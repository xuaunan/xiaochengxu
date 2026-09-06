const { cancelOrder, fetchOrderDetail } = require('../../utils/api')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, syncOrderToCache } = require('../../utils/user-store')
const { ORDER_STATUS } = require('../../utils/constants')
const { redirectToOrderFlow } = require('../../utils/order-flow')
const { runExclusive, runGuarded, switchTabSilky } = require('../../utils/page')

const POLL_INTERVAL_MS = 3000
const ESTIMATED_WAIT_MINUTES = 3
const MINUTE_MS = 60 * 1000

function parseOrderTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = `${value}`.trim()
  if (!text) return 0
  const timestamp = Date.parse(text.includes('T') ? text : text.replace(/-/g, '/'))
  return Number.isFinite(timestamp) ? timestamp : 0
}

Page({
  data: {
    order: null,
    remainingMinutes: ESTIMATED_WAIT_MINUTES,
    estimateTitle: `预估${ESTIMATED_WAIT_MINUTES}分钟有车主接单`,
    estimateHint: '订单已发送给附近司机，请耐心等待',
    expandedSearch: false,
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

  onHide() {
    this.stopWaiting()
  },

  onUnload() {
    this.stopWaiting()
  },

  stopWaiting() {
    if (this.estimateTimer) {
      clearInterval(this.estimateTimer)
      this.estimateTimer = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  },

  applyOrderState(rawOrder) {
    if (!rawOrder) return

    if (!this.waitingStartedAt) {
      this.waitingStartedAt = parseOrderTime(rawOrder.createdAt || rawOrder.orderTime) || Date.now()
    }

    const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(rawOrder, {
      carType: carTypeMap[rawOrder.carTypeId]
    })

    getApp().setCurrentRideOrder(order, {
      persist: false
    })

    this.setData({ order })
    this.updateEstimateState()
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
    if (!this.waitingStartedAt) {
      this.waitingStartedAt = Date.now()
    }
    this.updateEstimateState()
    this.estimateTimer = setInterval(() => {
      this.updateEstimateState()
    }, 1000)
    this.pollTimer = setInterval(() => {
      this.pollOrderState()
    }, POLL_INTERVAL_MS)
  },

  updateEstimateState() {
    const startedAt = this.waitingStartedAt || Date.now()
    const elapsedMinutes = Math.floor(Math.max(0, Date.now() - startedAt) / MINUTE_MS)
    const remainingMinutes = Math.max(ESTIMATED_WAIT_MINUTES - elapsedMinutes, 0)
    const expandedSearch = remainingMinutes === 0

    this.setData({
      remainingMinutes,
      expandedSearch,
      estimateTitle: expandedSearch
        ? '正在扩大范围寻找司机中...'
        : `预估${remainingMinutes}分钟有车主接单`,
      estimateHint: expandedSearch
        ? '我们正在通知更远范围内的司机，请再耐心等一会儿'
        : '订单已发送给附近司机，请耐心等待'
    })

    if (expandedSearch) {
      this.showExpandedSearchNotice()
    }
  },

  showExpandedSearchNotice() {
    if (this.expansionNoticeShown) return
    const noticeKey = `taxi-waiting-expanded:${this.data.orderId}`
    if (wx.getStorageSync(noticeKey)) {
      this.expansionNoticeShown = true
      return
    }

    this.expansionNoticeShown = true
    wx.setStorageSync(noticeKey, true)
    wx.showModal({
      title: '正在继续为你寻找司机',
      content: '附近司机可能正忙，请别着急。我们已经扩大寻找范围，会持续为你匹配合适的司机。',
      showCancel: false,
      confirmText: '继续等待',
      confirmColor: '#ff7a00'
    })
  },

  pollOrderState() {
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
        switchTabSilky(this, {
          url: '/pages/home/index'
        })
      }
    })
  }
})
