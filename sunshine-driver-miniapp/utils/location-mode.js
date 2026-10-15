const { SERVICE_TYPE } = require('./constants')

// 定位模式（接单定位，与轨迹模式 trackMode 相互独立）
// REAL = 真实定位：使用司机真实 GPS，仅接收上车点 5 公里内的快车/国际出行订单
// DEMO = 演示定位：与原有行为完全一致（接收全部订单，顺风车不受影响）
const LOCATION_MODE = {
  DEMO: 'DEMO',
  REAL: 'REAL'
}

const MAX_RECEIVE_DISTANCE_KM = 5

const LOCATION_MODE_OPTIONS = [
  {
    value: LOCATION_MODE.REAL,
    label: '真实定位',
    desc: '只接收上车点5公里内的快车/国际出行订单'
  },
  {
    value: LOCATION_MODE.DEMO,
    label: '演示定位',
    desc: '接收全部待抢订单，行程为演示轨迹'
  }
]

function normalizeLocationMode(value) {
  return value === LOCATION_MODE.REAL ? LOCATION_MODE.REAL : LOCATION_MODE.DEMO
}

function getLocationModeLabel(value) {
  return normalizeLocationMode(value) === LOCATION_MODE.REAL ? '真实定位' : '演示定位'
}

function getLocationModeDesc(value) {
  const option = LOCATION_MODE_OPTIONS.find((item) => item.value === normalizeLocationMode(value))
  return option ? option.desc : ''
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getDistanceKm(from = {}, to = {}) {
  const fromLat = Number(from.latitude)
  const fromLng = Number(from.longitude)
  const toLat = Number(to.latitude)
  const toLng = Number(to.longitude)
  if (![fromLat, fromLng, toLat, toLng].every((item) => Number.isFinite(item))) {
    return Number.POSITIVE_INFINITY
  }
  const earthRadius = 6371
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
    Math.cos(toRadians(toLat)) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

function getValidRealLocation(realLocation) {
  if (!realLocation) return null
  const latitude = Number(realLocation.latitude)
  const longitude = Number(realLocation.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (!latitude && !longitude)) {
    return null
  }
  return { latitude, longitude }
}

// 真实定位模式下，订单是否在可接范围内（顺风车始终放行，保持原有行为）
function isOrderReceivable(order = {}, realLocation) {
  if (order.serviceType === SERVICE_TYPE.CARPOOL) return true
  const from = getValidRealLocation(realLocation)
  if (!from) return false
  const distanceKm = getDistanceKm(from, {
    latitude: Number(order.startLat || order.latitude || 0),
    longitude: Number(order.startLng || order.longitude || 0)
  })
  return distanceKm <= MAX_RECEIVE_DISTANCE_KM
}

// 按定位模式过滤待抢订单：非 REAL 模式原样返回（行为不变）
function filterWaitingOrdersByLocationMode(orders = [], locationMode, realLocation) {
  if (normalizeLocationMode(locationMode) !== LOCATION_MODE.REAL) {
    return orders
  }
  return orders.filter((item) => isOrderReceivable(item, realLocation))
}

module.exports = {
  LOCATION_MODE,
  LOCATION_MODE_OPTIONS,
  MAX_RECEIVE_DISTANCE_KM,
  filterWaitingOrdersByLocationMode,
  getDistanceKm,
  getLocationModeDesc,
  getLocationModeLabel,
  getValidRealLocation,
  isOrderReceivable,
  normalizeLocationMode
}
