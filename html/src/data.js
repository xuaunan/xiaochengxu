export const ROLE = {
  USER: 'USER',
  DRIVER: 'DRIVER'
}

export const SERVICE_TYPE = {
  TAXI: 'TAXI',
  CARPOOL: 'CARPOOL',
  INTERNATIONAL: 'INTERNATIONAL'
}

export const ORDER_STATUS = {
  CREATED: 'CREATED',
  DISPATCHING: 'DISPATCHING',
  ACCEPTED: 'ACCEPTED',
  PICKING_UP: 'PICKING_UP',
  IN_TRIP: 'IN_TRIP',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED'
}

export const PAY_STATUS = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
}

export const DRIVER_STATUS = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  BUSY: 'BUSY'
}

export const statusLabel = {
  CREATED: '已创建',
  DISPATCHING: '等待接单',
  ACCEPTED: '司机已接单',
  PICKING_UP: '接驾中',
  IN_TRIP: '行程中',
  FINISHED: '已完成',
  CANCELLED: '已取消',
  UNPAID: '待支付',
  PAID: '已支付',
  REFUNDED: '已退款',
  OFFLINE: '离线',
  ONLINE: '在线听单',
  BUSY: '服务中',
  TAXI: '即时打车',
  CARPOOL: '顺风车',
  INTERNATIONAL: '国际出行'
}

export const statusTone = {
  CREATED: 'waiting',
  DISPATCHING: 'waiting',
  ACCEPTED: 'active',
  PICKING_UP: 'active',
  IN_TRIP: 'active',
  FINISHED: 'success',
  CANCELLED: 'danger',
  UNPAID: 'waiting',
  PAID: 'success',
  REFUNDED: 'danger',
  OFFLINE: 'muted',
  ONLINE: 'success',
  BUSY: 'active'
}

export const poiLibrary = [
  { id: 'poi101', name: '燕京理工学院-南门', address: '河北省廊坊市三河市燕郊经济技术开发区迎宾北路45号', latitude: 39.9825, longitude: 117.0782, tags: ['高校', '校园'] },
  { id: 'poi102', name: '天洋广场', address: '河北省廊坊市三河市燕郊开发区迎宾路东侧天洋广场', latitude: 39.9848, longitude: 117.0831, tags: ['商场', '商圈'] },
  { id: 'poi103', name: '海底捞火锅(天洋广场店)', address: '河北省廊坊市三河市燕郊开发区天洋广场4层', latitude: 39.9844, longitude: 117.0836, tags: ['美食', '火锅'] },
  { id: 'poi104', name: '三河市政府', address: '河北省廊坊市三河市府东路5号', latitude: 39.981, longitude: 117.0786, tags: ['政务', '地标'] },
  { id: 'poi001', name: '上海虹桥机场T2', address: '闵行区申贵路1500号', latitude: 31.20066, longitude: 121.32756, tags: ['交通枢纽', '机场'] },
  { id: 'poi002', name: '上海迪士尼度假区', address: '浦东新区川沙新镇黄赵路310号', latitude: 31.14337, longitude: 121.65717, tags: ['景点', '度假区'] },
  { id: 'poi003', name: '人民广场', address: '黄浦区人民大道185号', latitude: 31.23037, longitude: 121.4737, tags: ['地标', '商圈'] },
  { id: 'poi004', name: '陆家嘴中心', address: '浦东新区世纪大道88号', latitude: 31.23969, longitude: 121.49981, tags: ['金融区', '商务'] },
  { id: 'poi005', name: '上海浦东国际机场', address: '浦东新区迎宾大道6000号', latitude: 31.14434, longitude: 121.8083, tags: ['机场', '国际'] },
  { id: 'poi006', name: '静安寺', address: '静安区南京西路1686号', latitude: 31.22392, longitude: 121.4451, tags: ['热门', '商圈'] },
  { id: 'poi007', name: '深圳湾口岸，中国深圳', address: '广东省深圳市南山区东滨路', latitude: 22.50269, longitude: 113.94598, tags: ['国际', '口岸'] },
  { id: 'poi008', name: '香港国际机场，中国香港', address: '中国香港大屿山', latitude: 22.308, longitude: 113.9185, tags: ['机场', '国际'] },
  { id: 'poi009', name: '澳门渔人码头，中国澳门', address: '中国澳门外港新填海区', latitude: 22.1959, longitude: 113.5582, tags: ['国际', '景点'] },
  { id: 'poi011', name: '苏州工业园区', address: '江苏省苏州市工业园区', latitude: 31.324, longitude: 120.7219, tags: ['跨城', '商务'] },
  { id: 'poi112', name: '燕京理工学院-图书馆', address: '河北省廊坊市三河市燕郊经济技术开发区燕京理工学院校内', latitude: 39.98162, longitude: 117.07932, tags: ['高校', '图书馆'] }
]

export const fallbackCarTypes = [
  { id: 1, name: '经济型', baseFare: 10, perKmFee: 2.2, perMinuteFee: 0.45, image: '/assets/map-driver.png', description: '轻快省心，日常通勤首选', seatText: '4座' },
  { id: 2, name: '舒适型', baseFare: 14, perKmFee: 2.9, perMinuteFee: 0.58, image: '/assets/map-driver.png', description: '空间更稳，适合商务和家庭', seatText: '4座' },
  { id: 3, name: '商务型', baseFare: 22, perKmFee: 4.1, perMinuteFee: 0.75, image: '/assets/map-driver.png', description: '高级接送，跨城跨境更体面', seatText: '6座' }
]

export const fallbackCoupons = [
  { id: 1, couponName: '新人立减18元券', couponType: 'CASH', serviceScope: 'ALL', thresholdAmount: 40, discountAmount: 18, discountRate: null, ruleDesc: '首单满40元可减18元', validEndTime: '2026-12-31 23:59:59' },
  { id: 2, couponName: '打车立减12元券', couponType: 'CASH', serviceScope: 'TAXI', thresholdAmount: 50, discountAmount: 12, discountRate: null, ruleDesc: '即时打车满50元减12元', validEndTime: '2026-12-31 23:59:59' },
  { id: 3, couponName: '顺风车八折券', couponType: 'DISCOUNT', serviceScope: 'CARPOOL', thresholdAmount: 20, discountAmount: null, discountRate: 0.8, ruleDesc: '顺风车订单享受8折优惠', validEndTime: '2026-12-31 23:59:59' },
  { id: 4, couponName: '国际出行20美元券', couponType: 'CASH', serviceScope: 'INTERNATIONAL', thresholdAmount: 50, discountAmount: 20, discountRate: null, ruleDesc: '国际出行满50美元减20美元', validEndTime: '2026-12-31 23:59:59' }
]

export const demoAccounts = {
  USER: { phone: '13800000001', password: '123456', nickname: '阳光旅客' },
  DRIVER: { phone: '13900000001', password: '123456', nickname: '一号司机' }
}

export const defaultBooking = {
  serviceType: SERVICE_TYPE.TAXI,
  startId: 'poi101',
  endId: 'poi102',
  carTypeId: 1,
  remark: '网页端下单，自动同步同一套后端订单。'
}

export function findPoi(id) {
  return poiLibrary.find((poi) => poi.id === id) || poiLibrary[0]
}

export function formatMoney(value, currency = 'CNY') {
  const amount = Number(value || 0)
  const symbol = currency === 'USD' ? '$' : '¥'
  return `${symbol}${amount.toFixed(2)}`
}

export function calcRoute(startId, endId) {
  const start = findPoi(startId)
  const end = findPoi(endId)
  const distance = haversine(start.latitude, start.longitude, end.latitude, end.longitude)
  const distanceKm = Math.max(1.2, Number(distance.toFixed(1)))
  const durationMin = Math.max(6, Math.round(distanceKm * 3.4 + 4))
  return { start, end, distanceKm, durationMin }
}

export function estimateLocalFare(carTypeId, serviceType, distanceKm, durationMin) {
  const type = fallbackCarTypes.find((item) => Number(item.id) === Number(carTypeId)) || fallbackCarTypes[0]
  const multiplier = serviceType === SERVICE_TYPE.INTERNATIONAL ? 1.65 : serviceType === SERVICE_TYPE.CARPOOL ? 0.68 : 1
  const baseAmount = type.baseFare + distanceKm * type.perKmFee + durationMin * type.perMinuteFee
  const longDistanceSurchargeAmount = distanceKm > 15 ? (distanceKm - 15) * 1.6 : 0
  const nightSurchargeAmount = 0
  const amount = (baseAmount + longDistanceSurchargeAmount + nightSurchargeAmount) * multiplier
  return {
    distanceKm,
    durationMin,
    baseAmount: Number(baseAmount.toFixed(2)),
    nightSurchargeAmount: Number(nightSurchargeAmount.toFixed(2)),
    longDistanceSurchargeAmount: Number(longDistanceSurchargeAmount.toFixed(2)),
    amount: Number(amount.toFixed(2)),
    currencyCode: serviceType === SERVICE_TYPE.INTERNATIONAL ? 'USD' : 'CNY',
    exchangeRate: serviceType === SERVICE_TYPE.INTERNATIONAL ? 7.15 : 1
  }
}

export function createOrderPayload(booking, estimate) {
  const { start, end } = calcRoute(booking.startId, booking.endId)
  return {
    carTypeId: Number(booking.carTypeId),
    serviceType: booking.serviceType,
    startName: start.name,
    startLng: String(start.longitude),
    startLat: String(start.latitude),
    endName: end.name,
    endLng: String(end.longitude),
    endLat: String(end.latitude),
    estimatedDistanceKm: estimate.distanceKm,
    estimatedDurationMin: estimate.durationMin,
    userCouponId: booking.userCouponId || null,
    dispatchMode: 'SMART',
    languageCode: 'zh-CN',
    currencyCode: estimate.currencyCode || 'CNY',
    remark: booking.remark || ''
  }
}

export function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.orders)) return data.orders
  return []
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
