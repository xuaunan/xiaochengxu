const { cancelOrder, fetchOrderDetail, fetchOrderRuntime, pickupOrder } = require('../../utils/api')
const { buildRoutePolylines, hasUsableRoute } = require('../../utils/route-display')
const { buildRideOrderModel, findCachedOrder, getCarTypeMap, syncOrderToCache } = require('../../utils/user-store')
const { ORDER_STATUS } = require('../../utils/constants')
const { redirectToOrderFlow } = require('../../utils/order-flow')
const { createSimulation } = require('../../utils/trip-simulator')
const { runExclusive, runGuarded, switchTabSilky } = require('../../utils/page')
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
    traveledPoints: runtime.traveledPoints,
    remainPoints: runtime.remainPoints,
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

function getDisplayFallback(activeRuntime = {}, fallback = {}) {
  return activeRuntime.routePlanned || activeRuntime.routeReal ? fallback : {}
}

function mergeRuntimeSnapshot(runtime = {}, cachedRuntime = null, fallback = {}) {
  if (runtime && runtime.routeSource === 'demo_trace') {
    return {
      ...stripRouteFields(fallback || {}),
      ...stripRouteFields(runtime || {}),
      ...pickPlannedRoute(cachedRuntime),
      ...(runtime && runtime.routePlanned ? pickPlannedRoute(runtime) : {}),
      currentPoint: runtime && runtime.currentPoint ? runtime.currentPoint : fallback.currentPoint,
      heading: runtime && runtime.heading !== undefined ? runtime.heading : fallback.heading,
      phase: runtime.phase || fallback.phase,
      phaseText: runtime.phaseText || fallback.phaseText,
      routeSource: 'demo_trace',
      routeReal: false
    }
  }
  if (runtime && runtime.routeSource === 'travel_trace') {
    return runtime
  }
  if (hasRuntimeRoute(runtime)) {
    return runtime
  }
  if (hasRuntimeRoute(cachedRuntime)) {
    return {
      ...cachedRuntime,
      ...(runtime || {})
    }
  }
  return {
    ...stripRouteFields(fallback || {}),
    ...(runtime || {})
  }
}

function isDriverArrived(runtime = {}, rawOrder = {}) {
  if (rawOrder.orderStatus !== ORDER_STATUS.PICKING_UP) return false
  const remainDistanceKm = Number(runtime && runtime.remainDistanceKm !== undefined ? runtime.remainDistanceKm : NaN)
  const remainingSeconds = Number(runtime && runtime.remainingSeconds !== undefined ? runtime.remainingSeconds : NaN)
  const hasDistance = !Number.isNaN(remainDistanceKm)
  const hasSeconds = !Number.isNaN(remainingSeconds)

  if (hasDistance && hasSeconds) {
    return remainDistanceKm <= 0.05 && remainingSeconds <= 60
  }
  if (hasDistance) {
    return remainDistanceKm <= 0.05
  }
  if (hasSeconds) {
    return remainingSeconds <= 60
  }
  return runtime && runtime.driverArrived === true
}

function getTrafficText(runtime = {}, fallback = {}) {
  if (runtime.waitingRedLight) {
    return runtime.waitingText || runtime.trafficText || fallback.trafficText || '--'
  }
  return '接驾中'
}

function getRuntimePhase(runtime = {}, rawOrder = {}) {
  if (runtime.phase) return runtime.phase
  return rawOrder.orderStatus === ORDER_STATUS.IN_TRIP ? 'trip' : 'approach'
}

Page({
  data: {
    order: null,
    progress: 0,
    progressText: '0%',
    etaText: '--',
    trafficText: '--',
    driverPosition: null,
    markers: [],
    polyline: [],
    includePoints: [],
    latitude: 31.2,
    longitude: 121.33,
    orderId: '',
    actionButtonText: '刷新接驾状态',
    canceling: false
  },

  async onLoad(options) {
    this.setData({
      orderId: options.id || ''
    })

    const cachedOrder = findCachedOrder(this.data.orderId)
    if (cachedOrder) {
      this.applyOrderView(cachedOrder, null)
    }

    await this.refreshOrderView(false).catch(() => {})
    this.startPolling()
  },

  onShow() {
    if (!this.data.orderId) return
    this.refreshOrderView(true).catch(() => {})
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

  applyOrderView(rawOrder, runtime) {
    if (!rawOrder) return

    const app = getApp()
    const carTypeMap = getCarTypeMap(app.globalData.userStore.home.carTypes || [])
    const order = buildRideOrderModel(rawOrder, {
      carType: carTypeMap[rawOrder.carTypeId]
    })
    const fallback = createSimulation(rawOrder)
    const cachedRuntime = app.getOrderRuntimeCache ? app.getOrderRuntimeCache(rawOrder.id) : null
    const activeRuntime = mergeRuntimeSnapshot(runtime, cachedRuntime, fallback)
    const hasSyncedTrace = ['demo_trace', 'travel_trace'].includes(activeRuntime.routeSource)
    const driverPosition = normalizePoint(activeRuntime.currentPoint || fallback.currentPoint)
    const remainMinutes = Math.max(0, Math.round(Number(activeRuntime.remainingSeconds || fallback.remainingSeconds || 0) / 60))
    const driverArrived = isDriverArrived(activeRuntime, rawOrder)
    const displayRemainMinutes = driverArrived ? 0 : Math.max(1, remainMinutes)
    const displayPercent = !hasSyncedTrace
      ? 0
      : driverArrived
      ? 100
      : Math.min(98, Number(activeRuntime.percent !== undefined ? activeRuntime.percent : fallback.percent || 0))
    const phase = getRuntimePhase(activeRuntime, rawOrder)
    const targetPoint = phase === 'trip' ? order.end : order.start
    const routeStartPoint = normalizePoint(phase === 'trip'
      ? order.start
      : (activeRuntime.driverStartPoint || fallback.driverStart || driverPosition))
    const markers = [
      {
        id: 1,
        latitude: targetPoint.latitude,
        longitude: targetPoint.longitude,
        iconPath: phase === 'trip' ? '/images/map-end.png' : '/images/map-start.png',
        width: 34,
        height: 40
      },
      {
        id: 2,
        latitude: driverPosition.latitude,
        longitude: driverPosition.longitude,
        iconPath: '/images/map-driver.png',
        width: 48,
        height: 48,
        rotate: Number(activeRuntime.heading || fallback.heading || 0),
        anchor: {
          x: 0.5,
          y: 0.5
        },
        callout: {
          content: driverArrived ? '司机已到达上车点' : `司机接驾中 ${displayRemainMinutes} 分钟`,
          color: '#1f2432',
          bgColor: '#ffffff',
          borderRadius: 12,
          padding: 8,
          display: 'ALWAYS'
        }
      }
    ]
    const displayFallback = getDisplayFallback(activeRuntime, fallback)
    const polyline = buildRoutePolylines({
      runtime: activeRuntime,
      fallback: displayFallback,
      phase,
      currentPoint: driverPosition,
      traveledColor: '#2c63ff',
      traveledWidth: 8,
      remainColor: '#8fb2ff',
      remainWidth: 6
    })

    this.setData({
      order,
      progress: displayPercent / 100,
      driverPosition,
      etaText: !hasSyncedTrace ? '等待司机位置更新' : (driverArrived ? '司机已到达，请确认上车' : `预计 ${displayRemainMinutes} 分钟到达起点`),
      trafficText: hasSyncedTrace ? getTrafficText(activeRuntime, fallback) : '司机位置更新中',
      progressText: `${displayPercent}%`,
      actionButtonText: driverArrived ? '我已上车' : '刷新接驾状态',
      markers,
      polyline,
      includePoints: [targetPoint, driverPosition],
      latitude: targetPoint.latitude,
      longitude: targetPoint.longitude
    })

    app.setCurrentRideOrder(order, {
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
      currentPoint: driverPosition,
      from: routeStartPoint,
      to: targetPoint
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
          traveledColor: '#2c63ff',
          traveledWidth: 8,
          remainColor: '#8fb2ff',
          remainWidth: 6
        })
      })
    }).catch(() => {})
  },

  async refreshOrderView(silent = true) {
    return runExclusive(this, '__refreshOrderViewPromise', async () => {
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
            title: '接驾信息已恢复显示',
            icon: 'none'
          })
        }
      }

      if (redirectToOrderFlow(this.route, rawOrder)) {
        this.stopPolling()
        return rawOrder
      }

      this.applyOrderView(rawOrder, runtime)
      return rawOrder
    })
  },

  startPolling() {
    this.stopPolling()

    this.timer = setInterval(() => {
      runGuarded(this, '__polling', async () => {
        const rawOrder = await this.refreshOrderView(true)
        if (!rawOrder) return

        if ([ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(rawOrder.orderStatus)) {
          this.stopPolling()
          redirectToOrderFlow(this.route, rawOrder)
        }
      }).catch(() => {})
    }, 3000)
  },

  contactDriver() {
    wx.showToast({
      title: '暂未返回司机电话，请稍后重试',
      icon: 'none'
    })
  },

  cancelRideOrder() {
    if (!this.data.order || this.data.canceling) return

    wx.showModal({
      title: '取消订单',
      content: this.data.order.cancelRule || '确认取消当前订单吗？',
      confirmText: '确认取消',
      cancelText: '再等等',
      success: async ({ confirm }) => {
        if (!confirm) return
        const cancelReason = '乘客在司机接单页主动取消'
        this.setData({ canceling: true })
        wx.showLoading({ title: '取消中' })
        try {
          await cancelOrder(this.data.order.id, cancelReason)
          let cancelledOrder = null
          try {
            const detailResponse = await fetchOrderDetail(this.data.order.id, { skipToast: true })
            cancelledOrder = detailResponse.data
          } catch (error) {
            cancelledOrder = null
          }
          syncOrderToCache(cancelledOrder || {
            ...(findCachedOrder(this.data.order.id) || {}),
            ...this.data.order,
            orderStatus: ORDER_STATUS.CANCELLED,
            cancelReason,
            updatedAt: new Date().toISOString()
          })
          this.stopPolling()
          wx.hideLoading()
          wx.showToast({
            title: '订单已取消',
            icon: 'none'
          })
          getApp().setCurrentRideOrder(null)
          setTimeout(() => {
            switchTabSilky(this, {
              url: '/pages/home/index'
            }, {
              selector: '.home-page'
            })
          }, 220)
        } catch (error) {
          wx.hideLoading()
          this.setData({ canceling: false })
          wx.showToast({
            title: error && error.message ? error.message : '取消失败，请稍后重试',
            icon: 'none'
          })
        }
      }
    })
  },

  async startTripNow() {
    if (!this.data.order) return
    const runtime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(this.data.order.id) : null
    if (!isDriverArrived(runtime, this.data.order)) {
      this.refreshOrderView(false).catch(() => {})
      return
    }
    await pickupOrder(this.data.order.id)
    await this.refreshOrderView(false)
  }
})
