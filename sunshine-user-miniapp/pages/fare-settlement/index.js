const { fetchCouponCenter, fetchMyCoupons, fetchOrderDetail } = require('../../utils/api')
const { COUPON_STATUS, ORDER_STATUS, PAY_STATUS, getOrderStatusMeta } = require('../../utils/constants')
const { formatPrice, parseDateValue } = require('../../utils/format')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, mergeCoupons, syncOrderToCache } = require('../../utils/user-store')
const { buildOrderFlowUrl } = require('../../utils/order-flow')

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

function setPendingCouponContext(orderId, orderNo, context) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return
  const store = ensurePendingCouponStore()
  if (!context) {
    keys.forEach((key) => {
      delete store[key]
    })
    return
  }
  keys.forEach((key) => {
    store[key] = { ...context }
  })
}

function clearPendingCouponContext(orderId, orderNo) {
  setPendingCouponContext(orderId, orderNo, null)
}

function getOrderOriginalAmount(rawOrder = {}) {
  return toNumber(rawOrder.actualAmount, toNumber(rawOrder.estimatedAmount, toNumber(rawOrder.payableAmount)))
}

function getCouponDiscountAmount(coupon, amount) {
  const totalAmount = Math.max(0, toNumber(amount))
  if (!coupon) return 0
  if (coupon.discount) {
    return Number((totalAmount * (1 - toNumber(coupon.amount, 1))).toFixed(2))
  }
  return Number(Math.min(toNumber(coupon.amount), totalAmount).toFixed(2))
}

function buildCouponRuleText(coupon, currencyCode) {
  if (coupon.ruleDesc) return coupon.ruleDesc
  const thresholdText = toNumber(coupon.minAmount) > 0
    ? `满 ${formatPrice(coupon.minAmount, currencyCode)} 可用`
    : '无门槛可用'
  const validityText = coupon.validDate ? `${coupon.validDate} 前有效` : ''
  return [thresholdText, validityText].filter(Boolean).join(' · ')
}

function getCouponUnavailableReason(coupon, rawOrder, originalAmount) {
  const rawStatus = `${coupon.rawStatus || ''}`.toUpperCase()
  const status = `${coupon.status || ''}`.toLowerCase()

  if (rawStatus === COUPON_STATUS.USED || status === 'used') {
    return '已使用'
  }
  if (rawStatus === COUPON_STATUS.EXPIRED || status === 'expired') {
    return '已过期'
  }

  const validDate = parseDateValue(coupon.validDate)
  if (validDate && validDate.getTime() < Date.now()) {
    return '已过期'
  }

  const scopeCode = coupon.scopeCode || 'ALL'
  if (scopeCode !== 'ALL' && scopeCode !== rawOrder.serviceType) {
    return '不支持该业务'
  }

  if (originalAmount < toNumber(coupon.minAmount)) {
    return '未满足门槛'
  }

  return ''
}

function buildCouponOption(coupon, rawOrder) {
  const currencyCode = rawOrder.currencyCode || 'CNY'
  const originalAmount = getOrderOriginalAmount(rawOrder)
  const discountAmount = getCouponDiscountAmount(coupon, originalAmount)

  return {
    ...coupon,
    userCouponIdText: `${coupon.userCouponId || coupon.id || ''}`,
    discountAmount,
    discountAmountText: formatPrice(discountAmount, currencyCode),
    faceValueText: coupon.discount
      ? `${Math.round(toNumber(coupon.amount, 1) * 10)}折`
      : formatPrice(toNumber(coupon.amount), currencyCode),
    ruleText: buildCouponRuleText(coupon, currencyCode),
    validText: coupon.validDate ? `${coupon.validDate} 前有效` : ''
  }
}

function buildCouponGroups(rawOrder, coupons = []) {
  const originalAmount = getOrderOriginalAmount(rawOrder)
  const result = {
    available: [],
    unavailable: []
  }

  ;(coupons || []).forEach((item) => {
    const coupon = buildCouponOption(item, rawOrder)
    const unavailableReason = getCouponUnavailableReason(coupon, rawOrder, originalAmount)
    if (unavailableReason) {
      result.unavailable.push({
        ...coupon,
        unavailableReason
      })
      return
    }
    result.available.push(coupon)
  })

  result.available.sort((left, right) => right.discountAmount - left.discountAmount)
  return result
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
    estimateView: null,
    couponHint: '可在本页选择优惠券后再支付',
    summaryTitle: '行程已结束',
    summaryDesc: '',
    statusTagText: '待支付',
    statusTagClass: 'status-accent',
    primaryButtonText: '查看订单',
    canPay: false,
    availableCoupons: [],
    unavailableCoupons: [],
    couponSummaryText: '',
    couponActionDisabled: true,
    selectedCouponId: '',
    showDiscountPrice: false,
    couponModalVisible: false,
    activeCouponTab: 'available'
  },

  onLoad(options) {
    const currentRideOrder = getApp().globalData.userStore.currentRideOrder || {}
    const fallbackOrderId = currentRideOrder.orderStatus === ORDER_STATUS.FINISHED && currentRideOrder.payStatus === PAY_STATUS.UNPAID
      ? currentRideOrder.id
      : ''
    this.orderId = options.id || fallbackOrderId || ''
    this.rawOrder = null
    this.couponList = getApp().globalData.userStore.coupons || []
    const cachedOrder = findCachedOrder(this.orderId)

    if (cachedOrder) {
      this.applyOrderState(cachedOrder)
    }

    this.loadOrder(this.orderId, false).catch(() => {})
  },

  onShow() {
    if (!this.orderId) return
    this.loadOrder(this.orderId, true).catch(() => {})
  },

  async refreshCoupons() {
    const [mineResponse, centerResponse] = await Promise.all([
      fetchMyCoupons(),
      fetchCouponCenter()
    ])
    const coupons = mergeCoupons(mineResponse.data || [], centerResponse.data || [])
    const app = getApp()
    app.globalData.userStore.coupons = coupons
    app.globalData.userStore.couponCenter = centerResponse.data || []
    app.saveUserStore()
    this.couponList = coupons
    return coupons
  },

  async loadOrder(orderId, silent = true) {
    let rawOrder = null

    try {
      const response = await fetchOrderDetail(orderId, {
        skipToast: true
      })
      rawOrder = syncOrderToCache(response.data)
    } catch (error) {
      rawOrder = findCachedOrder(orderId)
      if (!rawOrder) {
        throw error
      }
      if (!silent) {
        wx.showToast({
          title: '结算信息已恢复显示',
          icon: 'none'
        })
      }
    }

    if (rawOrder && rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID) {
      try {
        await this.refreshCoupons()
      } catch (error) {
        this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
      }
    }

    this.applyOrderState(rawOrder)
  },

  applyOrderState(rawOrder) {
    if (!rawOrder) return

    const canPay = rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID
    if (!canPay) {
      clearPendingCouponContext(rawOrder.id, rawOrder.orderNo)
      const targetUrl = buildOrderFlowUrl(rawOrder)
      if (targetUrl && targetUrl !== `/pages/fare-settlement/index?id=${rawOrder.id}`) {
        wx.redirectTo({ url: targetUrl })
        return
      }
    }

    const couponGroups = canPay ? buildCouponGroups(rawOrder, this.couponList || []) : { available: [], unavailable: [] }
    const pendingCoupon = canPay ? getPendingCouponContext(rawOrder.id, rawOrder.orderNo) : null
    let selectedCoupon = pendingCoupon
      ? couponGroups.available.find((item) => item.userCouponIdText === `${pendingCoupon.userCouponId || ''}`) || null
      : null

    if (pendingCoupon && !selectedCoupon) {
      clearPendingCouponContext(rawOrder.id, rawOrder.orderNo)
    }

    const originalAmount = getOrderOriginalAmount(rawOrder)
    const discountAmount = selectedCoupon ? selectedCoupon.discountAmount : 0
    const couponContext = selectedCoupon
      ? {
          userCouponId: selectedCoupon.userCouponIdText,
          couponDiscount: discountAmount,
          payableAmount: Math.max(0, Number((originalAmount - discountAmount).toFixed(2))),
          originalAmount,
          couponName: selectedCoupon.name,
          couponRuleDesc: selectedCoupon.ruleText
        }
      : null
    const effectiveOrder = mergeOrderWithCouponContext(rawOrder, couponContext)
    const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(effectiveOrder, {
      carType: carTypeMap[effectiveOrder.carTypeId]
    })
    const statusMeta = getOrderStatusMeta(rawOrder.orderStatus, rawOrder.payStatus)
    const isPaid = rawOrder.payStatus === PAY_STATUS.PAID
    const isCancelled = rawOrder.orderStatus === ORDER_STATUS.CANCELLED
    const couponSummaryText = !couponGroups.available.length
      ? '暂无可用优惠券'
      : selectedCoupon
        ? `已选 ${selectedCoupon.name}`
        : `可用 ${couponGroups.available.length} 张`

    this.rawOrder = rawOrder
    order.coupon = selectedCoupon || order.coupon || null

    getApp().setCurrentRideOrder(order, {
      persist: false
    })

    this.setData({
      order: {
        ...order,
        amountText: formatPrice(order.fee.payable, order.fee.currencyCode),
        originalAmountText: formatPrice(originalAmount, order.fee.currencyCode),
        startDisplay: order.startName || (order.start && order.start.name) || '',
        endDisplay: order.endName || (order.end && order.end.name) || ''
      },
      estimateView: this.buildEstimateView(order.fee),
      couponHint: selectedCoupon
        ? `${selectedCoupon.name} 已抵扣 ${selectedCoupon.discountAmountText}`
        : canPay
          ? couponSummaryText
          : '当前订单无需选择优惠券',
      summaryTitle: canPay ? '行程已结束' : isPaid ? '订单已支付' : isCancelled ? '订单已取消' : '订单状态已更新',
      summaryDesc: canPay
        ? '费用明细已生成，可先选择优惠券，再点击下方按钮进入支付确认。'
        : isPaid
          ? '本单已完成支付，可直接查看订单详情或后续发票入口。'
          : isCancelled
            ? '订单已取消，当前无需继续支付。'
            : '当前订单暂不可支付，可先返回订单详情查看最新状态。',
      statusTagText: statusMeta.label,
      statusTagClass: canPay ? 'status-accent' : isPaid ? 'status-success' : 'status-muted',
      primaryButtonText: canPay ? `去支付 ${formatPrice(order.fee.payable, order.fee.currencyCode)}` : '查看订单',
      canPay,
      availableCoupons: couponGroups.available,
      unavailableCoupons: couponGroups.unavailable,
      couponSummaryText,
      couponActionDisabled: !canPay || !couponGroups.available.length,
      selectedCouponId: selectedCoupon ? selectedCoupon.userCouponIdText : '',
      showDiscountPrice: discountAmount > 0,
      couponModalVisible: canPay ? this.data.couponModalVisible : false
    })
  },

  buildEstimateView(estimate) {
    return {
      payableText: formatPrice(estimate.payable, estimate.currencyCode),
      startFeeText: formatPrice(estimate.breakdown.startFee, estimate.currencyCode),
      distanceFeeText: formatPrice(estimate.breakdown.distanceFee, estimate.currencyCode),
      durationFeeText: formatPrice(estimate.breakdown.durationFee, estimate.currencyCode),
      longDistanceFeeText: formatPrice(estimate.breakdown.longDistanceFee, estimate.currencyCode),
      nightFeeText: formatPrice(estimate.breakdown.nightFee, estimate.currencyCode),
      couponDiscountText: formatPrice(estimate.breakdown.couponDiscount, estimate.currencyCode)
    }
  },

  async openCouponPicker() {
    if (!this.rawOrder || this.data.couponActionDisabled || !this.data.canPay) return

    try {
      await this.refreshCoupons()
    } catch (error) {
      this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
    }

    this.applyOrderState(this.rawOrder)
    if (this.data.couponActionDisabled) return

    this.setData({
      couponModalVisible: true,
      activeCouponTab: 'available'
    })
  },

  closeCouponPicker() {
    this.setData({
      couponModalVisible: false
    })
  },

  switchCouponTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.activeCouponTab) return
    this.setData({
      activeCouponTab: tab
    })
  },

  chooseCoupon(e) {
    if (!this.rawOrder) return

    const couponId = `${e.currentTarget.dataset.id || ''}`
    const selectedCoupon = (this.data.availableCoupons || []).find((item) => item.userCouponIdText === couponId)
    if (!selectedCoupon) return

    const originalAmount = getOrderOriginalAmount(this.rawOrder)
    setPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo, {
      userCouponId: selectedCoupon.userCouponIdText,
      couponDiscount: selectedCoupon.discountAmount,
      payableAmount: Math.max(0, Number((originalAmount - selectedCoupon.discountAmount).toFixed(2))),
      originalAmount,
      couponName: selectedCoupon.name,
      couponRuleDesc: selectedCoupon.ruleText
    })

    this.setData({
      couponModalVisible: false
    })
    this.applyOrderState(this.rawOrder)
  },

  clearCouponSelection() {
    if (!this.rawOrder) return
    clearPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo)
    this.setData({
      couponModalVisible: false
    })
    this.applyOrderState(this.rawOrder)
  },

  goPrimaryAction() {
    if (!this.data.order) return

    if (this.data.canPay) {
      wx.navigateTo({
        url: `/pages/payment-confirm/index?id=${this.data.order.id}`
      })
      return
    }

    this.goToDetail()
  },

  goToDetail() {
    if (!this.data.order) return
    wx.redirectTo({
      url: `/pages/order-detail/index?id=${this.data.order.id}`
    })
  }
})
