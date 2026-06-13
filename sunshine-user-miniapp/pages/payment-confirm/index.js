const { fetchOrderDetail, mockPay } = require('../../utils/api')
const { ORDER_STATUS, PAY_STATUS } = require('../../utils/constants')
const { formatPrice } = require('../../utils/format')
const {
  buildRideOrderModel,
  findCachedOrder,
  getCarTypeMap,
  syncOrderToCache
} = require('../../utils/user-store')
const { navigateBackSilky, redirectToSilky } = require('../../utils/page')

function wait(duration = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function ensurePendingCouponStore() {
  const app = getApp()
  if (!app.globalData.pendingPaymentCouponMap) {
    app.globalData.pendingPaymentCouponMap = {}
  }
  return app.globalData.pendingPaymentCouponMap
}

function getOrderKeys(orderId, orderNo) {
  return [orderId, orderNo].filter((value, index, list) => {
    return value && list.findIndex((item) => `${item}` === `${value}`) === index
  }).map((value) => `${value}`)
}

function getPendingCouponContext(orderId, orderNo) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return null
  const store = ensurePendingCouponStore()
  const current = keys.map((key) => store[key]).find(Boolean)
  return current ? { ...current } : null
}

function clearPendingCouponContext(orderId, orderNo) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return
  const store = ensurePendingCouponStore()
  keys.forEach((key) => {
    delete store[key]
  })
}

function getOrderOriginalAmount(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return Math.max(0, toNumber(rawOrder.cancelFee, toNumber(rawOrder.payableAmount, 0)))
  }
  return toNumber(rawOrder.actualAmount, toNumber(rawOrder.estimatedAmount, toNumber(rawOrder.payableAmount)))
}

function canPayOrder(rawOrder = {}) {
  return rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID
}

function mergeOrderWithCouponContext(rawOrder, couponContext) {
  if (!couponContext) return rawOrder

  return {
    ...rawOrder,
    actualAmount: getOrderOriginalAmount(rawOrder),
    payableAmount: toNumber(couponContext.payableAmount, rawOrder.payableAmount),
    couponDiscount: toNumber(couponContext.couponDiscount, rawOrder.couponDiscount),
    userCouponId: couponContext.userCouponId || rawOrder.userCouponId || null,
    couponName: couponContext.couponName || rawOrder.couponName || '',
    couponRuleDesc: couponContext.couponRuleDesc || rawOrder.couponRuleDesc || ''
  }
}

Page({
  data: {
    order: null,
    selectedMethod: 'WECHAT',
    paymentMethods: [
      {
        key: 'WECHAT',
        name: '微信支付',
        desc: '推荐使用，流程更完整'
      },
      {
        key: 'BALANCE',
        name: '余额支付',
        desc: '使用账户余额完成支付'
      }
    ],
    confirmText: '确认支付',
    canPay: false,
    processing: false,
    loading: true,
    showSuccessPopup: false,
    successHint: ''
  },

  onLoad(options) {
    this.orderId = options.id || ''
    this.redirectTimer = null
    this.lastPaidOrder = null

    const cachedOrder = findCachedOrder(this.orderId)
    if (cachedOrder) {
      this.applyOrderState(cachedOrder)
    }

    this.loadOrder().catch(() => {})
  },

  onShow() {
    if (!this.orderId) return
    this.loadOrder(true).catch(() => {})
  },

  onUnload() {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer)
      this.redirectTimer = null
    }
  },

  async loadOrder(silent = false) {
    let rawOrder = null

    try {
      const response = await fetchOrderDetail(this.orderId, {
        skipToast: Boolean(silent)
      })
      rawOrder = syncOrderToCache(response.data)
    } catch (error) {
      if (!silent) {
        wx.showToast({
          title: '订单确认失败，请稍后重试',
          icon: 'none'
        })
      }
      throw error
    }

    this.applyOrderState(rawOrder)
  },

  applyOrderState(rawOrder) {
    if (!rawOrder) return

    const payable = canPayOrder(rawOrder)
    if (!payable) {
      clearPendingCouponContext(rawOrder.id, rawOrder.orderNo)
    }
    const couponContext = payable
      ? getPendingCouponContext(rawOrder.id, rawOrder.orderNo)
      : null
    const effectiveOrder = mergeOrderWithCouponContext(rawOrder, couponContext)
    const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(effectiveOrder, {
      carType: carTypeMap[effectiveOrder.carTypeId]
    })
    const amountText = formatPrice(
      effectiveOrder.orderStatus === ORDER_STATUS.CANCELLED
        ? getOrderOriginalAmount(effectiveOrder)
        : effectiveOrder.payableAmount !== undefined && effectiveOrder.payableAmount !== null
          ? effectiveOrder.payableAmount
          : (effectiveOrder.actualAmount || effectiveOrder.estimatedAmount),
      effectiveOrder.currencyCode
    )
    const hasPaid = effectiveOrder.payStatus === PAY_STATUS.PAID

    this.setData({
      order: {
        ...order,
        amountText,
        startDisplay: order.startName || (order.start && order.start.name) || '',
        endDisplay: order.endName || (order.end && order.end.name) || ''
      },
      confirmText: hasPaid ? '已完成支付' : payable ? `确认支付 ${amountText}` : '暂不可支付',
      canPay: payable,
      loading: false
    })

    if (!payable && !hasPaid) {
      wx.showToast({
        title: '订单完成后才可支付',
        icon: 'none'
      })
      if (!this.redirectTimer) {
        this.redirectTimer = setTimeout(() => {
          this.redirectToDetail(effectiveOrder)
        }, 600)
      }
    }
  },

  async waitForPaidOrder(orderId, maxAttempts = 4, interval = 800) {
    let latestOrder = null

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await wait(interval)
      try {
        const detailResponse = await fetchOrderDetail(orderId, {
          skipToast: true
        })
        latestOrder = syncOrderToCache(detailResponse.data)
        if (latestOrder && latestOrder.payStatus === PAY_STATUS.PAID) {
          return latestOrder
        }
      } catch (error) {
        latestOrder = findCachedOrder(orderId) || latestOrder
      }
    }

    return latestOrder
  },

  selectMethod(e) {
    if (this.data.processing || !this.data.order || !this.data.canPay || this.data.order.payStatus === PAY_STATUS.PAID) return
    this.setData({
      selectedMethod: e.currentTarget.dataset.key
    })
  },

  cancelPay() {
    if (this.data.processing) return

    if (this.data.order && this.data.order.payStatus === PAY_STATUS.PAID) {
      this.redirectToDetail(this.data.order)
      return
    }

    wx.showModal({
      title: '取消支付',
      content: '本次未完成支付，订单会继续保留为待支付状态。',
      confirmText: '返回订单',
      cancelText: '继续支付',
      success: (res) => {
        if (!res.confirm) return
        wx.showToast({
          title: '已取消支付',
          icon: 'none'
        })
        setTimeout(() => {
          this.redirectToDetail()
        }, 180)
      }
    })
  },

  async confirmPay() {
    if (this.data.processing || !this.data.order) return

    if (!this.data.canPay) {
      wx.showToast({
        title: '订单完成后才可支付',
        icon: 'none'
      })
      this.redirectToDetail(this.data.order)
      return
    }

    if (this.data.order.payStatus === PAY_STATUS.PAID) {
      wx.showToast({
        title: '该订单已完成支付',
        icon: 'none'
      })
      this.redirectToDetail(this.data.order)
      return
    }

    const couponContext = getPendingCouponContext(this.data.order.id, this.data.order.orderNo)

    this.setData({ processing: true })
    wx.showLoading({
      title: '支付处理中'
    })

    try {
      await wait(1000)

      let paidOrder = null

      try {
        const payResponse = await mockPay(this.data.order.id, {
          payChannel: this.data.selectedMethod,
          userCouponId: couponContext ? couponContext.userCouponId : null,
          couponDiscount: couponContext ? couponContext.couponDiscount : 0,
          payableAmount: couponContext ? couponContext.payableAmount : null,
          originalAmount: couponContext ? couponContext.originalAmount : null,
          skipToast: true
        })

        if (payResponse && payResponse.data && payResponse.data.id) {
          paidOrder = syncOrderToCache(mergeOrderWithCouponContext({
            ...payResponse.data,
            payChannel: payResponse.data.payChannel || this.data.selectedMethod
          }, couponContext))
        }

        if (!paidOrder || paidOrder.payStatus !== PAY_STATUS.PAID) {
          paidOrder = await this.waitForPaidOrder(this.data.order.id)
          if (paidOrder && paidOrder.payStatus === PAY_STATUS.PAID) {
            paidOrder = syncOrderToCache(mergeOrderWithCouponContext({
              ...paidOrder,
              payChannel: paidOrder.payChannel || this.data.selectedMethod
            }, couponContext))
          }
        }
      } catch (error) {
        paidOrder = null
      }

      if (!paidOrder || paidOrder.payStatus !== PAY_STATUS.PAID) {
        throw new Error('PAYMENT_NOT_CONFIRMED')
      }

      clearPendingCouponContext(this.data.order.id, this.data.order.orderNo)
      this.lastPaidOrder = paidOrder
      this.applyOrderState(paidOrder)

      wx.hideLoading()
      this.setData({
        processing: false,
        showSuccessPopup: true,
        successHint: '支付成功，正在返回订单详情。'
      })

      this.redirectTimer = setTimeout(() => {
        this.redirectToDetail(paidOrder)
      }, 2000)
    } catch (error) {
      wx.hideLoading()
      this.setData({ processing: false })
      wx.showModal({
        title: '支付失败',
        content: '支付未完成，当前订单仍保持待支付状态。',
        showCancel: false,
        complete: () => {
          this.redirectToDetail()
        }
      })
    }
  },

  redirectToDetail(order = this.lastPaidOrder) {
    const pages = getCurrentPages()
    const previousPage = pages[pages.length - 2]

    if (
      order &&
      previousPage &&
      previousPage.route === 'pages/order-detail/index' &&
      `${previousPage.orderId || ''}` === `${this.orderId}` &&
      typeof previousPage.applyRawOrder === 'function'
    ) {
      previousPage.applyRawOrder(order, {
        immediate: true
      })
      navigateBackSilky(this, {
        delta: 1,
        selector: '.payment-page'
      })
      return
    }

    redirectToSilky(this, {
      url: `/pages/order-detail/index?id=${this.orderId}`
    }, {
      selector: '.payment-page'
    })
  }
})
