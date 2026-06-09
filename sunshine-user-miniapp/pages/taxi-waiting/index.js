const { cancelOrder, fetchOrderDetail } = require('../../utils/api')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, syncOrderToCache } = require('../../utils/user-store')
const { ORDER_STATUS } = require('../../utils/constants')
const { redirectToOrderFlow } = require('../../utils/order-flow')
const { runExclusive, runGuarded } = require('../../utils/page')

const POLL_SECONDS = 3

Page({
  data: {
    order: null,
    countdown: POLL_SECONDS,
    orderId: ''
  },

  async onLoad(options) {
    this.setData({
      orderId: options.id || ''
    })

    const cachedOrder = findCachedOrder(this.data.orderId)
    if (cachedOrder) {
      this.applyOrderState(cachedOrder)
    }

    await this.syncOrderState(false).catch(() => {})
    this.startWaiting()
  },

  onShow() {
    if (!this.data.orderId) return
    this.syncOrderState(true).catch(() => {})
    this.startWaiting()
  },

  onUnload() {
    this.stopWaiting()
  },

  stopWaiting() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  applyOrderState(rawOrder) {
    if (!rawOrder) return

    const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(rawOrder, {
      carType: carTypeMap[rawOrder.carTypeId]
    })

    getApp().setCurrentRideOrder(order, {
      persist: false
    })

    this.setData({ order })
  },

  async syncOrderState(silent = true) {
    return runExclusive(this, '__syncOrderStatePromise', async () => {
      let rawOrder = null

      try {
        const response = await fetchOrderDetail(this.data.orderId, {
          skipToast: Boolean(silent)
        })
        rawOrder = syncOrderToCache(response.data)
      } catch (error) {
        rawOrder = findCachedOrder(this.data.orderId)
        if (!rawOrder) {
          throw error
        }

        if (!silent) {
          wx.showToast({
            title: '订单信息已恢复显示',
            icon: 'none'
          })
        }
      }

      if (redirectToOrderFlow(this.route, rawOrder)) {
        this.stopWaiting()
        return rawOrder
      }

      this.applyOrderState(rawOrder)
      return rawOrder
    })
  },

  startWaiting() {
    this.stopWaiting()
    this.setData({ countdown: POLL_SECONDS })

    this.timer = setInterval(() => {
      const nextCountdown = Math.max(this.data.countdown - 1, 0)
      this.setData({ countdown: nextCountdown })

      if (nextCountdown > 0) {
        return
      }

      this.setData({ countdown: POLL_SECONDS })
      runGuarded(this, '__polling', async () => {
        const rawOrder = await this.syncOrderState(true)

        if (!rawOrder) return

        if ([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(rawOrder.orderStatus)) {
          this.stopWaiting()
          redirectToOrderFlow(this.route, rawOrder)
          return
        }

        if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
          this.stopWaiting()
          wx.showToast({ title: '订单已取消', icon: 'none' })
          redirectToOrderFlow(this.route, rawOrder)
        }
      }).catch(() => {})
    }, 1000)
  },

  cancelOrder() {
    if (!this.data.order) return

    wx.showModal({
      title: '取消订单',
      content: this.data.order.cancelRule,
      success: async ({ confirm }) => {
        if (!confirm) return
        await cancelOrder(this.data.orderId, '乘客主动取消')
        this.stopWaiting()
        const nextOrder = await this.syncOrderState(true).catch(() => findCachedOrder(this.data.orderId))
        if (nextOrder && redirectToOrderFlow(this.route, nextOrder)) {
          return
        }
        getApp().setCurrentRideOrder(null)
        wx.switchTab({
          url: '/pages/home/index'
        })
      }
    })
  }
})
