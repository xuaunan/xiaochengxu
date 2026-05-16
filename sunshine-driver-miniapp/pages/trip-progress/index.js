const { fetchOrderDetail, fetchOrderRuntime, fetchOrders, reportTrack } = require('../../utils/api')
const { ORDER_STATUS, getServiceTypeMeta } = require('../../utils/constants')
const { formatPrice, mapTripOrder } = require('../../utils/driver-store')
const { createSimulation } = require('../../utils/trip-simulator')
const { buildRoutePolylines, hasUsableRoute } = require('../../utils/route-display')
const { requestRoute } = require('../../utils/route-planner')
const { broadcastDriver, notifyDriver } = require('../../utils/notify')
const { TRACK_MODE, getCurrentTrackMode, getTrackModeLabel } = require('../../utils/track-mode')
const { buildTrackReport } = require('../../utils/track-reporter')

const POLL_INTERVAL = 3000

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? fallback : numeric
}

function normalizePoint(point = {}) {
  return {
    latitude: toNumber(point.latitude),
    longitude: toNumber(point.longitude)
  }
}

function hasRuntimeRoute(runtime) {
  return hasUsableRoute(runtime)
}

function getTrafficText(runtime = {}, fallback = {}) {
  if (runtime.waitingRedLight) {
    return runtime.waitingText || runtime.trafficText || fallback.trafficText || '--'
  }
  return runtime.trafficText || fallback.trafficText || '--'
}

function getRuntimePhase(runtime = {}, order = {}) {
  if (runtime.phase) return runtime.phase
  return order.orderStatus === ORDER_STATUS.IN_TRIP ? 'trip' : 'approach'
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

function mergeRuntimeSnapshot(runtime = {}, cachedRuntime = null, fallback = {}, trackMode = TRACK_MODE.DEMO) {
  if (trackMode === TRACK_MODE.DEMO) {
    return {
      ...(runtime || {}),
      ...stripRouteFields(fallback || {}),
      ...pickPlannedRoute(cachedRuntime),
      ...(runtime && runtime.routePlanned ? pickPlannedRoute(runtime) : {}),
      currentPoint: runtime && runtime.currentPoint && runtime.routeSource !== 'order_record'
        ? runtime.currentPoint
        : fallback.currentPoint,
      heading: runtime && runtime.heading !== undefined ? runtime.heading : fallback.heading,
      routeSource: 'demo_trace',
      routeReal: false
    }
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

function getDemoRouteStart(runtime = {}, fallback = {}) {
  if (runtime && runtime.currentPoint && runtime.routeSource !== 'order_record') return runtime.currentPoint
  if (runtime && runtime.driverStartPoint) return runtime.driverStartPoint
  if (fallback && fallback.driverStart) return fallback.driverStart
  return fallback.currentPoint
}

function isDriverArrived(runtime = {}, rawOrder = {}) {
  if (![ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(rawOrder.orderStatus)) return false
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

function asPlainObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {}
  }
  return value
}

function canReportTrack(order = {}) {
  return [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus)
}

function formatDistance(value) {
  return `${toNumber(value).toFixed(1)} 公里`
}

function formatDurationMinutes(seconds) {
  return `${Math.max(0, Math.round(toNumber(seconds) / 60))} 分钟`
}

function buildTripModel(order = {}, runtime = null) {
  const serviceTypeMeta = getServiceTypeMeta(order.serviceType)
  const fallback = createSimulation(order)
  const cachedRuntime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(order.id) : null
  const trackMode = getCurrentTrackMode()
  const activeRuntime = mergeRuntimeSnapshot(runtime, cachedRuntime, fallback, trackMode)
  const routeCurrentPoint = trackMode === TRACK_MODE.DEMO
    ? normalizePoint(getDemoRouteStart(runtime, fallback))
    : normalizePoint(activeRuntime.currentPoint || fallback.currentPoint)
  const start = {
    latitude: toNumber(order.startLat),
    longitude: toNumber(order.startLng),
    name: order.startName
  }
  const end = {
    latitude: toNumber(order.endLat),
    longitude: toNumber(order.endLng),
    name: order.endName
  }
  const currentPoint = normalizePoint(activeRuntime.currentPoint || routeCurrentPoint || fallback.currentPoint)
  const remainingSeconds = toNumber(activeRuntime.remainingSeconds, fallback.remainingSeconds)
  const rawRemainMinutes = Math.max(0, Math.round(remainingSeconds / 60))
  const phase = getRuntimePhase(activeRuntime, order)
  const targetPoint = phase === 'trip' ? end : start
  const rawPercent = activeRuntime.percent !== undefined ? activeRuntime.percent : fallback.percent
  const traveledDistanceKm = activeRuntime.traveledDistanceKm !== undefined
    ? activeRuntime.traveledDistanceKm
    : fallback.traveledDistanceKm
  const elapsedSeconds = activeRuntime.elapsedSeconds !== undefined
    ? activeRuntime.elapsedSeconds
    : fallback.usedSeconds
  const heading = toNumber(activeRuntime.heading, fallback.heading)
  const trafficText = getTrafficText(activeRuntime, fallback)
  const driverArrived = phase === 'approach' && isDriverArrived(activeRuntime, order)
  const remainMinutes = driverArrived ? 0 : Math.max(1, rawRemainMinutes)
  const percent = driverArrived || order.orderStatus === ORDER_STATUS.IN_TRIP || order.orderStatus === ORDER_STATUS.FINISHED
    ? rawPercent
    : Math.min(98, Number(rawPercent || 0))
  const etaText = driverArrived
    ? '司机已到达上车点'
    : remainMinutes > 0
      ? `${remainMinutes} 分钟后到达`
      : '即将到达'
  const statusText = order.orderStatus === ORDER_STATUS.IN_TRIP
    ? '行程中'
    : driverArrived
      ? '司机已到达'
      : [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus)
        ? '接驾中'
        : order.orderStatus === ORDER_STATUS.FINISHED
          ? '已完成'
          : '进行中'

  return {
    id: order.id,
    start,
    end,
    serviceTypeLabel: serviceTypeMeta.label,
    trackModeText: `${getTrackModeLabel(trackMode)}轨迹`,
    serviceTypeClassName: serviceTypeMeta.className,
    fareText: formatPrice(order.actualAmount || order.payableAmount || order.estimatedAmount, order.currencyCode),
    statusText,
    etaText,
    trafficText,
    mileageText: formatDistance(traveledDistanceKm),
    remainDistanceKm: toNumber(activeRuntime.remainDistanceKm, fallback.remainDistanceKm),
    durationText: formatDurationMinutes(elapsedSeconds),
    progressText: `${percent}%`,
    speedText: `${toNumber(activeRuntime.speedKmh, 90)} km/h`,
    actionText: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus)
      ? '查看司机操作'
      : '查看详情',
    orderStatus: order.orderStatus,
    markers: [
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
        latitude: currentPoint.latitude,
        longitude: currentPoint.longitude,
        iconPath: '/images/map-driver.png',
        width: 42,
        height: 42,
        rotate: heading,
        anchor: {
          x: 0.5,
          y: 0.5
        },
        callout: {
          content: etaText,
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
      fallback: getDisplayFallback(activeRuntime, fallback),
      phase,
      currentPoint,
      traveledColor: '#ff7a00',
      traveledWidth: 10,
      remainColor: '#9db5ff',
      remainWidth: 6
    }),
    includePoints: [start, end, currentPoint],
    routePlan: {
      phase,
      currentPoint: routeCurrentPoint || currentPoint,
      from: routeCurrentPoint || currentPoint,
      to: targetPoint,
      fallback,
      activeRuntime
    }
  }
}

Page({
  data: {
    orderId: '',
    order: null,
    noticePopup: {
      visible: false
    }
  },

  async onLoad(options) {
    this.setData({
      orderId: options.id || ''
    })
    await this.loadTrip(false)
    this.startPolling()
  },

  onShow() {
    if (!this.data.orderId) return
    this.loadTrip(true).catch(() => {})
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  startPolling() {
    this.stopPolling()
    this.timer = setInterval(() => {
      this.loadTrip(true).catch(() => {})
    }, POLL_INTERVAL)
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  async syncOrderList() {
    const response = await fetchOrders()
    const store = getApp().globalData.driverStore
    store.tripOrders = (response.data || []).map(mapTripOrder)
    getApp().saveStore()
  },

  async loadTrip(silent = false) {
    if (!this.data.orderId) return null
    if (this.tripLoadPromise) return this.tripLoadPromise

    const task = (async () => {
      let order = null
      let runtime = null

      try {
        const orderResponse = await fetchOrderDetail(this.data.orderId)
        order = asPlainObject(orderResponse.data)
        this.currentRawOrder = order
        const runtimeResponse = await fetchOrderRuntime(this.data.orderId)
        runtime = asPlainObject(runtimeResponse.data || runtimeResponse)
      } catch (error) {
        const fallbackResponse = await fetchOrderDetail(this.data.orderId)
        order = asPlainObject(fallbackResponse.data)
        this.currentRawOrder = order
        runtime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(this.data.orderId) : null
        if (!silent) {
          wx.showToast({
            title: '实时轨迹同步失败，请稍后刷新',
            icon: 'none'
          })
        }
      }

      if (hasRuntimeRoute(runtime) && getApp().setOrderRuntimeCache) {
        getApp().setOrderRuntimeCache(this.data.orderId, runtime)
      }
      const tripModel = buildTripModel(order, runtime)
      this.currentRoutePlan = tripModel.routePlan || null
      const orderView = {
        ...tripModel
      }
      delete orderView.routePlan

      this.setData({
        order: orderView
      })
      this.handleTripVoice(orderView, order)
      this.syncPlannedRoute(orderView.id).then((planned) => {
        if (planned === false) {
          this.reportCurrentLocation(order).catch(() => {})
        }
      }).catch(() => {
        this.reportCurrentLocation(order).catch(() => {})
      })
      await this.syncOrderList().catch(() => {})

      if ([ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(order.orderStatus)) {
        this.stopPolling()
      }

      return orderView
    })()

    this.tripLoadPromise = task.finally(() => {
      this.tripLoadPromise = null
    })
    return this.tripLoadPromise
  },

  handleTripVoice(tripModel = {}, rawOrder = {}) {
    const remainMeters = Number(tripModel.remainDistanceKm || 0) * 1000
    if ([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(rawOrder.orderStatus) && remainMeters > 0 && remainMeters <= 500) {
      broadcastDriver(this, `距离上车点还有500米，请准备接乘客`, `pickup-500-${rawOrder.id}`)
    }

    if (rawOrder.orderStatus === ORDER_STATUS.IN_TRIP) {
      broadcastDriver(this, '乘客已上车，请开始行程', `passenger-onboard-${rawOrder.id}`)
      broadcastDriver(this, '请提醒乘客系好安全带并确认目的地', `passenger-reminder-after-onboard-${rawOrder.id}`)
      if (remainMeters > 0 && remainMeters <= 500) {
        broadcastDriver(this, '距离目的地还有500米，请提醒乘客带好随身物品', `destination-500-${rawOrder.id}`)
      }
    }

    if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED && (!rawOrder.cancelByRole || rawOrder.cancelByRole === 'USER')) {
      notifyDriver(this, '乘客取消订单', `${rawOrder.startName} 到 ${rawOrder.endName} 的订单已被乘客取消。`, {
        id: `cancel-notice-${rawOrder.id}`,
        type: 'cancel'
      })
      broadcastDriver(this, `乘客已取消订单，${rawOrder.startName}到${rawOrder.endName}`, `passenger-cancel-${rawOrder.id}`)
    }
  },

  syncPlannedRoute(orderId) {
    const plan = this.currentRoutePlan || {}
    if (!orderId || !plan.from || !plan.to || !plan.currentPoint) return Promise.resolve(false)
    const routeKey = `${orderId}|${plan.phase}|${plan.currentPoint.latitude},${plan.currentPoint.longitude}`
    this.latestRoutePlanKey = routeKey
    return requestRoute(plan.from, plan.to).then((routePoints) => {
      if (this.latestRoutePlanKey !== routeKey) return null
      if (!routePoints.length) return false
      const phaseRouteKey = plan.phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'
      const runtime = {
        ...plan.activeRuntime,
        [phaseRouteKey]: routePoints,
        routePoints,
        fullRoutePoints: routePoints,
        remainPoints: routePoints,
        routePlanned: true
      }
      const app = getApp()
      if (app.setOrderRuntimeCache) {
        app.setOrderRuntimeCache(orderId, runtime)
      }
      const tripModel = this.currentRawOrder ? buildTripModel(this.currentRawOrder, runtime) : null
      if (tripModel) {
        this.currentRoutePlan = tripModel.routePlan || {
          ...(this.currentRoutePlan || {}),
          activeRuntime: runtime
        }
        const orderView = {
          ...tripModel
        }
        delete orderView.routePlan
        this.setData({
          order: orderView
        })
      } else {
        this.currentRoutePlan = {
          ...(this.currentRoutePlan || {}),
          activeRuntime: runtime
        }
        this.setData({
          'order.polyline': buildRoutePolylines({
            runtime,
            fallback: plan.fallback,
            phase: plan.phase,
            currentPoint: plan.currentPoint,
            traveledColor: '#ff7a00',
            traveledWidth: 10,
            remainColor: '#9db5ff',
            remainWidth: 6
          })
        })
      }
      const rawOrder = this.currentRawOrder
      if (rawOrder && [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(rawOrder.orderStatus)) {
        this.reportCurrentLocation(rawOrder, { force: true }).catch(() => {})
      }
      return true
    }).catch(() => false)
  },

  openTripDetail() {
    if (!this.data.orderId) return
    wx.navigateTo({
      url: `/pages/trip-detail/index?id=${this.data.orderId}`
    })
  }
,

  async reportCurrentLocation(order = {}, options = {}) {
    if (!order.id || !canReportTrack(order)) return
    const now = Date.now()
    if (!options.force && this.lastTrackReportAt && now - this.lastTrackReportAt < POLL_INTERVAL - 200) return
    this.lastTrackReportAt = now

    const runtime = this.currentRoutePlan && this.currentRoutePlan.activeRuntime ? this.currentRoutePlan.activeRuntime : {}
    const report = await buildTrackReport(order, { runtime })
    await reportTrack(order.id, report.payload)
    const nextRuntime = {
      ...runtime,
      ...(report.runtime || {}),
      currentPoint: {
        latitude: Number(report.payload.latitude),
        longitude: Number(report.payload.longitude)
      },
      traceMode: report.mode,
      routeSource: report.mode === TRACK_MODE.DEMO ? 'demo_trace' : 'travel_trace',
      routeReal: report.mode === TRACK_MODE.REAL
    }
    const app = getApp()
    if (app.setOrderRuntimeCache) {
      app.setOrderRuntimeCache(order.id, nextRuntime)
    }
    this.currentRoutePlan = {
      ...(this.currentRoutePlan || {}),
      activeRuntime: nextRuntime,
      currentPoint: nextRuntime.currentPoint
    }
    const tripModel = buildTripModel(order, nextRuntime)
    this.currentRoutePlan = tripModel.routePlan || this.currentRoutePlan
    const orderView = {
      ...tripModel
    }
    delete orderView.routePlan
    this.setData({
      order: orderView
    })
  }
})
