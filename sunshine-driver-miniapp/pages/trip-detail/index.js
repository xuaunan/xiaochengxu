const { fetchOrderDetail, fetchOrderRuntime, fetchOrders, finishOrder, payCarpoolPenalty, pickupOrder, setCarpoolToll, startOrder } = require('../../utils/api')
const { ORDER_STATUS, SERVICE_TYPE, getOrderStatusMeta, getServiceTypeMeta } = require('../../utils/constants')
const { formatPrice, mapTripOrder, nextActionText, parseCarpoolMeta, parseInternationalMeta } = require('../../utils/driver-store')
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

function firstText(...values) {
  const matched = values.find((value) => `${value || ''}`.trim())
  return matched === undefined ? '' : `${matched}`.trim()
}

function getCarpoolLatestStartAt(trip = {}) {
  const start = trip.carpoolDepartureAt ? new Date(trip.carpoolDepartureAt).getTime() : NaN
  const end = trip.carpoolDepartureEndAt ? new Date(trip.carpoolDepartureEndAt).getTime() : NaN
  if (Number.isFinite(end)) return end - 30 * 60 * 1000
  if (Number.isFinite(start)) return start + 30 * 60 * 1000
  return NaN
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

function mergeRuntimeForDisplay(runtime = {}, cachedRuntime = null) {
  const serverRuntime = asPlainObject(runtime)
  const routeRuntime = hasRuntimeRoute(serverRuntime)
    ? serverRuntime
    : hasRuntimeRoute(cachedRuntime)
      ? cachedRuntime
      : {}
  return {
    ...routeRuntime,
    ...serverRuntime
  }
}

function clampProgress(value, fallback = 0) {
  const numeric = Number(value)
  const next = Number.isNaN(numeric) ? fallback : numeric
  return Math.max(0, Math.min(100, Math.round(next)))
}

function formatRuntimeDistance(value, fallback = '--') {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric <= 0) return fallback
  return `${Number(numeric.toFixed(1))} 公里`
}

function formatRuntimeMinutes(seconds, fallback = '--') {
  const numeric = Number(seconds)
  if (Number.isNaN(numeric) || numeric <= 0) return fallback
  return `${Math.max(1, Math.round(numeric / 60))} 分钟`
}

function compactFacts(items = []) {
  return items
    .filter((item) => item && `${item.value || ''}`.trim())
    .slice(0, 3)
}

function normalizeTripStatusFields(order = {}) {
  const rawStatus = `${order.orderStatus || order.order_status || order.rawStatus || order.status || ''}`.trim()
  const statusMap = {
    completed: ORDER_STATUS.FINISHED,
    finished: ORDER_STATUS.FINISHED,
    cancelled: ORDER_STATUS.CANCELLED
  }
  return {
    ...order,
    orderStatus: statusMap[rawStatus] || rawStatus.toUpperCase()
  }
}

function buildDriveStatusView(trip = {}, runtime = {}, fallback = {}) {
  const runtimeText = firstText(runtime.displayText, runtime.stateText, runtime.phaseText, runtime.waitingText, runtime.trafficText)
  const progress = clampProgress(runtime.percent, fallback.percent || 0)
  const remainingDistanceText = formatRuntimeDistance(runtime.remainDistanceKm, '')
  const traveledDistanceText = formatRuntimeDistance(runtime.traveledDistanceKm, formatMetric(trip.actualDistanceKm || trip.estimatedDistanceKm, '公里', 1))
  const elapsedText = formatRuntimeMinutes(runtime.elapsedSeconds, formatMetric((trip.actualDurationMin || trip.estimatedDurationMin || 0), '分钟', 0))
  const incomeText = formatPrice(trip.driverIncomeAmount || trip.actualAmount || trip.payableAmount || trip.estimatedAmount, trip.currencyCode)

  if (trip.orderStatus === ORDER_STATUS.CANCELLED) {
    return {
      sectionTitle: '行程结果',
      subtitle: '订单已取消',
      description: firstText(trip.cancelReason, '本单已取消，行程状态已同步。'),
      badge: '已关闭',
      visualType: 'cancelled',
      visualTitle: '服务已停止',
      visualHint: '无需继续接驾或行驶',
      progress: 0,
      state: 'cancelled',
      facts: compactFacts([
        { label: '取消原因', value: trip.cancelReason || '订单已关闭' },
        { label: '下一步', value: '返回听单' },
        { label: '费用', value: incomeText }
      ])
    }
  }

  if (trip.orderStatus === ORDER_STATUS.FINISHED) {
    return {
      sectionTitle: '行程结果',
      subtitle: '行程已完成',
      description: '已到达目的地，订单状态已完成。',
      badge: '已送达',
      visualType: 'finished',
      visualTitle: '本单已完成',
      visualHint: '可在钱包查看入账与提现记录',
      progress: 100,
      state: 'finished',
      facts: compactFacts([{ label: '本单金额', value: incomeText, tone: 'strong' }])
    }
  }

  if (trip.orderStatus === ORDER_STATUS.ACCEPTED) {
    const isCarpool = trip.serviceType === SERVICE_TYPE.CARPOOL
    return {
      sectionTitle: isCarpool ? '接驾准备' : '接驾准备',
      subtitle: isCarpool ? '顺风车订单已接取' : '订单已接取',
      description: isCarpool ? '请确认行程信息，准备好后点击开始接驾。' : '正在同步接驾状态，请稍候。',
      badge: isCarpool ? '等待出发' : '准备出发',
      visualType: isCarpool ? 'accepted' : 'approach',
      visualTitle: isCarpool ? '确认后开始接驾' : '前往乘客上车点',
      visualHint: isCarpool ? '乘客端会在你开始接驾后看到实时状态' : '接驾状态确认后将自动开始导航',
      progress: Math.max(12, progress),
      state: 'accepted',
      facts: compactFacts([
        { label: '当前状态', value: '已接单' },
        { label: '接驾状态', value: '正在同步' },
        { label: '上车地点', value: trip.startName || '待同步' }
      ])
    }
  }

  if (trip.orderStatus === ORDER_STATUS.PICKING_UP) {
    return {
      sectionTitle: '接驾状态',
      subtitle: '接驾中',
      description: runtimeText || firstText(fallback.trafficText, '正在前往乘客上车点。'),
      badge: '正在前往',
      visualType: 'approach',
      visualTitle: '前往乘客上车点',
      visualHint: trip.serviceType === SERVICE_TYPE.CARPOOL ? '到达上车点后等待乘客确认上车' : (remainingDistanceText ? `距上车点约 ${remainingDistanceText}` : '到达后确认乘客上车'),
      progress: Math.max(24, progress),
      state: 'approach',
      facts: compactFacts([
        { label: '下一步', value: nextActionText(trip.orderStatus) },
        { label: '剩余距离', value: remainingDistanceText || '同步中' },
        { label: '行驶状态', value: firstText(runtime.waitingText, runtime.trafficText, '路线导航中') }
      ])
    }
  }

  if (trip.orderStatus === ORDER_STATUS.IN_TRIP) {
    return {
      sectionTitle: '行驶状态',
      subtitle: '行程进行中',
      description: runtimeText || firstText(fallback.trafficText, '车辆正在前往目的地。'),
      badge: '送达中',
      visualType: trip.serviceType === SERVICE_TYPE.CARPOOL ? 'carpool-trip' : 'trip',
      visualTitle: '上车点 → 目的地',
      visualHint: trip.serviceType === SERVICE_TYPE.CARPOOL ? '按约定路线同行' : (remainingDistanceText ? `剩余约 ${remainingDistanceText}` : '按导航继续行驶'),
      progress: Math.max(42, progress),
      state: 'trip',
      facts: trip.serviceType === SERVICE_TYPE.CARPOOL ? [] : compactFacts([
        { label: '行程进度', value: `${Math.max(42, progress)}%`, tone: 'strong' },
        { label: '已行驶', value: traveledDistanceText },
        { label: '已用时', value: elapsedText }
      ])
    }
  }

  return {
    sectionTitle: '订单状态',
    subtitle: '等待接单',
    description: runtimeText || '等待状态同步。',
    badge: '待处理',
    visualType: 'dispatch',
    visualTitle: '订单待确认',
    visualHint: '确认后进入接驾流程',
    progress: Math.max(12, progress),
    state: 'dispatching',
    facts: compactFacts([
      { label: '订单状态', value: runtimeText || '待接单' },
      { label: '预计里程', value: formatMetric(trip.estimatedDistanceKm, '公里', 1) },
      { label: '预计金额', value: trip.fareText }
    ])
  }
}

function asPlainObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {}
  }
  return value
}

function formatCarpoolDateTime(value) {
  const raw = `${value || ''}`.trim()
  if (!raw) return ''
  // 兼容 "2026,9,28,12,0"（LocalDateTime 数组序列化）与常规日期字符串
  const parts = raw.split(',').map((item) => parseInt(item, 10))
  if (parts.length >= 5 && parts.every((num) => !isNaN(num))) {
    const pad = (num) => `${num}`.padStart(2, '0')
    return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])} ${pad(parts[3])}:${pad(parts[4])}`
  }
  return raw.replace('T', ' ').slice(0, 16)
}

function enrichCarpoolMeta(meta) {
  if (!meta) return null
  const segments = `${meta.summaryText || ''}`.split(' · ')
  return {
    ...meta,
    timeText: segments[0] || '时间待确认',
    passengerCountText: segments[1] || '1人',
    luggageText: segments[2] || '无行李',
    tollModeText: segments[3] || '高速费协商',
    departureText: formatCarpoolDateTime(meta.departureAt) || '待确认'
  }
}

function buildTripView(trip = {}, runtime = null) {
  const serviceTypeMeta = getServiceTypeMeta(trip.serviceType)
  const statusMeta = getOrderStatusMeta(trip.orderStatus)
  const internationalMeta = parseInternationalMeta(trip)
  const carpoolMeta = enrichCarpoolMeta(parseCarpoolMeta(trip))
  const fallback = createSimulation(trip)
  const cachedRuntime = getApp().getOrderRuntimeCache ? getApp().getOrderRuntimeCache(trip.id) : null
  const activeRuntime = mergeRuntimeForDisplay(runtime, cachedRuntime)
  const traveledDistanceKm = activeRuntime.traveledDistanceKm !== undefined
    ? activeRuntime.traveledDistanceKm
    : fallback.traveledDistanceKm
  const elapsedSeconds = activeRuntime.elapsedSeconds !== undefined
    ? activeRuntime.elapsedSeconds
    : fallback.usedSeconds
  const percent = activeRuntime.percent !== undefined ? activeRuntime.percent : fallback.percent
  const driveStatus = buildDriveStatusView(trip, activeRuntime, fallback)
  const showServiceFlow = !['finished', 'cancelled'].includes(driveStatus.visualType)

  return {
    ...trip,
    runtime: activeRuntime,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    fareText: formatPrice(trip.actualAmount || trip.payableAmount || trip.estimatedAmount, trip.currencyCode),
    passengerText: internationalMeta ? internationalMeta.contactText : `乘客 ${trip.userId || '--'}`,
    carpoolMeta,
    internationalMeta,
    statusText: statusMeta.label,
    statusTagType: statusMeta.tagType,
    distanceText: formatMetric(traveledDistanceKm, '公里', 1),
    durationText: formatMetric(elapsedSeconds / 60, '分钟', 0),
    percentText: `${percent}%`,
    trafficText: getTrafficText(activeRuntime, fallback),
    driveStatus,
    showServiceFlow,
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
    loading: true,
    loadError: '',
    updatingStatus: false,
    actionText: '状态已完结',
    tollAmountInput: '',
    savingCarpoolToll: false,
    payingCarpoolPenalty: false,
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
    if (!id) {
      if (!silent) {
        this.setData({
          loading: false,
          loadError: '行程信息缺失，请返回后重试'
        })
      }
      return null
    }
    if (this.tripLoadPromise) return this.tripLoadPromise
    if (!silent) {
      this.setData({
        loading: !this.data.trip,
        loadError: ''
      })
    }

    const task = (async () => {
      let tripData = {}
      let runtime = null

      try {
        const response = await fetchOrderDetail(id)
        tripData = normalizeTripStatusFields(asPlainObject(response.data))
        const runtimeResponse = await fetchOrderRuntime(id)
        runtime = asPlainObject(runtimeResponse.data || runtimeResponse)
      } catch (error) {
        const response = await fetchOrderDetail(id)
        tripData = normalizeTripStatusFields(asPlainObject(response.data))
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
        actionText: trip.serviceType === SERVICE_TYPE.CARPOOL && trip.orderStatus === ORDER_STATUS.PICKING_UP
          ? '等待乘客确认上车'
          : nextActionText(trip.orderStatus),
        loadError: ''
      })

      await this.syncTripStore().catch(() => {
        if (!silent) {
          wx.showToast({
            title: '订单列表刷新失败，稍后重试',
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
    })().catch((error) => {
      if (!silent) {
        this.setData({
          loadError: (error && error.message) || '行程加载失败，请稍后重试'
        })
        wx.showToast({
          title: '行程加载失败，请稍后重试',
          icon: 'none'
        })
      }
      return null
    }).finally(() => {
      if (!silent) {
        this.setData({ loading: false })
      }
      this.tripLoadPromise = null
    })
    return this.tripLoadPromise
  },

  async updateStatus() {
    if (this.data.updatingStatus) return
    const trip = this.data.trip
    if (!trip) return

    this.setData({ updatingStatus: true })
    try {
      const previousStatus = trip.orderStatus
      if (trip.orderStatus === ORDER_STATUS.ACCEPTED) {
        if (trip.serviceType === SERVICE_TYPE.CARPOOL) {
          const now = Date.now()
          const start = trip.carpoolDepartureAt ? new Date(trip.carpoolDepartureAt).getTime() : NaN
          const latest = getCarpoolLatestStartAt(trip)
          if (Number.isFinite(start) && now < start) {
            wx.showToast({ title: '尚未到约定出发时间，暂不能开始接驾', icon: 'none' })
            return
          }
          if (Number.isFinite(latest) && now >= latest) {
            wx.showToast({ title: '已超过可开始接驾时间，订单将自动取消', icon: 'none' })
            return
          }
        }
        if (trip.serviceType === SERVICE_TYPE.CARPOOL && trip.carpoolTollStatus === 'PENDING') {
          wx.showToast({ title: '等待乘客确认高速费后再开始', icon: 'none' })
          return
        }
        await startOrder(trip.id)
      } else if (trip.orderStatus === ORDER_STATUS.PICKING_UP) {
        if (trip.serviceType === SERVICE_TYPE.CARPOOL) {
          wx.showToast({ title: '请等待乘客在乘客端确认上车', icon: 'none' })
          return
        }
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
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '状态更新失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ updatingStatus: false })
    }
  },

  onCarpoolTollInput(e) {
    this.setData({ tollAmountInput: e.detail.value })
  },

  async submitCarpoolToll() {
    const trip = this.data.trip
    const amount = Number(this.data.tollAmountInput)
    if (!trip || trip.serviceType !== SERVICE_TYPE.CARPOOL || trip.orderStatus !== ORDER_STATUS.ACCEPTED) return
    if (!Number.isFinite(amount) || amount <= 0) {
      wx.showToast({ title: '请输入大于0的高速费金额', icon: 'none' })
      return
    }
    if (this.data.savingCarpoolToll) return
    this.setData({ savingCarpoolToll: true })
    try {
      await setCarpoolToll(trip.id, Number(amount.toFixed(2)))
      this.setData({ tollAmountInput: '' })
      wx.showToast({ title: '已提交，等待乘客确认', icon: 'none', duration: 2500 })
      await this.loadTrip(trip.id)
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '高速费提交失败', icon: 'none' })
    } finally {
      this.setData({ savingCarpoolToll: false })
    }
  },

  async payCarpoolPenalty() {
    const trip = this.data.trip
    if (!trip || trip.driverPenaltyStatus !== 'DUE' || this.data.payingCarpoolPenalty) return
    this.setData({ payingCarpoolPenalty: true })
    try {
      await payCarpoolPenalty(trip.id)
      wx.showToast({ title: '违约金已缴纳', icon: 'success' })
      await this.loadTrip(trip.id)
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '缴纳失败，请先确认钱包余额', icon: 'none' })
    } finally {
      this.setData({ payingCarpoolPenalty: false })
    }
  },

  retryLoadTrip() {
    this.loadTrip(this.data.orderId).catch(() => {})
  }
})
