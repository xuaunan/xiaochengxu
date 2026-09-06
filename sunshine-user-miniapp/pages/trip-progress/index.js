const { fetchOrderDetail, fetchOrderRuntime, sendSupportMessage } = require('../../utils/api')
const { buildRoutePolylines, hasUsableRoute } = require('../../utils/route-display')
const { formatDistance, formatDuration, formatPrice } = require('../../utils/format')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, syncOrderToCache } = require('../../utils/user-store')
const { ORDER_STATUS, getServiceLabel } = require('../../utils/constants')
const { redirectToOrderFlow } = require('../../utils/order-flow')
const { createSimulation } = require('../../utils/trip-simulator')
const { runExclusive, runGuarded } = require('../../utils/page')
const { requestRoute } = require('../../utils/route-planner')

const MAP_FOLLOW_RESUME_DELAY = 10000
const EMERGENCY_SUPPORT_PREFIX = '【紧急安全求助】'

function normalizePoint(point = {}) {
  return {
    latitude: Number(point.latitude || 0),
    longitude: Number(point.longitude || 0)
  }
}

function hasRuntimeRoute(runtime) {
  return hasUsableRoute(runtime)
}

function pickPlannedRoute(runtime = {}) {
  if (!hasRuntimeRoute(runtime)) return {}
  return {
    approachRoutePoints: runtime.approachRoutePoints,
    tripRoutePoints: runtime.tripRoutePoints,
    routePoints: runtime.routePoints,
    fullRoutePoints: runtime.fullRoutePoints,
    points: runtime.points,
    routePlanned: runtime.routePlanned
  }
}

function stripRouteFields(runtime = {}) {
  const {
    approachRoute,
    tripRoute,
    activeRoute,
    approachRoutePoints,
    tripRoutePoints,
    routePoints,
    fullRoutePoints,
    points,
    traveledPoints,
    remainPoints,
    ...rest
  } = runtime || {}
  return rest
}

function mergeRuntimeSnapshot(runtime = {}, cachedRuntime = null, fallback = {}) {
  if (runtime && (runtime.routeSource === 'demo_trace' || runtime.routeSource === 'travel_trace')) {
    return {
      ...(fallback || {}),
      ...stripRouteFields(runtime || {}),
      ...pickPlannedRoute(cachedRuntime),
      ...(runtime && runtime.routePlanned ? pickPlannedRoute(runtime) : {}),
      currentPoint: runtime.currentPoint || fallback.currentPoint,
      heading: runtime.heading !== undefined ? runtime.heading : fallback.heading,
      routeSource: runtime.routeSource,
      routeReal: runtime.routeSource === 'travel_trace'
    }
  }
  if (hasRuntimeRoute(cachedRuntime)) {
    return {
      ...cachedRuntime,
      ...(runtime || {})
    }
  }
  return {
    ...(fallback || {}),
    ...(runtime || {})
  }
}

function getTrafficText(runtime = {}, fallback = {}) {
  if (runtime.waitingRedLight) {
    return runtime.waitingText || runtime.trafficText || fallback.trafficText || '--'
  }
  return runtime.trafficText || fallback.trafficText || '--'
}

function buildServiceSteps(order = {}, phase = 'trip') {
  const status = `${order.orderStatus || ''}`.toUpperCase()
  const completed = status === ORDER_STATUS.FINISHED || phase === 'finished'
  const currentIndex = completed ? 3 : phase === 'trip' ? 2 : phase === 'approach' ? 1 : 0
  const titles = ['已接单', '接驾中', '行程中', '已完成']
  return titles.map((title, index) => ({
    key: title,
    title,
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
  }))
}

function getTripPhaseLabel(phase = 'trip', order = {}) {
  const status = `${order.orderStatus || ''}`.toUpperCase()
  if (status === ORDER_STATUS.FINISHED || phase === 'finished') {
    return { label: '已完成', state: 'complete' }
  }
  if (phase === 'approach') {
    return { label: '接驾中', state: 'approach' }
  }
  if (phase === 'dispatch') {
    return { label: '派单中', state: 'dispatch' }
  }
  return { label: '行程中', state: 'trip' }
}

Page({
  data: {
    order: null,
    progress: 0,
    currentPoint: null,
    mapCenter: {},
    mapFollowMode: true,
    markers: [],
    polyline: [],
    etaText: '--',
    trafficText: '--',
    mileageText: '--',
    durationText: '--',
    progressText: '0%',
    orderId: '',
    statusBarHeight: 20,
    navHeight: 44,
    mapHeight: 288,
    mapBodyHeight: 244,
    serviceSteps: [],
    tripPhaseLabel: '行程中',
    tripPhaseState: 'trip',
    safetySheetVisible: false,
    emergencyConnecting: false
  },

  async onLoad(options) {
    this.initLayoutMetrics()
    this.setData({
      orderId: options.id || ''
    })

    const cachedOrder = findCachedOrder(this.data.orderId)
    if (cachedOrder) {
      this.applyTripView(cachedOrder, null)
    }

    await this.updateTripStatus(false).catch(() => {})
    this.startPolling()
  },

  onShow() {
    if (!this.data.orderId) return
    this.clearMapFollowTimer()
    if (!this.data.mapFollowMode) {
      this.setData({ mapFollowMode: true })
    }
    this.updateTripStatus(true).catch(() => {})
    this.startPolling()
  },

  onReady() {
    if (wx.createMapContext) {
      this.mapContext = wx.createMapContext('tripMap', this)
    }
  },

  onHide() {
    this.stopPolling()
    this.clearMapFollowTimer()
  },

  onUnload() {
    this.stopPolling()
    this.clearMapFollowTimer()
  },

  initLayoutMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const windowHeight = windowInfo.windowHeight || 720
    const safeArea = windowInfo.safeArea || {}
    const safeAreaBottomInset = Math.max(windowHeight - Number(safeArea.bottom || windowHeight), 0)
    const availableHeight = Math.max(windowHeight - 56 - safeAreaBottomInset, 0)
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const navHeight = menuButton ? Math.max(menuButton.height + 10, 44) : 44
    const mapHeight = Math.round(availableHeight * 0.4)
    const mapBodyHeight = Math.max(mapHeight, 180)

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      navHeight,
      mapHeight,
      mapBodyHeight
    })
  },

  handleDirectBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: () => wx.switchTab({ url: '/pages/home/index' })
      })
      return
    }
    wx.switchTab({ url: '/pages/home/index' })
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  applyTripView(rawOrder, runtime) {
    if (!rawOrder) return

    const app = getApp()
    const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(rawOrder, {
      carType: carTypeMap[rawOrder.carTypeId]
    })
    const fallback = createSimulation(rawOrder)
    const cachedRuntime = app.getOrderRuntimeCache ? app.getOrderRuntimeCache(rawOrder.id) : null
    const activeRuntime = mergeRuntimeSnapshot(runtime, cachedRuntime, fallback)
    this.currentRuntimeSnapshot = activeRuntime
    const currentPoint = normalizePoint(activeRuntime.currentPoint || fallback.currentPoint)
    const phase = activeRuntime.phase || fallback.phase || 'trip'
    const phaseView = getTripPhaseLabel(phase, order)
    const fareValue = rawOrder.payableAmount ?? rawOrder.actualAmount ?? rawOrder.estimatedAmount
    const routeStartPoint = phase === 'trip'
      ? order.start
      : normalizePoint(activeRuntime.driverStartPoint || fallback.driverStart || currentPoint)
    const routeEndPoint = phase === 'trip' ? order.end : order.start
    const remainMinutes = Math.max(0, Math.round(Number(activeRuntime.remainingSeconds || fallback.remainingSeconds || 0) / 60))

    const mapCenter = this.data.mapCenter || {}
    const shouldUpdateMapCenter = this.data.mapFollowMode || !mapCenter.latitude || !mapCenter.longitude

    const tripViewData = {
      order,
      orderSummary: {
        orderNo: rawOrder.orderNo || rawOrder.id || '--',
        serviceTypeText: rawOrder.serviceTypeText || rawOrder.serviceTypeLabel || getServiceLabel(rawOrder.serviceType),
        fareText: fareValue === undefined || fareValue === null || fareValue === ''
          ? ''
          : formatPrice(fareValue, rawOrder.currencyCode || 'CNY')
      },
      serviceSteps: buildServiceSteps(order, phase),
      tripPhaseLabel: phaseView.label,
      tripPhaseState: phaseView.state,
      progress: Number(activeRuntime.progress || fallback.progress || 0),
      currentPoint,
      etaText: activeRuntime.routeSource === 'order_record' ? '等待司机位置更新' : (remainMinutes > 0 ? `${remainMinutes} 分钟后到达` : '即将到达终点'),
      trafficText: getTrafficText(activeRuntime, fallback),
      mileageText: formatDistance(Number(activeRuntime.traveledDistanceKm || fallback.traveledDistanceKm || 0)),
      durationText: formatDuration(Number(activeRuntime.elapsedSeconds || fallback.usedSeconds || 0) / 60),
      progressText: `${activeRuntime.routeSource === 'order_record' ? 0 : (activeRuntime.percent !== undefined ? activeRuntime.percent : fallback.percent)}%`,
      markers: [
        {
          id: 1,
          latitude: order.start.latitude,
          longitude: order.start.longitude,
          iconPath: '/images/map-start.png',
          width: 32,
          height: 38
        },
        {
          id: 2,
          latitude: order.end.latitude,
          longitude: order.end.longitude,
          iconPath: '/images/map-end.png',
          width: 36,
          height: 42
        },
        {
          id: 3,
          latitude: currentPoint.latitude,
          longitude: currentPoint.longitude,
          iconPath: '/images/map-car-real-top.png',
          width: 46,
          height: 46,
          rotate: Number(activeRuntime.heading || fallback.heading || 0),
          anchor: {
            x: 0.5,
            y: 0.5
          },
          callout: {
            content: remainMinutes > 0 ? `${remainMinutes} 分钟后到达` : '即将到达终点',
            color: '#1f2432',
            bgColor: '#ffffff',
            borderRadius: 12,
            padding: 8,
            display: 'ALWAYS'
          }
        }
      ],
      polyline: buildRoutePolylines({
        runtime: activeRuntime,
        fallback,
        phase,
        currentPoint,
        traveledColor: '#ff7a00',
        traveledWidth: 10,
        remainColor: '#9db5ff',
        remainWidth: 6
      })
    }
    if (shouldUpdateMapCenter) {
      tripViewData.mapCenter = currentPoint
    }
    this.setData(tripViewData)

    getApp().setCurrentRideOrder(order, {
      persist: false
    })
    if (hasRuntimeRoute(activeRuntime) && app.setOrderRuntimeCache) {
      app.setOrderRuntimeCache(rawOrder.id, activeRuntime)
    }
    this.syncPlannedRoute({
      order,
      activeRuntime,
      fallback,
      phase,
      currentPoint,
      from: routeStartPoint,
      to: routeEndPoint
    })
  },

  syncPlannedRoute(options = {}) {
    const routeKey = [
      options.order.id,
      options.phase,
      Number(options.from.latitude).toFixed(6),
      Number(options.from.longitude).toFixed(6),
      Number(options.to.latitude).toFixed(6),
      Number(options.to.longitude).toFixed(6)
    ].join('|')
    this.latestRoutePlanKey = routeKey
    requestRoute(options.from, options.to).then((routePoints) => {
      if (this.latestRoutePlanKey !== routeKey || !routePoints.length) return
      const phaseRouteKey = options.phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'
      const runtime = {
        ...options.activeRuntime,
        [phaseRouteKey]: routePoints,
        routePoints,
        fullRoutePoints: routePoints,
        points: routePoints,
        routePlanned: true
      }
      const app = getApp()
      if (app.setOrderRuntimeCache) {
        app.setOrderRuntimeCache(options.order.id, runtime)
      }
      this.setData({
        polyline: buildRoutePolylines({
          runtime,
          fallback: options.fallback,
          phase: options.phase,
          currentPoint: options.currentPoint,
          traveledColor: '#ff7a00',
          traveledWidth: 10,
          remainColor: '#9db5ff',
          remainWidth: 6
        })
      })
    }).catch(() => {})
  },

  async updateTripStatus(silent = true) {
    return runExclusive(this, '__updateTripStatusPromise', async () => {
      let rawOrder = null
      let runtime = null

      try {
        const orderResponse = await fetchOrderDetail(this.data.orderId, {
          skipToast: Boolean(silent)
        })
        rawOrder = syncOrderToCache(orderResponse.data)
        const runtimeResponse = await fetchOrderRuntime(this.data.orderId, {
          skipToast: true
        })
        runtime = runtimeResponse.data || runtimeResponse
      } catch (error) {
        rawOrder = findCachedOrder(this.data.orderId)
        runtime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(this.data.orderId) : null
        if (!rawOrder) {
          throw error
        }
        if (!silent) {
          wx.showToast({
            title: '行程信息已恢复显示',
            icon: 'none'
          })
        }
      }

      if (redirectToOrderFlow(this.route, rawOrder)) {
        this.stopPolling()
        return rawOrder
      }

      this.applyTripView(rawOrder, runtime)
      return rawOrder
    })
  },

  startPolling() {
    this.stopPolling()

    this.timer = setInterval(() => {
      runGuarded(this, '__polling', async () => {
        const rawOrder = await this.updateTripStatus(true)
        if (!rawOrder) return

        if ([ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(rawOrder.orderStatus)) {
          this.stopPolling()
          redirectToOrderFlow(this.route, rawOrder)
        }
      }).catch(() => {})
    }, 3000)
  },

  handleMapRegionChange(event) {
    const detail = event.detail || {}
    const causedBy = detail.causedBy || event.causedBy
    const changeType = detail.type || event.type
    if (causedBy !== 'gesture') return

    this.clearMapFollowTimer()
    if (this.data.mapFollowMode) {
      this.setData({ mapFollowMode: false })
    }
    if (changeType === 'end') {
      this.scheduleMapFollowRestore()
    }
  },

  scheduleMapFollowRestore() {
    this.clearMapFollowTimer()
    this.mapFollowTimer = setTimeout(() => {
      this.restoreVehicleView()
    }, MAP_FOLLOW_RESUME_DELAY)
  },

  clearMapFollowTimer() {
    if (this.mapFollowTimer) {
      clearTimeout(this.mapFollowTimer)
      this.mapFollowTimer = null
    }
  },

  restoreVehicleView() {
    const currentPoint = normalizePoint(this.data.currentPoint)
    if (!currentPoint.latitude || !currentPoint.longitude) return

    this.clearMapFollowTimer()
    this.setData({
      mapFollowMode: true,
      mapCenter: currentPoint
    })
    const mapContext = this.mapContext || (wx.createMapContext && wx.createMapContext('tripMap', this))
    if (!mapContext || !mapContext.moveToLocation) return
    mapContext.moveToLocation({
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude
    })
  },

  openSafetyCenter() {
    this.setData({ safetySheetVisible: true })
  },

  closeSafetyCenter() {
    this.setData({ safetySheetVisible: false })
  },

  stopEvent() {},

  openTripComplaint() {
    this.closeSafetyCenter()
    wx.navigateTo({
      url: `/pages/complaint/index?id=${encodeURIComponent(this.data.orderId)}`
    })
  },

  openSupportFeedback() {
    this.closeSafetyCenter()
    wx.navigateTo({ url: '/pages/support/index' })
  },

  async openEmergencySupport() {
    if (this.data.emergencyConnecting) return
    const order = this.data.order || {}
    const orderNo = order.orderNo || order.id || this.data.orderId || '--'
    const routeText = order.start && order.end
      ? `${order.start.name || '起点'} 至 ${order.end.name || '终点'}`
      : '行程进行中'

    this.setData({ emergencyConnecting: true })
    wx.showLoading({ title: '正在联系客服', mask: true })
    try {
      await sendSupportMessage(`${EMERGENCY_SUPPORT_PREFIX}行程中需要紧急人工客服，订单号：${orderNo}，行程：${routeText}`)
      this.closeSafetyCenter()
      wx.navigateTo({ url: '/pages/support/index?source=emergency' })
    } catch (error) {
      console.warn('Failed to create emergency support request', error)
      wx.showModal({
        title: '联系失败',
        content: '暂时无法连接平台客服，请立即联系您的紧急联系人或拨打 110。',
        confirmText: '知道了',
        showCancel: false
      })
    } finally {
      wx.hideLoading()
      this.setData({ emergencyConnecting: false })
    }
  },

  openEmergencyContact() {
    const profile = getApp().globalData.userStore.profile || {}
    const contactName = `${profile.emergencyContact || ''}`.trim()
    const contactPhone = `${profile.emergencyPhone || ''}`.trim()
    if (!contactPhone) {
      wx.showModal({
        title: '尚未设置紧急联系人',
        content: '设置后可在行程中一键拨打。',
        confirmText: '去设置',
        cancelText: '暂不设置',
        success: (result) => {
          if (result.confirm) {
            wx.navigateTo({ url: '/pages/profileEdit/index' })
          }
        }
      })
      return
    }

    wx.showModal({
      title: '紧急联系人',
      content: `${contactName || '紧急联系人'}  ${contactPhone}`,
      confirmText: '拨打电话',
      cancelText: '取消',
      success: (result) => {
        if (result.confirm) {
          wx.makePhoneCall({ phoneNumber: contactPhone })
        }
      }
    })
  },

  reportCurrentLocation() {}
})
