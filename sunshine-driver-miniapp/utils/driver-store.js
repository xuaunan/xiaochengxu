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
  if (currency === 'HKD') return `HK$${amount}`
  return `¥${amount}`
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
      { id: 'driver-local-001', title: '账号提示', content: '默认司机账号：13900000001 / 123456，通知只在消息中心展示，不触发语音。', time: '刚刚', unread: false }
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
  const rawStatus = `${order.orderStatus || order.order_status || order.rawStatus || order.status || ''}`.trim()
  const statusMap = {
    completed: ORDER_STATUS.FINISHED,
    finished: ORDER_STATUS.FINISHED,
    cancelled: ORDER_STATUS.CANCELLED
  }
  return statusMap[rawStatus] || rawStatus.toUpperCase()
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

function parseMetaObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value.trim())
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch (error) {
      return null
    }
  }
  return null
}

function parseTaggedMeta(remark = '', tag) {
  const matched = `${remark || ''}`.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`))
  if (!matched || !matched[1]) return null
  return parseMetaObject(matched[1])
}

function toList(value) {
  if (Array.isArray(value)) return value.filter((item) => `${item || ''}`.trim())
  return `${value || ''}`.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseCarpoolMeta(order = {}) {
  if (order.serviceType !== SERVICE_TYPE.CARPOOL) return null
  const meta = parseTaggedMeta(order.remark, 'CARPOOL_META')
  if (!meta) return null

  const passengerCount = Math.max(1, toNumber(meta.passengerCount, 1))
  const luggageText = meta.hasLuggage === true || meta.hasLuggage === 'HAS_LUGGAGE' ? '有行李' : '无行李'
  const tollText = meta.tollMode === 'PASSENGER_PAYS' ? '乘客出高速费' : '高速费协商'

  return {
    summaryText: [[meta.departDate, meta.timeRange].filter(Boolean).join(' '), `${passengerCount}人`, luggageText, tollText].filter(Boolean).join(' · ')
  }
}

function parseInternationalMeta(order = {}) {
  if (order.serviceType !== SERVICE_TYPE.INTERNATIONAL) return null
  const embeddedMeta = parseTaggedMeta(order.remark, 'INTERNATIONAL_META') || {}
  const viewMeta = parseMetaObject(order.internationalMeta) || {}
  const meta = {
    ...embeddedMeta,
    ...viewMeta
  }
  const passengerCount = Math.max(1, toNumber(meta.passengerCount, 1))
  const luggageCount = Math.max(0, toNumber(meta.luggageCount, 0))
  const appointmentTime = firstText(meta.appointmentTime)
  const flightNo = firstText(meta.flightNo).toUpperCase()
  const contactName = firstText(meta.contactName)
  const contactPhone = firstText(meta.contactPhone)
  const pickupSign = firstText(meta.pickupSign, contactName, '待确认')
  const documents = toList(meta.documents)
  const serviceItems = toList(meta.serviceItems)

  return {
    routeCode: firstText(meta.routeCode, 'GLOBAL'),
    countryText: firstText(meta.countryText),
    productName: firstText(meta.productName, '国际出行'),
    productNameEn: firstText(meta.productNameEn),
    appointmentTime,
    appointmentTimeText: appointmentTime || '预约时间待确认',
    passengerCount,
    passengerCountText: `${passengerCount}人`,
    luggageCount,
    luggageCountText: `${luggageCount}件行李`,
    contactName,
    contactPhone,
    contactText: [contactName, contactPhone].filter(Boolean).join(' · ') || '联系人待确认',
    flightNo,
    flightText: flightNo ? `航班/编号 ${flightNo}` : '航班/编号待补充',
    pickupSign,
    pickupSignText: pickupSign === '待确认' ? '接机牌待确认' : `接机牌 ${pickupSign}`,
    documents,
    documentsText: documents.length ? documents.join('、') : '按目的地要求携带有效证件',
    serviceItems,
    serviceItemsText: serviceItems.length ? serviceItems.join(' · ') : '跨境接送 · 中文客服',
    syncStatusText: meta.syncStatus === 'LOCAL_DRAFT' ? '待提交' : '已确认',
    summaryText: [appointmentTime || '', flightNo || '', `${passengerCount}人`, `${luggageCount}件行李`].filter(Boolean).join(' · '),
    driverBriefText: [appointmentTime || '预约待确认', flightNo || '航班待补充', `${passengerCount}人/${luggageCount}件行李`, pickupSign === '待确认' ? '' : `接机牌 ${pickupSign}`].filter(Boolean).join(' · ')
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

function firstText(...values) {
  return values.find((value) => `${value || ''}`.trim()) || ''
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
  const internationalMeta = parseInternationalMeta(order)
  const passenger = order.passenger || order.user || {}
  const passengerName = firstText(order.passengerName, order.userName, order.userNickname, passenger.displayName, passenger.nickname, passenger.realName, `乘客 #${String(order.userId || '').slice(-2) || '00'}`)
  const distanceText = driverLocation
    ? `${getDistanceKm(driverLocation, { latitude: toNumber(order.startLat), longitude: toNumber(order.startLng) }).toFixed(1)} 公里到上车点`
    : '等待获取当前位置'
  return {
    ...order,
    passengerName,
    startName: order.startName,
    endName: order.endName,
    distanceText,
    fareText: `预估 ${formatPrice(order.payableAmount || order.estimatedAmount, order.currencyCode)}`,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    carpoolMeta,
    internationalMeta,
    orderInfoText: internationalMeta ? internationalMeta.driverBriefText : carpoolMeta ? carpoolMeta.summaryText : '',
    seatHint: order.serviceType === SERVICE_TYPE.CARPOOL ? '顺路拼座单' : order.serviceType === SERVICE_TYPE.INTERNATIONAL ? '国际预约行程' : '标准即时订单',
    latitude: toNumber(order.startLat),
    longitude: toNumber(order.startLng),
    status: 'waiting'
  }
}

function mapTripOrder(order) {
  const orderStatus = getOrderStatusValue(order)
  const statusMeta = getOrderStatusMeta(orderStatus)
  const serviceTypeMeta = getServiceTypeMeta(order.serviceType)
  const carpoolMeta = parseCarpoolMeta(order)
  const internationalMeta = parseInternationalMeta(order)
  const passenger = order.passenger || order.user || {}
  const passengerName = firstText(order.passengerName, order.userName, order.userNickname, passenger.displayName, passenger.nickname, passenger.realName, `乘客 #${String(order.userId || '').slice(-2) || '00'}`)
  return {
    ...order,
    orderStatus,
    passengerName,
    status: statusMeta.key,
    rawStatus: orderStatus,
    statusText: statusMeta.label,
    serviceTypeLabel: serviceTypeMeta.label,
    serviceTypeClassName: serviceTypeMeta.className,
    carpoolMeta,
    internationalMeta,
    orderInfoText: internationalMeta ? internationalMeta.driverBriefText : carpoolMeta ? carpoolMeta.summaryText : '',
    seatHint: order.serviceType === SERVICE_TYPE.CARPOOL ? '顺风车订单' : order.serviceType === SERVICE_TYPE.INTERNATIONAL ? '国际预约行程' : '即时打车订单',
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
    todayIncome: Number(todayIncome.toFixed(2)),
    monthIncome: Number(monthIncome.toFixed(2)),
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
  parseInternationalMeta,
  toNumber,
  getDriverIncomeAmount
}
