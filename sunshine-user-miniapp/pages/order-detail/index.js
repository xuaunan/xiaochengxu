const { fetchCouponCenter, fetchMyCoupons, fetchOrderDetail, fetchOrderRuntime, fetchOrders } = require('../../utils/api')
const { formatPrice, parseDateValue } = require('../../utils/format')
const { COUPON_STATUS, ORDER_STATUS, PAY_STATUS, getPayStatusLabel, getServiceLabel } = require('../../utils/constants')
const { runExclusive, runGuarded } = require('../../utils/page')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const {
  buildOrderTimelineSteps,
  buildRideOrderModel,
  findCachedOrder,
  getCarTypeMap,
  mergeCoupons,
  syncOrdersToCache,
  syncOrderToCache
} = require('../../utils/user-store')

const PRICE_ANIMATION_FRAME_TOTAL = 12
const PRICE_ANIMATION_FRAME_DELAY = 18
const DETAIL_SYNC_INTERVAL = 5000
const ORDER_STAGE_MAP = {
  [ORDER_STATUS.CREATED]: 0,
  [ORDER_STATUS.DISPATCHING]: 1,
  [ORDER_STATUS.ACCEPTED]: 2,
  [ORDER_STATUS.PICKING_UP]: 3,
  [ORDER_STATUS.IN_TRIP]: 4,
  [ORDER_STATUS.FINISHED]: 5,
  [ORDER_STATUS.CANCELLED]: -1
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function getOrderStage(order = {}) {
  if (!order || !order.orderStatus) return -1
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID) {
    return 6
  }
  return ORDER_STAGE_MAP[order.orderStatus] !== undefined ? ORDER_STAGE_MAP[order.orderStatus] : -1
}

function mergeOrderFields(base = {}, patch = {}) {
  const next = {
    ...base
  }

  Object.keys(patch || {}).forEach((key) => {
    if (hasMeaningfulValue(patch[key])) {
      next[key] = patch[key]
    }
  })

  return next
}

function mergeMissingOrderFields(base = {}, patch = {}) {
  const next = {
    ...base
  }

  Object.keys(patch || {}).forEach((key) => {
    if (!hasMeaningfulValue(next[key]) && hasMeaningfulValue(patch[key])) {
      next[key] = patch[key]
    }
  })

  return next
}

function shouldPreferCandidate(base = {}, candidate = {}) {
  if (!candidate || !candidate.orderStatus) return false
  if (!base || !base.orderStatus) return true

  if (candidate.payStatus === PAY_STATUS.PAID && base.payStatus !== PAY_STATUS.PAID) {
    return true
  }

  const baseStage = getOrderStage(base)
  const candidateStage = getOrderStage(candidate)

  if (base.orderStatus === ORDER_STATUS.CANCELLED && candidate.orderStatus !== ORDER_STATUS.CANCELLED) {
    return candidateStage >= 0
  }

  if (base.orderStatus === ORDER_STATUS.FINISHED && candidateStage >= ORDER_STAGE_MAP[ORDER_STATUS.ACCEPTED] && candidateStage < ORDER_STAGE_MAP[ORDER_STATUS.FINISHED]) {
    return true
  }

  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(base.orderStatus) && candidateStage > baseStage) {
    return true
  }

  if (candidate.orderStatus === ORDER_STATUS.IN_TRIP && base.orderStatus !== ORDER_STATUS.IN_TRIP) {
    return true
  }

  if (candidateStage > baseStage && candidateStage <= ORDER_STAGE_MAP[ORDER_STATUS.FINISHED]) {
    return true
  }

  return false
}

function findMatchingOrderSnapshot(orderId, orderNo, orders = []) {
  return (orders || []).find((item) => {
    if (!item) return false
    return `${item.id || ''}` === `${orderId || ''}` || `${item.orderNo || ''}` === `${orderNo || ''}`
  }) || null
}

function buildRuntimeOrderPatch(runtime = {}, currentOrder = {}) {
  const phase = `${runtime.phase || ''}`.toLowerCase()
  if (!phase) return null

  if (currentOrder.orderStatus === ORDER_STATUS.FINISHED) {
    return {
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (currentOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return {
      orderStatus: ORDER_STATUS.CANCELLED,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (phase === 'trip') {
    return {
      orderStatus: ORDER_STATUS.IN_TRIP,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (phase === 'approach') {
    return {
      orderStatus: currentOrder.orderStatus === ORDER_STATUS.ACCEPTED ? ORDER_STATUS.ACCEPTED : ORDER_STATUS.PICKING_UP,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  return null
}

function reconcileLiveOrder(detailOrder, listOrder, cachedOrder, runtime) {
  let effectiveOrder = detailOrder || listOrder || cachedOrder || null
  if (!effectiveOrder) return null

  ;[listOrder, cachedOrder].forEach((candidate) => {
    if (!candidate) return
    effectiveOrder = shouldPreferCandidate(effectiveOrder, candidate)
      ? mergeOrderFields(effectiveOrder, candidate)
      : mergeMissingOrderFields(effectiveOrder, candidate)
  })

  const runtimePatch = buildRuntimeOrderPatch(runtime, effectiveOrder)
  if (runtimePatch) {
    effectiveOrder = shouldPreferCandidate(effectiveOrder, runtimePatch)
      ? mergeOrderFields(effectiveOrder, runtimePatch)
      : mergeMissingOrderFields(effectiveOrder, runtimePatch)
  }

  return syncOrderToCache(effectiveOrder)
}

function getCarTypeMapFromStore() {
  return getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
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

function getOrderPayableAmount(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return Math.max(0, toNumber(rawOrder.cancelFee, toNumber(rawOrder.payableAmount, 0)))
  }
  return Math.max(0, toNumber(rawOrder.payableAmount, getOrderOriginalAmount(rawOrder)))
}

function hasPendingPayment(rawOrder = {}) {
  return rawOrder.payStatus === PAY_STATUS.UNPAID && getOrderPayableAmount(rawOrder) > 0
}

function canUseCouponForOrder(rawOrder = {}) {
  return rawOrder.orderStatus === ORDER_STATUS.FINISHED && hasPendingPayment(rawOrder)
}

function getAmountCaption(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return hasPendingPayment(rawOrder) ? '取消费用待支付' : '取消费用'
  }
  return '订单总金额'
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
    ? `满${formatPrice(coupon.minAmount, currencyCode)}可用`
    : '无门槛可用'
  const validityText = coupon.validDate ? `${coupon.validDate}前有效` : ''
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
    return '不支持该业务类型'
  }

  if (originalAmount < toNumber(coupon.minAmount)) {
    return '未满足满减门槛'
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

function buildAppliedCoupon(rawOrder, coupons = []) {
  const discountAmount = toNumber(rawOrder.couponDiscount)
  if (discountAmount <= 0) return null

  const matchedCoupon = (coupons || []).find((item) => {
    return `${item.userCouponId || item.id || ''}` === `${rawOrder.userCouponId || ''}`
  })
  const currencyCode = rawOrder.currencyCode || 'CNY'

  return {
    userCouponIdText: `${rawOrder.userCouponId || ''}`,
    name: rawOrder.couponName || (matchedCoupon && matchedCoupon.name) || '优惠券',
    discountAmount,
    discountAmountText: formatPrice(discountAmount, currencyCode),
    ruleText: rawOrder.couponRuleDesc || (matchedCoupon && buildCouponRuleText(matchedCoupon, currencyCode)) || ''
  }
}

function buildDetailViewState(rawOrder, coupons = []) {
  const detail = buildRideOrderModel(rawOrder, {
    carType: getCarTypeMapFromStore()[rawOrder.carTypeId]
  })
  const currencyCode = rawOrder.currencyCode || 'CNY'
  const originalAmountValue = getOrderOriginalAmount(rawOrder)
  const showPayBar = hasPendingPayment(rawOrder)
  const allowCoupon = canUseCouponForOrder(rawOrder)
  const couponGroups = allowCoupon ? buildCouponGroups(rawOrder, coupons) : { available: [], unavailable: [] }

  let selectedCoupon = null
  if (showPayBar) {
    const pendingCoupon = getPendingCouponContext(rawOrder.id, rawOrder.orderNo)
    if (pendingCoupon) {
      selectedCoupon = couponGroups.available.find((item) => item.userCouponIdText === `${pendingCoupon.userCouponId || ''}`) || null
      if (!selectedCoupon) {
        clearPendingCouponContext(rawOrder.id, rawOrder.orderNo)
      }
    }
  } else {
    clearPendingCouponContext(rawOrder.id, rawOrder.orderNo)
  }

  const paidCoupon = rawOrder.payStatus === PAY_STATUS.PAID ? buildAppliedCoupon(rawOrder, coupons) : null
  const effectiveCoupon = selectedCoupon || paidCoupon
  const discountAmount = rawOrder.payStatus === PAY_STATUS.PAID
    ? toNumber(rawOrder.couponDiscount)
    : toNumber(selectedCoupon && selectedCoupon.discountAmount)
  const payableAmountValue = rawOrder.orderStatus === ORDER_STATUS.CANCELLED
    ? getOrderPayableAmount(rawOrder)
    : rawOrder.payStatus === PAY_STATUS.PAID
    ? getOrderPayableAmount(rawOrder)
    : Math.max(0, Number((originalAmountValue - discountAmount).toFixed(2)))
  const showDiscountPrice = discountAmount > 0 && payableAmountValue < originalAmountValue
  const payableAmountText = formatPrice(payableAmountValue, currencyCode)
  const originalAmountText = formatPrice(originalAmountValue, currencyCode)
  const couponSummaryText = !couponGroups.available.length
    ? '暂无可用优惠券'
    : selectedCoupon
      ? `已选${selectedCoupon.name}`
      : `可用${couponGroups.available.length}张`

  const detailState = {
    ...detail,
    amountText: payableAmountText,
    amountCaption: getAmountCaption(rawOrder),
    originalAmountText,
    payableAmountText,
    couponDiscountText: formatPrice(discountAmount, currencyCode),
    showDiscountPrice,
    showPaidCouponInfo: rawOrder.payStatus === PAY_STATUS.PAID && discountAmount > 0,
    appliedCouponName: rawOrder.payStatus === PAY_STATUS.PAID && effectiveCoupon ? effectiveCoupon.name : '',
    appliedCouponDiscountText: rawOrder.payStatus === PAY_STATUS.PAID && effectiveCoupon ? effectiveCoupon.discountAmountText : '',
    serviceTypeText: getServiceLabel(rawOrder.serviceType),
    payStatusText: getPayStatusLabel(rawOrder.payStatus),
    startDisplay: detail.startName || (detail.start && detail.start.name) || '',
    endDisplay: detail.endName || (detail.end && detail.end.name) || '',
    remarkText: detail.remarkText || '',
    carpoolMeta: detail.carpoolMeta || null
  }

  return {
    detail: detailState,
    timelineSteps: buildOrderTimelineSteps(rawOrder),
    showPayBar,
    payButtonText: `立即支付 ${payableAmountText}`,
    paymentSceneText: rawOrder.orderStatus === ORDER_STATUS.CANCELLED ? '取消费待支付' : '行程费待支付',
    availableCoupons: couponGroups.available,
    unavailableCoupons: couponGroups.unavailable,
    availableCouponCount: couponGroups.available.length,
    couponSummaryText: allowCoupon ? couponSummaryText : '取消费不使用优惠券',
    couponActionDisabled: !allowCoupon || !couponGroups.available.length,
    allowCoupon,
    selectedCouponId: selectedCoupon ? selectedCoupon.userCouponIdText : '',
    payableAmountValue,
    payableAmountText,
    currencyCode,
    loading: false
  }
}

Page({
  data: {
    detail: null,
    timelineSteps: [],
    showPayBar: false,
    payButtonText: '',
    paymentSceneText: '',
    loading: true,
    displayedPayableAmountValue: 0,
    displayedPayableAmountText: '',
    availableCoupons: [],
    unavailableCoupons: [],
    availableCouponCount: 0,
    couponSummaryText: '',
    couponActionDisabled: true,
    allowCoupon: false,
    selectedCouponId: '',
    couponModalVisible: false,
    activeCouponTab: 'available',
    timelineExpanded: false,
    timelineSummary: null
  },

  onLoad(options) {
    this.orderId = options.id || ''
    this.hasShownAfterLoad = false
    this.priceAnimationTimer = null
    this.timer = null
    this.rawOrder = null
    this.couponList = getApp().globalData.userStore.coupons || []

    const cachedOrder = findCachedOrder(this.orderId)
    if (cachedOrder) {
      this.applyRawOrder(cachedOrder, {
        immediate: true
      })
    }

    this.refreshDetail().catch(() => {})
  },

  onShow() {
    if (!this.orderId) return

    if (!this.hasShownAfterLoad) {
      this.hasShownAfterLoad = true
      this.startPolling()
      return
    }

    this.refreshDetail(true).catch(() => {})
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
    this.clearPriceAnimationTimer()
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  startPolling() {
    this.stopPolling()

    this.timer = setInterval(() => {
      runGuarded(this, '__detailPolling', async () => {
        await this.refreshDetail(true)
      }).catch(() => {})
    }, DETAIL_SYNC_INTERVAL)
  },

  clearPriceAnimationTimer() {
    if (this.priceAnimationTimer) {
      clearInterval(this.priceAnimationTimer)
      this.priceAnimationTimer = null
    }
  },

  updateDisplayedPayAmount(targetValue, currencyCode, immediate = false) {
    const finalValue = Math.max(0, toNumber(targetValue))
    const finalText = formatPrice(finalValue, currencyCode)

    this.clearPriceAnimationTimer()

    if (immediate) {
      this.setData({
        displayedPayableAmountValue: finalValue,
        displayedPayableAmountText: finalText,
        payButtonText: `立即支付 ${finalText}`
      })
      return
    }

    const startValue = toNumber(this.data.displayedPayableAmountValue, finalValue)
    if (Math.abs(startValue - finalValue) < 0.01) {
      this.setData({
        displayedPayableAmountValue: finalValue,
        displayedPayableAmountText: finalText,
        payButtonText: `立即支付 ${finalText}`
      })
      return
    }

    let frame = 0
    this.priceAnimationTimer = setInterval(() => {
      frame += 1
      const progress = frame / PRICE_ANIMATION_FRAME_TOTAL
      const currentValue = startValue + (finalValue - startValue) * progress
      const currentText = formatPrice(currentValue, currencyCode)
      this.setData({
        displayedPayableAmountValue: Number(currentValue.toFixed(2)),
        displayedPayableAmountText: currentText,
        payButtonText: `立即支付 ${currentText}`
      })

      if (frame >= PRICE_ANIMATION_FRAME_TOTAL) {
        this.clearPriceAnimationTimer()
        this.setData({
          displayedPayableAmountValue: finalValue,
          displayedPayableAmountText: finalText,
          payButtonText: `立即支付 ${finalText}`
        })
      }
    }, PRICE_ANIMATION_FRAME_DELAY)
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

  async refreshDetail(silent = false) {
    return runExclusive(this, '__refreshDetailPromise', async () => {
      const cachedOrder = findCachedOrder(this.orderId)
      let rawOrder = null

      const [detailResult, runtimeResult, ordersResult] = await Promise.allSettled([
        fetchOrderDetail(this.orderId, {
          skipToast: true
        }),
        fetchOrderRuntime(this.orderId, {
          skipToast: true
        }),
        fetchOrders()
      ])

      const detailOrder = detailResult.status === 'fulfilled'
        ? detailResult.value.data
        : null
      const runtime = runtimeResult.status === 'fulfilled'
        ? (runtimeResult.value.data || runtimeResult.value)
        : null
      const syncedOrders = ordersResult.status === 'fulfilled'
        ? syncOrdersToCache(ordersResult.value.data || [])
        : []
      const listOrder = findMatchingOrderSnapshot(
        this.orderId,
        (detailOrder && detailOrder.orderNo) || (cachedOrder && cachedOrder.orderNo),
        syncedOrders
      )

      rawOrder = reconcileLiveOrder(detailOrder, listOrder, cachedOrder, runtime)
      if (!rawOrder) {
        const failure = detailResult.status === 'rejected'
          ? detailResult.reason
          : runtimeResult.status === 'rejected'
            ? runtimeResult.reason
            : ordersResult.status === 'rejected'
              ? ordersResult.reason
              : null
        if (failure) {
          throw failure
        }
        throw new Error('ORDER_DETAIL_SYNC_FAILED')
      }

      if (!detailOrder && !listOrder && !silent) {
        wx.showToast({
          title: '宸插垏鎹负鏈湴璁㈠崟婕旂ず鏁版嵁',
          icon: 'none'
        })
      }

      if (false && rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID) {

        if (!silent) {
          wx.showToast({
            title: '已切换为本地订单演示数据',
            icon: 'none'
          })
        }
      }

      if (canUseCouponForOrder(rawOrder)) {
        try {
          await this.refreshCoupons()
        } catch (error) {
          this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
        }
      }

      this.applyRawOrder(rawOrder, {
        immediate: !this.data.detail
      })
    })
  },

  applyRawOrder(rawOrder, options = {}) {
    if (!rawOrder) return

    const targetUrl = buildOrderFlowUrl(rawOrder)
    if (targetUrl && targetUrl !== `/pages/order-detail/index?id=${rawOrder.id}`) {
      wx.redirectTo({
        url: targetUrl
      })
      return
    }

    this.rawOrder = rawOrder
    const viewState = buildDetailViewState(rawOrder, this.couponList || [])

    this.setData({
      detail: viewState.detail,
      timelineSteps: viewState.timelineSteps,
      timelineSummary: this.getTimelineSummary(viewState.timelineSteps),
      showPayBar: viewState.showPayBar,
      availableCoupons: viewState.availableCoupons,
      unavailableCoupons: viewState.unavailableCoupons,
      availableCouponCount: viewState.availableCouponCount,
      couponSummaryText: viewState.couponSummaryText,
      couponActionDisabled: viewState.couponActionDisabled,
      allowCoupon: viewState.allowCoupon,
      paymentSceneText: viewState.paymentSceneText,
      selectedCouponId: viewState.selectedCouponId,
      couponModalVisible: viewState.showPayBar ? this.data.couponModalVisible : false,
      activeCouponTab: this.data.activeCouponTab || 'available',
      loading: false
    })

    this.updateDisplayedPayAmount(viewState.payableAmountValue, viewState.currencyCode, Boolean(options.immediate))
    getApp().setCurrentRideOrder(viewState.detail, {
      persist: false
    })
  },

  getTimelineSummary(steps = []) {
    const current = (steps || []).find((item) => item.state === 'current')
    return current || (steps || []).filter((item) => item.state !== 'upcoming').slice(-1)[0] || (steps || [])[0] || null
  },

  toggleTimeline() {
    this.setData({
      timelineExpanded: !this.data.timelineExpanded
    })
  },

  gotoComplaint() {
    if (!this.data.detail) return
    wx.navigateTo({ url: `/pages/complaint/index?id=${this.data.detail.id}` })
  },

  gotoInvoice() {
    wx.navigateTo({ url: '/pages/invoice/index' })
  },

  applyRefund() {
    wx.showModal({
      title: '退款说明',
      content: '演示环境下退款走模拟售后流程，提交投诉后可在后台演示退款处理，当前订单状态不会被直接修改。',
      showCancel: false
    })
  },

  async openCouponPicker() {
    if (!this.rawOrder || !this.data.allowCoupon || this.data.couponActionDisabled || !this.data.showPayBar) return

    try {
      await this.refreshCoupons()
      this.applyRawOrder(this.rawOrder, {
        immediate: true
      })
    } catch (error) {
      this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
      this.applyRawOrder(this.rawOrder, {
        immediate: true
      })
    }

    if (this.data.couponActionDisabled) {
      return
    }

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

    setPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo, {
      userCouponId: selectedCoupon.userCouponIdText,
      couponDiscount: selectedCoupon.discountAmount,
      payableAmount: Math.max(0, Number((getOrderOriginalAmount(this.rawOrder) - selectedCoupon.discountAmount).toFixed(2))),
      originalAmount: getOrderOriginalAmount(this.rawOrder),
      couponName: selectedCoupon.name,
      couponRuleDesc: selectedCoupon.ruleText
    })

    this.setData({
      couponModalVisible: false
    })
    this.applyRawOrder(this.rawOrder)
  },

  clearCouponSelection() {
    if (!this.rawOrder) return
    clearPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo)
    this.setData({
      couponModalVisible: false
    })
    this.applyRawOrder(this.rawOrder)
  },

  goToPay() {
    if (!this.data.detail) return
    wx.navigateTo({
      url: `/pages/payment-confirm/index?id=${this.data.detail.id}`
    })
  }
})
