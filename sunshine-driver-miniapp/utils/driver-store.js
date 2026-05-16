const { AUTH_STATUS, DRIVER_SERVICE_STATUS, ORDER_STATUS, SERVICE_TYPE, getAuthStatusMeta, getOrderStatusMeta, getServiceTypeMeta } = require('./constants')
const { DRIVER_AVATAR_FALLBACK } = require('./media')

function formatDateTime(date) {
  if (Array.isArray(date)) {
    const [year, month, day, hour = 0, minute = 0] = date
    const pad = (value) => `${value}`.padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`
  }
  const current = new Date(date)
  if (Number.isNaN(current.getTime())) {
    return '--'
  }
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())} ${pad(current.getHours())}:${pad(current.getMinutes())}`
}

function formatPrice(value, currency = 'CNY') {
  const amount = Number(value || 0).toFixed(2)
  if (currency === 'USD') return `$${amount}`
  return `\u00a5${amount}`
  return currency === 'USD' ? `$${amount}` : `¥${amount}`
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getDistanceKm(start, end) {
  const earthRadius = 6371
  const deltaLat = toRadians(end.latitude - start.latitude)
  const deltaLng = toRadians(end.longitude - start.longitude)
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(start.latitude)) *
    Math.cos(toRadians(end.latitude)) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

function createDefaultDriverStore() {
  return {
    loggedIn: false,
    loginInfo: null,
    profile: {},
    vehicle: {},
    permission: {
      canReceiveOrders: false,
      message: '请先登录司机账号'
    },
    settings: {
      listenMode: false,
      autoAccept: false,
      voiceBroadcast: true,
      voiceStyle: 'default',
      trackMode: 'DEMO',
      manualResting: false,
      listeningSince: 0,
      listeningBaselineReady: false,
      listeningBaselineOrderIds: []
    },
    messages: [
      { id: 'driver-local-001', title: '课程演示提示', content: '默认司机账号：13900000001 / 123456，通知只在消息中心展示，不触发语音。', time: '刚刚', unread: false }
    ],
    noticeHistory: {},
    voiceHistory: {},
    availableOrders: [],
    tripOrders: [],
    wallet: {
      todayIncome: 0,
      monthIncome: 0,
      withdrawable: 0,
      completedTrips: 0
    }
  }
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function getOrderStatusValue(order = {}) {
  return order.orderStatus || order.status || ''
}

function getDriverIncomeAmount(order = {}) {
  return toNumber(
    order.driverIncomeAmount ??
    order.driver_income_amount ??
    order.driverIncome ??
    order.driver_income ??
    order.incomeAmount ??
    order.income_amount ??
    order.settleAmount ??
    order.settle_amount ??
    order.actualAmount,
    0
  )
}

function buildLocalDateParts() {
  const current = new Date()
  const pad = (value) => `${value}`.padStart(2, '0')
  const day = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
  return {
    day,
    month: day.slice(0, 7)
  }
}

function normalizeDateKey(value) {
  if (Array.isArray(value)) {
    const [year, month, day] = value
    if (!year || !month || !day) return ''
    const pad = (next) => `${next}`.padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}`
  }

  const text = `${value || ''}`.trim()
  if (!text) return ''
  const arrayLike = text.match(/^(\d{4}),(\d{1,2}),(\d{1,2})/)
  if (arrayLike) {
    const pad = (next) => `${next}`.padStart(2, '0')
    return `${arrayLike[1]}-${pad(arrayLike[2])}-${pad(arrayLike[3])}`
  }
  return text.slice(0, 10).replace(/\//g, '-')
}

function parseCarpoolMeta(order = {}) {
  if (order.serviceType !== SERVICE_TYPE.CARPOOL) return null
  const remark = `${order.remark || ''}`
  const matched = remark.match(/\[CARPOOL_META\]([\s\S]*?)\[\/CARPOOL_META\]/)
  let meta = null
  if (matched && matched[1]) {
    try {
      meta = JSON.parse(matched[1])
    } catch (error) {
      meta = null
    }
  }
  if (!meta) return null

  const passengerCount = Math.max(1, toNumber(meta.passengerCount, 1))
  const luggageText = meta.hasLuggage === true || meta.hasLuggage === 'HAS_LUGGAGE' ? '有行李' : '无行李'
  const tollText = meta.tollMode === 'PASSENGER_PAYS' ? '乘客出高速费' : '高速费协商'

  return {
    summaryText: [[meta.departDate, meta.timeRange].filter(Boolean).join(' '), `${passengerCount}人`, luggageText, tollText].filter(Boolean).join(' · ')
  }
}

function isEnabled(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['1', 'true', 'enabled', 'enable', 'on'].includes(normalized)
  }
  return value !== 0 && value !== null && value !== undefined
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function getReceiveOrderPermission(dashboard = {}) {
  const user = dashboard.user || {}
  const vehicle = dashboard.vehicle || null
  const serverPermission = dashboard.servicePermission || {}
  if (typeof serverPermission.canReceiveOrders === 'boolean') {
    return {
      canReceiveOrders: serverPermission.canReceiveOrders,
      message: serverPermission.message || '请先提交车辆信息并通过管理员审核'
    }
  }
  if (!isEnabled(user.enabled)) {
    return { canReceiveOrders: false, message: '司机账号已被管理员禁用' }
  }
  if (!vehicle || !vehicle.id) {
    return { canReceiveOrders: false, message: '请先提交车辆信息并通过管理员审核' }
  }
  if (vehicle.auditStatus !== AUTH_STATUS.APPROVED) {
    return { canReceiveOrders: false, message: '请先提交车辆信息并通过管理员审核' }
  }
  return { canReceiveOrders: true, message: '车辆审核已通过，可正常接单' }
}

function mapDriverProfile(user = {}, profile = {}, vehicle = {}, permission = {}) {
  const canReceiveOrders = Boolean(permission.canReceiveOrders)
  const accountEnabled = isEnabled(user.enabled)
  const displayServiceStatus = accountEnabled
    ? (profile.serviceStatus || DRIVER_SERVICE_STATUS.OFFLINE)
    : DRIVER_SERVICE_STATUS.DISABLED

  return {
    id: user.id || profile.userId,
    name: user.nickname || `司机 #${String(profile.userId || '').slice(-2) || '00'}`,
    phone: user.phone || '',
    avatar: DRIVER_AVATAR_FALLBACK,
    rating: Number(profile.score || 5),
    serviceScore: Math.round(Number(profile.score || 5) * 20),
    carModel: `${vehicle.brand || ''} ${vehicle.modelName || ''}`.trim() || '暂未绑定车辆',
    plateNo: vehicle.plateNo || '未绑定',
    cityCode: firstDefined(profile.cityCode, profile.city_code, ''),
    licenseNo: firstDefined(profile.licenseNo, profile.license_no, ''),
    emergencyContact: firstDefined(user.emergencyContact, user.emergency_contact, ''),
    emergencyPhone: firstDefined(user.emergencyPhone, user.emergency_phone, ''),
    serviceStatus: displayServiceStatus,
    vehicleAuditStatus: typeof firstDefined(vehicle.auditStatus, vehicle.audit_status) === 'number' ? firstDefined(vehicle.auditStatus, vehicle.audit_status) : AUTH_STATUS.UNVERIFIED,
    vehicleAuditRemark: firstDefined(vehicle.auditRemark, vehicle.audit_remark, ''),
    accountEnabled,
    canReceiveOrders,
    lockMessage: permission.message || '请先提交车辆信息并通过管理员审核'
  }
}

function buildVehicleView(vehicle = {}, user = {}, permission = {}) {
  const hasVehicle = Boolean(vehicle && vehicle.id)
  const auditStatus = hasVehicle ? firstDefined(vehicle.auditStatus, vehicle.audit_status) : AUTH_STATUS.UNVERIFIED
  const auditMeta = getAuthStatusMeta(auditStatus, !isEnabled(user.enabled))
  return {
    hasVehicle,
    plateNo: firstDefined(vehicle.plateNo, vehicle.plate_no, ''),
    brand: vehicle.brand || '',
    modelName: firstDefined(vehicle.modelName, vehicle.model_name, ''),
    color: vehicle.color || '',
    seatCount: firstDefined(vehicle.seatCount, vehicle.seat_count, ''),
    insuranceExpireDate: firstDefined(vehicle.insuranceExpireDate, vehicle.insurance_expire_date, ''),
    annualInspectExpireDate: firstDefined(vehicle.annualInspectExpireDate, vehicle.annual_inspect_expire_date, ''),
    vehicleLicenseImageUrl: firstDefined(vehicle.vehicleLicenseImageUrl, vehicle.vehicle_license_image_url, ''),
    driverLicenseImageUrl: firstDefined(vehicle.driverLicenseImageUrl, vehicle.driver_license_image_url, ''),
    auditStatus,
    auditText: auditMeta.text,
    auditClassName: auditMeta.className,
    auditRemark: firstDefined(vehicle.auditRemark, vehicle.audit_remark, permission.message || '请先提交车辆信息并通过管理员审核')
  }
}

function mapWaitingOrder(order, driverLocation) {
  const serviceTypeMeta = getServiceTypeMeta(order.serviceType)
  const carpoolMeta = parseCarpoolMeta(order)
  const distanceText = driverLocation
    ? `${getDistanceKm(driverLocation, { latitude: toNumber(order.startLat), longitude: toNumber(order.startLng) }).toFixed(1)} 公里到上车点`
    : '等待获取当前位置'
  return {
    ...order,
    passengerName: `乘客 #${String(order.userId || '').slice(-2) || '00'}`,
    startName: order.startName,
    endName: order.endName,
    distanceText,
    fareText: `预估 ${formatPrice(order.payableAmount || order.estimatedAmount, order.currencyCode)}`,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    orderInfoText: carpoolMeta ? carpoolMeta.summaryText : '',
    seatHint: order.serviceType === SERVICE_TYPE.CARPOOL ? '顺路拼座单' : order.serviceType === SERVICE_TYPE.INTERNATIONAL ? '跨境行程单' : '标准即时订单',
    latitude: toNumber(order.startLat),
    longitude: toNumber(order.startLng),
    status: 'waiting'
  }
}

function mapTripOrder(order) {
  const statusMeta = getOrderStatusMeta(order.orderStatus)
  const serviceTypeMeta = getServiceTypeMeta(order.serviceType)
  return {
    ...order,
    passengerName: `乘客 #${String(order.userId || '').slice(-2) || '00'}`,
    status: statusMeta.key,
    rawStatus: order.orderStatus,
    statusText: statusMeta.label,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    seatHint: order.serviceType === SERVICE_TYPE.CARPOOL ? '顺风车订单' : order.serviceType === SERVICE_TYPE.INTERNATIONAL ? '国际行程订单' : '即时打车订单',
    fareText: formatPrice(order.actualAmount || order.payableAmount || order.estimatedAmount, order.currencyCode),
    createdAt: formatDateTime(order.createdAt || new Date())
  }
}

function buildWallet(profile, orders = []) {
  const completedOrders = orders.filter((item) => getOrderStatusValue(item) === ORDER_STATUS.FINISHED)
  const { day, month } = buildLocalDateParts()
  const todayIncome = completedOrders
    .filter((item) => normalizeDateKey(item.finishedAt || item.finishTime || item.finished_at || item.finish_time || item.updatedAt || item.updated_at).startsWith(day))
    .reduce((sum, item) => sum + getDriverIncomeAmount(item), 0)
  const monthIncome = completedOrders
    .filter((item) => normalizeDateKey(item.finishedAt || item.finishTime || item.finished_at || item.finish_time || item.updatedAt || item.updated_at).startsWith(month))
    .reduce((sum, item) => sum + getDriverIncomeAmount(item), 0)
  return {
    todayIncome: Number((todayIncome || toNumber(profile.todayIncome ?? profile.today_income, 0)).toFixed(2)),
    monthIncome: Number((monthIncome || toNumber(profile.monthIncome ?? profile.month_income ?? profile.totalIncome ?? profile.total_income, 0)).toFixed(2)),
    withdrawable: toNumber(
      profile.withdrawableIncome ??
      profile.withdrawable_income ??
      profile.withdrawableAmount ??
      profile.withdrawable_amount ??
      profile.availableWithdrawAmount ??
      profile.available_withdraw_amount ??
      profile.balance,
      0
    ),
    completedTrips: completedOrders.length
  }
}

function canEnterDashboard(profile = {}, vehicle = {}) {
  return profile.accountEnabled !== false && vehicle.auditStatus === AUTH_STATUS.APPROVED
}

function nextActionText(orderStatus) {
  if (orderStatus === ORDER_STATUS.ACCEPTED) return '开始接驾'
  if (orderStatus === ORDER_STATUS.PICKING_UP) return '确认乘客已上车'
  if (orderStatus === ORDER_STATUS.IN_TRIP) return '结束行程'
  return '状态已完结'
}

module.exports = {
  DRIVER_SERVICE_STATUS,
  buildVehicleView,
  buildWallet,
  canEnterDashboard,
  createDefaultDriverStore,
  formatPrice,
  getReceiveOrderPermission,
  isEnabled,
  mapDriverProfile,
  mapTripOrder,
  mapWaitingOrder,
  nextActionText,
  toNumber,
  getDriverIncomeAmount
}
