const { fetchOrderDetail, fetchOrderRuntime, fetchOrders, finishOrder, pickupOrder, startOrder } = require('../../utils/api')
const { ORDER_STATUS, getOrderStatusMeta, getServiceTypeMeta } = require('../../utils/constants')
const { formatPrice, mapTripOrder, nextActionText } = require('../../utils/driver-store')
const { createSimulation } = require('../../utils/trip-simulator')
const { broadcastDriver, notifyDriver } = require('../../utils/notify')

const DETAIL_POLL_INTERVAL = 3000

function formatMetric(value, suffix, digits = 0, fallback = '--') {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric < 0) {
    return fallback
  }
  return `${numeric.toFixed(digits)} ${suffix}`
}

function hasRuntimeRoute(runtime = {}) {
  if (!runtime) return false
  return (Array.isArray(runtime.traveledPoints) && runtime.traveledPoints.length > 1) ||
    (Array.isArray(runtime.remainPoints) && runtime.remainPoints.length > 1) ||
    (Array.isArray(runtime.tripRoutePoints) && runtime.tripRoutePoints.length > 1) ||
    (Array.isArray(runtime.approachRoutePoints) && runtime.approachRoutePoints.length > 1)
}

function getTrafficText(runtime = {}, fallback = {}) {
  if (runtime.waitingRedLight) {
    return runtime.waitingText || runtime.trafficText || fallback.trafficText || '--'
  }
  return runtime.trafficText || fallback.trafficText || '--'
}

function asPlainObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {}
  }
  return value
}

function buildTripView(trip = {}, runtime = null) {
  const serviceTypeMeta = getServiceTypeMeta(trip.serviceType)
  const statusMeta = getOrderStatusMeta(trip.orderStatus)
  const fallback = createSimulation(trip)
  const cachedRuntime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(trip.id) : null
  const activeRuntime = hasRuntimeRoute(runtime) ? runtime : (hasRuntimeRoute(cachedRuntime) ? cachedRuntime : (runtime || {}))
  const traveledDistanceKm = activeRuntime.traveledDistanceKm !== undefined
    ? activeRuntime.traveledDistanceKm
    : fallback.traveledDistanceKm
  const elapsedSeconds = activeRuntime.elapsedSeconds !== undefined
    ? activeRuntime.elapsedSeconds
    : fallback.usedSeconds
  const percent = activeRuntime.percent !== undefined ? activeRuntime.percent : fallback.percent

  return {
    ...trip,
    runtime: activeRuntime,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    fareText: formatPrice(trip.actualAmount || trip.payableAmount || trip.estimatedAmount, trip.currencyCode),
    passengerText: `乘客 ${trip.userId || '--'}`,
    statusText: statusMeta.label,
    statusTagType: statusMeta.tagType,
    distanceText: formatMetric(traveledDistanceKm, '公里', 1),
    durationText: formatMetric(elapsedSeconds / 60, '分钟', 0),
    percentText: `${percent}%`,
    trafficText: getTrafficText(activeRuntime, fallback),
    timeline: [
      { key: 'accept', label: '已接单', done: true, active: trip.orderStatus === ORDER_STATUS.ACCEPTED },
      { key: 'pickup', label: '接驾中', done: [ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED].includes(trip.orderStatus), active: trip.orderStatus === ORDER_STATUS.PICKING_UP },
      { key: 'trip', label: '行程中', done: [ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED].includes(trip.orderStatus), active: trip.orderStatus === ORDER_STATUS.IN_TRIP },
      { key: 'finish', label: '已完成', done: trip.orderStatus === ORDER_STATUS.FINISHED, active: trip.orderStatus === ORDER_STATUS.FINISHED }
    ]
  }
}

Page({
  data: {
    orderId: '',
    trip: null,
    actionText: '状态已完结',
    noticePopup: {
      visible: false
    }
  },

  async onLoad(options) {
    this.setData({
      orderId: options.id || ''
    })
    await this.loadTrip(this.data.orderId)
  },

  onShow() {
    if (!this.data.orderId) return
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
    this.pollingTimer = setInterval(() => {
      this.loadTrip(this.data.orderId, true).catch(() => {})
    }, DETAIL_POLL_INTERVAL)
  },

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  },

  async syncTripStore() {
    const response = await fetchOrders()
    const list = (response.data || []).map(mapTripOrder)
    const store = getApp().globalData.driverStore
    store.tripOrders = list
    getApp().saveStore()
  },

  async loadTrip(id, silent = false) {
    if (!id) return null
    if (this.tripLoadPromise) return this.tripLoadPromise

    const task = (async () => {
      let tripData = {}
      let runtime = null

      try {
        const response = await fetchOrderDetail(id)
        tripData = asPlainObject(response.data)
        const runtimeResponse = await fetchOrderRuntime(id)
        runtime = asPlainObject(runtimeResponse.data || runtimeResponse)
      } catch (error) {
        const response = await fetchOrderDetail(id)
        tripData = asPlainObject(response.data)
        runtime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(id) : null
        if (!silent) {
          wx.showToast({
            title: '实时轨迹暂不可用，请稍后刷新',
            icon: 'none'
          })
        }
      }

      if (hasRuntimeRoute(runtime) && getApp().setOrderRuntimeCache) {
        getApp().setOrderRuntimeCache(id, runtime)
      }
      const trip = buildTripView(tripData, runtime)
      this.currentTripRuntime = trip.runtime || {}
      const tripView = {
        ...trip
      }
      delete tripView.runtime

      this.setData({
        trip: tripView,
        actionText: nextActionText(trip.orderStatus)
      })

      await this.syncTripStore().catch(() => {
        if (!silent) {
          wx.showToast({
            title: '订单列表同步失败，稍后重试',
            icon: 'none'
          })
        }
      })

      if (trip.orderStatus === ORDER_STATUS.FINISHED) {
        this.stopPolling()
      }

      if (trip.orderStatus === ORDER_STATUS.CANCELLED && (!trip.cancelByRole || trip.cancelByRole === 'USER')) {
        notifyDriver(this, '乘客取消订单', `${trip.startName} 到 ${trip.endName} 的订单已被乘客取消。`, {
          id: `cancel-notice-${trip.id}`,
          type: 'cancel'
        })
        broadcastDriver(this, `乘客已取消订单，${trip.startName}到${trip.endName}`, `passenger-cancel-${trip.id}`)
      }

      return tripView
    })()

    this.tripLoadPromise = task.finally(() => {
      this.tripLoadPromise = null
    })
    return this.tripLoadPromise
  },

  async updateStatus() {
    const trip = this.data.trip
    if (!trip) return

    const previousStatus = trip.orderStatus
    if (trip.orderStatus === ORDER_STATUS.ACCEPTED) {
      await startOrder(trip.id)
    } else if (trip.orderStatus === ORDER_STATUS.PICKING_UP) {
      await pickupOrder(trip.id)
    } else if (trip.orderStatus === ORDER_STATUS.IN_TRIP) {
      const runtime = this.currentTripRuntime || {}
      await finishOrder(trip.id, {
        actualDistanceKm: Number(runtime.tripDistanceKm || runtime.traveledDistanceKm || trip.actualDistanceKm || trip.estimatedDistanceKm || 10),
        actualDurationMin: Number(runtime.tripTotalSeconds ? runtime.tripTotalSeconds / 60 : trip.actualDurationMin || trip.estimatedDurationMin || 20)
      })
    } else {
      wx.showToast({ title: '当前状态无需处理', icon: 'none' })
      return
    }

    await this.loadTrip(trip.id)
    if (previousStatus === ORDER_STATUS.PICKING_UP) {
      broadcastDriver(this, '乘客已上车，请开始行程', `passenger-onboard-${trip.id}`)
      broadcastDriver(this, '请提醒乘客系好安全带并确认目的地', `passenger-reminder-after-onboard-${trip.id}`)
    }
    wx.showToast({ title: '状态已更新', icon: 'success' })
  }
})
