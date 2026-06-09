const { fetchOrderDetail, fetchOrderRuntime } = require('../../utils/api')
const { buildRoutePolylines, hasUsableRoute } = require('../../utils/route-display')
const { formatDistance, formatDuration } = require('../../utils/format')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, syncOrderToCache } = require('../../utils/user-store')
const { ORDER_STATUS } = require('../../utils/constants')
const { redirectToOrderFlow } = require('../../utils/order-flow')
const { createSimulation } = require('../../utils/trip-simulator')
const { runExclusive, runGuarded } = require('../../utils/page')
const { requestRoute } = require('../../utils/route-planner')

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

Page({
  data: {
    order: null,
    progress: 0,
    currentPoint: null,
    markers: [],
    polyline: [],
    includePoints: [],
    etaText: '--',
    trafficText: '--',
    mileageText: '--',
    durationText: '--',
    progressText: '0%',
    orderId: ''
  },

  async onLoad(options) {
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
    this.updateTripStatus(true).catch(() => {})
    this.startPolling()
  },

  onUnload() {
    this.stopPolling()
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
    const routeStartPoint = phase === 'trip'
      ? order.start
      : normalizePoint(activeRuntime.driverStartPoint || fallback.driverStart || currentPoint)
    const routeEndPoint = phase === 'trip' ? order.end : order.start
    const remainMinutes = Math.max(0, Math.round(Number(activeRuntime.remainingSeconds || fallback.remainingSeconds || 0) / 60))

    this.setData({
      order,
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
          iconPath: '/images/map-driver.png',
          width: 48,
          height: 48,
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
      }),
      includePoints: [order.start, order.end, currentPoint]
    })

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

  openSafetyCenter() {
    const profile = getApp().globalData.userStore.profile
    wx.showModal({
      title: '安全中心',
      content: `紧急联系人：${profile.emergencyContact || '未设置'} ${profile.emergencyPhone || ''}`.trim(),
      showCancel: false
    })
  },

  openEmergencyContact() {
    const profile = getApp().globalData.userStore.profile
    wx.showModal({
      title: '紧急联系人',
      content: `${profile.emergencyContact || '未设置'} ${profile.emergencyPhone || ''}`.trim() || '暂未设置紧急联系人',
      confirmText: '知道了',
      showCancel: false
    })
  },

  reportCurrentLocation() {}
})
