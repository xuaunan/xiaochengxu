const { createOrder, estimateFare, fetchCouponCenter, fetchHome, fetchMyCoupons, fetchOrderDetail, fetchOrders, fetchProfile } = require('../../utils/api')
const { formatPrice } = require('../../utils/format')
const { ORDER_STATUS, PAY_STATUS, SERVICE_TYPE } = require('../../utils/constants')
const {
  buildEstimateFromRoute,
  buildRideOrderModel,
  decorateCarType,
  getCarTypeMap,
  mergeCoupons,
  pickAutoCoupon,
  syncOrderToCache
} = require('../../utils/user-store')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const { buildCurrentLocationPoint } = require('../../utils/address')
const { runExclusive } = require('../../utils/page')

const HOME_TAB_BAR_HEIGHT = 56
const ACTIVE_RIDE_SYNC_INTERVAL = 5000
const HOME_CAR_COPY = {
  1: {
    name: '经济型',
    description: '适合日常通勤与短途出行'
  },
  2: {
    name: '舒适型',
    description: '空间更舒适，适合家庭出行'
  },
  3: {
    name: '商务型',
    description: '适合接送机与商务出行'
  }
}

const HOME_PRICE_CAR_TYPE_IDS = [1, 2, 3]

function getCouponDiscountAmount(coupon, amount) {
  if (!coupon) return 0
  if (coupon.discount) {
    return Number((Number(amount || 0) * (1 - Number(coupon.amount || 1))).toFixed(2))
  }
  return Number(Number(coupon.amount || 0).toFixed(2))
}

function formatMetricValue(value, decimals) {
  const numeric = Number(value || 0)
  if (decimals === 0) return `${Math.round(numeric)}`
  return numeric.toFixed(decimals)
}

function formatDurationBlock(minutes) {
  const total = Math.max(0, Math.round(Number(minutes || 0)))
  const hour = Math.floor(total / 60)
  const minute = total % 60
  if (hour > 0) {
    return `${hour}小时 ${minute}分钟`
  }
  return `${total}分钟`
}

function isSamePoint(left = {}, right = {}) {
  return `${left.id || ''}` === `${right.id || ''}` &&
    `${left.name || ''}` === `${right.name || ''}` &&
    Number(left.latitude || 0) === Number(right.latitude || 0) &&
    Number(left.longitude || 0) === Number(right.longitude || 0)
}

function isSameDraft(left = {}, right = {}) {
  return `${left.serviceType || ''}` === `${right.serviceType || ''}` &&
    Number(left.selectedCarTypeId || 0) === Number(right.selectedCarTypeId || 0) &&
    isSamePoint(left.start, right.start) &&
    isSamePoint(left.end, right.end)
}

function buildDefaultMetricCards() {
  return [
    { key: 'distance', label: '预估里程', value: '--', suffix: '', numeric: 0, decimals: 1 },
    { key: 'duration', label: '预估时长', value: '--', suffix: '', numeric: 0, decimals: 0 },
    { key: 'price', label: '预估费用', value: '--', suffix: '', numeric: 0, decimals: 2 }
  ]
}

function buildMetricCardsFromEstimate(estimate = {}) {
  const distance = Number(estimate.route ? estimate.route.distanceKm : 0)
  const duration = Number(estimate.route ? estimate.route.durationMin : 0)
  const price = Number(estimate.payable || 0)

  return [
    {
      key: 'distance',
      label: '预估里程',
      value: `${formatMetricValue(distance, 1)} 公里`,
      suffix: '',
      numeric: Number(distance.toFixed(1)),
      decimals: 1
    },
    {
      key: 'duration',
      label: '预估时长',
      value: formatDurationBlock(duration),
      suffix: '',
      numeric: Math.round(duration),
      decimals: 0
    },
    {
      key: 'price',
      label: '预估费用',
      value: formatPrice(price, estimate.currencyCode),
      suffix: '',
      numeric: Number(price.toFixed(2)),
      decimals: 2
    }
  ]
}

function isActiveRideOrder(order = {}) {
  return Boolean(order && order.id && ![ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(order.orderStatus))
}

function isUnpaidFinishedOrder(order = {}) {
  return Boolean(order && order.id && order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID)
}

function shouldShowHomeRideOrder(order = {}) {
  return isActiveRideOrder(order) ||
    isUnpaidFinishedOrder(order)
}

function pickLatestRelevantOrder(candidates = []) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((item) => shouldShowHomeRideOrder(item))
    .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0] || null
}

function getHomeRideStatusText(order = {}) {
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID) {
    return '待支付'
  }
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) {
    return '行程进行中'
  }
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) {
    return order.serviceType === SERVICE_TYPE.CARPOOL ? '车主接驾中' : '司机接驾中'
  }
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) {
    return order.serviceType === SERVICE_TYPE.CARPOOL ? '已匹配车主' : '司机已接单'
  }
  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return '已取消'
  }
  return order.serviceType === SERVICE_TYPE.CARPOOL ? '匹配车主中' : '等待接单'
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function buildActiveRideCard(order = {}) {
  if (!shouldShowHomeRideOrder(order)) return null
  const isCarpool = order.serviceType === SERVICE_TYPE.CARPOOL
  const amountValue = order.orderStatus === ORDER_STATUS.CANCELLED
    ? firstPresent(order.cancelFee, order.payableAmount, 0)
    : firstPresent(order.actualAmount, order.payableAmount, order.estimatedAmount)
  const eyebrowText = order.orderStatus === ORDER_STATUS.FINISHED
    ? '当前待处理的订单'
    : '当前进行中的行程'
  return {
    id: order.id,
    eyebrowText,
    title: `${order.startName} -> ${order.endName}`,
    statusText: getHomeRideStatusText(order),
    amountText: formatPrice(amountValue, order.currencyCode),
    actionText: isCarpool || order.orderStatus === ORDER_STATUS.FINISHED
      ? '\u67e5\u770b\u8ba2\u5355'
      : order.orderStatus === ORDER_STATUS.IN_TRIP
        ? '\u7ee7\u7eed\u67e5\u770b'
        : '\u67e5\u770b\u8fdb\u5ea6'
  }
}

Page({
  data: {
    loading: true,
    statusBarHeight: 20,
    mapHeight: 360,
    panelHeight: 360,
    currentLocation: null,
    locationReady: false,
    activeService: 'taxi',
    draft: {},
    carTypes: [],
    carTypeMap: {},
    carCards: [],
    coupons: [],
    selectedCoupon: null,
    selectedCarTypeId: 1,
    estimate: null,
    estimateView: {
      priceText: '--'
    },
    metricCards: buildDefaultMetricCards(),
    latitude: 31.20066,
    longitude: 121.32756,
    zoom: 14,
    calculating: false,
    dispatching: false,
    activeRideCard: null,
    brandTitle: '阳光出行',
    brandSubtitle: '暖橙色出行服务平台',
    silkyReturnActive: false
  },

  async onLoad() {
    const app = getApp()
    if (!app.globalData.userStore.hasSeenWelcome) {
      wx.redirectTo({ url: '/pages/welcome/index' })
      return
    }
    if (!app.globalData.userStore.loggedIn) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }

    this.initLayoutMetrics()

    await this.loadBootstrap()
    await this.syncActiveRideOrder(true)
    await this.ensureLocation()
    await this.rebuildRoute()
  },

  async onShow() {
    const app = getApp()
    this.playSilkyReturnIfNeeded()
    const storeCoupons = app.globalData.userStore.coupons || []
    const draft = app.globalData.routeDraft || {}
    const nextDraft = {
      ...draft,
      serviceType: SERVICE_TYPE.TAXI,
      selectedCarTypeId: draft.selectedCarTypeId || this.data.selectedCarTypeId
    }
    const draftChanged = Boolean((draft.start || draft.end) && !isSameDraft(nextDraft, this.data.draft || {}))
    const couponChanged = storeCoupons !== this.data.coupons
    const nextData = {}

    if (couponChanged) {
      nextData.coupons = storeCoupons
    }

    if (draft.start || draft.end) {
      app.updateDraft(nextDraft)
      nextData.draft = nextDraft
      nextData.activeService = 'taxi'
      nextData.selectedCarTypeId = nextDraft.selectedCarTypeId
    }

    if (Object.keys(nextData).length) {
      this.setData(nextData)
    }

    await this.syncActiveRideOrder(true)
    this.startActiveRidePolling()

    if (!this.data.loading && (draftChanged || couponChanged)) {
      await this.rebuildRoute()
    }
  },

  onHide() {
    this.stopActiveRidePolling()
  },

  onUnload() {
    if (this.locationChangeHandler) {
      wx.offLocationChange(this.locationChangeHandler)
    }
    wx.stopLocationUpdate({
      fail: () => {}
    })
    clearInterval(this.metricTimer)
    clearTimeout(this.cardAnimateTimer)
    clearTimeout(this.silkyReturnTimer)
    this.stopActiveRidePolling()
  },

  startActiveRidePolling() {
    this.stopActiveRidePolling()
    this.activeRideSyncTimer = setInterval(() => {
      this.syncActiveRideOrder(true).catch(() => {})
    }, ACTIVE_RIDE_SYNC_INTERVAL)
  },

  stopActiveRidePolling() {
    if (this.activeRideSyncTimer) {
      clearInterval(this.activeRideSyncTimer)
      this.activeRideSyncTimer = null
    }
  },

  playSilkyReturnIfNeeded() {
    const app = getApp()
    const transition = (app.globalData && app.globalData.uiTransition) || {}
    const returnedAt = Number(transition.silkyReturnAt || 0)

    if (!returnedAt || Date.now() - returnedAt > 900) return

    app.globalData.uiTransition = {
      ...transition,
      silkyReturnAt: 0
    }
    clearTimeout(this.silkyReturnTimer)
    this.setData({ silkyReturnActive: true })
    this.silkyReturnTimer = setTimeout(() => {
      this.setData({ silkyReturnActive: false })
    }, 320)
  },

  initLayoutMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    const windowHeight = windowInfo.windowHeight || 720
    const safeArea = windowInfo.safeArea || {}
    const safeAreaBottomInset = Math.max(windowHeight - Number(safeArea.bottom || windowHeight), 0)
    const availableHeight = Math.max(windowHeight - HOME_TAB_BAR_HEIGHT - safeAreaBottomInset, 0)
    const mapHeight = Math.round(availableHeight * 0.4)

    this.setData({
      statusBarHeight,
      mapHeight,
      panelHeight: availableHeight - mapHeight
    })
  },

  getCarDisplay(item = {}) {
    const preset = HOME_CAR_COPY[item.id] || {}
    return {
      name: preset.name || item.name || '车型',
      description: preset.description || item.description || item.seatText || '适合当前行程'
    }
  },

  buildFallbackCarCards(carTypes = []) {
    return carTypes.map((item) => {
      const display = this.getCarDisplay(item)
      return {
        id: item.id,
        image: item.image,
        name: display.name,
        description: display.description,
        actionMode: 'text',
        actionText: '点击查看'
      }
    })
  },

  buildCarCards(selectedEstimate, serviceType) {
    const { draft, carTypes, selectedCarTypeId, coupons } = this.data
    const autoUseCoupon = Boolean(getApp().globalData.userStore.settings.autoUseCoupon)

    if (!draft.start || !draft.end || !carTypes.length) {
      return this.buildFallbackCarCards(carTypes)
    }

    return carTypes.map((item) => {
      const display = this.getCarDisplay(item)
      const baseEstimate = buildEstimateFromRoute(item, serviceType, draft.start, draft.end, 0)
      const autoCoupon = autoUseCoupon ? pickAutoCoupon(coupons, serviceType, baseEstimate.amount) : null
      const discount = getCouponDiscountAmount(autoCoupon, baseEstimate.amount)
      const localEstimate = buildEstimateFromRoute(item, serviceType, draft.start, draft.end, discount)
      const showPrice = HOME_PRICE_CAR_TYPE_IDS.includes(item.id) && item.id === selectedCarTypeId
      const finalEstimate = selectedEstimate && item.id === selectedCarTypeId
        ? {
            ...localEstimate,
            amount: selectedEstimate.amount,
            payable: selectedEstimate.payable,
            currencyCode: selectedEstimate.currencyCode
          }
        : localEstimate
      const hasCouponDiscount = showPrice && Boolean(autoCoupon && Number(finalEstimate.amount || 0) > Number(finalEstimate.payable || 0))

      return {
        id: item.id,
        image: item.image,
        name: display.name,
        description: display.description,
        actionMode: showPrice ? 'price' : 'text',
        actionText: showPrice ? formatPrice(finalEstimate.payable, finalEstimate.currencyCode) : '点击查看',
        originalPriceText: formatPrice(finalEstimate.amount, finalEstimate.currencyCode),
        payablePriceText: formatPrice(finalEstimate.payable, finalEstimate.currencyCode),
        hasCouponDiscount
      }
    })
  },

  animateMetricCards(nextMetrics = []) {
    clearInterval(this.metricTimer)

    const currentMetrics = Array.isArray(this.data.metricCards) && this.data.metricCards.length
      ? this.data.metricCards
      : buildDefaultMetricCards()

    const totalFrame = 8
    let currentFrame = 0

    this.metricTimer = setInterval(() => {
      currentFrame += 1
      const progress = currentFrame / totalFrame
      const metrics = nextMetrics.map((item, index) => {
        const previousNumeric = Number(currentMetrics[index] && currentMetrics[index].numeric ? currentMetrics[index].numeric : 0)
        const targetNumeric = Number(item.numeric || 0)
        const currentNumeric = previousNumeric + (targetNumeric - previousNumeric) * progress

        if (item.key === 'duration') {
          return {
            ...item,
            numeric: Math.round(currentNumeric),
            value: formatDurationBlock(currentNumeric)
          }
        }

        if (item.key === 'price') {
          return {
            ...item,
            numeric: Number(currentNumeric.toFixed(2)),
            value: formatPrice(currentNumeric, this.data.estimate ? this.data.estimate.currencyCode : 'CNY')
          }
        }

        return {
          ...item,
          numeric: Number(currentNumeric.toFixed(1)),
          value: `${formatMetricValue(currentNumeric, 1)} 公里`
        }
      })

      this.setData({ metricCards: metrics })

      if (currentFrame >= totalFrame) {
        clearInterval(this.metricTimer)
        this.setData({ metricCards: nextMetrics })
      }
    }, 36)
  },

  async loadBootstrap() {
    const app = getApp()
    const draft = app.globalData.routeDraft || {}
    const [homeResponse, profileResponse, myCouponsResponse, centerCouponsResponse] = await Promise.all([
      fetchHome(),
      fetchProfile(),
      fetchMyCoupons(),
      fetchCouponCenter()
    ])

    const homeData = homeResponse.data || {}
    const carTypes = (homeData.carTypes || []).map((item) => decorateCarType(item))
    const carTypeMap = getCarTypeMap(carTypes)
    const coupons = mergeCoupons(myCouponsResponse.data || [], centerCouponsResponse.data || homeData.couponCenter || [])
    const currentDraft = {
      ...draft,
      serviceType: SERVICE_TYPE.TAXI,
      selectedCarTypeId: draft.selectedCarTypeId || (carTypes[0] ? carTypes[0].id : 1)
    }

    app.applyProfile(profileResponse.data || {})
    app.globalData.userStore.home = {
      banners: homeData.banners || [],
      notices: homeData.notices || [],
      carTypes,
      systemConfigs: homeData.systemConfigs || {},
      couponCenter: centerCouponsResponse.data || []
    }
    app.globalData.userStore.coupons = coupons
    app.saveUserStore()
    app.updateDraft(currentDraft)

    this.setData({
      loading: false,
      carTypes,
      carTypeMap,
      carCards: this.buildFallbackCarCards(carTypes),
      coupons,
      draft: currentDraft,
      activeService: 'taxi',
      selectedCarTypeId: currentDraft.selectedCarTypeId
    })
  },

  async syncActiveRideOrder(silent = false) {
    return runExclusive(this, '__syncActiveRideOrderPromise', async () => {
      const app = getApp()
      let storeOrders = Array.isArray(app.globalData.userStore.orders) ? app.globalData.userStore.orders : []
      try {
        const response = await fetchOrders()
        const remoteOrders = Array.isArray(response.data) ? response.data : []
        storeOrders = remoteOrders
          .map((item) => syncOrderToCache(item) || item)
          .filter(Boolean)
      } catch (error) {
        if (!silent) {
          wx.showToast({
            title: '订单列表同步失败',
            icon: 'none'
          })
        }
      }
      const currentRideOrder = app.globalData.userStore.currentRideOrder
      const preferredOrder = shouldShowHomeRideOrder(currentRideOrder)
        ? currentRideOrder
        : pickLatestRelevantOrder(storeOrders)

      if (!preferredOrder || !preferredOrder.id) {
        if (currentRideOrder && currentRideOrder.id && currentRideOrder.orderStatus === ORDER_STATUS.FINISHED && currentRideOrder.payStatus === PAY_STATUS.UNPAID) {
          app.setCurrentRideOrder(null)
        }
        this.setData({ activeRideCard: null })
        return null
      }

      let latestOrder = preferredOrder
      try {
        const response = await fetchOrderDetail(preferredOrder.id, {
          skipToast: Boolean(silent)
        })
        latestOrder = response.data || currentRideOrder
      } catch (error) {
        if (!silent) {
          wx.showToast({
            title: '当前订单同步失败',
            icon: 'none'
          })
        }
      }

      if (!shouldShowHomeRideOrder(latestOrder)) {
        if (latestOrder.orderStatus === ORDER_STATUS.CANCELLED || latestOrder.payStatus === PAY_STATUS.PAID) {
          app.setCurrentRideOrder(null)
        }
        this.setData({ activeRideCard: null })
        return latestOrder
      }

      app.setCurrentRideOrder(latestOrder)
      this.setData({
        activeRideCard: buildActiveRideCard(latestOrder)
      })
      return latestOrder
    })
  },

  async ensureLocation() {
    try {
      await this.startLocationUpdate()
      const location = await this.getLocation()
      this.applyCurrentLocation(location)
      this.locationChangeHandler = (next) => this.applyCurrentLocation(next)
      wx.onLocationChange(this.locationChangeHandler)
    } catch (error) {
      this.setData({
        locationReady: false
      })
    }
  },

  startLocationUpdate() {
    return new Promise((resolve, reject) => {
      wx.startLocationUpdate({
        type: 'gcj02',
        success: resolve,
        fail: reject
      })
    })
  },

  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: resolve,
        fail: reject
      })
    })
  },

  applyCurrentLocation(location) {
    const currentLocation = buildCurrentLocationPoint(location)
    const draft = { ...this.data.draft }
    if (!draft.start || draft.start.source === 'currentLocation' || draft.start.source === 'location') {
      draft.start = currentLocation
    }

    this.setData({
      currentLocation,
      draft,
      locationReady: true,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      zoom: 15
    })
    getApp().updateDraft(draft)
  },

  async rebuildRoute() {
    const { draft, selectedCarTypeId, carTypeMap } = this.data

    if (!draft.start || !draft.end || !carTypeMap[selectedCarTypeId]) {
      this.setData({
        estimate: null,
        selectedCoupon: null,
        metricCards: buildDefaultMetricCards(),
        estimateView: { priceText: '--' },
        carCards: this.buildFallbackCarCards(this.data.carTypes)
      })
      return
    }

    const selectedCar = carTypeMap[selectedCarTypeId]
    const serviceType = SERVICE_TYPE.TAXI
    const baseEstimate = buildEstimateFromRoute(selectedCar, serviceType, draft.start, draft.end, 0)
    const autoCoupon = getApp().globalData.userStore.settings.autoUseCoupon
      ? pickAutoCoupon(this.data.coupons, serviceType, baseEstimate.amount)
      : null
    const couponDiscount = getCouponDiscountAmount(autoCoupon, baseEstimate.amount)
    const localEstimate = buildEstimateFromRoute(selectedCar, serviceType, draft.start, draft.end, couponDiscount)

    this.setData({ calculating: true })

    try {
      const response = await estimateFare({
        carTypeId: selectedCarTypeId,
        serviceType,
        distanceKm: localEstimate.route.distanceKm,
        durationMin: localEstimate.route.durationMin
      })
      const remote = response.data || {}
      const estimate = {
        ...localEstimate,
        amount: Number(remote.amount || localEstimate.amount),
        payable: Number(Math.max(Number(remote.amount || localEstimate.amount) - couponDiscount, 0).toFixed(2)),
        currencyCode: remote.currencyCode || localEstimate.currencyCode,
        exchangeRate: Number(remote.exchangeRate || localEstimate.exchangeRate)
      }

      const metricCards = buildMetricCardsFromEstimate(estimate)
      const centerLatitude = Number(((draft.start.latitude + draft.end.latitude) / 2).toFixed(6))
      const centerLongitude = Number(((draft.start.longitude + draft.end.longitude) / 2).toFixed(6))

      this.setData({
        estimate,
        selectedCoupon: autoCoupon,
        estimateView: {
          priceText: formatPrice(estimate.payable, estimate.currencyCode)
        },
        carCards: this.buildCarCards(estimate, serviceType),
        latitude: centerLatitude,
        longitude: centerLongitude,
        zoom: 12
      })
      this.animateMetricCards(metricCards)
    } finally {
      this.setData({ calculating: false })
    }
  },

  chooseService(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'carpool') {
      wx.switchTab({ url: '/pages/carpool/index' })
      return
    }
    if (type === 'international') {
      wx.navigateTo({ url: '/pages/international/index' })
      return
    }
    this.setData({ activeService: 'taxi' })
  },

  chooseCarType(e) {
    const selectedCarTypeId = Number(e.currentTarget.dataset.id)
    const draft = { ...this.data.draft, selectedCarTypeId }
    getApp().updateDraft(draft)
    clearTimeout(this.cardAnimateTimer)
    this.setData({
      selectedCarTypeId,
      draft,
      cardAnimateId: selectedCarTypeId
    })
    this.cardAnimateTimer = setTimeout(() => {
      this.setData({ cardAnimateId: null })
    }, 320)
    this.rebuildRoute()
  },

  openAddressSearch(e) {
    const type = e.currentTarget.dataset.type
    const draft = {
      ...this.data.draft,
      serviceType: SERVICE_TYPE.TAXI,
      selectedCarTypeId: this.data.selectedCarTypeId
    }
    getApp().updateDraft(draft)
    wx.navigateTo({
      url: `/pages/address-search/index?type=${type}`
    })
  },

  swapAddress() {
    if (!this.data.draft.start && !this.data.draft.end) return
    const draft = {
      ...this.data.draft,
      start: this.data.draft.end,
      end: this.data.draft.start
    }
    getApp().updateDraft(draft)
    this.setData({ draft })
    this.rebuildRoute()
  },

  openCurrentRide() {
    runExclusive(this, '__openCurrentRidePromise', async () => {
      const latestOrder = await this.syncActiveRideOrder(true).catch(() => null)
      const currentRideOrder = latestOrder || getApp().globalData.userStore.currentRideOrder
      const targetUrl = buildOrderFlowUrl(currentRideOrder)

      if (!targetUrl) {
        wx.showToast({
          title: '当前没有可继续的订单',
          icon: 'none'
        })
        return
      }

      wx.navigateTo({
        url: targetUrl
      })
    }).catch(() => {})
  },

  async createRideOrder() {
    if (!this.data.draft.start || !this.data.draft.end || !this.data.estimate) {
      wx.showToast({
        title: '请先选择出发地和目的地',
        icon: 'none'
      })
      return
    }

    this.setData({ dispatching: true })

    try {
      const existingOrder = await this.syncActiveRideOrder(true)
      if (isUnpaidFinishedOrder(existingOrder)) {
        const targetUrl = buildOrderFlowUrl(existingOrder)
        wx.showModal({
          title: '存在待支付订单',
          content: '请先完成上一笔订单支付，支付完成后才能继续打车。',
          confirmText: '去支付',
          showCancel: false,
          success: () => {
            if (targetUrl) {
              wx.redirectTo({
                url: targetUrl
              })
            }
          }
        })
        return
      }

      if (isActiveRideOrder(existingOrder)) {
        wx.showToast({
          title: '你有进行中的订单，已为你恢复',
          icon: 'none'
        })
        const targetUrl = buildOrderFlowUrl(existingOrder)
        if (targetUrl) {
          setTimeout(() => {
            wx.redirectTo({
              url: targetUrl
            })
          }, 160)
        }
        return
      }

      const payload = {
        carTypeId: this.data.selectedCarTypeId,
        serviceType: SERVICE_TYPE.TAXI,
        startName: this.data.draft.start.name,
        startLng: `${this.data.draft.start.longitude}`,
        startLat: `${this.data.draft.start.latitude}`,
        endName: this.data.draft.end.name,
        endLng: `${this.data.draft.end.longitude}`,
        endLat: `${this.data.draft.end.latitude}`,
        estimatedDistanceKm: this.data.estimate.route.distanceKm,
        estimatedDurationMin: this.data.estimate.route.durationMin,
        userCouponId: this.data.selectedCoupon ? this.data.selectedCoupon.userCouponId : null,
        dispatchMode: 'SMART',
        languageCode: getApp().globalData.locale,
        currencyCode: this.data.estimate.currencyCode,
        remark: '微信小程序乘客端下单'
      }

      const response = await createOrder(payload)
      const rawOrder = syncOrderToCache(response.data) || response.data
      const currentRideOrder = buildRideOrderModel(rawOrder, {
        carType: this.data.carTypeMap[this.data.selectedCarTypeId],
        route: this.data.estimate.route
      })
      currentRideOrder.coupon = this.data.selectedCoupon || null
      getApp().setCurrentRideOrder(currentRideOrder)
      this.setData({
        activeRideCard: buildActiveRideCard(currentRideOrder)
      })

      wx.showToast({
        title: '下单成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/taxi-waiting/index?id=${response.data.id}`
        })
      }, 220)
    } finally {
      this.setData({ dispatching: false })
    }
  }
})
