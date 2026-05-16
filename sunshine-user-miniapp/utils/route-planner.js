const { normalizeRoutePoints } = require('./route-display')

const TENCENT_DIRECTION_URL = 'https://apis.map.qq.com/ws/direction/v1/driving/'
const routeCache = {}

function toNumber(value, fallback = NaN) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function getMapServiceKey() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    const mapConfig = app && app.globalData ? app.globalData.mapConfig : null
    if (mapConfig && mapConfig.tencentKey) {
      return `${mapConfig.tencentKey}`.trim()
    }
  } catch (error) {
    // ignore
  }

  try {
    return `${wx.getStorageSync('sunshine-tencent-map-key') || ''}`.trim()
  } catch (error) {
    return ''
  }
}

function toLocationParam(point = {}) {
  const latitude = toNumber(point.latitude)
  const longitude = toNumber(point.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''
  return `${latitude},${longitude}`
}

function getRouteCacheKey(from, to) {
  return [
    toNumber(from.latitude).toFixed(5),
    toNumber(from.longitude).toFixed(5),
    toNumber(to.latitude).toFixed(5),
    toNumber(to.longitude).toFixed(5)
  ].join('|')
}

function decodeTencentPolyline(polyline = []) {
  const values = Array.isArray(polyline) ? polyline.slice() : []
  if (values.length < 4) return []

  for (let index = 2; index < values.length; index += 1) {
    values[index] = Number(values[index - 2]) + Number(values[index]) / 1000000
  }

  const points = []
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({
      latitude: values[index],
      longitude: values[index + 1]
    })
  }

  return normalizeRoutePoints(points)
}

function requestRoute(from, to) {
  const key = getMapServiceKey()
  const fromParam = toLocationParam(from)
  const toParam = toLocationParam(to)
  if (!key || !fromParam || !toParam) {
    return Promise.resolve([])
  }

  const cacheKey = getRouteCacheKey(from, to)
  if (routeCache[cacheKey]) {
    return Promise.resolve(routeCache[cacheKey])
  }

  return new Promise((resolve) => {
    wx.request({
      url: TENCENT_DIRECTION_URL,
      method: 'GET',
      timeout: 5000,
      data: {
        from: fromParam,
        to: toParam,
        key
      },
      success: (response) => {
        const payload = response.data || {}
        const route = payload.result && Array.isArray(payload.result.routes)
          ? payload.result.routes[0]
          : null
        const points = route ? decodeTencentPolyline(route.polyline) : []
        if (points.length >= 3) {
          routeCache[cacheKey] = points
          resolve(points)
          return
        }
        resolve([])
      },
      fail: () => resolve([])
    })
  })
}

module.exports = {
  requestRoute
}
