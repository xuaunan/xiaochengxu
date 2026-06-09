const { acceptOrder, fetchDashboard, fetchHome, fetchWaitingOrders, rejectOrder, reportTrack, updateServiceStatus } = require('../../utils/api')
const { DRIVER_SERVICE_STATUS, ORDER_STATUS, SERVICE_TYPE, getDriverServiceActionText, getDriverServiceText } = require('../../utils/constants')
const { buildVehicleView, buildWallet, getReceiveOrderPermission, mapDriverProfile, mapTripOrder, mapWaitingOrder } = require('../../utils/driver-store')
const { broadcastDriver, notifyDriver } = require('../../utils/notify')
const { buildTrackReport } = require('../../utils/track-reporter')
const { createSimulation } = require('../../utils/trip-simulator')
const { requestRoute } = require('../../utils/route-planner')

const DASHBOARD_POLL_INTERVAL = 3000

function hasActiveTrip(orders = []) {
  return orders.some((item) => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(item.orderStatus))
}

function canReportActiveTrack(order = {}) {
  return [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus)
}

function getActiveTrip(orders = []) {
  return orders.find((item) => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(item.orderStatus)) || null
}

function buildActiveTripCard(order) {
  if (!order) return null
  const mappedOrder = mapTripOrder(order)
  return {
    id: order.id,
    title: `${order.startName} → ${order.endName}`,
    fareText: mappedOrder.fareText,
    statusText: order.orderStatus === ORDER_STATUS.IN_TRIP
      ? '行程中'
      : order.orderStatus === ORDER_STATUS.PICKING_UP
        ? '接驾中'
        : '已接单',
    actionText: '继续查看'
  }
}

function getOrderTimeMs(order = {}, keys = []) {
  const numeric = Number(order.createdAtMs || order.__createdAtMs || 0)
  if (keys.includes('createdAt') && numeric > 0) return numeric

  const createdAt = keys.map((key) => order[key]).find((value) => value !== undefined && value !== null && value !== '') ||
    order.createdAt ||
    order.createTime ||
    order.created_at
  if (Array.isArray(createdAt)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = createdAt
    const timestamp = new Date(year, Number(month || 1) - 1, day || 1, hour, minute, second).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  const text = `${createdAt || ''}`.trim()
  if (!text) return 0
  const normalized = text.includes('T') ? text : text.replace(/-/g, '/')
  const timestamp = new Date(normalized).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getOrderCreatedAtMs(order = {}) {
  return getOrderTimeMs(order, ['createdAt', 'createTime', 'created_at'])
}

function getOrderEventAtMs(order = {}) {
  return getOrderTimeMs(order, ['cancelledAt', 'canceledAt', 'updatedAt', 'updateTime', 'createdAt', 'createTime', 'updated_at', 'created_at'])
}

function isAfterListening(order, listeningSince) {
  const createdAtMs = getOrderCreatedAtMs(order)
  return createdAtMs > 0 && createdAtMs >= Number(listeningSince || 0)
}

function orderIdOf(order = {}) {
  return `${order.id || order.orderId || order.orderNo || ''}`
}

function resolveServiceStatus(profileStatus, busy) {
  if (busy) return DRIVER_SERVICE_STATUS.BUSY
  return profileStatus === DRIVER_SERVICE_STATUS.BUSY ? DRIVER_SERVICE_STATUS.OFFLINE : profileStatus
}

function buildNoticeTickerText(notices = []) {
  return (Array.isArray(notices) ? notices : [])
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      const title = `${item.title || ''}`.trim()
      const content = `${item.content || ''}`.trim()
      return title && content ? `${title}：${content}` : title || content
    })
    .filter(Boolean)
    .join('　　·　　')
}

function getListeningBaseline(settings = {}) {
  return new Set(Array.isArray(settings.listeningBaselineOrderIds)
    ? settings.listeningBaselineOrderIds.map((id) => `${id}`)
    : [])
}

function isNewAfterListening(order = {}, settings = {}) {
  const listeningSince = Number(settings.listeningSince || 0)
  if (!listeningSince) return false
  if (getListeningBaseline(settings).has(orderIdOf(order))) return false
  return Boolean(order.isNew) || isAfterListening(order, listeningSince)
}

Page({
  data: {
    listening: false,
    listeningText: '休息中，暂未开启接单',
    listeningActionText: '开始接单',
    availableOrders: [],
    markers: [],
    latitude: 31.216,
    longitude: 121.362,
    currentIncome: '¥0.00',
    profile: {},
    permission: {
      canReceiveOrders: false,
      message: '正在确认司机与车辆审核状态'
    },
    hasActiveTrip: false,
    activeTripCard: null,
    vehicleView: {
      auditText: '确认中',
      auditClassName: 'neutral'
    },
    noticeText: '',
    noticePopup: {
      visible: false
    }
  },

  newOrderTimer: null,
  dashboardPollingTimer: null,

  async onShow() {
    if (!getApp().globalData.driverStore.loggedIn) {
      wx.redirectTo({ url: '/pages/onboarding/index' })
      return
    }
    this.loadHomeNotices().catch(() => {})
    const openedVehiclePage = await this.loadDashboard()
    if (openedVehiclePage) return
    this.startDashboardPolling()
  },

  onHide() {
    this.clearNewOrderTimer()
    this.stopDashboardPolling()
  },

  onUnload() {
    this.clearNewOrderTimer()
    this.stopDashboardPolling()
  },

  startDashboardPolling() {
    this.stopDashboardPolling()
    this.dashboardPollingTimer = setInterval(() => {
      this.loadDashboard(true).catch(() => {})
    }, DASHBOARD_POLL_INTERVAL)
  },

  stopDashboardPolling() {
    if (this.dashboardPollingTimer) {
      clearInterval(this.dashboardPollingTimer)
      this.dashboardPollingTimer = null
    }
  },

  async loadHomeNotices() {
    const response = await fetchHome({ skipToast: true })
    const homeData = response.data || {}
    this.setData({
      noticeText: buildNoticeTickerText(homeData.notices || [])
    })
  },

  async loadDashboard(silent = false) {
    let dashboardResponse = null
    try {
      dashboardResponse = await fetchDashboard()
    } catch (error) {
      const location = await this.safeGetLocation()
      this.applyDashboardLoadFailure(error, silent, location)
      return
    }
    const dashboard = dashboardResponse.data || {}
    const permission = getReceiveOrderPermission(dashboard)
    const profile = mapDriverProfile(
      dashboard.user || {},
      dashboard.profile || {},
      dashboard.vehicle || {},
      permission
    )
    const vehicleView = buildVehicleView(dashboard.vehicle || {}, dashboard.user || {}, permission)
    const orders = dashboard.orders || []
    const busy = hasActiveTrip(orders)
    const activeTrip = getActiveTrip(orders)
    const wallet = buildWallet(dashboard.profile || {}, orders)
    const store = getApp().globalData.driverStore
    let serviceStatus = resolveServiceStatus(profile.serviceStatus, busy)

    if (!silent && !vehicleView.hasVehicle) {
      store.profile = {
        ...profile,
        serviceStatus
      }
      store.vehicle = dashboard.vehicle || {}
      store.permission = permission
      store.tripOrders = orders.map(mapTripOrder)
      store.wallet = wallet
      getApp().saveStore()
      wx.navigateTo({ url: '/pages/onboarding/index' })
      return true
    }

    const location = await this.safeGetLocation()

    if (permission.canReceiveOrders &&
      !busy &&
      serviceStatus === DRIVER_SERVICE_STATUS.OFFLINE &&
      !((store.settings || {}).manualResting)) {
      serviceStatus = DRIVER_SERVICE_STATUS.ONLINE
      updateServiceStatus({
        serviceStatus: DRIVER_SERVICE_STATUS.ONLINE,
        longitude: `${location ? location.longitude : ''}`,
        latitude: `${location ? location.latitude : ''}`
      }, { skipToast: true }).catch(() => {})
    }

    let availableOrders = []
    if (permission.canReceiveOrders && !busy && serviceStatus === DRIVER_SERVICE_STATUS.ONLINE) {
      try {
        const waitingResponse = await fetchWaitingOrders({ skipToast: Boolean(silent) })
        availableOrders = (waitingResponse.data || []).map((item) => mapWaitingOrder(item, location))
      } catch (error) {
        availableOrders = []
      }
    }
    availableOrders = this.decorateIncomingOrders(availableOrders)
    this.syncListeningScope(store, serviceStatus, busy, availableOrders)
    const autoAcceptedOrder = await this.tryAutoAccept(availableOrders, serviceStatus, busy)
    if (autoAcceptedOrder) return
    this.handleWaitingOrderEvents(availableOrders)
    this.handleCancelledOrderEvents(orders)

    store.profile = {
      ...profile,
      serviceStatus
    }
    store.vehicle = dashboard.vehicle || {}
    store.permission = permission
    store.tripOrders = orders.map(mapTripOrder)
    store.availableOrders = availableOrders
    store.wallet = wallet
    store.settings.listenMode = serviceStatus === DRIVER_SERVICE_STATUS.ONLINE
    if (serviceStatus !== DRIVER_SERVICE_STATUS.ONLINE && !busy) {
      store.settings.listeningSince = 0
      store.settings.listeningBaselineReady = false
      store.settings.listeningBaselineOrderIds = []
    }
    getApp().saveStore()

    this.setData({
      listening: serviceStatus === DRIVER_SERVICE_STATUS.ONLINE,
      listeningText: getDriverServiceText(serviceStatus),
      listeningActionText: getDriverServiceActionText(serviceStatus),
      availableOrders,
      currentIncome: `¥${wallet.todayIncome.toFixed(2)}`,
      latitude: location ? location.latitude : this.data.latitude,
      longitude: location ? location.longitude : this.data.longitude,
      markers: this.buildMarkers(location, availableOrders),
      profile: {
        ...profile,
        serviceStatus
      },
      permission,
      hasActiveTrip: busy,
      activeTripCard: buildActiveTripCard(activeTrip),
      vehicleView
    })

    if (activeTrip && canReportActiveTrack(activeTrip)) {
      this.reportActiveTripTrack(activeTrip).catch(() => {})
    }

    if (!silent || availableOrders.some((item) => item.isNew)) {
      this.scheduleNewOrderReset()
    }
  },

  applyDashboardLoadFailure(error, silent = false, location = null) {
    const store = getApp().globalData.driverStore || {}
    const cachedProfile = store.profile || {}
    const cachedVehicle = store.vehicle || {}
    const cachedPermission = store.permission || {}
    const hasCachedPermission = typeof cachedPermission.canReceiveOrders === 'boolean'
    const permission = hasCachedPermission
      ? cachedPermission
      : {
          canReceiveOrders: false,
          message: '连接超时，暂时无法确认接单资格，请刷新重试'
        }
    const vehicleView = cachedVehicle && cachedVehicle.id
      ? buildVehicleView(cachedVehicle, {}, permission)
      : {
          auditText: '确认失败',
          auditClassName: 'neutral',
          hasVehicle: false
        }
    const serviceStatus = cachedProfile.serviceStatus || DRIVER_SERVICE_STATUS.OFFLINE
    const wallet = store.wallet || { todayIncome: 0 }
    const availableOrders = store.availableOrders || []

    this.setData({
      listening: serviceStatus === DRIVER_SERVICE_STATUS.ONLINE,
      listeningText: hasCachedPermission ? getDriverServiceText(serviceStatus) : '连接超时，无法确认接单状态',
      listeningActionText: getDriverServiceActionText(serviceStatus),
      availableOrders,
      currentIncome: `¥${Number(wallet.todayIncome || 0).toFixed(2)}`,
      latitude: location ? location.latitude : this.data.latitude,
      longitude: location ? location.longitude : this.data.longitude,
      markers: this.buildMarkers(location, availableOrders),
      profile: cachedProfile,
      permission,
      hasActiveTrip: false,
      activeTripCard: null,
      vehicleView
    })

    if (!silent) {
      wx.showToast({
        title: '状态刷新超时，请刷新重试',
        icon: 'none'
      })
    }
  },

  decorateIncomingOrders(availableOrders) {
    const previousIds = (this.data.availableOrders || []).map((item) => `${item.id}`)
    const previousIdSet = new Set(previousIds)
    const enableNewFlag = previousIds.length > 0

    return availableOrders.map((item) => ({
      ...item,
      isNew: enableNewFlag && !previousIdSet.has(`${item.id}`)
    }))
  },

  syncListeningScope(store, serviceStatus, busy, availableOrders = []) {
    store.settings = store.settings || {}
    if (serviceStatus !== DRIVER_SERVICE_STATUS.ONLINE || busy) {
      return
    }

    if (!Number(store.settings.listeningSince || 0)) {
      store.settings.listeningSince = Date.now()
      store.settings.listeningBaselineReady = false
    }

    if (!store.settings.listeningBaselineReady) {
      store.settings.listeningBaselineOrderIds = availableOrders.map(orderIdOf).filter(Boolean)
      store.settings.listeningBaselineReady = true
    }
  },

  async tryAutoAccept(availableOrders, serviceStatus, busy) {
    const store = getApp().globalData.driverStore
    const settings = store.settings || {}
    if (!settings.autoAccept || busy || serviceStatus !== DRIVER_SERVICE_STATUS.ONLINE || this.autoAccepting) {
      return null
    }

    const order = (availableOrders || []).find((item) => {
      return item.serviceType === SERVICE_TYPE.TAXI &&
        isNewAfterListening(item, settings)
    })

    if (!order) return null

    this.autoAccepting = true
    try {
      await acceptOrder(order.id)
      notifyDriver(this, '已自动接单', `${order.startName} 到 ${order.endName} 已自动接取。`, {
        id: `auto-accept-${order.id}`,
        type: 'auto'
      })
      broadcastDriver(this, `已自动接单，乘客从${order.startName}前往${order.endName}`, `auto-accept-${order.id}`)
      this.reportAcceptedTrack(order).catch(() => {})
      await this.loadDashboard(true)
      wx.navigateTo({
        url: `/pages/trip-progress/index?id=${order.id}`
      })
      return order
    } finally {
      this.autoAccepting = false
    }
  },

  handleWaitingOrderEvents(availableOrders = []) {
    const settings = ((getApp().globalData.driverStore || {}).settings || {})
    availableOrders.forEach((order) => {
      if (!isNewAfterListening(order, settings)) {
        return
      }

      if (order.isNew) {
        notifyDriver(this, '新订单通知', `${order.serviceTypeLabel}：${order.startName} 到 ${order.endName}`, {
          id: `new-order-${order.id}`,
          type: 'order'
        })
      }

      if (order.serviceType === SERVICE_TYPE.CARPOOL) {
        notifyDriver(this, '顺风车订单', `${order.startName} 到 ${order.endName}，可手动接取。`, {
          id: `carpool-notice-${order.id}`,
          type: 'carpool'
        })
        broadcastDriver(this, `有新的顺风车订单，从${order.startName}前往${order.endName}`, `carpool-order-${order.id}`)
      }
    })
  },

  handleCancelledOrderEvents(orders = []) {
    const listeningSince = Number((((getApp().globalData.driverStore || {}).settings || {}).listeningSince) || 0)
    if (!listeningSince) return
    orders
      .filter((item) => item.orderStatus === ORDER_STATUS.CANCELLED && (!item.cancelByRole || item.cancelByRole === 'USER'))
      .forEach((order) => {
        const eventAt = getOrderEventAtMs(order)
        if (listeningSince && (!eventAt || eventAt < listeningSince)) {
          return
        }
        notifyDriver(this, '乘客取消订单', `${order.startName} 到 ${order.endName} 的订单已被乘客取消。`, {
          id: `cancel-notice-${order.id}`,
          type: 'cancel'
        })
        broadcastDriver(this, `乘客已取消订单，${order.startName}到${order.endName}`, `passenger-cancel-${order.id}`)
      })
  },

  scheduleNewOrderReset() {
    this.clearNewOrderTimer()
    if (!(this.data.availableOrders || []).some((item) => item.isNew)) {
      return
    }

    this.newOrderTimer = setTimeout(() => {
      const availableOrders = (this.data.availableOrders || []).map((item) => ({
        ...item,
        isNew: false
      }))
      this.setData({ availableOrders })
      this.newOrderTimer = null
    }, 2200)
  },

  clearNewOrderTimer() {
    if (this.newOrderTimer) {
      clearTimeout(this.newOrderTimer)
      this.newOrderTimer = null
    }
  },

  buildMarkers(location, availableOrders) {
    const markers = []
    if (location) {
      markers.push({
        id: 1,
        latitude: location.latitude,
        longitude: location.longitude,
        iconPath: '/images/map-driver.png',
        width: 42,
        height: 42
      })
    }

    return markers.concat(availableOrders.map((item, index) => ({
      id: index + 2,
      latitude: item.latitude,
      longitude: item.longitude,
      iconPath: '/images/map-order.png',
      width: 36,
      height: 42,
      callout: {
        content: item.fareText,
        color: '#ff7a00',
        bgColor: '#ffffff',
        borderRadius: 12,
        padding: 8,
        display: 'ALWAYS'
      }
    })))
  },

  safeGetLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: () => resolve(null)
      })
    })
  },

  async toggleListening() {
    if (!this.data.permission.canReceiveOrders) {
      wx.showModal({
        title: '接单功能未解锁',
        content: this.data.permission.message,
        confirmText: '去提交车辆',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/onboarding/index' })
          }
        }
      })
      return
    }

    if (this.data.hasActiveTrip) {
      wx.showToast({
        title: '服务中暂不可接单',
        icon: 'none'
      })
      return
    }

    const nextStatus = this.data.listening ? DRIVER_SERVICE_STATUS.OFFLINE : DRIVER_SERVICE_STATUS.ONLINE
    let baselineOrderIds = []
    let baselineReady = nextStatus !== DRIVER_SERVICE_STATUS.ONLINE
    if (nextStatus === DRIVER_SERVICE_STATUS.ONLINE) {
      try {
        const waitingResponse = await fetchWaitingOrders({ skipToast: true })
        baselineOrderIds = (waitingResponse.data || []).map(orderIdOf).filter(Boolean)
        baselineReady = true
      } catch (error) {
        baselineOrderIds = []
        baselineReady = false
      }
    }
    const location = await this.safeGetLocation()
    await updateServiceStatus({
      serviceStatus: nextStatus,
      longitude: `${location ? location.longitude : this.data.longitude}`,
      latitude: `${location ? location.latitude : this.data.latitude}`
    })
    wx.showToast({
      title: nextStatus === DRIVER_SERVICE_STATUS.ONLINE ? '已开始接单' : '已停止接单',
      icon: 'success'
    })
    const store = getApp().globalData.driverStore
    store.settings = {
      ...(store.settings || {}),
      listenMode: nextStatus === DRIVER_SERVICE_STATUS.ONLINE,
      manualResting: nextStatus === DRIVER_SERVICE_STATUS.OFFLINE,
      listeningSince: nextStatus === DRIVER_SERVICE_STATUS.ONLINE ? Date.now() : 0,
      listeningBaselineReady: baselineReady,
      listeningBaselineOrderIds: nextStatus === DRIVER_SERVICE_STATUS.ONLINE ? baselineOrderIds : []
    }
    getApp().saveStore()
    await this.loadDashboard()
  },

  async acceptOrder(e) {
    const orderId = e.currentTarget.dataset.id
    const order = (this.data.availableOrders || []).find((item) => `${item.id}` === `${orderId}`)
    await acceptOrder(orderId)
    if (order) {
      notifyDriver(this, '接单成功', `${order.startName} 到 ${order.endName} 已接单。`, {
        id: `manual-accept-${order.id}`,
        type: 'order'
      })
      broadcastDriver(this, `接单成功，乘客从${order.startName}前往${order.endName}`, `manual-accept-${order.id}`, {
        audioKey: 'auto-accept'
      })
    }
    this.reportAcceptedTrack(order || { id: orderId }).catch(() => {})
    wx.showToast({ title: '接单成功', icon: 'success' })
    await this.loadDashboard()
    wx.navigateTo({
      url: `/pages/trip-progress/index?id=${orderId}`
    })
  },

  async reportAcceptedTrack(order = {}) {
    if (!order || !order.id) return
    const acceptedOrder = {
      ...order,
      orderStatus: ORDER_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString()
    }
    const simulation = createSimulation(acceptedOrder)
    const routePoints = await requestRoute(simulation.driverStart, {
      latitude: Number(acceptedOrder.startLat || 0),
      longitude: Number(acceptedOrder.startLng || 0)
    }).catch(() => [])
    const report = await buildTrackReport(acceptedOrder, {
      runtime: routePoints.length >= 3
        ? {
            approachRoutePoints: routePoints,
            routePoints,
            fullRoutePoints: routePoints,
            remainPoints: routePoints,
            routePlanned: true,
            currentPoint: simulation.driverStart
          }
        : {
            currentPoint: simulation.driverStart
          }
    })
    await reportTrack(order.id, report.payload)
  },

  async reportActiveTripTrack(order = {}) {
    if (!order || !order.id || !canReportActiveTrack(order)) return
    const now = Date.now()
    this.activeTrackReportAt = this.activeTrackReportAt || {}
    const lastReportedAt = Number(this.activeTrackReportAt[order.id] || 0)
    if (now - lastReportedAt < DASHBOARD_POLL_INTERVAL - 200) return
    this.activeTrackReportAt[order.id] = now

    const simulation = createSimulation(order)
    const phase = simulation.phase
    const start = {
      latitude: Number(order.startLat || 0),
      longitude: Number(order.startLng || 0)
    }
    const end = {
      latitude: Number(order.endLat || 0),
      longitude: Number(order.endLng || 0)
    }
    const from = phase === 'trip' ? start : simulation.driverStart
    const to = phase === 'trip' ? end : start
    let routePoints = await requestRoute(from, to).catch(() => [])
    if (!routePoints.length && simulation.activeRoute && Array.isArray(simulation.activeRoute.points)) {
      routePoints = simulation.activeRoute.points
    }
    const phaseRouteKey = phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'
    const report = await buildTrackReport(order, {
      runtime: {
        phase,
        [phaseRouteKey]: routePoints,
        routePoints,
        fullRoutePoints: routePoints,
        points: routePoints,
        routePlanned: routePoints.length >= 3,
        currentPoint: simulation.currentPoint,
        driverStartPoint: simulation.driverStart
      }
    })
    await reportTrack(order.id, report.payload)
  },

  async rejectOrder(e) {
    const orderId = e.currentTarget.dataset.id
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认暂不接此单',
        content: '拒单后该订单会从当前司机的大厅中暂时隐藏。',
        confirmText: '确认拒单',
        success: (res) => resolve(res.confirm)
      })
    })
    if (!confirmed) return
    await rejectOrder(orderId, '司机当前暂不方便接单')
    wx.showToast({ title: '已拒绝该订单', icon: 'success' })
    await this.loadDashboard()
  },

  goVehiclePage() {
    wx.navigateTo({ url: '/pages/onboarding/index' })
  },

  openCurrentTrip() {
    const activeTripCard = this.data.activeTripCard
    if (!activeTripCard || !activeTripCard.id) {
      wx.showToast({
        title: '当前没有进行中的行程',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: `/pages/trip-progress/index?id=${activeTripCard.id}`
    })
  }
})
