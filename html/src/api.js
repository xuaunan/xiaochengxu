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
import { dispatchInvalidSession, resolveSessionFromToken } from './auth-session.js'

const API_BASE_KEY = 'sunshine-web-api-base'
const DEMO_DB_KEY = 'sunshine-web-demo-db-v2'
const WEB_SUPPORT_HEADERS = { 'X-Sunshine-Client': 'WEB' }
const DEMO_DB_VERSION = 4
const DEFAULT_API_BASE = 'http://127.0.0.1:8080'
const SUPPORT_AI_ROLE = 'AI'
const DEFAULT_AI_WELCOME_MESSAGE = '您好，阳光出行客服已接入，请描述您遇到的问题。'
const PREVIOUS_AI_WELCOME_MESSAGE = '您好，阳光出行AI客服已接入，请描述您遇到的问题。'
const LEGACY_DEFAULT_WELCOME_MESSAGE = '您好，阳光出行客服已接入，请描述您遇到的问题。'
const DRIVER_AI_WELCOME_MESSAGE = '司机端AI客服已接入，听单、提现、资质问题都可以在这里反馈。'
const LEGACY_DRIVER_WELCOME_MESSAGE = '司机端客服通道已接入，听单、提现、资质问题都可以在这里反馈。'
const MANUAL_OPEN_NOTICE = '已接入人工客服'
const MANUAL_CLOSE_NOTICE = '已关闭人工客服'
const MANUAL_WAIT_WARNING = '人工客服等待时间太久啦，即将为您结束本次人工接待，后续您可以继续由AI客服为您服务。'
const MANUAL_WARN_TIMEOUT_MS = 150 * 1000
const MANUAL_IDLE_TIMEOUT_MS = 180 * 1000
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
    headers: customHeaders = {},
    timeout = 1200,
    allowDemoFallback = true
  } = options

  bumpApiLoading(1)

  if (Date.now() < backendBackoffUntil && allowDemoFallback) {
    emitApiMode('demo', '业务服务暂不可用，当前操作使用网页离线数据')
    try {
      return demoRequest(path, { method, data, token, demoRole, headers: customHeaders })
    } finally {
      bumpApiLoading(-1)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const headers = { 'Content-Type': 'application/json', ...customHeaders }
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
      emitApiMode('backend', '已连接业务服务')
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
      dispatchInvalidSession({
        token,
        skipAuth,
        status: error.status,
        code: error.code,
        message: error.message
      })
      throw error
    }
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '业务服务暂不可用，当前操作使用网页离线数据')
    if (!allowDemoFallback) {
      throw new ApiError('当前未连接后端，暂时无法同步真实资料', {
        status: 503,
        network: true
      })
    }
    return demoRequest(path, { method, data, token, demoRole, headers: customHeaders })
  } finally {
    window.clearTimeout(timer)
    bumpApiLoading(-1)
  }
}

function tripRequest(path, options = {}) {
  return request(path, {
    ...options,
    timeout: options.timeout ?? 12000,
    allowDemoFallback: false
  })
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

async function uploadDriverDocument(token, file, documentType) {
  if (!file) throw new ApiError('请选择要上传的证件图片', { status: 400 })
  bumpApiLoading(1)

  if (Date.now() < backendBackoffUntil) {
    bumpApiLoading(-1)
    throw new ApiError('业务服务暂不可用，证件图片未上传完成，请稍后重试', { status: 503, network: true })
  }

  const formData = new FormData()
  formData.append('file', file)
  if (documentType) formData.append('documentType', documentType)

  try {
    const response = await fetch(`${getApiBase()}/driver/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      credentials: 'include'
    })
    const payload = await parsePayload(response)
    if (response.ok && Number(payload.code) === 0) {
      backendBackoffUntil = 0
      emitApiMode('backend', '已连接业务服务')
      return payload.data ?? payload
    }
    throw new ApiError(payload.message || payload.msg || `上传失败：${response.status}`, {
      code: payload.code,
      status: response.status,
      network: false,
      payload
    })
  } catch (error) {
    if (error instanceof ApiError && !error.network) throw error
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '业务服务未连接，证件图片未上传完成')
    throw new ApiError('证件图片上传失败，请检查业务服务后重新选择图片', { status: 503, network: true })
  } finally {
    bumpApiLoading(-1)
  }
}

async function uploadAvatarImage(token, file) {
  if (!file) throw new ApiError('请选择要上传的头像图片', { status: 400 })
  bumpApiLoading(1)

  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch(`${getApiBase()}/auth/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      credentials: 'include'
    })
    const payload = await parsePayload(response)
    if (response.ok && Number(payload.code) === 0) {
      backendBackoffUntil = 0
      emitApiMode('backend', '已连接业务服务')
      return payload.data ?? payload
    }
    throw new ApiError(payload.message || payload.msg || `头像上传失败：${response.status}`, {
      code: payload.code,
      status: response.status,
      network: false,
      payload
    })
  } catch (error) {
    if (error instanceof ApiError && !error.network) throw error
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '业务服务未连接，头像未上传完成')
    throw new ApiError('头像上传失败，请检查业务服务后重新选择图片', { status: 503, network: true })
  } finally {
    bumpApiLoading(-1)
  }
}

async function binaryRequest(path, options = {}) {
  const { token, timeout = 3000 } = options
  bumpApiLoading(1)

  if (Date.now() < backendBackoffUntil) {
    emitApiMode('demo', '业务服务暂不可用，当前操作使用网页离线数据')
    try {
      return demoInvoiceImageUrl(path)
    } finally {
      bumpApiLoading(-1)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
      credentials: 'include'
    })
    if (!response.ok) throw new ApiError(`请求失败：${response.status}`, { status: response.status })
    backendBackoffUntil = 0
    emitApiMode('backend', '已连接业务服务')
    return URL.createObjectURL(await response.blob())
  } catch (error) {
    if (error instanceof ApiError) {
      dispatchInvalidSession({
        token,
        skipAuth: false,
        status: error.status,
        code: error.code,
        message: error.message
      })
      throw error
    }
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '业务服务未连接，当前使用网页离线数据')
    return demoInvoiceImageUrl(path)
  } finally {
    window.clearTimeout(timer)
    bumpApiLoading(-1)
  }
}

function invoiceBinaryFilename(path, extension = 'png') {
  const match = String(path || '').match(/\/orders\/(\d+)\/invoice\/image/)
  return match?.[1] ? `invoice-${match[1]}.${extension}` : `invoice.${extension}`
}

async function binaryAssetRequest(path, options = {}) {
  const { token, timeout = 3000, strict = false } = options
  bumpApiLoading(1)

  if (Date.now() < backendBackoffUntil) {
    emitApiMode('demo', '业务服务暂不可用，当前操作使用网页离线数据')
    try {
      if (strict) {
        throw new ApiError('当前未连接后端，暂时无法查看发票', {
          status: 503,
          network: true
        })
      }
      return {
        url: demoInvoiceImageUrl(path),
        filename: invoiceBinaryFilename(path, 'svg'),
        isDemo: true
      }
    } finally {
      bumpApiLoading(-1)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
      credentials: 'include'
    })
    if (!response.ok) {
      throw new ApiError(
        response.status === 400 || response.status === 404
          ? '发票暂未生成，请稍后再查看'
          : '查看发票失败，请稍后重试',
        { status: response.status }
      )
    }
    backendBackoffUntil = 0
    emitApiMode('backend', '已连接业务服务')
    return {
      url: URL.createObjectURL(await response.blob()),
      filename: invoiceBinaryFilename(path),
      isDemo: false
    }
  } catch (error) {
    if (error instanceof ApiError) {
      dispatchInvalidSession({
        token,
        skipAuth: false,
        status: error.status,
        code: error.code,
        message: error.message
      })
      throw error
    }
    backendBackoffUntil = Date.now() + 5000
    emitApiMode('demo', '业务服务未连接，当前使用网页离线数据')
    if (strict) {
      throw new ApiError('当前未连接后端，暂时无法查看发票', {
        status: 503,
        network: true
      })
    }
    return {
      url: demoInvoiceImageUrl(path),
      filename: invoiceBinaryFilename(path, 'svg'),
      isDemo: true
    }
  } finally {
    window.clearTimeout(timer)
    bumpApiLoading(-1)
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
  profileStrict: (token) => request('/auth/profile', { token, allowDemoFallback: false, timeout: 1800 }),
  updateProfile: (token, data) => request('/auth/profile', { method: 'PUT', token, data }),
  uploadAvatar: (token, file) => uploadAvatarImage(token, file),
  submitRealName: (token, data) => request('/auth/real-name', { method: 'POST', token, data }),
  home: () => request('/app/home', { skipAuth: true }),
  estimate: (params) => request(`/app/estimate${toQuery(params)}`, { skipAuth: true }),
  createOrder: (token, data) => tripRequest('/orders', { method: 'POST', token, data }),
  orders: (token) => tripRequest('/orders/mine', { token }),
  orderDetail: (token, id) => tripRequest(`/orders/${id}`, { token }),
  orderRuntime: (token, id) => tripRequest(`/orders/${id}/runtime`, { token }),
  cancelOrder: (token, id, reason) => tripRequest(`/orders/${id}/cancel`, { method: 'POST', token, data: { reason } }),
  pickupOrder: (token, id) => tripRequest(`/orders/${id}/pickup`, { method: 'POST', token }),
  mockPay: (token, id, amount, payChannel = 'WEB', options = {}) => tripRequest('/orders/mock-pay', {
    method: 'POST',
    token,
    data: {
      orderId: Number(id),
      payChannel,
      payableAmount: amount || null,
      userCouponId: options.userCouponId || null,
      couponDiscount: options.couponDiscount || 0,
      originalAmount: options.originalAmount || null,
      couponName: options.couponName || '',
      couponRuleDesc: options.couponRuleDesc || ''
    }
  }),
  evaluate: (token, data) => tripRequest('/orders/evaluation', { method: 'POST', token, data: normalizeEvaluationRequest(data) }),
  complaint: (token, data) => tripRequest('/orders/complaint', { method: 'POST', token, data: normalizeComplaintRequest(data) }),
  applyInvoice: (token, id, data) => tripRequest(`/orders/${id}/invoice`, { method: 'POST', token, data }),
  invoiceImage: (token, id) => binaryRequest(`/orders/${id}/invoice/image`, { token }),
  invoiceAsset: (token, id, options = {}) => binaryAssetRequest(`/orders/${id}/invoice/image`, { token, ...options }),
  trackHistory: (token, id) => tripRequest(`/orders/${id}/track/history`, { token }),
  reportTrack: (token, id, data) => tripRequest(`/orders/${id}/track/report`, { method: 'POST', token, data }),
  couponCenter: () => request('/coupons/center', { skipAuth: true }),
  myCoupons: (token) => request('/coupons/mine', { token }),
  receiveCoupon: (token, id) => request(`/coupons/${id}/receive`, { method: 'POST', token }),
  membership: (token) => request('/membership', { token }),
  activateMembership: (token) => request('/membership/activate', { method: 'POST', token }),
  syncMembershipCoupons: (token) => request('/membership/weekly-coupons', { method: 'POST', token }),
  messages: (token) => request('/messages', { token }),
  markMessageRead: (token, id) => request(`/messages/${id}/read`, { method: 'POST', token }),
  supportConversation: (token) => request('/support/conversation', { token, headers: WEB_SUPPORT_HEADERS }),
  supportMessages: (token) => request('/support/messages', { token, headers: WEB_SUPPORT_HEADERS }),
  sendSupportMessage: (token, content) => request('/support/messages', {
    method: 'POST',
    token,
    headers: WEB_SUPPORT_HEADERS,
    data: { content }
  }),
  carpoolSearch: (keyword = '') => tripRequest(`/carpool/search${toQuery({ keyword })}`, { skipAuth: true }),
  carpoolDetail: (id) => tripRequest(`/carpool/${id}`, { skipAuth: true }),
  carpoolMine: (token) => tripRequest('/carpool/mine', { token }),
  carpoolPublish: (token, data) => tripRequest('/carpool/publish', { method: 'POST', token, data }),
  carpoolApply: (token, data) => tripRequest('/carpool/apply', { method: 'POST', token, data }),
  carpoolOwnerConfirm: (token, data) => tripRequest('/carpool/owner-confirm', { method: 'POST', token, data }),
  carpoolPassengerConfirm: (token, data) => tripRequest('/carpool/passenger-confirm', { method: 'POST', token, data }),
  carpoolCancel: (token, data) => tripRequest('/carpool/cancel', { method: 'POST', token, data }),
  driverDashboard: (token) => tripRequest('/driver/dashboard', { token }),
  driverUpdateProfile: (token, data) => request('/driver/profile', { method: 'PUT', token, data }),
  driverStatus: (token, data) => tripRequest('/driver/service-status', { method: 'POST', token, data }),
  driverWithdraws: (token) => request('/driver/withdraws', { token }),
  driverWaitingOrders: (token) => tripRequest('/orders/waiting', { token }),
  driverAccept: (token, id) => tripRequest(`/orders/${id}/accept`, { method: 'POST', token }),
  driverReject: (token, id, reason) => tripRequest(`/orders/${id}/reject`, { method: 'POST', token, data: { reason } }),
  driverStart: (token, id) => tripRequest(`/orders/${id}/start`, { method: 'POST', token }),
  driverPickup: (token, id) => tripRequest(`/orders/${id}/pickup`, { method: 'POST', token }),
  driverFinish: (token, id, data) => tripRequest(`/orders/${id}/finish`, { method: 'POST', token, data }),
  driverWithdraw: (token, data) => request('/driver/withdraw', { method: 'POST', token, data }),
  driverUploadDocument: (token, file, documentType) => uploadDriverDocument(token, file, documentType),
  driverCertify: (token, data) => request('/driver/certification', { method: 'POST', token, data })
}

function toQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return query ? `?${query}` : ''
}

function normalizeEvaluationRequest(data = {}) {
  const tags = Array.isArray(data.tags) && data.tags.length ? `标签：${data.tags.join('、')}` : ''
  const anonymous = data.anonymous ? '匿名评价' : ''
  const content = [anonymous, tags, String(data.content || '').trim()].filter(Boolean).join('\n')
  return {
    orderId: data.orderId,
    score: Number(data.score || 5),
    content,
    tags: Array.isArray(data.tags) ? data.tags : [],
    anonymous: Boolean(data.anonymous)
  }
}

function normalizeComplaintRequest(data = {}) {
  const contactPhone = String(data.contactPhone || '').trim()
  const contactLine = contactPhone ? `联系电话：${contactPhone}` : ''
  return {
    orderId: data.orderId,
    complaintType: data.complaintType || 'OTHER',
    content: [String(data.content || '').trim(), contactLine].filter(Boolean).join('\n')
  }
}

function demoCouponDiscountAmount(coupon = {}, amount = 0) {
  const totalAmount = Math.max(0, Number(amount || 0))
  if (!totalAmount) return 0
  const cashAmount = Number(coupon.discountAmount ?? coupon.amount ?? coupon.faceValue ?? coupon.couponAmount)
  if (Number.isFinite(cashAmount) && cashAmount > 0) {
    return Number(Math.min(cashAmount, Math.max(0, totalAmount - 0.01)).toFixed(2))
  }
  const rate = Number(coupon.discountRate ?? coupon.rate ?? coupon.discount)
  if (Number.isFinite(rate) && rate > 0 && rate < 1) {
    return Number((totalAmount * (1 - rate)).toFixed(2))
  }
  return 0
}

function demoFindUserCoupon(db, userCouponId) {
  if (!userCouponId) return null
  return db.userCoupons.find((item) => String(item.userCouponId || item.id || item.couponId) === String(userCouponId)) || null
}

function demoCouponMatchesOrder(coupon = {}, serviceType = '') {
  const status = String(coupon.couponStatus || coupon.status || 'UNUSED').toUpperCase()
  const scope = String(coupon.serviceScope || coupon.serviceType || coupon.scope || 'ALL').toUpperCase()
  const orderType = String(serviceType || '').toUpperCase()
  return status === 'UNUSED' && (scope === 'ALL' || scope === orderType)
}

function demoRequest(path, options) {
  const url = new URL(path, 'http://demo.local')
  const method = options.method || 'GET'
  const body = options.data || {}
  const db = loadDemoDb()
  const actor = resolveActor(options.token, options.demoRole)
  const supportChannel = normalizeSupportChannel(options.headers?.['X-Sunshine-Client'])

  if (url.pathname === '/auth/login' && method === 'POST') {
    const role = body.roleCode
    const account = role === ROLE.DRIVER ? db.driverUser : db.passengerUser
    const fallback = demoAccounts[role]
    const password = account?.password || fallback?.password
    const phone = account?.phone || fallback?.phone
    if (!account || body.phone !== phone || body.password !== password) {
      throw new ApiError('账号或密码不正确', { code: 4000 })
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
        { title: '橙色专车门户已接入统一业务服务', subtitle: '乘客下单、司机抢单、支付评价闭环' },
        { title: '即时打车 / 顺风车 / 国际出行', subtitle: '沿用小程序状态与接口字段' }
      ],
      carTypes: fallbackCarTypes,
      couponCenter: db.coupons,
      notices: ['司机听单大厅实时刷新', '默认业务服务地址 http://127.0.0.1:8080', '业务服务未连接时自动切换离线数据'],
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
    return db.carpoolTrips
      .filter((item) => `${item.startName}${item.endName}`.includes(keyword))
      .map((trip) => buildDemoSearchCarpoolTrip(db, trip))
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
    db.messages.unshift(message('USER', '实名信息已提交', '资料已更新到网页端，在线服务可继续处理实名流程。'))
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

  if (url.pathname === '/membership') {
    requireRole(actor, ROLE.USER)
    return buildMembership(db, 0)
  }

  if (url.pathname === '/membership/activate' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    db.passengerUser.memberStatus = 'ACTIVE'
    db.passengerUser.memberLevel = '阳光会员'
    db.passengerUser.memberOpenedAt = db.passengerUser.memberOpenedAt || nowText()
    db.passengerUser.memberExpireAt = addDaysText(30)
    const issuedCount = ensureDemoMemberCoupons(db, true)
    db.messages.unshift(message('USER', '阳光会员已开通', `会员权益已同步，${issuedCount} 张专属券已放入券包。`))
    saveDemoDb(db)
    return buildMembership(db, issuedCount)
  }

  if (url.pathname === '/membership/weekly-coupons' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const issuedCount = ensureDemoMemberCoupons(db, true)
    saveDemoDb(db)
    return buildMembership(db, issuedCount)
  }

  const receiveMatch = url.pathname.match(/^\/coupons\/(\d+)\/receive$/)
  if (receiveMatch && method === 'POST') {
    const coupon = db.coupons.find((item) => Number(item.id) === Number(receiveMatch[1]))
    if (!coupon) throw new ApiError('优惠券不存在', { code: 4004 })
    const existing = db.userCoupons.find((item) => Number(item.couponId || item.id) === Number(coupon.id))
    if (existing) throw new ApiError('该优惠券已领取', { code: 4006 })
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
    const isWebTaxiOrder = String(body.sourceChannel || '').toUpperCase() === 'WEB' && body.serviceType === SERVICE_TYPE.TAXI
    const webExclusiveDiscountAmount = isWebTaxiOrder
      ? Math.min(Math.max(0, Number(body.webExclusiveDiscountAmount || 0)), Math.max(0, Number(fare.amount || 0) - 0.01))
      : 0
    const selectedCoupon = demoFindUserCoupon(db, body.userCouponId)
    const selectedCouponUsable = selectedCoupon && demoCouponMatchesOrder(selectedCoupon, body.serviceType)
    const requestedCouponDiscount = Math.max(0, Number(body.couponDiscount || 0))
    const calculatedCouponDiscount = selectedCouponUsable
      ? (requestedCouponDiscount || demoCouponDiscountAmount(selectedCoupon, Number(fare.amount || 0) - webExclusiveDiscountAmount))
      : 0
    const couponDiscountAmount = Number(Math.min(
      Math.max(0, calculatedCouponDiscount),
      Math.max(0, Number(fare.amount || 0) - webExclusiveDiscountAmount - 0.01)
    ).toFixed(2))
    const totalDiscountAmount = Number((webExclusiveDiscountAmount + couponDiscountAmount).toFixed(2))
    const payableAmount = Number(Math.max(0, Number(fare.amount || 0) - totalDiscountAmount).toFixed(2))
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
      couponDiscount: totalDiscountAmount,
      payableAmount,
      actualAmount: payableAmount,
      currencyCode: fare.currencyCode,
      dispatchMode: body.dispatchMode || 'SMART',
      sourceChannel: body.sourceChannel || 'WEB',
      webExclusiveDiscountAmount: Number(webExclusiveDiscountAmount.toFixed(2)),
      webExclusiveDiscountLabel: body.webExclusiveDiscountLabel || '网页专属签到优惠',
      webExclusiveDiscountScope: body.webExclusiveDiscountScope || 'WEB_TAXI_ONLY',
      webCheckinAccountKey: body.webCheckinAccountKey || '',
      userCouponId: selectedCouponUsable ? (selectedCoupon.userCouponId || selectedCoupon.id || selectedCoupon.couponId) : null,
      couponName: selectedCouponUsable
        ? (body.couponName || selectedCoupon.couponName || selectedCoupon.name || '优惠券')
        : webExclusiveDiscountAmount > 0 ? (body.webExclusiveDiscountLabel || '网页专属签到优惠') : '',
      couponRuleDesc: selectedCouponUsable
        ? (body.couponRuleDesc || selectedCoupon.ruleDesc || '')
        : webExclusiveDiscountAmount > 0 ? '网页版打车专属，小程序不可使用' : '',
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
    const previousPayStatus = order.payStatus
    order.payStatus = PAY_STATUS.PAID
    order.payChannel = body.payChannel || 'WEB'
    order.paidAt = nowText()
    const payCouponId = body.userCouponId || order.userCouponId
    if (payCouponId) {
      const selectedCoupon = db.userCoupons.find((item) => String(item.userCouponId || item.id || item.couponId) === String(payCouponId))
      if (selectedCoupon) {
        selectedCoupon.couponStatus = 'USED'
        selectedCoupon.usedAt = nowText()
        order.userCouponId = selectedCoupon.userCouponId || selectedCoupon.id || selectedCoupon.couponId
        order.couponName = body.couponName || selectedCoupon.couponName || selectedCoupon.name || '优惠券'
        order.couponRuleDesc = body.couponRuleDesc || selectedCoupon.ruleDesc || ''
      } else {
        order.userCouponId = payCouponId
      }
      order.couponDiscount = Number(body.couponDiscount || order.couponDiscount || 0)
      order.originalAmount = body.originalAmount !== undefined && body.originalAmount !== null ? Number(body.originalAmount) : order.originalAmount
    }
    if (body.payableAmount !== undefined && body.payableAmount !== null) {
      order.payableAmount = Number(body.payableAmount)
      order.actualAmount = Number(body.payableAmount)
    }
    if (previousPayStatus !== PAY_STATUS.PAID && String(order.payChannel).toUpperCase() === 'BALANCE') {
      const paidAmount = Number(order.payableAmount || order.actualAmount || 0)
      db.passengerUser.walletBalance = Math.max(0, Number(db.passengerUser.walletBalance || 0) - paidAmount)
    }
    order.updatedAt = nowText()
    addTimeline(order, `支付成功（${demoPayChannelText(order.payChannel)}）`, 'success')
    db.messages.unshift(message('USER', '支付完成', `${order.orderNo} 已通过${demoPayChannelText(order.payChannel)}完成支付。`))
    saveDemoDb(db)
    return order
  }

  if (url.pathname === '/orders/evaluation' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, body.orderId)
    order.evaluationStatus = 'DONE'
    order.score = body.score
    order.evaluationTags = Array.isArray(body.tags) ? body.tags : []
    order.evaluationContent = body.content
    addTimeline(order, `已评价 ${body.score} 星`, 'success')
    db.messages.unshift(message('USER', '评价已提交', `${order.orderNo} 的行程评价已同步。`))
    saveDemoDb(db)
    return true
  }

  if (url.pathname === '/orders/complaint' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, body.orderId)
    order.complaintStatus = 'PENDING'
    order.complaintType = body.complaintType || 'OTHER'
    order.complaintContactPhone = body.contactPhone || ''
    order.complaintContent = body.content
    addTimeline(order, `投诉已提交（${demoComplaintTypeText(order.complaintType)}）`, 'danger')
    db.messages.unshift(message('USER', '投诉已提交', `${order.orderNo} 的${demoComplaintTypeText(order.complaintType)}反馈已进入处理。`))
    saveDemoDb(db)
    return true
  }

  const invoiceMatch = url.pathname.match(/^\/orders\/(\d+)\/invoice$/)
  if (invoiceMatch && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const order = requireOrder(db, invoiceMatch[1])
    if (order.orderStatus !== ORDER_STATUS.FINISHED || order.payStatus !== PAY_STATUS.PAID) {
      throw new ApiError('仅已完成且已支付订单可以申请发票', { code: 4005 })
    }
    order.invoiceStatus = 'APPLIED'
    order.invoiceTitle = body.invoiceTitle || body.title || db.passengerUser.realName || db.passengerUser.nickname
    order.taxNo = body.taxNo || '个人无需填写'
    order.buyerPhone = body.buyerPhone || db.passengerUser.phone
    order.invoiceRemark = body.remark || '网页端提交电子发票申请'
    order.invoiceAppliedAt = nowText()
    addTimeline(order, '发票申请已提交', 'success')
    db.messages.unshift(message('USER', '发票申请已提交', `${order.orderNo} 的电子发票申请已同步到后台。`))
    saveDemoDb(db)
    return order
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

  if (url.pathname === '/driver/withdraws') {
    requireRole(actor, ROLE.DRIVER)
    return db.withdraws
  }

  if (url.pathname === '/driver/profile' && method === 'PUT') {
    requireRole(actor, ROLE.DRIVER)
    db.driverUser.nickname = body.nickname || db.driverUser.nickname
    db.driverUser.defaultLanguage = body.defaultLanguage || db.driverUser.defaultLanguage
    db.driverUser.emergencyContact = body.emergencyContact ?? body.emergency_contact ?? db.driverUser.emergencyContact
    db.driverUser.emergencyPhone = body.emergencyPhone ?? body.emergency_phone ?? db.driverUser.emergencyPhone
    db.driverProfile.cityCode = body.cityCode || db.driverProfile.cityCode
    db.driverProfile.licenseNo = body.licenseNo || db.driverProfile.licenseNo
    db.driverProfile.emergencyContact = db.driverUser.emergencyContact
    db.driverProfile.emergencyPhone = db.driverUser.emergencyPhone
    db.messages.unshift(message('DRIVER', '司机资料已更新', '资料已更新到司机端工作台。'))
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
    const applyAmount = Number(body.applyAmount || body.amount || 0)
    const availableAmount = Number(db.driverProfile.withdrawableIncome || 0)
    if (!Number.isFinite(applyAmount) || applyAmount <= 0) {
      throw new ApiError('请输入正确的提现金额', { code: 4001 })
    }
    if (applyAmount > availableAmount) {
      throw new ApiError('提现金额不能超过可提现余额', { code: 4001 })
    }
    if (!String(body.bankName || '').trim()) {
      throw new ApiError('请输入开户行', { code: 4001 })
    }
    if (!String(body.bankAccount || '').trim()) {
      throw new ApiError('请输入银行卡号', { code: 4001 })
    }
    const item = { id: Date.now(), driverId: db.driverUser.id, status: 'PENDING', createdAt: nowText(), ...body }
    db.withdraws.unshift(item)
    db.driverProfile.withdrawableIncome = Math.max(0, availableAmount - applyAmount)
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

  if (url.pathname === '/support/conversation') {
    requireSupportRole(actor)
    const conversation = ensureDemoSupportConversation(db, actor, supportChannel)
    saveDemoDb(db)
    return conversation
  }

  if (url.pathname === '/support/messages') {
    requireSupportRole(actor)
    const conversation = ensureDemoSupportConversation(db, actor, supportChannel)
    if (method === 'POST') {
      const content = String(body.content || '').trim()
      if (!content) throw new ApiError('消息内容不能为空', { code: 4001 })
      const item = supportMessage(conversation.id, actor.userId, actor.roleCode, content)
      db.supportMessages.push(item)
      const wasManual = conversation.status === 'MANUAL'
      const manualActive = wasManual || isDemoManualSupportIntent(content)
      conversation.status = manualActive ? 'MANUAL' : 'OPEN'
      conversation.lastMessage = item.content
      conversation.lastMessageAt = item.createdAt
      conversation.unreadForAdmin = Number(conversation.unreadForAdmin || 0) + 1
      conversation.unreadForUser = 0
      if (manualActive) {
        const notice = ensureDemoManualOpenNotice(db, conversation)
        if (notice) {
        conversation.lastMessage = notice.content
        conversation.lastMessageAt = notice.createdAt
        conversation.unreadForUser = Number(conversation.unreadForUser || 0) + 1
        }
      }
      if (!manualActive) {
        const aiReply = supportMessage(conversation.id, null, SUPPORT_AI_ROLE, buildDemoSupportReply(content, actor.roleCode))
        db.supportMessages.push(aiReply)
        conversation.lastMessage = aiReply.content
        conversation.lastMessageAt = aiReply.createdAt
        conversation.unreadForUser = Number(conversation.unreadForUser || 0) + 1
      }
      db.messages.unshift(message(actor.roleCode, '客服消息已发送', content))
      saveDemoDb(db)
      return item
    }
    conversation.unreadForUser = 0
    saveDemoDb(db)
    return db.supportMessages.filter((item) => Number(item.conversationId) === Number(conversation.id))
  }

  if (url.pathname === '/carpool/mine') {
    requireRole(actor, ROLE.USER)
    return buildDemoCarpoolMine(db)
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
    const trip = db.carpoolTrips.find((item) => Number(item.id) === Number(body.tripId))
    if (!trip) throw new ApiError('顺风车行程不存在', { code: 4004 })
    if (Number(trip.ownerId || trip.ownerUserId) === Number(db.passengerUser.id)) {
      throw new ApiError('不能申请自己发布的顺风车', { code: 4006 })
    }
    const existing = db.carpoolApplications.find((item) => Number(item.tripId) === Number(body.tripId) && Number(item.passengerUserId || item.passengerId) === Number(db.passengerUser.id) && !['CANCELLED', 'REJECTED'].includes(item.applicationStatus))
    if (existing) throw new ApiError('已提交过该顺风车申请', { code: 4006 })
    const companionCount = Number(body.companionCount || 0)
    const needSeat = companionCount + 1
    const remainSeat = Number(trip.remainSeatCount ?? trip.remainingSeatCount ?? trip.seatCount ?? 1)
    if (needSeat > remainSeat) throw new ApiError('当前顺风车余座不足', { code: 4005 })
    const item = {
      id: Date.now(),
      tripId: Number(body.tripId),
      applicationStatus: 'APPLIED',
      passengerUserId: db.passengerUser.id,
      passengerId: db.passengerUser.id,
      companionCount,
      totalSeatCount: needSeat,
      sharedAmount: Number(trip.sharedAmount || 0) * needSeat,
      note: body.note || '网页端申请搭乘',
      createdAt: nowText(),
      updatedAt: nowText()
    }
    db.carpoolApplications.unshift(item)
    trip.remainSeatCount = Math.max(0, remainSeat - needSeat)
    trip.status = trip.remainSeatCount <= 0 ? 'FULL' : 'MATCHING'
    saveDemoDb(db)
    return item
  }

  if (url.pathname === '/carpool/owner-confirm' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) {
      if (String(body.action || '').toUpperCase() === 'REJECT') {
        app.applicationStatus = 'REJECTED'
        app.cancelReason = body.note || '车主暂时不便同行'
      } else {
        app.applicationStatus = 'OWNER_CONFIRMED'
        app.ownerConfirmedAt = nowText()
      }
      app.note = body.note || app.note
      app.updatedAt = nowText()
    }
    saveDemoDb(db)
    return app || true
  }

  if (url.pathname === '/carpool/passenger-confirm' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) {
      app.applicationStatus = 'CONFIRMED'
      app.passengerConfirmedAt = nowText()
      app.note = body.note || app.note
      app.updatedAt = nowText()
      const trip = db.carpoolTrips.find((item) => Number(item.id) === Number(app.tripId))
      if (trip) trip.status = 'CONFIRMED'
    }
    saveDemoDb(db)
    return app || true
  }

  if (url.pathname === '/carpool/cancel' && method === 'POST') {
    requireRole(actor, ROLE.USER)
    const app = db.carpoolApplications.find((item) => Number(item.id) === Number(body.applicationId))
    if (app) {
      app.applicationStatus = 'CANCELLED'
      app.cancelReason = body.reason || '网页端取消申请'
      app.updatedAt = nowText()
      const trip = db.carpoolTrips.find((item) => Number(item.id) === Number(app.tripId))
      if (trip) {
        const released = Number(app.companionCount || 0) + 1
        trip.remainSeatCount = Math.min(Number(trip.seatCount || released), Number(trip.remainSeatCount ?? 0) + released)
        trip.status = trip.remainSeatCount >= Number(trip.seatCount || 0) ? 'PUBLISHED' : 'MATCHING'
      }
    }
    saveDemoDb(db)
    return app || true
  }

  throw new ApiError(`离线数据暂未覆盖接口：${method} ${url.pathname}`, { code: 4004 })
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
  return resolveSessionFromToken(token)
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

function requireSupportRole(actor) {
  if (![ROLE.USER, ROLE.DRIVER].includes(actor.roleCode)) throw new ApiError('当前账号无权限执行该操作', { code: 4003 })
}

function requireOrder(db, id) {
  const order = db.orders.find((item) => Number(item.id) === Number(id))
  if (!order) throw new ApiError('订单不存在', { code: 4004 })
  return order
}

function buildMembership(db, issuedCount = 0) {
  const user = db.passengerUser
  const active = user.memberStatus === 'ACTIVE'
  const weeklyCouponTotal = db.userCoupons.filter((item) => item.receiveMode === 'MEMBER_WEEKLY').length
  return {
    userId: user.id,
    nickname: user.nickname,
    phone: user.phone,
    roleCode: ROLE.USER,
    active,
    memberStatus: active ? 'ACTIVE' : 'NONE',
    memberLevel: active ? (user.memberLevel || '阳光会员') : '普通用户',
    memberOpenedAt: user.memberOpenedAt || '',
    memberExpireAt: user.memberExpireAt || '',
    expireDate: user.memberExpireAt ? String(user.memberExpireAt).slice(0, 10) : '',
    memberLastCouponWeek: user.memberLastCouponWeek || '',
    lastSyncAt: user.memberLastCouponSyncedAt || '',
    weeklyCouponTotal,
    issuedCount,
    couponRuleText: '每周自动赠送 3 张不同优惠券',
    createdAt: user.createdAt || nowText()
  }
}

function ensureDemoMemberCoupons(db, notify = false) {
  if (db.passengerUser.memberStatus !== 'ACTIVE') {
    throw new ApiError('乘客会员未开通或已过期', { code: 4005 })
  }
  const weekCode = currentWeekCode()
  if (db.passengerUser.memberLastCouponWeek === weekCode) return 0
  const templates = [
    { id: 8101, couponName: '会员每周通用6元券', couponType: 'CASH', serviceScope: 'ALL', thresholdAmount: 20, discountAmount: 6, ruleDesc: '阳光会员每周专属券' },
    { id: 8102, couponName: '会员每周打车8元券', couponType: 'CASH', serviceScope: 'TAXI', thresholdAmount: 30, discountAmount: 8, ruleDesc: '即时打车满30元可用' },
    { id: 8103, couponName: '会员每周顺风车5元券', couponType: 'CASH', serviceScope: 'CARPOOL', thresholdAmount: 20, discountAmount: 5, ruleDesc: '顺风车满20元可用' }
  ]
  templates.forEach((template) => {
    if (!db.coupons.some((item) => Number(item.id) === Number(template.id))) {
      db.coupons.push({ ...template, validEndTime: '2030-12-31 23:59:59', status: 1, remainCount: 999999 })
    }
    db.userCoupons.unshift({
      id: Date.now() + template.id,
      userCouponId: Date.now() + template.id,
      couponId: template.id,
      couponName: template.couponName,
      couponStatus: 'UNUSED',
      serviceScope: template.serviceScope,
      validStartTime: nowText(),
      validEndTime: addDaysText(7),
      receiveMode: 'MEMBER_WEEKLY',
      ...template
    })
  })
  db.passengerUser.memberLastCouponWeek = weekCode
  db.passengerUser.memberLastCouponSyncedAt = nowText()
  if (notify) {
    db.messages.unshift(message('USER', '会员券包已同步', `本周 ${templates.length} 张会员专属券已到账。`))
  }
  return templates.length
}

function currentOrders(db, actor) {
  if (actor.roleCode === ROLE.DRIVER) {
    return db.orders.filter((item) => Number(item.driverId) === db.driverUser.id)
  }
  return db.orders.filter((item) => Number(item.userId) === db.passengerUser.id)
}

function buildDemoCarpoolMine(db) {
  const ownerRecords = db.carpoolTrips
    .filter((trip) => Number(trip.ownerId || trip.ownerUserId) === Number(db.passengerUser.id))
    .map((trip) => buildDemoOwnerCarpoolRecord(db, trip))
  const passengerRecords = db.carpoolApplications
    .filter((application) => Number(application.passengerId || application.passengerUserId) === Number(db.passengerUser.id))
    .map((application) => buildDemoPassengerCarpoolRecord(db, application))
  const records = [...ownerRecords, ...passengerRecords]
  return {
    summary: {
      ownerTripTotal: ownerRecords.length,
      passengerTripTotal: passengerRecords.length,
      pendingTotal: records.filter((item) => item.statusBucket === 'pending').length,
      upcomingTotal: records.filter((item) => item.statusBucket === 'upcoming').length,
      processingTotal: records.filter((item) => item.statusBucket === 'processing').length,
      completedTotal: records.filter((item) => item.statusBucket === 'completed').length
    },
    ownerRecords,
    passengerRecords
  }
}

function buildDemoOwnerCarpoolRecord(db, trip) {
  const applications = db.carpoolApplications
    .filter((item) => Number(item.tripId) === Number(trip.id))
    .map((item) => buildDemoCarpoolApplication(item, true))
  return {
    trip: buildDemoCarpoolTrip(trip),
    applications,
    statusBucket: demoCarpoolBucket(trip.status),
    statusBucketText: demoCarpoolBucketText(demoCarpoolBucket(trip.status)),
    departTime: trip.departTime
  }
}

function buildDemoPassengerCarpoolRecord(db, application) {
  const trip = db.carpoolTrips.find((item) => Number(item.id) === Number(application.tripId)) || application
  const bucket = demoCarpoolBucket(application.applicationStatus)
  return {
    trip: buildDemoCarpoolTrip(trip),
    application: buildDemoCarpoolApplication(application, false),
    statusBucket: bucket,
    statusBucketText: demoCarpoolBucketText(bucket),
    departTime: trip.departTime
  }
}

function buildDemoCarpoolTrip(trip = {}) {
  const status = trip.status || 'PUBLISHED'
  const seatCount = Number(trip.seatCount || 1)
  const remainSeatCount = Number(trip.remainSeatCount ?? trip.remainingSeatCount ?? seatCount)
  return {
    ...trip,
    ownerUserId: trip.ownerUserId || trip.ownerId,
    remainSeatCount,
    bookedSeatCount: Math.max(0, seatCount - remainSeatCount),
    status,
    statusText: demoCarpoolTripStatusText(status),
    departTimeText: String(trip.departTime || '').replace('T', ' ').slice(0, 16),
    canApply: !['FULL', 'CONFIRMED', 'CANCELLED', 'FINISHED'].includes(status)
  }
}

function buildDemoSearchCarpoolTrip(db, trip = {}) {
  const normalized = buildDemoCarpoolTrip(trip)
  const ownTrip = Number(trip.ownerId || trip.ownerUserId) === Number(db.passengerUser.id)
  const application = db.carpoolApplications.find((item) => Number(item.tripId) === Number(trip.id) && Number(item.passengerUserId || item.passengerId) === Number(db.passengerUser.id) && !['CANCELLED', 'REJECTED'].includes(item.applicationStatus))
  return {
    ...normalized,
    canApply: normalized.canApply && !ownTrip && !application,
    hasApplied: Boolean(application),
    myApplicationStatusText: ownTrip ? '我发布的行程' : application ? demoCarpoolApplicationStatusText(application.applicationStatus) : ''
  }
}

function buildDemoCarpoolApplication(application = {}, exposePassenger) {
  const status = application.applicationStatus || 'APPLIED'
  const totalSeatCount = Number(application.totalSeatCount || application.companionCount || 1)
  return {
    ...application,
    totalSeatCount,
    applicationStatus: status,
    applicationStatusText: demoCarpoolApplicationStatusText(status),
    statusText: demoCarpoolApplicationStatusText(status),
    passengerName: exposePassenger ? '阳光乘客' : undefined,
    passengerText: exposePassenger ? '阳光乘客 · 138****8888' : undefined,
    seatText: `${totalSeatCount} 人同行`,
    noteText: application.note || '未填写备注',
    canOwnerApprove: status === 'APPLIED',
    canOwnerReject: status === 'APPLIED',
    canPassengerConfirm: status === 'OWNER_CONFIRMED',
    canPassengerCancel: !['CANCELLED', 'REJECTED'].includes(status)
  }
}

function demoCarpoolBucket(status) {
  if (['CANCELLED', 'REJECTED', 'FINISHED'].includes(status)) return 'completed'
  if (['CONFIRMED', 'PASSENGER_CONFIRMED'].includes(status)) return 'upcoming'
  if (status === 'IN_PROGRESS') return 'processing'
  return 'pending'
}

function demoCarpoolBucketText(bucket) {
  return { pending: '待确认', upcoming: '待出发', processing: '行程中', completed: '已完成' }[bucket] || '待确认'
}

function demoCarpoolTripStatusText(status) {
  return {
    PUBLISHED: '可申请',
    MATCHING: '拼友匹配中',
    FULL: '座位已满',
    CONFIRMED: '已确认成行',
    CANCELLED: '已取消',
    FINISHED: '已完成'
  }[status] || status || '可申请'
}

function demoCarpoolApplicationStatusText(status) {
  return {
    APPLIED: '待车主确认',
    OWNER_CONFIRMED: '待乘客确认',
    PASSENGER_CONFIRMED: '已确认同行',
    CONFIRMED: '已确认同行',
    CANCELLED: '已取消',
    REJECTED: '已拒绝'
  }[status] || status || '待确认'
}

function normalizeSupportChannel(channel = '') {
  const normalized = String(channel || '').trim().toUpperCase()
  return ['WEB', 'H5', 'PC'].includes(normalized) ? 'WEB' : 'MINIAPP'
}

function supportChannelText(channel = '') {
  return normalizeSupportChannel(channel) === 'WEB' ? '网页端' : '小程序'
}

function ensureDemoSupportConversation(db, actor, channel = 'WEB') {
  db.supportConversations = db.supportConversations || []
  db.supportMessages = db.supportMessages || []
  const supportChannel = normalizeSupportChannel(channel)
  let conversation = db.supportConversations.find((item) => Number(item.userId) === Number(actor.userId) && item.userRole === actor.roleCode && normalizeSupportChannel(item.channel) === supportChannel)
  if (conversation) {
    closeExpiredDemoManualConversation(db, conversation)
    return conversation
  }
  conversation = {
    id: Date.now() + actor.userId,
    userId: actor.userId,
    userRole: actor.roleCode,
    channel: supportChannel,
    channelText: supportChannelText(supportChannel),
    roleText: actor.roleCode === ROLE.DRIVER ? '司机' : '乘客',
    nickname: actor.roleCode === ROLE.DRIVER ? db.driverUser.nickname : db.passengerUser.nickname,
    phone: actor.roleCode === ROLE.DRIVER ? db.driverUser.phone : db.passengerUser.phone,
    member: actor.roleCode === ROLE.USER && db.passengerUser.memberStatus === 'ACTIVE',
    memberLevel: actor.roleCode === ROLE.USER ? db.passengerUser.memberLevel : '',
    status: 'OPEN',
    lastMessage: '已进入在线客服',
    lastMessageAt: nowText(),
    unreadForAdmin: 0,
    unreadForUser: 0,
    createdAt: nowText()
  }
  const welcomeContent = actor.roleCode === ROLE.DRIVER ? DRIVER_AI_WELCOME_MESSAGE : DEFAULT_AI_WELCOME_MESSAGE
  conversation.lastMessage = welcomeContent
  db.supportConversations.push(conversation)
  db.supportMessages.push(supportMessage(conversation.id, null, SUPPORT_AI_ROLE, welcomeContent))
  return conversation
}

function supportMessage(conversationId, senderId, senderRole, content) {
  const aiWelcome = isDemoAiWelcome(senderId, senderRole, content)
  const systemNotice = isDemoSystemNotice(senderId, senderRole, content)
  return {
    id: Date.now() + Math.random(),
    conversationId,
    senderId,
    senderRole,
    fromAdmin: senderRole === 'ADMIN' && !aiWelcome,
    fromAi: senderRole === SUPPORT_AI_ROLE || aiWelcome,
    systemNotice,
    content,
    createdAt: nowText()
  }
}

function isDemoAiWelcome(senderId, senderRole, content) {
  if (senderId !== null && senderId !== undefined) return false
  if (senderRole !== 'ADMIN') return false
  return [DEFAULT_AI_WELCOME_MESSAGE, PREVIOUS_AI_WELCOME_MESSAGE, LEGACY_DEFAULT_WELCOME_MESSAGE, DRIVER_AI_WELCOME_MESSAGE, LEGACY_DRIVER_WELCOME_MESSAGE].includes(content)
}

function normalizeDemoSupportMessage(item = {}) {
  const aiWelcome = isDemoAiWelcome(item.senderId, item.senderRole, item.content)
  const systemNotice = isDemoSystemNotice(item.senderId, item.senderRole, item.content)
  return {
    ...item,
    fromAdmin: item.senderRole === 'ADMIN' && !aiWelcome,
    fromAi: item.senderRole === SUPPORT_AI_ROLE || aiWelcome,
    systemNotice,
    content: normalizeDemoWelcomeContent(item.content)
  }
}

function isDemoSystemNotice(senderId, senderRole, content) {
  if (senderId !== null && senderId !== undefined) return false
  if (senderRole !== 'ADMIN') return false
  return [MANUAL_OPEN_NOTICE, MANUAL_CLOSE_NOTICE, MANUAL_WAIT_WARNING].includes(content)
}

function isDemoManualSupportIntent(content = '') {
  const normalized = String(content || '').replace(/\s+/g, '')
  return /联系人工|人工客服|转人工|找人工|转接人工|真人客服|人工跟进/.test(normalized)
}

function closeExpiredDemoManualConversation(db, conversation) {
  if (!conversation || conversation.status !== 'MANUAL') return false
  const anchorAt = latestDemoManualActivityAt(db, conversation.id)
  if (!anchorAt) return false
  const idleMs = Date.now() - anchorAt
  if (idleMs >= MANUAL_WARN_TIMEOUT_MS && !hasDemoManualWarningAfter(db, conversation.id, anchorAt)) {
    const warning = supportMessage(conversation.id, null, 'ADMIN', MANUAL_WAIT_WARNING)
    db.supportMessages.push(warning)
    conversation.lastMessage = warning.content
    conversation.lastMessageAt = warning.createdAt
    conversation.unreadForUser = Number(conversation.unreadForUser || 0) + 1
  }
  if (idleMs < MANUAL_IDLE_TIMEOUT_MS) return false
  const closeNotice = supportMessage(conversation.id, null, 'ADMIN', MANUAL_CLOSE_NOTICE)
  db.supportMessages.push(closeNotice)
  conversation.status = 'OPEN'
  conversation.lastMessage = closeNotice.content
  conversation.lastMessageAt = closeNotice.createdAt
  conversation.unreadForUser = Number(conversation.unreadForUser || 0) + 1
  return true
}

function ensureDemoManualOpenNotice(db, conversation) {
  if (!conversation) return null
  const latestCloseAt = latestDemoMessageTime((db.supportMessages || []).filter((item) => (
    Number(item.conversationId) === Number(conversation.id)
    && item.senderRole === 'ADMIN'
    && item.content === MANUAL_CLOSE_NOTICE
  )))
  const hasOpenNotice = (db.supportMessages || []).some((item) => (
    Number(item.conversationId) === Number(conversation.id)
    && item.senderRole === 'ADMIN'
    && item.content === MANUAL_OPEN_NOTICE
    && (!latestCloseAt || parseDemoTime(item.createdAt) > latestCloseAt)
  ))
  if (hasOpenNotice) return null
  const notice = supportMessage(conversation.id, null, 'ADMIN', MANUAL_OPEN_NOTICE)
  db.supportMessages.push(notice)
  return notice
}

function latestDemoManualActivityAt(db, conversationId) {
  const conversationMessages = (db.supportMessages || [])
    .filter((item) => Number(item.conversationId) === Number(conversationId))
    .filter((item) => ![MANUAL_WAIT_WARNING, MANUAL_CLOSE_NOTICE].includes(item.content))
  const latestAdminAnchorAt = latestDemoMessageTime(conversationMessages.filter((item) => item.senderRole === 'ADMIN'))
  if (!latestAdminAnchorAt) return 0
  const userLatest = latestDemoMessageTime(conversationMessages.filter((item) => item.senderRole !== SUPPORT_AI_ROLE && item.senderRole !== 'ADMIN'))
  if (userLatest && userLatest > latestAdminAnchorAt) return 0
  return latestAdminAnchorAt
}

function latestDemoMessageTime(messages = []) {
  return messages
    .map((item) => parseDemoTime(item.createdAt))
    .filter(Boolean)
    .reduce((latest, value) => Math.max(latest, value), 0)
}

function hasDemoManualWarningAfter(db, conversationId, sinceMs) {
  return (db.supportMessages || []).some((item) => (
    Number(item.conversationId) === Number(conversationId)
    && item.content === MANUAL_WAIT_WARNING
    && parseDemoTime(item.createdAt) > sinceMs
  ))
}

function parseDemoTime(value) {
  if (!value) return 0
  const parsed = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDemoSupportConversation(item = {}) {
  const channel = normalizeSupportChannel(item.channel)
  const nextLastMessage = item.lastMessage === LEGACY_DRIVER_WELCOME_MESSAGE
      ? DRIVER_AI_WELCOME_MESSAGE
      : normalizeDemoWelcomeContent(item.lastMessage)
  return {
    ...item,
    channel,
    channelText: item.channelText || supportChannelText(channel),
    lastMessage: nextLastMessage
  }
}

function normalizeDemoWelcomeContent(content) {
  return content === PREVIOUS_AI_WELCOME_MESSAGE ? DEFAULT_AI_WELCOME_MESSAGE : content
}

function buildDemoSupportReply(content = '', roleCode = ROLE.USER) {
  const normalized = String(content || '').replace(/\s+/g, '')
  if (roleCode === ROLE.DRIVER) {
    if (/提现|到账|收入|钱包/.test(normalized)) return 'AI客服已读取司机端资料。提现记录请在司机端【收益】-【提现记录】查看；若状态长时间未更新，可以把提现时间和金额发给我继续核对。'
    if (/资质|审核|车辆|认证/.test(normalized)) return 'AI客服已读取司机端资料。司机资料和车辆信息在【我的车辆】与【司机资料】维护，提交后由后台审核，审核结果会同步到消息通知。'
    return 'AI客服已接入司机端会话。你可以继续描述听单、行程、提现或车辆资质问题，我会结合司机端真实资料辅助判断。'
  }
  if (/订单|行程|司机/.test(normalized)) return 'AI客服已读取乘客端资料。订单和行程可在【行程】查看详情；若需要核对费用、司机或状态，请继续补充订单号或具体问题。'
  if (/发票|优惠券|支付|退款|费用/.test(normalized)) return 'AI客服已读取乘客端资料。支付、优惠券、退款和发票会结合真实订单记录核对；未查询到的数据会建议转人工继续处理。'
  return 'AI客服已接入乘客端会话。请继续描述订单、支付、发票、优惠券或投诉建议问题，我会结合当前账号真实数据回答。'
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
    db.messages.unshift(message('USER', '行程已结束', '请完成支付并评价本次服务。'))
    return
  }
  if (action === 'cancel') {
    const wasPaid = order.payStatus === PAY_STATUS.PAID
    order.orderStatus = ORDER_STATUS.CANCELLED
    order.cancelReason = body.reason || '网页端取消'
    if (wasPaid) {
      const refundAmount = Number(order.actualAmount || order.payableAmount || order.estimatedAmount || 0)
      order.payStatus = PAY_STATUS.REFUNDED
      order.refundedAt = nowText()
      if (String(order.payChannel || '').toUpperCase() === 'BALANCE') {
        db.passengerUser.walletBalance = Number(db.passengerUser.walletBalance || 0) + refundAmount
      }
      db.messages.unshift(message('USER', '退款已入账', `${order.orderNo} 已取消，退款 ${formatAmount(order)} 已同步到账户流水。`))
    }
    db.driverProfile.serviceStatus = DRIVER_STATUS.ONLINE
    addTimeline(order, wasPaid ? '订单已取消，退款已同步' : '订单已取消', 'danger')
  }
}

function buildDriverDashboard(db) {
  return {
    user: db.driverUser,
    profile: db.driverProfile,
    vehicle: db.vehicle,
    servicePermission: {
      canReceiveOrders: db.driverProfile.auditStatus === 2 && db.vehicle.auditStatus === 2,
      message: db.driverProfile.auditStatus === 2 ? '资质正常，可听单' : '资质待审核，可继续体验流程'
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

function demoInvoiceImageUrl(path) {
  const match = String(path || '').match(/\/orders\/(\d+)\/invoice\/image/)
  const orderId = match?.[1] || 'DEMO'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
    <rect width="960" height="560" fill="#fffaf4"/>
    <rect x="36" y="36" width="888" height="488" rx="18" fill="#fff" stroke="#f1d7bd" stroke-width="2"/>
    <text x="64" y="92" font-family="Microsoft YaHei, Arial" font-size="32" font-weight="700" fill="#1f2937">阳光出行电子发票</text>
    <text x="64" y="138" font-family="Microsoft YaHei, Arial" font-size="18" fill="#64748b">订单号：${orderId}</text>
    <line x1="64" y1="170" x2="896" y2="170" stroke="#f1d7bd"/>
    <text x="64" y="226" font-family="Microsoft YaHei, Arial" font-size="24" fill="#1f2937">购买方：阳光乘客</text>
    <text x="64" y="278" font-family="Microsoft YaHei, Arial" font-size="22" fill="#1f2937">项目：出行服务费</text>
    <text x="64" y="330" font-family="Microsoft YaHei, Arial" font-size="22" fill="#1f2937">状态：网页端演示发票</text>
    <text x="64" y="430" font-family="Microsoft YaHei, Arial" font-size="18" fill="#64748b">连接后端后会拉取真实发票 PNG。</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function demoPayChannelText(value) {
  return {
    WECHAT: '微信支付',
    BALANCE: '钱包余额',
    ALIPAY: '支付宝',
    WEB: '网页支付'
  }[String(value || '').toUpperCase()] || '网页支付'
}

function demoComplaintTypeText(value) {
  return {
    SERVICE: '司机服务',
    FEE: '费用争议',
    VEHICLE: '车辆问题',
    PRODUCT: '产品建议',
    ROUTE: '路线绕行',
    PAYMENT: '费用疑问',
    SAFETY: '安全问题',
    OTHER: '其他反馈'
  }[String(value || '').toUpperCase()] || '其他反馈'
}

function loadDemoDb() {
  try {
    const cached = JSON.parse(localStorage.getItem(DEMO_DB_KEY) || 'null')
    if (cached?.version === DEMO_DB_VERSION) return cached
    if (cached) {
      const upgraded = upgradeDemoDb(cached)
      saveDemoDb(upgraded)
      return upgraded
    }
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
    version: DEMO_DB_VERSION,
    nextOrderId: 9003,
    nextCarpoolId: 3003,
    passengerUser: {
      id: 1,
      phone: demoAccounts.USER.phone,
      password: demoAccounts.USER.password,
      nickname: demoAccounts.USER.nickname,
      roleCode: ROLE.USER,
      authStatus: 2,
      realName: '阳光乘客',
      walletBalance: 268.8,
      emergencyContact: '王同学',
      emergencyPhone: '13800009999',
      memberStatus: 'ACTIVE',
      memberLevel: '阳光会员',
      memberOpenedAt: '2026-05-01 09:00:00',
      memberExpireAt: addDaysText(30),
      memberLastCouponWeek: ''
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
        remark: '网页端订单，可用司机账号接单。',
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
        paidAt: '2026-05-14 09:48:00',
        updatedAt: '2026-05-14 09:48:00',
        evaluationStatus: 'DONE',
        complaintStatus: 'NONE',
        invoiceStatus: 'NONE',
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
    supportConversations: [
      { id: 7001, userId: 1, userRole: ROLE.USER, roleText: '乘客', channel: 'WEB', channelText: '网页端', nickname: demoAccounts.USER.nickname, phone: demoAccounts.USER.phone, member: true, memberLevel: '阳光会员', status: 'OPEN', lastMessage: DEFAULT_AI_WELCOME_MESSAGE, lastMessageAt: nowText(), unreadForAdmin: 0, unreadForUser: 0, createdAt: nowText() },
      { id: 7002, userId: 2, userRole: ROLE.DRIVER, roleText: '司机', channel: 'WEB', channelText: '网页端', nickname: demoAccounts.DRIVER.nickname, phone: demoAccounts.DRIVER.phone, member: false, memberLevel: '', status: 'OPEN', lastMessage: DRIVER_AI_WELCOME_MESSAGE, lastMessageAt: nowText(), unreadForAdmin: 0, unreadForUser: 0, createdAt: nowText() }
    ],
    supportMessages: [
      supportMessage(7001, null, SUPPORT_AI_ROLE, DEFAULT_AI_WELCOME_MESSAGE),
      supportMessage(7002, null, SUPPORT_AI_ROLE, DRIVER_AI_WELCOME_MESSAGE)
    ],
    withdraws: [
      { id: 6001, driverId: 2, applyAmount: 188, bankName: '中国银行', bankAccount: '6222 **** 2026', status: 'PENDING', createdAt: '2026-05-14 18:20:00' }
    ]
  }
}

function upgradeDemoDb(db) {
  const upgraded = { ...seedDemoDb(), ...db, version: DEMO_DB_VERSION }
  upgraded.passengerUser = { ...seedDemoDb().passengerUser, ...(db.passengerUser || {}) }
  upgraded.driverUser = { ...seedDemoDb().driverUser, ...(db.driverUser || {}) }
  upgraded.driverProfile = { ...seedDemoDb().driverProfile, ...(db.driverProfile || {}) }
  upgraded.vehicle = { ...seedDemoDb().vehicle, ...(db.vehicle || {}) }
  upgraded.coupons = Array.isArray(db.coupons) ? db.coupons : seedDemoDb().coupons
  upgraded.userCoupons = Array.isArray(db.userCoupons) ? db.userCoupons : []
  upgraded.orders = Array.isArray(db.orders) ? db.orders : seedDemoDb().orders
  upgraded.carpoolTrips = Array.isArray(db.carpoolTrips) ? db.carpoolTrips : seedDemoDb().carpoolTrips
  upgraded.carpoolApplications = Array.isArray(db.carpoolApplications) ? db.carpoolApplications : []
  upgraded.messages = Array.isArray(db.messages) ? db.messages : seedDemoDb().messages
  upgraded.withdraws = Array.isArray(db.withdraws) ? db.withdraws : seedDemoDb().withdraws
  upgraded.supportConversations = (Array.isArray(db.supportConversations) ? db.supportConversations : seedDemoDb().supportConversations)
    .map(normalizeDemoSupportConversation)
  upgraded.supportMessages = (Array.isArray(db.supportMessages) ? db.supportMessages : seedDemoDb().supportMessages)
    .map(normalizeDemoSupportMessage)
  return upgraded
}

function nowText() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function addDaysText(days) {
  const date = new Date()
  date.setDate(date.getDate() + Number(days || 0))
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function currentWeekCode() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const day = Math.floor((now - start) / 86400000)
  return `${now.getFullYear()}-W${String(Math.ceil((day + start.getDay() + 1) / 7)).padStart(2, '0')}`
}

function formatAmount(order) {
  return `${order.currencyCode === 'USD' ? '$' : '¥'}${Number(order.payableAmount || order.actualAmount || 0).toFixed(2)}`
}

export { normalizeList }
