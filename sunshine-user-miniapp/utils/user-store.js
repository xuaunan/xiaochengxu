const { POI_LIBRARY, CAR_TYPE_META, COUPON_TEMPLATE_FALLBACK_MAP, INTERNATIONAL_OPTIONS } = require('./catalog')
const { deepClone, formatDate, formatDateTime, formatPrice } = require('./format')
const { createDriverApproachPoints, interpolateRoute } = require('./map')
const {
  COUPON_STATUS,
  COUPON_TYPE,
  ORDER_STATUS,
  PAY_STATUS,
  SERVICE_TYPE,
  getCouponScopeLabel,
  getOrderStatusMeta,
  getPayStatusLabel,
  getServiceLabel
} = require('./constants')

const PAYMENT_SYNC_GUARD_MS = 15000
const CARPOOL_META_TAG = 'CARPOOL_META'
const INTERNATIONAL_META_TAG = 'INTERNATIONAL_META'
const INVOICE_META_TAG = 'INVOICE_META'
const ORDER_META_TAGS = [CARPOOL_META_TAG, INTERNATIONAL_META_TAG, INVOICE_META_TAG]

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function getOrderAmountValue(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return toNumber(firstPresent(order.cancelFee, order.payableAmount, 0), 0)
  }
  return toNumber(firstPresent(order.actualAmount, order.payableAmount, order.estimatedAmount), 0)
}

function getOrderPayStatusText(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED && getOrderAmountValue(order) <= 0) {
    return '无需支付'
  }
  return getPayStatusLabel(order.payStatus)
}

function parseEmbeddedMeta(text = '', tag = CARPOOL_META_TAG) {
  const source = `${text || ''}`
  const matcher = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`)
  const matched = source.match(matcher)
  if (!matched || !matched[1]) return null

  try {
    return JSON.parse(matched[1])
  } catch (error) {
    return null
  }
}

function parseMetaObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch (error) {
      return null
    }
  }
  return null
}

function stripEmbeddedMeta(text = '', tag = CARPOOL_META_TAG) {
  const source = `${text || ''}`
  const matcher = new RegExp(`\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]`, 'g')
  return source.replace(matcher, '').trim()
}

function stripAllEmbeddedMeta(text = '') {
  return ORDER_META_TAGS.reduce((result, tag) => stripEmbeddedMeta(result, tag), `${text || ''}`).trim()
}

function stripSystemDispatchRemark(text = '') {
  return `${text || ''}`
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item && !/^(SMART|Manual)\s+dispatch$/i.test(item))
    .join(' | ')
}

function looksLikeRawInvoiceMeta(text = '') {
  const source = `${text || ''}`.trim()
  return source.startsWith('{') &&
    /"(invoiceCode|invoiceNo|invoiceStatus|buyerTaxNo|sellerTaxNo|handledAt)"/.test(source)
}

function getVisibleOrderRemark(text = '') {
  const cleanText = stripSystemDispatchRemark(stripAllEmbeddedMeta(text))
  return looksLikeRawInvoiceMeta(cleanText) ? '' : cleanText
}

function getCarpoolTollLabel(value) {
  if (value === 'PASSENGER_PAYS') return '乘客承担高速费'
  if (value === 'NEGOTIABLE') return '高速费协商'
  return value || '未填写'
}

function getCarpoolLuggageLabel(value) {
  if (value === true || value === 'true' || value === 'HAS_LUGGAGE') return '有行李'
  if (value === false || value === 'false' || value === 'NO_LUGGAGE') return '无行李'
  return value || '未填写'
}

function formatCarpoolTimeRange(meta = {}) {
  const departDate = `${meta.departDate || ''}`.trim()
  const timeRange = `${meta.timeRange || ''}`.trim()
  return [departDate, timeRange].filter(Boolean).join(' ')
}

function getCarpoolMetaFromOrder(order = {}) {
  if (order.serviceType !== SERVICE_TYPE.CARPOOL) return null

  const rawMeta = parseEmbeddedMeta(order.remark)
  const passengerCount = Math.max(1, toNumber(order.passengerCount || (rawMeta && rawMeta.passengerCount), 1))
  const metaOriginalAmount = toNumber(rawMeta && rawMeta.originalAmount, 0)
  const metaDiscountAmount = toNumber(rawMeta && rawMeta.discountAmount, 0)
  const metaPayableAmount = toNumber(rawMeta && rawMeta.payableAmount, 0)
  const orderDiscountAmount = toNumber(order.couponDiscount, 0)
  const originalAmount = toNumber(order.estimatedAmount || order.actualAmount, metaOriginalAmount || order.payableAmount)
  const discountAmount = orderDiscountAmount > 0 ? orderDiscountAmount : metaDiscountAmount
  const orderPayableAmount = toNumber(order.payableAmount, 0)
  const payableAmount = discountAmount > 0
    ? (
        orderPayableAmount > 0 && orderPayableAmount < originalAmount
          ? orderPayableAmount
          : (metaPayableAmount || Math.max(originalAmount - discountAmount, 0))
      )
    : (orderPayableAmount || metaPayableAmount || originalAmount)
  const remarkText = getVisibleOrderRemark(order.remark)
  const timeText = formatCarpoolTimeRange(rawMeta || {})

  return {
    departDate: rawMeta && rawMeta.departDate || '',
    timeRange: rawMeta && rawMeta.timeRange || '',
    timeText,
    passengerCount,
    passengerCountText: `${passengerCount}人同行`,
    hasLuggage: rawMeta ? rawMeta.hasLuggage : '',
    luggageText: getCarpoolLuggageLabel(rawMeta && rawMeta.hasLuggage),
    tollMode: rawMeta ? rawMeta.tollMode : '',
    tollModeText: getCarpoolTollLabel(rawMeta && rawMeta.tollMode),
    originalAmount,
    discountAmount,
    payableAmount,
    originalAmountText: formatPrice(originalAmount, order.currencyCode),
    discountAmountText: formatPrice(discountAmount, order.currencyCode),
    payableAmountText: formatPrice(payableAmount, order.currencyCode),
    remarkText,
    summaryText: [timeText, `${passengerCount}人`, getCarpoolLuggageLabel(rawMeta && rawMeta.hasLuggage), getCarpoolTollLabel(rawMeta && rawMeta.tollMode)].filter(Boolean).join(' · ')
  }
}

function getInternationalMetaFromOrder(order = {}) {
  if (order.serviceType !== SERVICE_TYPE.INTERNATIONAL) return null

  const embeddedMeta = parseEmbeddedMeta(order.remark, INTERNATIONAL_META_TAG) || {}
  const viewMeta = parseMetaObject(order.internationalMeta) || {}
  const rawMeta = {
    ...embeddedMeta,
    ...viewMeta
  }
  const rawRemarkText = firstPresent(order.cleanRemark, order.remarkText, stripAllEmbeddedMeta(order.remark), '')
  const remarkText = getVisibleOrderRemark(rawRemarkText)
  const serviceItems = Array.isArray(rawMeta.serviceItems)
    ? rawMeta.serviceItems
    : `${rawMeta.serviceItems || ''}`.split(',').map((item) => item.trim()).filter(Boolean)
  const documents = Array.isArray(rawMeta.documents)
    ? rawMeta.documents
    : `${rawMeta.documents || ''}`.split(',').map((item) => item.trim()).filter(Boolean)
  const passengerCount = Math.max(1, toNumber(rawMeta.passengerCount, 1))
  const luggageCount = Math.max(0, toNumber(rawMeta.luggageCount, 0))
  const contactName = rawMeta.contactName || ''
  const contactPhone = rawMeta.contactPhone || ''
  const appointmentTime = rawMeta.appointmentTime || ''
  const flightNo = rawMeta.flightNo || ''
  const pickupSign = rawMeta.pickupSign || '待确认'
  const syncStatus = rawMeta.syncStatus || 'BACKEND_ORDER'
  const syncStatusText = syncStatus === 'BACKEND_ORDER'
    ? '已确认'
    : syncStatus === 'LOCAL_DRAFT'
      ? '待提交'
      : '确认中'

  return {
    optionId: rawMeta.optionId || '',
    routeCode: rawMeta.routeCode || '',
    countryText: rawMeta.countryText || '',
    productName: rawMeta.productName || '国际出行',
    productNameEn: rawMeta.productNameEn || '',
    startName: rawMeta.startName || order.startName || '',
    endName: rawMeta.endName || order.endName || '',
    appointmentTime,
    appointmentTimeText: appointmentTime || '待确认',
    passengerCount,
    passengerCountText: `${passengerCount}人`,
    contactName,
    contactPhone,
    contactText: [contactName, contactPhone].filter(Boolean).join(' · ') || '待补充',
    flightNo,
    flightText: flightNo ? `航班/编号 ${flightNo}` : '航班/编号待补充',
    luggageCount,
    luggageCountText: `${luggageCount}件行李`,
    languageCode: rawMeta.languageCode || order.languageCode || 'zh-CN',
    currencyCode: rawMeta.currencyCode || order.currencyCode || 'USD',
    exchangeRate: toNumber(rawMeta.exchangeRate || order.exchangeRate, 7.15),
    serviceItems,
    serviceItemsText: serviceItems.length ? serviceItems.join(' · ') : '中文客服 · 跨境接送',
    documents,
    documentsText: documents.length ? documents.join('、') : '按目的地要求携带有效证件',
    pickupSign,
    pickupSignText: pickupSign === '待确认' ? pickupSign : `接机牌：${pickupSign}`,
    riskNotice: rawMeta.riskNotice || '请提前确认通关证件、航班时间与目的地政策。',
    syncStatus,
    syncStatusText,
    submitSource: rawMeta.submitSource || 'USER_MINIAPP',
    remarkText: getVisibleOrderRemark(remarkText),
    summaryText: [appointmentTime, flightNo || '', `${passengerCount}人`, `${luggageCount}件行李`].filter(Boolean).join(' · ')
  }
}

function getInvoiceMetaFromOrder(order = {}) {
  const source = `${order.remark || ''}`
  const matcher = new RegExp(`\\[${INVOICE_META_TAG}\\]([\\s\\S]*?)\\[\\/${INVOICE_META_TAG}\\]`)
  const matched = source.match(matcher)
  if (!matched || !matched[1]) return {}

  const raw = matched[1].trim()
  if (!raw) return {}

  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      return {}
    }
  }

  return raw.split(';').reduce((result, part) => {
    const pair = part.split('=')
    if (pair.length >= 2) {
      result[pair[0].trim()] = pair.slice(1).join('=').trim()
    }
    return result
  }, {})
}

const CN_NUMBERS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const CN_INTEGER_UNITS = ['', '拾', '佰', '仟']
const CN_SECTION_UNITS = ['', '万', '亿']

function integerToChinese(value) {
  const integer = Math.floor(Math.abs(Number(value || 0)))
  if (!integer) return '零'
  const sections = []
  let current = integer
  while (current > 0) {
    sections.push(current % 10000)
    current = Math.floor(current / 10000)
  }

  let result = ''
  let needZero = false
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const section = sections[i]
    if (section === 0) {
      needZero = true
      continue
    }
    if (needZero) {
      result += '零'
      needZero = false
    }
    let sectionText = ''
    let unitPosition = 0
    let zero = true
    let sectionValue = section
    while (sectionValue > 0) {
      const digit = sectionValue % 10
      if (digit === 0) {
        if (!zero) {
          zero = true
          sectionText = CN_NUMBERS[0] + sectionText
        }
      } else {
        zero = false
        sectionText = CN_NUMBERS[digit] + CN_INTEGER_UNITS[unitPosition] + sectionText
      }
      unitPosition += 1
      sectionValue = Math.floor(sectionValue / 10)
    }
    result += sectionText + CN_SECTION_UNITS[i]
  }
  return result.replace(/零+/g, '零').replace(/零$/g, '')
}

function amountToChinese(value, currency = 'CNY') {
  const amount = Math.max(0, Number(value || 0))
  if (currency && currency !== 'CNY') {
    return `${currency} ${amount.toFixed(2)}`
  }
  const integer = Math.floor(amount)
  const cents = Math.round((amount - integer) * 100)
  const jiao = Math.floor(cents / 10)
  const fen = cents % 10
  let result = `人民币${integerToChinese(integer)}元`
  if (!jiao && !fen) return `${result}整`
  if (jiao) result += `${CN_NUMBERS[jiao]}角`
  if (fen) result += `${CN_NUMBERS[fen]}分`
  return result
}

function normalizePoint(source) {
  if (!source) return null
  return {
    id: source.id || '',
    name: source.name || source.startName || source.endName || '',
    address: source.address || source.name || '',
    latitude: toNumber(source.latitude || source.startLat || source.endLat),
    longitude: toNumber(source.longitude || source.startLng || source.endLng)
  }
}

function getDefaultDraft() {
  return {
    start: {
      id: 'poi001',
      name: '上海虹桥机场 T2',
      address: '上海市闵行区申贵路1500号',
      latitude: 31.20066,
      longitude: 121.32756
    },
    end: {
      id: 'poi003',
      name: '人民广场',
      address: '上海市黄浦区人民大道185号',
      latitude: 31.23037,
      longitude: 121.4737
    },
    serviceType: SERVICE_TYPE.TAXI,
    selectedCarTypeId: 1,
    selectedCouponId: ''
  }
}

function searchPois(keyword) {
  const target = `${keyword || ''}`.trim().toLowerCase()
  if (!target) {
    return POI_LIBRARY.slice(0, 8)
  }

  return POI_LIBRARY.filter((item) => `${item.name}${item.address}${(item.tags || []).join(',')}`.toLowerCase().includes(target))
}

function decorateCarType(carType = {}) {
  const meta = CAR_TYPE_META[carType.id] || CAR_TYPE_META[1]
  return {
    ...carType,
    name: meta.name || carType.name || '车型',
    image: meta.image,
    description: meta.description,
    seatText: meta.seatText
  }
}

function getCarTypeMap(carTypes = []) {
  return carTypes.reduce((result, item) => {
    result[item.id] = decorateCarType(item)
    return result
  }, {})
}

function isNightPeriod() {
  const hour = new Date().getHours()
  return hour >= 23 || hour < 6
}

function calcEstimate(carType, serviceType, distanceKm, durationMin, couponDiscount = 0) {
  if (!carType || !carType.id) {
    return {
      amount: 0,
      payable: 0,
      currencyCode: serviceType === SERVICE_TYPE.INTERNATIONAL ? 'USD' : 'CNY',
      exchangeRate: serviceType === SERVICE_TYPE.INTERNATIONAL ? getInternationalExchangeRate() : 1,
      breakdown: {
        startFee: 0,
        distanceFee: 0,
        durationFee: 0,
        longDistanceFee: 0,
        nightFee: 0,
        couponDiscount: 0
      }
    }
  }

  const startPrice = toNumber(serviceType === SERVICE_TYPE.INTERNATIONAL ? carType.crossBorderBasePrice : carType.startPrice)
  const startDistanceKm = toNumber(carType.startDistanceKm)
  const distancePrice = toNumber(carType.distancePrice)
  const durationPrice = toNumber(carType.durationPrice)
  const longDistancePrice = toNumber(carType.longDistancePrice)
  const nightSurcharge = isNightPeriod() ? toNumber(carType.nightSurcharge) : 0
  const extraDistance = Math.max(toNumber(distanceKm) - startDistanceKm, 0)
  let distanceFee = extraDistance * distancePrice
  let durationFee = toNumber(durationMin) * durationPrice
  let longDistanceFee = toNumber(distanceKm) > 30 ? (toNumber(distanceKm) - 30) * longDistancePrice : 0
  let startFee = startPrice
  let nightFee = nightSurcharge
  let amount = startFee + distanceFee + durationFee + longDistanceFee + nightFee

  if (serviceType === SERVICE_TYPE.CARPOOL) {
    amount *= 0.85
  }

  const exchangeRate = serviceType === SERVICE_TYPE.INTERNATIONAL ? getInternationalExchangeRate() : 1
  const currencyCode = serviceType === SERVICE_TYPE.INTERNATIONAL ? 'USD' : 'CNY'

  if (serviceType === SERVICE_TYPE.INTERNATIONAL) {
    startFee /= exchangeRate
    distanceFee /= exchangeRate
    durationFee /= exchangeRate
    longDistanceFee /= exchangeRate
    nightFee /= exchangeRate
    amount /= exchangeRate
  }

  return {
    amount: Number(amount.toFixed(2)),
    payable: Number(Math.max(amount - toNumber(couponDiscount), 0).toFixed(2)),
    currencyCode,
    exchangeRate,
    breakdown: {
      startFee: Number(startFee.toFixed(2)),
      distanceFee: Number(distanceFee.toFixed(2)),
      durationFee: Number(durationFee.toFixed(2)),
      longDistanceFee: Number(longDistanceFee.toFixed(2)),
      nightFee: Number(nightFee.toFixed(2)),
      couponDiscount: Number(toNumber(couponDiscount).toFixed(2))
    }
  }
}

function buildEstimateFromRoute(carType, serviceType, start, end, couponDiscount = 0) {
  const route = interpolateRoute(start, end, 24)
  const fee = calcEstimate(carType, serviceType, route.distanceKm, route.durationMin, couponDiscount)
  return {
    route,
    ...fee
  }
}

function buildCouponTemplateMap(templates = []) {
  return templates.reduce((result, item) => {
    result[item.id] = item
    return result
  }, { ...COUPON_TEMPLATE_FALLBACK_MAP })
}

function getPaidCouponIdSet() {
  const app = typeof getApp === 'function' ? getApp() : null
  const store = app && app.globalData ? app.globalData.userStore : null
  const paidCouponIds = new Set()

  if (!store || !Array.isArray(store.orders)) {
    return paidCouponIds
  }

  store.orders.forEach((order) => {
    if (order && order.payStatus === PAY_STATUS.PAID && order.userCouponId) {
      paidCouponIds.add(`${order.userCouponId}`)
    }
  })

  return paidCouponIds
}

function mergeCoupons(userCoupons = [], couponTemplates = []) {
  const couponMap = buildCouponTemplateMap(couponTemplates)
  const paidCouponIds = getPaidCouponIdSet()
  return userCoupons.map((item) => {
    const template = couponMap[item.couponId] || {}
    const isDiscount = template.couponType === COUPON_TYPE.DISCOUNT
    const hasPaidOrder = paidCouponIds.has(`${item.id}`)
    const rawStatus = hasPaidOrder ? COUPON_STATUS.USED : (item.couponStatus || COUPON_STATUS.UNUSED)
    return {
      id: item.id,
      templateId: item.couponId,
      name: template.couponName || `优惠券 #${item.couponId}`,
      type: template.couponType || COUPON_TYPE.CASH,
      amount: isDiscount ? toNumber(template.discountRate, 0.8) : toNumber(template.discountAmount),
      discount: isDiscount,
      minAmount: toNumber(template.thresholdAmount),
      scope: getCouponScopeLabel(item.serviceScope || template.serviceScope),
      scopeCode: item.serviceScope || template.serviceScope || 'ALL',
      status: rawStatus.toLowerCase(),
      rawStatus,
      validDate: formatDate(item.validEndTime || template.validEndTime || new Date()),
      code: `UC${item.id}`,
      userCouponId: item.id,
      ruleDesc: template.ruleDesc || '以平台规则为准',
      raw: item
    }
  })
}

function pickAutoCoupon(coupons = [], serviceType, amount) {
  const available = coupons.filter((item) => {
    const scopeOk = item.scopeCode === 'ALL' || item.scopeCode === serviceType
    return item.rawStatus === COUPON_STATUS.UNUSED && scopeOk && toNumber(amount) >= toNumber(item.minAmount)
  })

  available.sort((left, right) => {
    const leftDiscount = left.discount ? toNumber(amount) * (1 - toNumber(left.amount, 1)) : toNumber(left.amount)
    const rightDiscount = right.discount ? toNumber(amount) * (1 - toNumber(right.amount, 1)) : toNumber(right.amount)
    return rightDiscount - leftDiscount
  })

  return available[0] || null
}

function buildDriverSummary(driverId) {
  const tail = String(driverId || '00').slice(-2).padStart(2, '0')
  return {
    id: driverId || '',
    name: driverId ? `${tail}号司机` : '平台司机',
    avatar: '/images/avatar-driver-1.svg',
    rating: 4.9,
    plateNo: driverId ? `沪A${tail}8${tail}` : '待确认',
    carModel: '平台认证车辆',
    carColor: '白色',
    completedTrips: 200 + toNumber(tail),
    phone: '平台代呼'
  }
}

function pickFirstText(...values) {
  return values.find((value) => `${value || ''}`.trim()) || ''
}

function buildOrderDriverSummary(order = {}) {
  const driverId = order.driverId || order.driverUserId || (order.driver && order.driver.id)
  const tail = String(driverId || '00').slice(-2).padStart(2, '0')
  const fallback = buildDriverSummary(driverId)
  const driver = order.driver || order.driverInfo || order.driverUser || {}
  const vehicle = order.vehicle || order.driverVehicle || {}
  const vehicleName = vehicle.brand && vehicle.modelName ? `${vehicle.brand} ${vehicle.modelName}` : ''

  return {
    ...fallback,
    name: pickFirstText(order.driverName, order.driverNickname, driver.displayName, driver.nickname, driver.name, driver.realName, fallback.name),
    avatar: fallback.avatar,
    rating: Number(order.driverScore || order.driverRating || driver.score || driver.rating || fallback.rating),
    plateNo: pickFirstText(order.plateNo, order.vehiclePlateNo, vehicle.plateNo, fallback.plateNo),
    carModel: pickFirstText(order.carModel, order.vehicleModel, vehicleName, vehicle.modelName, fallback.carModel),
    carColor: pickFirstText(order.carColor, vehicle.color, fallback.carColor),
    completedTrips: Number(order.driverCompletedTrips || driver.completedTrips || fallback.completedTrips || (200 + toNumber(tail))),
    phone: pickFirstText(order.driverPhone, driver.phone, fallback.phone)
  }
}

function getFreeCancelMinutes() {
  const app = typeof getApp === 'function' ? getApp() : null
  const home = app && app.globalData && app.globalData.userStore
    ? app.globalData.userStore.home || {}
    : {}
  const configs = home.systemConfigs || {}
  const minutes = Number(configs.freeCancelMinutes)
  return Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : 3
}

function buildCancelRuleText(order = {}) {
  const minutes = getFreeCancelMinutes()
  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(order.orderStatus)) {
    return `派单中可免费取消；下单后 ${minutes} 分钟内免费取消。`
  }
  if ([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus)) {
    return `司机已接单，下单后 ${minutes} 分钟内免费取消，超时按平台规则收取取消费。`
  }
  return `免费取消时长 ${minutes} 分钟，实际费用以平台规则为准。`
}

function buildRideOrderModel(order, options = {}) {
  const start = normalizePoint({
    name: order.startName,
    startLat: order.startLat,
    startLng: order.startLng
  })
  const end = normalizePoint({
    name: order.endName,
    endLat: order.endLat,
    endLng: order.endLng
  })
  const carType = decorateCarType(options.carType || {})
  const route = options.route || interpolateRoute(start, end, 24)
  const estimate = {
    route,
    ...calcEstimate(
      carType,
      order.serviceType,
      toNumber(order.actualDistanceKm || order.estimatedDistanceKm, route.distanceKm),
      toNumber(order.actualDurationMin || order.estimatedDurationMin, route.durationMin),
      toNumber(order.couponDiscount)
    )
  }

  estimate.payable = toNumber(order.payableAmount, estimate.payable)
  estimate.amount = toNumber(order.actualAmount || order.estimatedAmount, estimate.amount)
  const carpoolMeta = getCarpoolMetaFromOrder(order)
  const internationalMeta = getInternationalMetaFromOrder(order)

  return {
    ...order,
    id: order.id,
    orderNo: order.orderNo,
    serviceType: order.serviceType,
    createdAt: formatDateTime(order.createdAt, { fallback: '--' }),
    start,
    end,
    carType,
    fee: estimate,
    carpoolMeta,
    internationalMeta,
    remarkText: carpoolMeta
      ? carpoolMeta.remarkText
      : internationalMeta
        ? internationalMeta.remarkText
        : getVisibleOrderRemark(order.remark),
    driver: buildOrderDriverSummary(order),
    nearbyDrivers: 6,
    waitingMinutes: 2,
    cancelRule: buildCancelRuleText(order),
    approachPoints: createDriverApproachPoints(start),
    tripPoints: route.points,
    uiStatus: getOrderStatusMeta(order.orderStatus, order.payStatus)
  }
}

function formatOrderItem(order, carTypeMap = {}) {
  const carType = carTypeMap[order.carTypeId] || {}
  const statusMeta = getOrderStatusMeta(order.orderStatus, order.payStatus)
  const carpoolMeta = getCarpoolMetaFromOrder(order)
  const internationalMeta = getInternationalMetaFromOrder(order)
  return {
    ...order,
    type: order.serviceType === SERVICE_TYPE.TAXI ? 'taxi' : order.serviceType === SERVICE_TYPE.CARPOOL ? 'carpool' : 'international',
    typeText: getServiceLabel(order.serviceType),
    status: statusMeta.key,
    rawStatus: order.orderStatus,
    statusText: statusMeta.label,
    statusTag: statusMeta.tagType,
    payStatusText: getOrderPayStatusText(order),
    amount: getOrderAmountValue(order),
    amountText: formatPrice(getOrderAmountValue(order), order.currencyCode),
    createdAtText: formatDateTime(order.createdAt || new Date()),
    carpoolMeta,
    internationalMeta,
    remarkText: carpoolMeta
      ? carpoolMeta.remarkText
      : internationalMeta
        ? internationalMeta.remarkText
        : getVisibleOrderRemark(order.remark),
    carTypeName: carType.name || `车型 #${order.carTypeId}`
  }
}

const ORDER_TIMELINE_CONFIG = [
  { key: 'created', title: '订单已创建', description: '乘客已提交订单，系统完成计价与建单。' },
  { key: 'dispatching', title: '平台派单中', description: '平台正在为你匹配合适司机。' },
  { key: 'accepted', title: '司机已接单', description: '司机已确认接单，准备前往上车点。' },
  { key: 'picking-up', title: '司机接驾中', description: '司机正在接驾，请保持电话畅通。' },
  { key: 'in-trip', title: '行程进行中', description: '本次行程正在进行，费用实时结算。' },
  { key: 'waiting-pay', title: '待支付', description: '行程已结束，请尽快完成本单支付。' }
]

function timelineTime(order = {}, key) {
  const valueMap = {
    created: order.createdAt,
    dispatching: order.createdAt || order.updatedAt,
    accepted: order.acceptedAt,
    'picking-up': order.acceptedAt || order.updatedAt,
    'in-trip': order.startedAt,
    'waiting-pay': order.finishedAt,
    paid: order.paidAt,
    cancelled: order.updatedAt || order.createdAt
  }
  return formatDateTime(valueMap[key], { fallback: '等待更新' })
}

function isSameOrder(left, right) {
  if (!left || !right) return false
  return `${left.id || ''}` === `${right.id || ''}` || `${left.orderNo || ''}` === `${right.orderNo || ''}`
}

function isActiveOrder(order = {}) {
  return Boolean(order && order.id && ![ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(order.orderStatus))
}

function pickLatestActiveOrder(orders = []) {
  return (Array.isArray(orders) ? orders : [])
    .filter((item) => isActiveOrder(item))
    .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0] || null
}

function getOrderIdentity(order) {
  if (!order) return ''
  if (order.id !== undefined && order.id !== null && `${order.id}`) {
    return `id:${order.id}`
  }
  if (order.orderNo) {
    return `orderNo:${order.orderNo}`
  }
  return ''
}

function getOrderTimelineStage(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CREATED) return 0
  if (order.orderStatus === ORDER_STATUS.DISPATCHING) return 1
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return 2
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return 3
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) return 4
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID) return 5
  return ORDER_TIMELINE_CONFIG.length - 1
}

function buildOrderTimelineSteps(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    const cancelFee = getOrderAmountValue(order)
    const hasCancelFeeToPay = order.payStatus === PAY_STATUS.UNPAID && cancelFee > 0
    return [
      {
        key: 'created',
        title: '订单已创建',
        description: '订单创建成功，平台已记录本次出行需求。',
        time: timelineTime(order, 'created'),
        state: 'completed',
        pulse: false
      },
      {
        key: 'cancelled',
        title: hasCancelFeeToPay ? '订单已取消，待支付取消费' : '订单已取消',
        description: hasCancelFeeToPay
          ? `订单已超时取消，需支付取消费 ${formatPrice(cancelFee, order.currencyCode)} 后关闭待支付状态。`
          : '订单已取消，当前无需继续支付。',
        time: timelineTime(order, 'cancelled'),
        state: 'current',
        pulse: hasCancelFeeToPay
      }
    ]
  }

  const paidCompleted = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID
  const currentStage = getOrderTimelineStage(order)
  const useMutedHistory = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID

  return ORDER_TIMELINE_CONFIG.map((item, index) => {
    let state = 'upcoming'
    if (paidCompleted || index < currentStage) {
      state = useMutedHistory ? 'completed-muted' : 'completed'
    }
    if (!paidCompleted && index === currentStage) {
      state = 'current'
    }
    return {
      ...item,
      title: item.key === 'waiting-pay' && paidCompleted ? '支付完成' : item.title,
      description: item.key === 'waiting-pay' && paidCompleted ? '本单已完成支付，订单状态已更新。' : item.description,
      time: timelineTime(order, item.key === 'waiting-pay' && paidCompleted ? 'paid' : item.key),
      state,
      pulse: state === 'current' && item.key === 'waiting-pay'
    }
  })
}

function buildOrderTimeline(order) {
  const base = [
    '订单已创建',
    '平台派单中',
    '司机已接单',
    '司机接驾中',
    '行程进行中',
    order.payStatus === PAY_STATUS.UNPAID ? '待支付' : '支付完成'
  ]

  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return ['订单已创建', '订单已取消']
  }
  if (order.orderStatus === ORDER_STATUS.DISPATCHING || order.orderStatus === ORDER_STATUS.CREATED) {
    return base.slice(0, 2)
  }
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) {
    return base.slice(0, 3)
  }
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) {
    return base.slice(0, 4)
  }
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) {
    return base.slice(0, 5)
  }
  return base
}

function findCachedOrder(orderId) {
  const app = typeof getApp === 'function' ? getApp() : null
  const store = app && app.globalData ? app.globalData.userStore : null
  if (!store || !orderId) return null

  const matcher = (item) => item && (`${item.id || ''}` === `${orderId}` || `${item.orderNo || ''}` === `${orderId}`)
  const order = (store.orders || []).find(matcher) || (matcher(store.currentRideOrder) ? store.currentRideOrder : null)
  return order ? deepClone(order) : null
}

function markCouponUsed(coupons = [], userCouponId) {
  return coupons.map((item) => {
    if (`${item.userCouponId || item.id || ''}` !== `${userCouponId}`) {
      return item
    }
    return {
      ...item,
      status: 'used',
      rawStatus: COUPON_STATUS.USED
    }
  })
}

function markPaymentSyncGuard(order) {
  if (!order || order.payStatus !== PAY_STATUS.PAID) {
    return order
  }

  return {
    ...order,
    __paymentSyncGuardUntil: Date.now() + PAYMENT_SYNC_GUARD_MS
  }
}

function resolveOrderWithPaymentGuard(order) {
  if (!order) return null

  const cachedOrder = findCachedOrder(order.id || order.orderNo)
  if (!cachedOrder) {
    return order
  }

  if (order.payStatus === PAY_STATUS.PAID) {
    return {
      ...order,
      __paymentSyncGuardUntil: undefined
    }
  }

  const guardUntil = toNumber(cachedOrder.__paymentSyncGuardUntil)
  const isGuardActive = guardUntil > Date.now()
  const shouldKeepPaidState = cachedOrder.payStatus === PAY_STATUS.PAID &&
    order.payStatus === PAY_STATUS.UNPAID &&
    isGuardActive

  if (!shouldKeepPaidState) {
    return {
      ...order,
      __paymentSyncGuardUntil: undefined
    }
  }

  return {
    ...order,
    payStatus: cachedOrder.payStatus,
    orderStatus: cachedOrder.orderStatus || order.orderStatus,
    actualAmount: cachedOrder.actualAmount || order.actualAmount || order.payableAmount || order.estimatedAmount,
    payableAmount: cachedOrder.payableAmount || order.payableAmount,
    couponDiscount: cachedOrder.couponDiscount || order.couponDiscount || 0,
    userCouponId: cachedOrder.userCouponId || order.userCouponId || null,
    couponName: cachedOrder.couponName || order.couponName || '',
    couponRuleDesc: cachedOrder.couponRuleDesc || order.couponRuleDesc || '',
    webExclusiveDiscountAmount: cachedOrder.webExclusiveDiscountAmount || order.webExclusiveDiscountAmount || 0,
    webExclusiveDiscountLabel: cachedOrder.webExclusiveDiscountLabel || order.webExclusiveDiscountLabel || '',
    webExclusiveDiscountScope: cachedOrder.webExclusiveDiscountScope || order.webExclusiveDiscountScope || '',
    webExclusiveMeta: cachedOrder.webExclusiveMeta || order.webExclusiveMeta || null,
    sourceChannel: cachedOrder.sourceChannel || order.sourceChannel || '',
    payChannel: cachedOrder.payChannel || order.payChannel,
    paidAt: cachedOrder.paidAt || order.paidAt,
    finishedAt: cachedOrder.finishedAt || order.finishedAt,
    updatedAt: cachedOrder.updatedAt || order.updatedAt,
    __paymentSyncGuardUntil: guardUntil
  }
}

function syncOrderToCache(order) {
  const app = typeof getApp === 'function' ? getApp() : null
  const store = app && app.globalData ? app.globalData.userStore : null
  if (!store || !order) {
    return order ? deepClone(order) : null
  }

  const resolvedOrder = resolveOrderWithPaymentGuard(order)
  const orderToStore = resolvedOrder && resolvedOrder.payStatus === PAY_STATUS.PAID
    ? markPaymentSyncGuard(resolvedOrder)
    : resolvedOrder

  const orders = Array.isArray(store.orders) ? store.orders.slice() : []
  const currentIndex = orders.findIndex((item) => isSameOrder(item, orderToStore))
  const previousOrder = currentIndex >= 0 ? orders[currentIndex] : null
  let storedOrder = null
  if (currentIndex >= 0) {
    orders[currentIndex] = {
      ...orders[currentIndex],
      ...orderToStore
    }
    storedOrder = orders[currentIndex]
  } else {
    storedOrder = deepClone(orderToStore)
    orders.unshift(storedOrder)
  }
  store.orders = orders

  if (isActiveOrder(storedOrder)) {
    store.currentRideOrder = {
      ...(store.currentRideOrder || {}),
      ...storedOrder,
      uiStatus: getOrderStatusMeta(storedOrder.orderStatus, storedOrder.payStatus)
    }
  } else if (store.currentRideOrder && isSameOrder(store.currentRideOrder, storedOrder)) {
    const latestActive = pickLatestActiveOrder(orders)
    if (latestActive) {
      store.currentRideOrder = {
        ...latestActive,
        uiStatus: getOrderStatusMeta(latestActive.orderStatus, latestActive.payStatus)
      }
    } else if (storedOrder.orderStatus === ORDER_STATUS.FINISHED && storedOrder.payStatus === PAY_STATUS.UNPAID) {
      store.currentRideOrder = {
        ...store.currentRideOrder,
        ...storedOrder,
        uiStatus: getOrderStatusMeta(storedOrder.orderStatus, storedOrder.payStatus)
      }
    } else {
      store.currentRideOrder = null
    }
  } else if (!store.currentRideOrder) {
    const latestActive = pickLatestActiveOrder(orders)
    if (latestActive) {
      store.currentRideOrder = {
        ...latestActive,
        uiStatus: getOrderStatusMeta(latestActive.orderStatus, latestActive.payStatus)
      }
    }
  }

  if (store.currentRideOrder && isSameOrder(store.currentRideOrder, storedOrder)) {
    store.currentRideOrder = {
      ...store.currentRideOrder,
      ...storedOrder,
      uiStatus: getOrderStatusMeta(storedOrder.orderStatus, storedOrder.payStatus)
    }
  }

  if (storedOrder.payStatus === PAY_STATUS.PAID && storedOrder.userCouponId && Array.isArray(store.coupons)) {
    store.coupons = markCouponUsed(store.coupons, storedOrder.userCouponId)
  }

  if (storedOrder.payStatus === PAY_STATUS.PAID && (!previousOrder || previousOrder.payStatus !== PAY_STATUS.PAID)) {
    const paymentMessage = {
      id: `pay-success-${storedOrder.id}-${Date.now()}`,
      title: '支付成功',
      content: `订单 ${order.orderNo || order.id} 已完成支付，可返回订单详情查看最新状态。`,
      time: '刚刚',
      unread: true
    }
    store.messages = [paymentMessage].concat(store.messages || []).slice(0, 20)
  }

  if (storedOrder.orderStatus === ORDER_STATUS.ACCEPTED && (!previousOrder || previousOrder.orderStatus !== ORDER_STATUS.ACCEPTED)) {
    const acceptMessage = {
      id: `order-accepted-${storedOrder.id}-${Date.now()}`,
      title: '司机已接单',
      content: `${storedOrder.startName || '上车点'} 到 ${storedOrder.endName || '目的地'} 的订单已接单，请留意司机位置。`,
      time: '刚刚',
      unread: true
    }
    store.messages = [acceptMessage].concat(store.messages || []).slice(0, 20)
    wx.showToast({ title: '司机已接单', icon: 'none' })
  }

  if (storedOrder.orderStatus === ORDER_STATUS.CANCELLED && (!previousOrder || previousOrder.orderStatus !== ORDER_STATUS.CANCELLED)) {
    const cancelMessage = {
      id: `order-cancelled-${storedOrder.id}-${Date.now()}`,
      title: '订单已取消',
      content: `订单 ${storedOrder.orderNo || storedOrder.id} 已取消，详情可在订单记录中查看。`,
      time: '刚刚',
      unread: true
    }
    store.messages = [cancelMessage].concat(store.messages || []).slice(0, 20)
  }

  if (app.saveUserStore) {
    app.saveUserStore()
  }
  return deepClone(storedOrder)
}

function applyLocalMockPayment(orderId, options = {}) {
  const current = findCachedOrder(orderId)
  if (!current) return null

  const paidAt = formatDateTime(new Date(), { includeSeconds: true })
  const originalAmount = toNumber(options.originalAmount, current.actualAmount || current.estimatedAmount || current.payableAmount)
  const payableAmount = toNumber(options.payableAmount, current.payableAmount || originalAmount)
  const couponDiscount = toNumber(options.couponDiscount, current.couponDiscount)
  const nextOrder = {
    ...current,
    orderStatus: ORDER_STATUS.FINISHED,
    payStatus: PAY_STATUS.PAID,
    actualAmount: originalAmount,
    payableAmount,
    couponDiscount,
    userCouponId: options.userCouponId || current.userCouponId || null,
    couponName: options.couponName || current.couponName || '',
    couponRuleDesc: options.couponRuleDesc || current.couponRuleDesc || '',
    paidAt,
    finishedAt: current.finishedAt || paidAt,
    updatedAt: paidAt,
    payChannel: options.payChannel || current.payChannel || 'WECHAT'
  }

  return syncOrderToCache(nextOrder)
}

function syncOrdersToCache(orderList = []) {
  const app = typeof getApp === 'function' ? getApp() : null
  const store = app && app.globalData ? app.globalData.userStore : null

  const syncedOrders = (orderList || [])
    .map((item) => syncOrderToCache(item) || item)
    .filter(Boolean)

  if (!store) {
    return deepClone(syncedOrders)
  }

  const remoteIdentitySet = new Set(syncedOrders.map((item) => getOrderIdentity(item)).filter(Boolean))
  const localOnlyOrders = (store.orders || []).filter((item) => {
    const identity = getOrderIdentity(item)
    return identity && !remoteIdentitySet.has(identity)
  })

  const nextOrders = syncedOrders.concat(localOnlyOrders.map((item) => deepClone(item)))
  store.orders = nextOrders

  if (app.saveUserStore) {
    app.saveUserStore()
  }

  return deepClone(nextOrders)
}

function buildWalletView(profile = {}, coupons = [], orders = []) {
  const completedOrders = orders.filter((item) => item.orderStatus === ORDER_STATUS.FINISHED && item.payStatus === PAY_STATUS.PAID)
  const couponBalance = coupons.reduce((sum, item) => {
    if (item.rawStatus !== COUPON_STATUS.UNUSED || item.discount) return sum
    return sum + toNumber(item.amount)
  }, 0)

  return {
    balance: toNumber(profile.walletBalance),
    couponBalance: Number(couponBalance.toFixed(2)),
    invoices: completedOrders.length
  }
}

function buildInvoiceList(orders = []) {
  return orders
    .filter((item) => item.orderStatus === ORDER_STATUS.FINISHED && item.payStatus === PAY_STATUS.PAID)
    .map((item) => {
      const meta = getInvoiceMetaFromOrder(item)
      const amount = toNumber(firstPresent(meta.totalAmount, item.actualAmount, item.payableAmount, item.estimatedAmount), 0)
      const currencyCode = firstPresent(meta.currencyCode, item.currencyCode, 'CNY')
      const invoiceStatus = item.invoiceStatus || meta.invoiceStatus || meta.status || 'NONE'
      const detail = buildInvoiceDetail(item, meta, amount, currencyCode, invoiceStatus)
      const serviceName = firstPresent(meta.serviceName, getServiceLabel(item.serviceType))
      return {
        id: item.id,
        orderNo: item.orderNo,
        invoiceStatus,
        title: `${serviceName}电子发票`,
        amount,
        amountText: formatPrice(amount, currencyCode),
        createdAt: formatDateTime(item.createdAt || new Date()),
        issuedAt: detail.issueAt || detail.handledAt || detail.invoiceDate,
        status: getInvoiceStatusText(invoiceStatus),
        rejectReason: detail.rejectReason,
        canApply: !invoiceStatus || ['NONE', 'REJECTED'].includes(invoiceStatus),
        isIssued: invoiceStatus === 'ISSUED',
        detail
      }
    })
}

function buildInvoiceDetail(order = {}, meta = {}, amount = 0, currencyCode = 'CNY', invoiceStatus = 'NONE') {
  const serviceName = firstPresent(meta.serviceName, getServiceLabel(order.serviceType))
  const tripTime = firstPresent(meta.tripTime, order.finishedAt, order.startedAt, order.createdAt)
  const invoiceDate = firstPresent(meta.invoiceDate, meta.issueAt, tripTime)
  const distanceKm = toNumber(firstPresent(meta.distanceKm, order.actualDistanceKm, order.estimatedDistanceKm), 0)
  const durationMin = toNumber(firstPresent(meta.durationMin, order.actualDurationMin, order.estimatedDurationMin), 0)
  const itemAmount = toNumber(firstPresent(meta.itemAmount, meta.totalAmount, amount), 0)
  return {
    status: invoiceStatus,
    invoiceCode: firstPresent(meta.invoiceCode, buildLocalInvoiceCode(order)),
    invoiceNo: firstPresent(meta.invoiceNo, buildLocalInvoiceNo(order)),
    invoiceDate: formatDateTime(invoiceDate, { fallback: formatDate(new Date()) }),
    issueAt: firstPresent(meta.issueAt, ''),
    handledAt: firstPresent(meta.handledAt, ''),
    orderNo: firstPresent(meta.orderNo, order.orderNo),
    invoiceType: firstPresent(meta.invoiceType, '电子普通发票'),
    buyerName: firstPresent(meta.buyerName, meta.title, '个人'),
    buyerTaxNo: firstPresent(meta.buyerTaxNo, meta.taxNo, '个人无需填写'),
    buyerPhone: firstPresent(meta.buyerPhone, '13800000000'),
    sellerName: firstPresent(meta.sellerName, '北京阳光出行有限公司'),
    sellerTaxNo: firstPresent(meta.sellerTaxNo, '91110105MA01SUN8X9'),
    sellerPhone: firstPresent(meta.sellerPhone, '400-100-0101'),
    passengerName: firstPresent(meta.passengerName, '阳光乘客'),
    tripTime: formatDateTime(tripTime, { fallback: '--' }),
    startName: firstPresent(meta.startName, order.startName, '未记录上车点'),
    endName: firstPresent(meta.endName, order.endName, '未记录下车点'),
    serviceName,
    carTypeName: firstPresent(meta.carTypeName, serviceName),
    distanceText: `${distanceKm.toFixed(1)} 公里`,
    durationText: `${Math.max(0, Math.round(durationMin))} 分钟`,
    payChannel: firstPresent(meta.payChannel, '在线支付'),
    itemName: firstPresent(meta.itemName, `${serviceName}出行服务费`),
    itemUnit: firstPresent(meta.itemUnit, '次'),
    itemQuantity: firstPresent(meta.itemQuantity, '1'),
    itemUnitPrice: toNumber(firstPresent(meta.itemUnitPrice, itemAmount), 0).toFixed(2),
    itemAmount: itemAmount.toFixed(2),
    totalAmount: amount.toFixed(2),
    totalAmountText: formatPrice(amount, currencyCode),
    amountUpper: amountToChinese(amount, currencyCode),
    remark: firstPresent(meta.remark, '本发票为打车出行电子发票。'),
    rejectReason: firstPresent(meta.rejectReason, '')
  }
}

function buildLocalInvoiceCode(order = {}) {
  const seed = Math.abs(hashText(`${order.id || ''}${order.orderNo || ''}`)) % 100000
  return `0310024${String(seed).padStart(5, '0')}`
}

function buildLocalInvoiceNo(order = {}) {
  const seed = Math.abs(hashText(`${order.orderNo || ''}${order.id || ''}${order.userId || ''}`)) % 100000000
  return String(seed).padStart(8, '0')
}

function hashText(text = '') {
  return `${text || ''}`.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
}

function getInvoiceStatusText(status) {
  const map = {
    NONE: '可申请',
    APPLIED: '申请中',
    ISSUED: '查看发票',
    REJECTED: '重新申请'
  }
  return map[status] || '可申请'
}

function buildReviewRecord(order, score, content, tags, anonymous) {
  return {
    id: `review-${order.id}`,
    score,
    orderNo: order.orderNo,
    content,
    tags,
    anonymous,
    createdAt: formatDateTime(new Date())
  }
}

function buildComplaintRecord(order, content) {
  return {
    id: `complaint-${order.id}-${Date.now()}`,
    title: content,
    status: '处理中',
    createdAt: formatDateTime(new Date()),
    orderNo: order.orderNo
  }
}

function parseReviewFromEvaluation(order) {
  const raw = `${order.evaluationStatus || ''}`
  if (!raw.startsWith('DONE:')) return null
  const [, scoreText, ...contentParts] = raw.split(':')
  return {
    id: `review-${order.id}`,
    score: toNumber(scoreText, 5),
    orderNo: order.orderNo,
    content: contentParts.join(':') || '乘客未填写文字评价',
    createdAt: formatDateTime(order.updatedAt || order.finishedAt || order.createdAt || new Date()),
    serviceTypeText: getServiceLabel(order.serviceType)
  }
}

function buildReviewListFromOrders(orders = []) {
  return orders
    .map(parseReviewFromEvaluation)
    .filter(Boolean)
    .sort((left, right) => `${right.createdAt}`.localeCompare(`${left.createdAt}`))
}

function buildInternationalOptions() {
  return INTERNATIONAL_OPTIONS
}

function getInternationalExchangeRate() {
  const app = typeof getApp === 'function' ? getApp() : null
  const configs = app && app.globalData && app.globalData.userStore
    ? (app.globalData.userStore.home || {}).systemConfigs || {}
    : {}
  const rate = Number(configs.intlExchangeRate)
  return Number.isFinite(rate) && rate > 0 ? rate : 7.15
}

function buildInternationalRemark(meta = {}, note = '') {
  const payload = {
    optionId: meta.optionId || '',
    routeCode: meta.routeCode || '',
    countryText: meta.countryText || '',
    productName: meta.productName || '',
    productNameEn: meta.productNameEn || '',
    startName: meta.startName || '',
    endName: meta.endName || '',
    appointmentTime: meta.appointmentTime || '',
    passengerCount: Math.max(1, toNumber(meta.passengerCount, 1)),
    contactName: meta.contactName || '',
    contactPhone: meta.contactPhone || '',
    flightNo: meta.flightNo || '',
    luggageCount: Math.max(0, toNumber(meta.luggageCount, 0)),
    languageCode: meta.languageCode || 'zh-CN',
    currencyCode: meta.currencyCode || 'USD',
    exchangeRate: toNumber(meta.exchangeRate, getInternationalExchangeRate()),
    serviceItems: Array.isArray(meta.serviceItems) ? meta.serviceItems : [],
    documents: Array.isArray(meta.documents) ? meta.documents : [],
    pickupSign: meta.pickupSign || '阳光出行',
    riskNotice: meta.riskNotice || '请提前确认通关证件、航班时间与目的地政策。',
    distanceText: meta.distanceText || '',
    durationText: meta.durationText || '',
    amountText: meta.amountText || '',
    syncStatus: meta.syncStatus || 'BACKEND_ORDER',
    submitSource: meta.submitSource || 'USER_MINIAPP'
  }
  const cleanNote = `${note || ''}`.trim()
  return `[${INTERNATIONAL_META_TAG}]${JSON.stringify(payload)}[/${INTERNATIONAL_META_TAG}]${cleanNote ? ` ${cleanNote}` : ''}`
}

module.exports = {
  applyLocalMockPayment,
  buildComplaintRecord,
  buildEstimateFromRoute,
  buildInternationalOptions,
  buildInternationalRemark,
  buildInvoiceList,
  buildOrderTimeline,
  buildOrderTimelineSteps,
  buildReviewListFromOrders,
  buildReviewRecord,
  buildRideOrderModel,
  buildWalletView,
  calcEstimate,
  decorateCarType,
  findCachedOrder,
  formatOrderItem,
  getCarpoolMetaFromOrder,
  getInternationalExchangeRate,
  getInternationalMetaFromOrder,
  getCarTypeMap,
  getDefaultDraft,
  mergeCoupons,
  normalizePoint,
  pickAutoCoupon,
  resolveOrderWithPaymentGuard,
  searchPois,
  syncOrdersToCache,
  syncOrderToCache
}
