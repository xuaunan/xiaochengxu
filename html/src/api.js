import {
  DRIVER_STATUS,
  ORDER_STATUS,
  PAY_STATUS,
  ROLE,
  SERVICE_TYPE,
  calcRoute,
  demoAccounts,
  estimateLocalFare,
  fallbackCarTypes,
  fallbackCoupons,
  normalizeList,
  statusLabel
} from './data'

const API_BASE_KEY = 'sunshine-web-api-base'
const DEMO_DB_KEY = 'sunshine-web-demo-db-v2'
const DEFAULT_API_BASE = 'http://127.0.0.1:8080'
let backendBackoffUntil = 0
let activeRequestCount = 0

export function getApiBase() {
  return localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE
}

export function setApiBase(baseUrl) {
  backendBackoffUntil = 0
  localStorage.setItem(API_BASE_KEY, (baseUrl || DEFAULT_API_BASE).replace(/\/$/, ''))
}

function emitApiMode(mode, message = '') {
  window.dispatchEvent(new CustomEvent('sunshine-api-mode', { detail: { mode, message } }))
}

function emitApiLoading() {
  window.dispatchEvent(new CustomEvent('sunshine-api-loading', { detail: { count: activeRequestCount, active: activeRequestCount > 0 } }))
}

function bumpApiLoading(delta) {
  activeRequestCount = Math.max(0, activeRequestCount + delta)
  emitApiLoading()
}

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, options)
  }
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    data,
    token,
    skipAuth = false,
    demoRole,
    timeout = 1200
  } = options

  bumpApiLoading(1)

  if (Date.now() < backendBackoffUntil) {
    emitApiMode('demo', '后端刚刚不可达，当前操作直接使用网页本地演示数据')
    try {
      return demoRequest(path, { method, data, token, demoRole })
    } finally {
      bumpApiLoading(-1)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const headers = { 'Content-Type': 'application/json' }
  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
      credentials: 'include'
    })
    const payload = await parsePayload(response)
    if (response.ok && Number(payload.code) === 0) {
      backendBackoffUntil = 0
      emitApiMode('backend', '已连接 Spring Boot 后端')
      return payload.data ?? payload
    }
    throw new ApiError(payload.message || payload.msg || `请求失败：${response.status}`, {
      code: payload.code,
      status: response.status,
      network: false,
      payload
    })
  } catch (error) {
    if (error instanceof ApiError && !error.network) {
      throw error
    }
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '后端未连接，当前使用网页本地演示数据')
    return demoRequest(path, { method, data, token, demoRole })
  } finally {
    window.clearTimeout(timer)
    bumpApiLoading(-1)
  }
}

async function parsePayload(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (error) {
    return { code: response.ok ? 0 : response.status, data: text, message: text }
  }
}

export const api = {
  login: (roleCode, phone, password) => request('/auth/login', {
    method: 'POST',
    skipAuth: true,
    demoRole: roleCode,
    timeout: 900,
    data: { phone, password, roleCode }
  }),
  register: (data) => request('/auth/register', { method: 'POST', skipAuth: true, data }),
  profile: (token) => request('/auth/profile', { token }),
  updateProfile: (token, data) => request('/auth/profile', { method: 'PUT', token, data }),
  submitRealName: (token, data) => request('/auth/real-name', { method: 'POST', token, data }),
  home: () => request('/app/home', { skipAuth: true }),
  estimate: (params) => request(`/app/estimate${toQuery(params)}`, { skipAuth: true }),
  createOrder: (token, data) => request('/orders', { method: 'POST', token, data }),
  orders: (token) => request('/orders/mine', { token }),
  orderDetail: (token, id) => request(`/orders/${id}`, { token }),
  orderRuntime: (token, id) => request(`/orders/${id}/runtime`, { token }),
  cancelOrder: (token, id, reason) => request(`/orders/${id}/cancel`, { method: 'POST', token, data: { reason } }),
  pickupOrder: (token, id) => request(`/orders/${id}/pickup`, { method: 'POST', token }),
  mockPay: (token, id, amount) => request('/orders/mock-pay', {
    method: 'POST',
    token,
    data: { orderId: Number(id), payChannel: 'WEB', payableAmount: amount || null }
  }),
  evaluate: (token, data) => request('/orders/evaluation', { method: 'POST', token, data }),
  complaint: (token, data) => request('/orders/complaint', { method: 'POST', token, data }),
  trackHistory: (token, id) => request(`/orders/${id}/track/history`, { token }),
  reportTrack: (token, id, data) => request(`/orders/${id}/track/report`, { method: 'POST', token, data }),
  couponCenter: () => request('/coupons/center', { skipAuth: true }),
  myCoupons: (token) => request('/coupons/mine', { token }),
  receiveCoupon: (token, id) => request(`/coupons/${id}/receive`, { method: 'POST', token }),
  messages: (token) => request('/messages', { token }),
  markMessageRead: (token, id) => request(`/messages/${id}/read`, { method: 'POST', token }),
  carpoolSearch: (keyword = '') => request(`/carpool/search${toQuery({ keyword })}`, { skipAuth: true }),
  carpoolDetail: (id) => request(`/carpool/${id}`, { skipAuth: true }),
  carpoolMine: (token) => request('/carpool/mine', { token }),
  carpoolPublish: (token, data) => request('/carpool/publish', { method: 'POST', token, data }),
  carpoolApply: (token, data) => request('/carpool/apply', { method: 'POST', token, data }),
  carpoolOwnerConfirm: (token, data) => request('/carpool/owner-confirm', { method: 'POST', token, data }),
  carpoolPassengerConfirm: (token, data) => request('/carpool/passenger-confirm', { method: 'POST', token, data }),
  carpoolCancel: (token, data) => request('/carpool/cancel', { method: 'POST', token, data }),
  driverDashboard: (token) => request('/driver/dashboard', { token }),
  driverUpdateProfile: (token, data) => request('/driver/profile', { method: 'PUT', token, data }),
  driverStatus: (token, data) => request('/driver/service-status', { method: 'POST', token, data }),
  driverWaitingOrders: (token) => request('/orders/waiting', { token }),
  driverAccept: (token, id) => request(`/orders/${id}/accept`, { method: 'POST', token }),
  driverReject: (token, id, reason) => request(`/orders/${id}/reject`, { method: 'POST', token, data: { reason } }),
  driverStart: (token, id) => request(`/orders/${id}/start`, { method: 'POST', token }),
  driverPickup: (token, id) => request(`/orders/${id}/pickup`, { method: 'POST', token }),
  driverFinish: (token, id, data) => request(`/orders/${id}/finish`, { method: 'POST', token, data }),
  driverWithdraw: (token, data) => request('/driver/withdraw', { method: 'POST', token, data }),
  driverCertify: (token, data) => request('/driver/certification', { method: 'POST', token, data })
}

function toQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return query ? `?${query}` : ''
}

function demoRequest(path, options) {
  const url = new URL(path, 'http://demo.local')
  const method = options.method || 'GET'
  const body = options.data || {}
  const db = loadDemoDb()
  const actor = resolveActor(options.token, options.demoRole)

  if (url.pathname === '/auth/login' && method === 'POST') {
    const role = body.roleCode
    const account = role === ROLE.DRIVER ? db.driverUser : db.passengerUser
    const fallback = demoAccounts[role]
    const password = account?.password || fallback?.password
    const phone = account?.phone || fallback?.phone
    if (!account || body.phone !== phone || body.password !== password) {
      throw new ApiError('演示账号或密码不正确', { code: 4000 })
    }
    return createDemoSession(role)
  }

  if (url.pathname === '/auth/register' && method === 'POST') {
    const role = body.roleCode || ROLE.USER
    const target = role === ROLE.DRIVER ? db.driverUser : db.passengerUser
    target.phone = body.phone || target.phone
    target.password = body.password || target.password || '123456'
    target.nickname = body.nickname || target.nickname
    target.defaultLanguage = body.defaultLanguage || target.defaultLanguage || 'zh-CN'
    target.roleCode = role
    target.authStatus = target.authStatus ?? 0
    target.enabled = 1
    saveDemoDb(db)
    return createDemoSession(role)
  }

  if (url.pathname === '/app/home') {
    const onlineDriverCount = 2
    const busyDriverCount = 2
    return {
      banners: [
        { title: '橙色专车门户已接入同一套后端', subtitle: '乘客下单、司机抢单、支付评价闭环演示' },
        { title: '即时打车 / 顺风车 / 国际出行', subtitle: '同步小程序枚举、状态、接口字段' }
      ],
      carTypes: fallbackCarTypes,
      couponCenter: db.coupons,
      notices: ['司机听单大厅实时刷新', '默认后端地址 http://127.0.0.1:8080', '后端未启动时自动切换本地演示'],
      fleet: {
        onlineDriverCount,
        idleDriverCount: Math.max(0, onlineDriverCount - busyDriverCount),
        busyDriverCount,
        serviceDriverCount: busyDriverCount,
        offlineDriverCount: db.driverProfile.serviceStatus === DRIVER_STATUS.OFFLINE ? 1 : 0
      },
      systemConfigs: { webPortal: 'enabled' }
    }
  }

  if (url.pathname === '/app/estimate') {
    return estimateLocalFare(
      Number(url.searchParams.get('carTypeId') || 1),
      url.searchParams.get('serviceType') || SERVICE_TYPE.TAXI,
      Number(url.searchParams.get('distanceKm') || 3),
      Number(url.searchParams.get('durationMin') || 16)
    )
  }

  if (url.pathname === '/coupons/center') return db.coupons
  if (url.pathname === '/carpool/search') {
    const keyword = url.searchParams.get('keyword') || ''
    return db.carpoolTrips.filter((item) => `${item.startName}${item.endName}`.includes(keyword))
  }

  const carpoolDetailMatch = url.pathname.match(/^\/carpool\/(\d+)$/)
  if (carpoolDetailMatch) {
    const trip = db.carpoolTrips.find((item) => Number(item.id) === Number(carpoolDetailMatch[1]))
    if (!trip) throw new ApiError('顺风车行程不存在', { code: 4004 })
    return { ...trip, applications: db.carpoolApplications.filter((item) => Number(item.tripId) === Number(trip.id)) }
  }

  ensureLogged(actor)

  if (url.pathname === '/auth/profile' && method === 'PUT') {
    const target = actor.roleCode === ROLE.DRIVER ? db.driverUser : db.passengerUser
    Object.assign(target, body)
    saveDemoDb(db)
    return target
  }

  if (url.pathname === '/auth/profile') {
    return actor.roleCode === ROLE.DRIVER ? db.driverUser : db.passengerUser
  }

  if (url.pathname === '/auth/real-name' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    Object.assign(db.passengerUser, body, { authStatus: 1, authRemark: '网页端已提交实名审核' })
    db.messages.unshift(message('USER', '实名信息已提交', '资料已同步到网页端演示数据库，后端运行时走 /auth/real-name。'))
    saveDemoDb(db)
    return { auditStatus: 1, message: '实名信息已提交' }
  }

  if (url.pathname === '/messages') {
    return db.messages.filter((item) => item.roleCode === actor.roleCode)
  }

  const messageReadMatch = url.pathname.match(/^\/messages\/(.+)\/read$/)
  if (messageReadMatch && method === 'POST') {
    const messageId = Number(messageReadMatch[1])
    const target = db.messages.find((item) => Number(item.id) === messageId && item.roleCode === actor.roleCode)
    if (!target) throw new ApiError('消息不存在', { code: 4004 })
    target.unread = false
    target.read = true
    target.isRead = true
    target.readStatus = 'READ'
    saveDemoDb(db)
    return target
  }

  if (url.pathname === '/coupons/mine') {
    return db.userCoupons
  }

  const receiveMatch = url.pathname.match(/^\/coupons\/(\d+)\/receive$/)
  if (receiveMatch && method === 'POST') {
    const coupon = db.coupons.find((item) => Number(item.id) === Number(receiveMatch[1]))
    if (!coupon) throw new ApiError('优惠券不存在', { code: 4004 })
    const record = {
      id: Date.now(),
      userCouponId: Date.now(),
      couponId: coupon.id,
      couponName: coupon.couponName,
      couponStatus: 'UNUSED',
      ...coupon
    }
    db.userCoupons.unshift(record)
    db.messages.unshift(message('USER', '优惠券已领取', `${coupon.couponName} 已放入你的卡包。`))
    saveDemoDb(db)
    return record
  }

  if (url.pathname === '/orders' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const route = {
      distanceKm: Number(body.estimatedDistanceKm || 4),
      durationMin: Number(body.estimatedDurationMin || 18)
    }
    const fare = estimateLocalFare(body.carTypeId, body.serviceType, route.distanceKm, route.durationMin)
    const order = {
      id: db.nextOrderId++,
      orderNo: `WEB${Date.now()}`,
      userId: db.passengerUser.id,
      driverId: null,
      carTypeId: Number(body.carTypeId),
      serviceType: body.serviceType,
      orderStatus: ORDER_STATUS.DISPATCHING,
      payStatus: PAY_STATUS.UNPAID,
      startName: body.startName,
      startLng: body.startLng,
      startLat: body.startLat,
      endName: body.endName,
      endLng: body.endLng,
      endLat: body.endLat,
      estimatedDistanceKm: route.distanceKm,
      estimatedDurationMin: route.durationMin,
      estimatedAmount: fare.amount,
      payableAmount: fare.amount,
      actualAmount: fare.amount,
      currencyCode: fare.currencyCode,
      dispatchMode: body.dispatchMode || 'SMART',
      remark: body.remark || '',
      createdAt: nowText(),
      updatedAt: nowText(),
      evaluationStatus: 'PENDING',
      complaintStatus: 'NONE',
      timeline: [{ label: '订单已提交', time: nowText(), tone: 'waiting' }]
    }
    db.orders.unshift(order)
    db.messages.unshift(message('USER', '订单已创建', `从 ${order.startName} 前往 ${order.endName}，正在等待司机接单。`))
    db.messages.unshift(message('DRIVER', '听单大厅有新订单', `${order.startName} -> ${order.endName}，预估 ${formatAmount(order)}。`))
    saveDemoDb(db)
    return order
  }

  if (url.pathname === '/orders/mine') {
    return currentOrders(db, actor)
  }

  if (url.pathname === '/orders/waiting') {
    requireDriverOrAdmin(actor)
    return db.orders.filter((item) => item.orderStatus === ORDER_STATUS.DISPATCHING)
  }

  if (url.pathname === '/orders/mock-pay' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, body.orderId)
    order.payStatus = PAY_STATUS.PAID
    order.updatedAt = nowText()
    addTimeline(order, '模拟支付成功', 'success')
    db.messages.unshift(message('USER', '支付完成', `${order.orderNo} 已完成模拟支付。`))
    saveDemoDb(db)
    return order
  }

  if (url.pathname === '/orders/evaluation' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, body.orderId)
    order.evaluationStatus = 'DONE'
    order.score = body.score
    order.evaluationContent = body.content
    addTimeline(order, `已评价 ${body.score} 星`, 'success')
    saveDemoDb(db)
    return true
  }

  if (url.pathname === '/orders/complaint' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, body.orderId)
    order.complaintStatus = 'PENDING'
    order.complaintContent = body.content
    addTimeline(order, '投诉已提交', 'danger')
    saveDemoDb(db)
    return true
  }

  const orderAction = url.pathname.match(/^\/orders\/(\d+)\/(accept|reject|start|pickup|finish|cancel|runtime)$/)
  if (orderAction) {
    const order = requireOrder(db, orderAction[1])
    const action = orderAction[2]
    if (action === 'runtime') return buildRuntime(order)
    mutateOrderByAction(db, actor, order, action, body)
    saveDemoDb(db)
    return action === 'accept' || action === 'reject' || action === 'start' || action === 'pickup' || action === 'finish' || action === 'cancel'
      ? { ok: true }
      : order
  }

  const detailMatch = url.pathname.match(/^\/orders\/(\d+)$/)
  if (detailMatch) {
    return requireOrder(db, detailMatch[1])
  }

  const trackMatch = url.pathname.match(/^\/orders\/(\d+)\/track\/(report|history)$/)
  if (trackMatch) {
    const order = requireOrder(db, trackMatch[1])
    order.track = order.track || []
    if (trackMatch[2] === 'report' && method === 'POST') {
      order.track.push({ ...body, reportTime: nowText() })
      saveDemoDb(db)
      return true
    }
    return order.track
  }

  if (url.pathname === '/driver/dashboard') {
    requireRole(actor, ROLE.DRIVER)
    return buildDriverDashboard(db)
  }

  if (url.pathname === '/driver/profile' && method === 'PUT') {
    requireRole(actor, ROLE.DRIVER)
    db.driverUser.nickname = body.nickname || db.driverUser.nickname
    db.driverProfile.cityCode = body.cityCode || db.driverProfile.cityCode
    db.driverProfile.licenseNo = body.licenseNo || db.driverProfile.licenseNo
    db.messages.unshift(message('DRIVER', '司机资料已更新', '资料已同步到司机端工作台。'))
    saveDemoDb(db)
    return { ...db.driverUser, profile: db.driverProfile }
  }

  if (url.pathname === '/driver/service-status' && method === 'POST') {
    requireRole(actor, ROLE.DRIVER)
    db.driverProfile.serviceStatus = body.serviceStatus
    db.driverProfile.lastLongitude = body.longitude
    db.driverProfile.lastLatitude = body.latitude
    db.messages.unshift(message('DRIVER', '听单状态已更新', `当前状态：${statusLabel[body.serviceStatus] || body.serviceStatus}`))
    saveDemoDb(db)
    return true
  }

  if (url.pathname === '/driver/withdraw' && method === 'POST') {
    requireRole(actor, ROLE.DRIVER)
    const item = { id: Date.now(), driverId: db.driverUser.id, status: 'PENDING', createdAt: nowText(), ...body }
    db.withdraws.unshift(item)
    db.driverProfile.withdrawableIncome = Math.max(0, Number(db.driverProfile.withdrawableIncome || 0) - Number(body.applyAmount || 0))
    saveDemoDb(db)
    return item
  }

  if (url.pathname === '/driver/certification' && method === 'POST') {
    requireRole(actor, ROLE.DRIVER)
    db.driverProfile.auditStatus = 1
    db.vehicle = { ...db.vehicle, ...body, auditStatus: 1, auditRemark: '网页端已提交，等待管理员审核' }
    saveDemoDb(db)
    return { driverId: db.driverUser.id, driverAuditStatus: 1, vehicleAuditStatus: 1, canReceiveOrders: false, message: '已提交，等待管理员审核' }
  }

  if (url.pathname === '/carpool/mine') {
    requireRole(actor, ROLE.USER)
    return {
      published: db.carpoolTrips.filter((item) => item.ownerId === db.passengerUser.id),
      applied: db.carpoolApplications
    }
  }

  if (url.pathname === '/carpool/publish' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const item = {
      id: db.nextCarpoolId++,
      ownerId: db.passengerUser.id,
      status: 'PUBLISHED',
      createdAt: nowText(),
      ...body
    }
    db.carpoolTrips.unshift(item)
    saveDemoDb(db)
    return item
  }

  if (url.pathname === '/carpool/apply' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const item = {
      id: Date.now(),
      applicationStatus: 'APPLIED',
      passengerId: db.passengerUser.id,
      createdAt: nowText(),
      ...body
    }
    db.carpoolApplications.unshift(item)
    saveDemoDb(db)
    return item
  }

  if (url.pathname === '/carpool/owner-confirm' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) app.ownerConfirmStatus = body.confirmStatus || 'CONFIRMED'
    saveDemoDb(db)
    return app || true
  }

  if (url.pathname === '/carpool/passenger-confirm' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) app.passengerConfirmStatus = body.confirmStatus || 'CONFIRMED'
    saveDemoDb(db)
    return app || true
  }

  if (url.pathname === '/carpool/cancel' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) app.applicationStatus = 'CANCELLED'
    saveDemoDb(db)
    return app || true
  }

  throw new ApiError(`本地演示暂未覆盖接口：${method} ${url.pathname}`, { code: 4004 })
}

function createDemoSession(roleCode) {
  const db = loadDemoDb()
  const user = roleCode === ROLE.DRIVER ? db.driverUser : db.passengerUser
  return {
    token: `demo.${roleCode}.${user.id}.${Date.now()}`,
    userId: user.id,
    roleCode,
    nickname: user.nickname,
    defaultLanguage: 'zh-CN',
    authStatus: user.authStatus ?? 2
  }
}

function resolveActor(token, demoRole) {
  if (demoRole) return { roleCode: demoRole, userId: demoRole === ROLE.DRIVER ? 2 : 1 }
  const parts = String(token || '').split('.')
  if (parts[0] === 'demo') return { roleCode: parts[1], userId: Number(parts[2]) }
  return { roleCode: '', userId: 0 }
}

function ensureLogged(actor) {
  if (!actor.userId) throw new ApiError('请先登录', { code: 4002 })
}

function requireRole(actor, role) {
  if (actor.roleCode !== role) throw new ApiError('当前账号无权限执行该操作', { code: 4003 })
}

function requireDriverOrAdmin(actor) {
  if (![ROLE.DRIVER, 'ADMIN'].includes(actor.roleCode)) throw new ApiError('当前账号无权限执行该操作', { code: 4003 })
}

function requireOrder(db, id) {
  const order = db.orders.find((item) => Number(item.id) === Number(id))
  if (!order) throw new ApiError('订单不存在', { code: 4004 })
  return order
}

function currentOrders(db, actor) {
  if (actor.roleCode === ROLE.DRIVER) {
    return db.orders.filter((item) => Number(item.driverId) === db.driverUser.id)
  }
  return db.orders.filter((item) => Number(item.userId) === db.passengerUser.id)
}

function mutateOrderByAction(db, actor, order, action, body) {
  if (action === 'accept') {
    requireRole(actor, ROLE.DRIVER)
    order.driverId = db.driverUser.id
    order.orderStatus = ORDER_STATUS.ACCEPTED
    db.driverProfile.serviceStatus = DRIVER_STATUS.BUSY
    addTimeline(order, '司机已接单', 'active')
    db.messages.unshift(message('USER', '司机已接单', '李师傅已接单，请准备上车。'))
    return
  }
  if (action === 'reject') {
    requireRole(actor, ROLE.DRIVER)
    addTimeline(order, `司机已拒单：${body.reason || '暂时无法服务'}`, 'danger')
    return
  }
  if (action === 'start') {
    requireRole(actor, ROLE.DRIVER)
    order.orderStatus = ORDER_STATUS.PICKING_UP
    addTimeline(order, '司机开始接驾', 'active')
    return
  }
  if (action === 'pickup') {
    if (![ROLE.DRIVER, ROLE.USER].includes(actor.roleCode)) throw new ApiError('无权限', { code: 4003 })
    order.orderStatus = ORDER_STATUS.IN_TRIP
    addTimeline(order, '行程已开始', 'active')
    return
  }
  if (action === 'finish') {
    requireRole(actor, ROLE.DRIVER)
    order.orderStatus = ORDER_STATUS.FINISHED
    order.actualDistanceKm = Number(body.actualDistanceKm || order.estimatedDistanceKm)
    order.actualDurationMin = Number(body.actualDurationMin || order.estimatedDurationMin)
    order.payStatus = PAY_STATUS.UNPAID
    db.driverProfile.serviceStatus = DRIVER_STATUS.ONLINE
    db.driverProfile.todayIncome = Number(db.driverProfile.todayIncome || 0) + Number(order.payableAmount || 0) * 0.8
    db.driverProfile.withdrawableIncome = Number(db.driverProfile.withdrawableIncome || 0) + Number(order.payableAmount || 0) * 0.8
    addTimeline(order, '行程已结束，等待乘客支付', 'success')
    db.messages.unshift(message('USER', '行程已结束', '请完成模拟支付并评价本次服务。'))
    return
  }
  if (action === 'cancel') {
    order.orderStatus = ORDER_STATUS.CANCELLED
    order.cancelReason = body.reason || '网页端取消'
    db.driverProfile.serviceStatus = DRIVER_STATUS.ONLINE
    addTimeline(order, '订单已取消', 'danger')
  }
}

function buildDriverDashboard(db) {
  return {
    user: db.driverUser,
    profile: db.driverProfile,
    vehicle: db.vehicle,
    servicePermission: {
      canReceiveOrders: db.driverProfile.auditStatus === 2 && db.vehicle.auditStatus === 2,
      message: db.driverProfile.auditStatus === 2 ? '资质正常，可听单' : '资质待审核，可体验演示流程'
    },
    orders: db.orders.filter((item) => Number(item.driverId) === db.driverUser.id),
    pendingWithdraw: db.withdraws.filter((item) => item.status === 'PENDING')
  }
}

function buildRuntime(order) {
  const start = {
    name: order.startName,
    latitude: Number(order.startLat),
    longitude: Number(order.startLng)
  }
  const end = {
    name: order.endName,
    latitude: Number(order.endLat),
    longitude: Number(order.endLng)
  }
  return {
    orderId: order.id,
    route: [start, end],
    driverLocation: order.orderStatus === ORDER_STATUS.DISPATCHING ? null : {
      latitude: Number(order.startLat) + 0.002,
      longitude: Number(order.startLng) + 0.002
    },
    etaMinutes: order.orderStatus === ORDER_STATUS.IN_TRIP ? Math.max(3, Math.round(Number(order.estimatedDurationMin || 8) / 2)) : 6,
    distanceKm: Number(order.estimatedDistanceKm || 3)
  }
}

function addTimeline(order, label, tone) {
  order.updatedAt = nowText()
  order.timeline = order.timeline || []
  order.timeline.unshift({ label, time: nowText(), tone })
}

function message(roleCode, title, content) {
  return {
    id: Date.now() + Math.random(),
    roleCode,
    title,
    content,
    time: nowText(),
    unread: true
  }
}

function loadDemoDb() {
  try {
    const cached = JSON.parse(localStorage.getItem(DEMO_DB_KEY) || 'null')
    if (cached?.version === 2) return cached
  } catch (error) {
    localStorage.removeItem(DEMO_DB_KEY)
  }
  const db = seedDemoDb()
  saveDemoDb(db)
  return db
}

function saveDemoDb(db) {
  localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db))
}

function seedDemoDb() {
  const route = calcRoute('poi101', 'poi102')
  const fare = estimateLocalFare(1, SERVICE_TYPE.TAXI, route.distanceKm, route.durationMin)
  return {
    version: 2,
    nextOrderId: 9003,
    nextCarpoolId: 3003,
    passengerUser: {
      id: 1,
      phone: demoAccounts.USER.phone,
      password: demoAccounts.USER.password,
      nickname: demoAccounts.USER.nickname,
      roleCode: ROLE.USER,
      authStatus: 2,
      walletBalance: 268.8,
      emergencyContact: '王同学',
      emergencyPhone: '13800009999'
    },
    driverUser: {
      id: 2,
      phone: demoAccounts.DRIVER.phone,
      password: demoAccounts.DRIVER.password,
      nickname: demoAccounts.DRIVER.nickname,
      roleCode: ROLE.DRIVER,
      authStatus: 2,
      emergencyContact: '家属',
      emergencyPhone: '13900008888'
    },
    driverProfile: {
      userId: 2,
      cityCode: '310100',
      licenseNo: 'DRV20260514001',
      serviceStatus: DRIVER_STATUS.ONLINE,
      auditStatus: 2,
      todayIncome: 326.4,
      withdrawableIncome: 1268.88,
      todayOrderCount: 8,
      lastLongitude: '117.0810',
      lastLatitude: '39.9820'
    },
    vehicle: {
      id: 101,
      driverId: 2,
      plateNo: '冀R·A8888',
      brand: '比亚迪',
      modelName: '汉 EV',
      color: '橙白',
      seatCount: 5,
      auditStatus: 2,
      auditRemark: '已通过',
      vehicleLicenseImageUrl: '/uploads/demo/vehicle.jpg',
      driverLicenseImageUrl: '/uploads/demo/driver.jpg'
    },
    coupons: fallbackCoupons,
    userCoupons: [],
    orders: [
      {
        id: 9002,
        orderNo: 'WEB9002',
        userId: 1,
        driverId: null,
        carTypeId: 1,
        serviceType: SERVICE_TYPE.TAXI,
        orderStatus: ORDER_STATUS.DISPATCHING,
        payStatus: PAY_STATUS.UNPAID,
        startName: route.start.name,
        startLng: String(route.start.longitude),
        startLat: String(route.start.latitude),
        endName: route.end.name,
        endLng: String(route.end.longitude),
        endLat: String(route.end.latitude),
        estimatedDistanceKm: route.distanceKm,
        estimatedDurationMin: route.durationMin,
        estimatedAmount: fare.amount,
        payableAmount: fare.amount,
        actualAmount: fare.amount,
        currencyCode: fare.currencyCode,
        dispatchMode: 'SMART',
        remark: '本地演示订单，可用司机账号接单。',
        createdAt: nowText(),
        updatedAt: nowText(),
        evaluationStatus: 'PENDING',
        complaintStatus: 'NONE',
        timeline: [{ label: '订单已提交', time: nowText(), tone: 'waiting' }]
      },
      {
        id: 9001,
        orderNo: 'WEB9001',
        userId: 1,
        driverId: 2,
        carTypeId: 2,
        serviceType: SERVICE_TYPE.TAXI,
        orderStatus: ORDER_STATUS.FINISHED,
        payStatus: PAY_STATUS.PAID,
        startName: '人民广场',
        startLng: '121.4737',
        startLat: '31.23037',
        endName: '陆家嘴中心',
        endLng: '121.49981',
        endLat: '31.23969',
        estimatedDistanceKm: 4.5,
        estimatedDurationMin: 18,
        estimatedAmount: 35.8,
        payableAmount: 35.8,
        actualAmount: 35.8,
        currencyCode: 'CNY',
        dispatchMode: 'SMART',
        remark: '已完成示例订单',
        createdAt: '2026-05-14 09:16:00',
        updatedAt: '2026-05-14 09:48:00',
        evaluationStatus: 'DONE',
        complaintStatus: 'NONE',
        score: 5,
        timeline: [
          { label: '支付完成', time: '2026-05-14 09:48:00', tone: 'success' },
          { label: '行程已结束', time: '2026-05-14 09:42:00', tone: 'success' },
          { label: '司机已接单', time: '2026-05-14 09:18:00', tone: 'active' }
        ]
      }
    ],
    carpoolTrips: [
      { id: 3001, ownerId: 1, startName: '燕京理工学院-南门', endName: '天洋广场', departTime: '2026-05-14 18:30:00', seatCount: 3, sharedAmount: 12, baggageRule: '可带小件行李', tripRemark: '校门口集合', status: 'PUBLISHED' },
      { id: 3002, ownerId: 6, startName: '人民广场', endName: '苏州工业园区', departTime: '2026-05-15 08:10:00', seatCount: 2, sharedAmount: 66, baggageRule: '后备箱可放一个行李箱', tripRemark: '商务跨城', status: 'PUBLISHED' }
    ],
    carpoolApplications: [],
    messages: [
      message('USER', '网页门户已准备好', '乘客端可下单、领券、支付、评价、投诉和发布顺风车。'),
      message('DRIVER', '听单大厅在线', '司机端可切换在线、抢单、开始接驾、完成行程和提现。')
    ],
    withdraws: []
  }
}

function nowText() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatAmount(order) {
  return `${order.currencyCode === 'USD' ? '$' : '¥'}${Number(order.payableAmount || order.actualAmount || 0).toFixed(2)}`
}

export { normalizeList }
