const {
  createOrder,
  fetchCouponCenter,
  fetchHome,
  fetchMyCoupons
} = require('../../utils/api')
const { formatPrice, parseDateValue } = require('../../utils/format')
const { COUPON_STATUS, SERVICE_TYPE } = require('../../utils/constants')
const {
  buildEstimateFromRoute,
  buildRideOrderModel,
  decorateCarType,
  mergeCoupons,
  pickAutoCoupon,
  syncOrderToCache
} = require('../../utils/user-store')
const { navigateToSilky } = require('../../utils/page')

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function getCouponDiscountAmount(coupon, amount) {
  if (!coupon) return 0
  if (coupon.discount) {
    return Number((Number(amount || 0) * (1 - Number(coupon.amount || 1))).toFixed(2))
  }
  return Number(Math.min(Number(coupon.amount || 0), Number(amount || 0)).toFixed(2))
}

function getDefaultPriceView() {
  return {
    distanceText: '--',
    originalPriceText: '--',
    discountText: '¥0.00',
    payablePriceText: '--',
    couponText: '暂无优惠'
  }
}

function buildCouponRuleText(coupon, currencyCode = 'CNY') {
  if (coupon.ruleDesc) return coupon.ruleDesc
  const thresholdText = toNumber(coupon.minAmount) > 0
    ? `满${formatPrice(coupon.minAmount, currencyCode)}可用`
    : '无门槛可用'
  const validityText = coupon.validDate ? `${coupon.validDate}前有效` : ''
  return [thresholdText, validityText].filter(Boolean).join(' · ')
}

function getCouponUnavailableReason(coupon, amount) {
  const rawStatus = `${coupon.rawStatus || ''}`.toUpperCase()
  const status = `${coupon.status || ''}`.toLowerCase()

  if (rawStatus === COUPON_STATUS.USED || status === 'used') return '已使用'
  if (rawStatus === COUPON_STATUS.EXPIRED || status === 'expired') return '已过期'

  const validDate = parseDateValue(coupon.validDate)
  if (validDate && validDate.getTime() < Date.now()) return '已过期'

  const scopeCode = coupon.scopeCode || 'ALL'
  if (scopeCode !== 'ALL' && scopeCode !== SERVICE_TYPE.CARPOOL) return '仅限其他业务使用'
  if (toNumber(amount) < toNumber(coupon.minAmount)) return '未满足满减门槛'

  return ''
}

function buildCouponGroups(coupons = [], amount = 0, currencyCode = 'CNY') {
  const groups = {
    available: [],
    unavailable: []
  }

  ;(coupons || []).forEach((coupon) => {
    const discountAmount = getCouponDiscountAmount(coupon, amount)
    const option = {
      ...coupon,
      userCouponIdText: `${coupon.userCouponId || coupon.id || ''}`,
      discountAmount,
      discountAmountText: formatPrice(discountAmount, currencyCode),
      ruleText: buildCouponRuleText(coupon, currencyCode),
      validText: coupon.validDate ? `${coupon.validDate} 前有效` : ''
    }
    const unavailableReason = getCouponUnavailableReason(option, amount)
    if (unavailableReason) {
      groups.unavailable.push({
        ...option,
        unavailableReason
      })
      return
    }
    groups.available.push(option)
  })

  groups.available.sort((left, right) => right.discountAmount - left.discountAmount)
  return groups
}

function buildCarpoolRemark(meta, note = '') {
  const remark = `${note || ''}`.trim()
  return `[CARPOOL_META]${JSON.stringify(meta)}[/CARPOOL_META]${remark ? `\n${remark}` : ''}`
}

function getFallbackContext() {
  const app = getApp()
  return {
    draft: app.globalData.routeDraft || {},
    departDate: '',
    selectedTimeRange: '07:00-09:00',
    selectedTimeRangeLabel: '07:00 - 09:00',
    passengerCount: 1,
    selectedPassengerLabel: '1 人',
    luggageMode: 'NO_LUGGAGE',
    luggageLabel: '无行李',
    tollMode: 'NEGOTIABLE',
    tollLabel: '高速费协商',
    note: ''
  }
}

Page({
  data: {
    context: getFallbackContext(),
    carType: null,
    coupons: [],
    selectedCoupon: null,
    selectedCouponId: '',
    couponMode: 'auto',
    couponModalVisible: false,
    activeCouponTab: 'available',
    availableCoupons: [],
    unavailableCoupons: [],
    estimate: null,
    priceView: getDefaultPriceView(),
    bootstrapping: false,
    dispatching: false
  },

  async onShow() {
    this.loadContext()
    await this.ensureBootstrap()
    await this.refreshCoupons()
    await this.rebuildEstimate()
  },

  loadContext() {
    const app = getApp()
    const cached = app.globalData.carpoolConfirmContext || wx.getStorageSync('sunshine-carpool-confirm') || {}
    this.setData({
      context: {
        ...getFallbackContext(),
        ...cached,
        draft: cached.draft || app.globalData.routeDraft || {}
      }
    })
  },

  async ensureBootstrap() {
    if (this.data.carType) return
    this.setData({ bootstrapping: true })
    try {
      const homeResponse = await fetchHome()
      const homeData = homeResponse.data || {}
      const carTypes = (homeData.carTypes || []).map((item) => decorateCarType(item))
      const carType = carTypes[0] || decorateCarType({
        id: 1,
        startPrice: 14,
        startDistanceKm: 3,
        distancePrice: 2.6,
        durationPrice: 0.5
      })
      const app = getApp()
      app.globalData.userStore.home = {
        ...(app.globalData.userStore.home || {}),
        ...(homeData || {}),
        carTypes
      }
      app.saveUserStore()
      this.setData({ carType })
    } finally {
      this.setData({ bootstrapping: false })
    }
  },

  async refreshCoupons() {
    const [myCouponsResponse, centerCouponsResponse] = await Promise.all([
      fetchMyCoupons(),
      fetchCouponCenter()
    ])
    const app = getApp()
    const couponCenter = centerCouponsResponse.data || app.globalData.userStore.home.couponCenter || []
    const coupons = mergeCoupons(myCouponsResponse.data || [], couponCenter)
    app.globalData.userStore.coupons = coupons
    app.globalData.userStore.home = {
      ...(app.globalData.userStore.home || {}),
      couponCenter
    }
    app.saveUserStore()
    this.setData({ coupons })
    return coupons
  },

  async rebuildEstimate() {
    const { context, carType, coupons } = this.data
    const draft = context.draft || {}
    if (!draft.start || !draft.end || !carType) {
      this.setData({
        estimate: null,
        selectedCoupon: null,
        selectedCouponId: '',
        availableCoupons: [],
        unavailableCoupons: [],
        priceView: getDefaultPriceView()
      })
      return
    }

    const baseEstimate = buildEstimateFromRoute(carType, SERVICE_TYPE.CARPOOL, draft.start, draft.end, 0)
    const couponGroups = buildCouponGroups(coupons, baseEstimate.amount, baseEstimate.currencyCode)
    const autoCoupon = pickAutoCoupon(coupons, SERVICE_TYPE.CARPOOL, baseEstimate.amount)
    let couponMode = this.data.couponMode || 'auto'
    let selectedCoupon = null

    if (couponMode === 'manual') {
      selectedCoupon = couponGroups.available.find((item) => item.userCouponIdText === `${this.data.selectedCouponId || ''}`) || null
      if (!selectedCoupon) couponMode = 'auto'
    }

    if (couponMode === 'auto') {
      selectedCoupon = autoCoupon
        ? couponGroups.available.find((item) => item.userCouponIdText === `${autoCoupon.userCouponId || autoCoupon.id || ''}`) || null
        : null
    }

    const couponDiscount = getCouponDiscountAmount(selectedCoupon, baseEstimate.amount)
    const estimate = buildEstimateFromRoute(carType, SERVICE_TYPE.CARPOOL, draft.start, draft.end, couponDiscount)
    const couponText = selectedCoupon
      ? `${couponMode === 'manual' ? '已选择' : '已优惠'} ${selectedCoupon.name}`
      : (couponMode === 'none' ? '未使用优惠券' : '暂无优惠')

    this.setData({
      estimate,
      selectedCoupon,
      selectedCouponId: selectedCoupon ? selectedCoupon.userCouponIdText : '',
      couponMode,
      availableCoupons: couponGroups.available,
      unavailableCoupons: couponGroups.unavailable,
      priceView: {
        distanceText: `${Number(estimate.route.distanceKm || 0).toFixed(1)} 公里`,
        originalPriceText: formatPrice(baseEstimate.amount, estimate.currencyCode),
        discountText: formatPrice(couponDiscount, estimate.currencyCode),
        payablePriceText: formatPrice(estimate.payable, estimate.currencyCode),
        couponText
      }
    })
  },

  openCouponPicker() {
    if (!this.data.estimate) return
    this.setData({
      couponModalVisible: true,
      activeCouponTab: 'available'
    })
  },

  closeCouponPicker() {
    this.setData({ couponModalVisible: false })
  },

  switchCouponTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.activeCouponTab) return
    this.setData({ activeCouponTab: tab })
  },

  chooseCoupon(e) {
    const couponId = `${e.currentTarget.dataset.id || ''}`
    const selectedCoupon = (this.data.availableCoupons || []).find((item) => item.userCouponIdText === couponId)
    if (!selectedCoupon) return
    this.setData({
      couponMode: 'manual',
      selectedCouponId: selectedCoupon.userCouponIdText,
      couponModalVisible: false
    })
    this.rebuildEstimate()
  },

  clearCouponSelection() {
    this.setData({
      couponMode: 'none',
      selectedCouponId: '',
      couponModalVisible: false
    })
    this.rebuildEstimate()
  },

  goPublish() {
    const context = this.data.context || {}
    const draft = context.draft || {}
    const timeRange = `${context.selectedTimeRange || '07:00-09:00'}`.split('-')
    const departTime = `${context.departDate} ${timeRange[0] || '07:00'}:00`
    navigateToSilky(this, {
      url: `/pages/carpool-publish/index?startName=${encodeURIComponent((draft.start && draft.start.name) || '')}&endName=${encodeURIComponent((draft.end && draft.end.name) || '')}&departTime=${encodeURIComponent(departTime)}`
    })
  },

  async submitCarpoolOrder() {
    const context = this.data.context || {}
    const draft = context.draft || {}
    if (this.data.dispatching || !draft.start || !draft.end || !this.data.estimate || !this.data.carType) {
      wx.showToast({ title: '请先选择起终点', icon: 'none' })
      return
    }

    this.setData({ dispatching: true })
    try {
      const meta = {
        departDate: context.departDate,
        timeRange: context.selectedTimeRange,
        passengerCount: context.passengerCount,
        hasLuggage: context.luggageMode,
        tollMode: context.tollMode,
        originalAmount: Number(this.data.estimate.amount || 0),
        discountAmount: Number(this.data.selectedCoupon ? getCouponDiscountAmount(this.data.selectedCoupon, this.data.estimate.amount) : 0),
        payableAmount: Number(this.data.estimate.payable || 0)
      }

      const payload = {
        carTypeId: this.data.carType.id,
        serviceType: SERVICE_TYPE.CARPOOL,
        startName: draft.start.name,
        startLng: `${draft.start.longitude}`,
        startLat: `${draft.start.latitude}`,
        endName: draft.end.name,
        endLng: `${draft.end.longitude}`,
        endLat: `${draft.end.latitude}`,
        estimatedDistanceKm: this.data.estimate.route.distanceKm,
        estimatedDurationMin: this.data.estimate.route.durationMin,
        userCouponId: this.data.selectedCoupon ? this.data.selectedCoupon.userCouponId : null,
        dispatchMode: 'CARPOOL_MATCH',
        remark: buildCarpoolRemark(meta, context.note)
      }
      const response = await createOrder(payload)
      const responseOrder = response.data || {}
      const responseDiscount = Number(responseOrder.couponDiscount || 0)
      const effectiveDiscount = this.data.selectedCoupon && responseDiscount <= 0 ? meta.discountAmount : responseDiscount
      const effectivePayableAmount = this.data.selectedCoupon && responseDiscount <= 0
        ? meta.payableAmount
        : (responseOrder.payableAmount !== undefined ? responseOrder.payableAmount : meta.payableAmount)

      const rawOrder = syncOrderToCache({
        ...responseOrder,
        remark: responseOrder.remark || payload.remark,
        serviceType: SERVICE_TYPE.CARPOOL,
        estimatedAmount: responseOrder.estimatedAmount !== undefined ? responseOrder.estimatedAmount : meta.originalAmount,
        payableAmount: effectivePayableAmount,
        couponDiscount: effectiveDiscount,
        userCouponId: responseOrder.userCouponId !== undefined ? responseOrder.userCouponId : (this.data.selectedCoupon ? this.data.selectedCoupon.userCouponId : null),
        couponName: responseOrder.couponName || (this.data.selectedCoupon ? this.data.selectedCoupon.name : ''),
        couponRuleDesc: responseOrder.couponRuleDesc || (this.data.selectedCoupon ? this.data.selectedCoupon.ruleDesc : ''),
        passengerCount: responseOrder.passengerCount !== undefined ? responseOrder.passengerCount : context.passengerCount
      }) || responseOrder
      const currentOrder = buildRideOrderModel(rawOrder, {
        carType: this.data.carType,
        route: this.data.estimate.route
      })
      currentOrder.coupon = this.data.selectedCoupon || null
      getApp().setCurrentRideOrder(currentOrder)

      wx.showToast({ title: '已开始匹配车主', icon: 'success' })
      setTimeout(() => {
        navigateToSilky(this, { url: `/pages/order-detail/index?id=${responseOrder.id}` })
      }, 220)
    } finally {
      this.setData({ dispatching: false })
    }
  }
})
