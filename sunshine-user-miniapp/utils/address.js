const { createId } = require('./format')
const { getDistanceKm } = require('./map')

const FAVORITE_POI_IDS = ['poi101', 'poi102', 'poi103']
const DEFAULT_CITY = '上海市'
const DEFAULT_RADIUS = 5000
const DEFAULT_PAGE_SIZE = 10
const EXACT_POI_MATCH_DISTANCE_KM = 0.04
const APPROXIMATE_POI_DISTANCE_KM = 0.5
const MAP_PICKER_POI_MATCH_DISTANCE_KM = 0.8
const CITY_INFER_DISTANCE_KM = 25
const LOCAL_NEARBY_FALLBACK_RADIUS_KM = 2
const TENCENT_REVERSE_POI_PICK_DISTANCE_KM = 0.12
const OSM_SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const OSM_REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const OSM_RATE_LIMIT_COOLDOWN_MS = 60 * 1000
const EARTH_A = 6378245.0
const EE = 0.00669342162296594323
const DEFAULT_LOCATION = {
  latitude: 31.230416,
  longitude: 121.473701,
  city: DEFAULT_CITY
}

const CITY_BY_ID = {
  poi101: '廊坊市',
  poi102: '廊坊市',
  poi103: '廊坊市',
  poi104: '廊坊市',
  poi105: '廊坊市',
  poi106: '廊坊市',
  poi107: '廊坊市',
  poi108: '廊坊市',
  poi109: '廊坊市',
  poi110: '廊坊市',
  poi001: '上海市',
  poi002: '上海市',
  poi003: '上海市',
  poi004: '上海市',
  poi005: '上海市',
  poi006: '上海市',
  poi007: '深圳市',
  poi008: '香港特别行政区',
  poi009: '澳门特别行政区',
  poi010: '上海市',
  poi011: '苏州市'
}

const LOCAL_POI_LIBRARY = [
  { id: 'poi101', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662-\u5357\u95e8', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u8fce\u5bbe\u5317\u8def45\u53f7', latitude: 39.9825, longitude: 117.0782, tags: ['\u9ad8\u6821', '\u6821\u56ed', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] },
  { id: 'poi102', name: '\u5929\u6d0b\u5e7f\u573a', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u5f00\u53d1\u533a\u8fce\u5bbe\u8def\u4e1c\u4fa7\u5929\u6d0b\u5e7f\u573a', latitude: 39.9848, longitude: 117.0831, tags: ['\u5546\u573a', '\u5546\u5708', '\u5929\u6d0b\u5e7f\u573a'] },
  { id: 'poi103', name: '\u6d77\u5e95\u635e\u706b\u9505(\u5929\u6d0b\u5e7f\u573a\u5e97)', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u5f00\u53d1\u533a\u5929\u6d0b\u5e7f\u573a4\u5c42', latitude: 39.9844, longitude: 117.0836, tags: ['\u7f8e\u98df', '\u706b\u9505', '\u5929\u6d0b\u5e7f\u573a'] },
  { id: 'poi104', name: '\u4e09\u6cb3\u5e02\u653f\u5e9c', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u5e9c\u4e1c\u8def5\u53f7', latitude: 39.981, longitude: 117.0786, tags: ['\u653f\u52a1', '\u5730\u6807', '\u4e09\u6cb3\u5e02\u653f\u5e9c'] },
  { id: 'poi105', name: '\u798f\u6210\u56fd\u9645\u5927\u9152\u5e97', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u5f00\u53d1\u533a\u795e\u5a01\u5317\u8def', latitude: 39.9894, longitude: 117.08, tags: ['\u9152\u5e97', '\u5546\u52a1', '\u798f\u6210'] },
  { id: 'poi106', name: '\u798f\u5143\u8fd0\u6765\u8336\u5e84', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u5f00\u53d1\u533a\u5317\u4eac\u7231\u516c\u8def', latitude: 39.9892, longitude: 117.0861, tags: ['\u5e97\u94fa', '\u8336\u5e84', '\u798f\u5143'] },
  { id: 'poi107', name: '\u4e09\u6cb3\u5e02\u7b2c\u4e00\u5c0f\u5b66', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u5411\u9633\u8def', latitude: 39.9712, longitude: 117.0915, tags: ['\u5b66\u6821', '\u5c0f\u5b66', '\u4e09\u6cb3'] },
  { id: 'poi108', name: '\u4e2d\u56fd\u94f6\u884c(\u4e09\u6cb3\u652f\u884c)', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u5e9c\u4e1c\u8857', latitude: 39.9767, longitude: 117.0735, tags: ['\u94f6\u884c', '\u91d1\u878d', '\u4e09\u6cb3'] },
  { id: 'poi109', name: '\u9f0e\u76db\u4e1c\u5927\u8857', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u9f0e\u76db\u4e1c\u5927\u8857', latitude: 39.9783, longitude: 117.0788, tags: ['\u8857\u9053', '\u57ce\u5e02', '\u4e09\u6cb3'] },
  { id: 'poi110', name: '\u71d5\u90ca\u516c\u56ed', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u5f00\u53d1\u533a\u795e\u5a01\u5317\u8def', latitude: 39.9862, longitude: 117.0715, tags: ['\u516c\u56ed', '\u4f11\u95f2', '\u71d5\u90ca'] },
  { id: 'poi001', name: '上海虹桥机场 T2', address: '上海市闵行区申贵路1500号', latitude: 31.20066, longitude: 121.32756, tags: ['交通枢纽', '机场'] },
  { id: 'poi002', name: '上海迪士尼度假区', address: '上海市浦东新区川沙新镇黄赵路310号', latitude: 31.14337, longitude: 121.65717, tags: ['景点', '度假区'] },
  { id: 'poi003', name: '人民广场', address: '上海市黄浦区人民大道185号', latitude: 31.23037, longitude: 121.4737, tags: ['地标', '商圈'] },
  { id: 'poi004', name: '陆家嘴中心', address: '上海市浦东新区世纪大道88号', latitude: 31.23969, longitude: 121.49981, tags: ['金融区', '商务'] },
  { id: 'poi005', name: '上海浦东国际机场', address: '上海市浦东新区迎宾大道6000号', latitude: 31.14434, longitude: 121.8083, tags: ['机场', '国际'] },
  { id: 'poi006', name: '静安寺', address: '上海市静安区南京西路1686号', latitude: 31.22392, longitude: 121.4451, tags: ['热门', '商圈'] },
  { id: 'poi007', name: '深圳湾口岸', address: '广东省深圳市南山区东滨路', latitude: 22.50269, longitude: 113.94598, tags: ['国际', '口岸'] },
  { id: 'poi008', name: '香港国际机场', address: '中国香港大屿山翔天路1号', latitude: 22.308, longitude: 113.9185, tags: ['机场', '国际'] },
  { id: 'poi009', name: '澳门渔人码头', address: '中国澳门外港新填海区友谊大马路', latitude: 22.1959, longitude: 113.5582, tags: ['国际', '景点'] },
  { id: 'poi010', name: '上海交通大学闵行校区', address: '上海市闵行区东川路800号', latitude: 31.02355, longitude: 121.43308, tags: ['高校', '校园'] },
  { id: 'poi011', name: '苏州工业园区', address: '江苏省苏州市工业园区', latitude: 31.324, longitude: 120.7219, tags: ['跨城', '商务'] }
]

Object.assign(CITY_BY_ID, {
  poi101: '\u5eca\u574a\u5e02',
  poi102: '\u5eca\u574a\u5e02',
  poi103: '\u5eca\u574a\u5e02',
  poi104: '\u5eca\u574a\u5e02',
  poi105: '\u5eca\u574a\u5e02',
  poi106: '\u5eca\u574a\u5e02',
  poi107: '\u5eca\u574a\u5e02',
  poi108: '\u5eca\u574a\u5e02',
  poi109: '\u5eca\u574a\u5e02',
  poi110: '\u5eca\u574a\u5e02',
  poi111: '\u5eca\u574a\u5e02',
  poi112: '\u5eca\u574a\u5e02',
  poi113: '\u5eca\u574a\u5e02',
  poi114: '\u5eca\u574a\u5e02',
  poi115: '\u5eca\u574a\u5e02',
  poi001: '\u4e0a\u6d77\u5e02',
  poi002: '\u4e0a\u6d77\u5e02',
  poi003: '\u4e0a\u6d77\u5e02',
  poi004: '\u4e0a\u6d77\u5e02',
  poi005: '\u4e0a\u6d77\u5e02',
  poi006: '\u4e0a\u6d77\u5e02',
  poi007: '\u6df1\u5733\u5e02',
  poi008: '\u9999\u6e2f\u7279\u522b\u884c\u653f\u533a',
  poi009: '\u6fb3\u95e8\u7279\u522b\u884c\u653f\u533a',
  poi010: '\u4e0a\u6d77\u5e02',
  poi011: '\u82cf\u5dde\u5e02'
})

LOCAL_POI_LIBRARY.push(
  { id: 'poi111', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u8fce\u5bbe\u5317\u8def45\u53f7', latitude: 39.98115, longitude: 117.07878, tags: ['\u9ad8\u6821', '\u6821\u56ed', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] },
  { id: 'poi112', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662-\u56fe\u4e66\u9986', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u71d5\u4eac\u7406\u5de5\u5b66\u9662\u6821\u5185', latitude: 39.98162, longitude: 117.07932, tags: ['\u9ad8\u6821', '\u56fe\u4e66\u9986', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] },
  { id: 'poi113', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662-\u4f53\u80b2\u9986', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u71d5\u4eac\u7406\u5de5\u5b66\u9662\u6821\u5185', latitude: 39.98062, longitude: 117.07812, tags: ['\u9ad8\u6821', '\u4f53\u80b2\u9986', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] },
  { id: 'poi114', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662-\u4e1c\u95e8', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u8fce\u5bbe\u5317\u8def', latitude: 39.98142, longitude: 117.08018, tags: ['\u9ad8\u6821', '\u6821\u95e8', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] },
  { id: 'poi115', name: '\u71d5\u4eac\u7406\u5de5\u5b66\u9662-\u751f\u6d3b\u670d\u52a1\u4e2d\u5fc3', address: '\u6cb3\u5317\u7701\u5eca\u574a\u5e02\u4e09\u6cb3\u5e02\u71d5\u90ca\u7ecf\u6d4e\u6280\u672f\u5f00\u53d1\u533a\u71d5\u4eac\u7406\u5de5\u5b66\u9662\u6821\u5185', latitude: 39.98096, longitude: 117.07956, tags: ['\u9ad8\u6821', '\u751f\u6d3b\u670d\u52a1', '\u71d5\u4eac\u7406\u5de5\u5b66\u9662'] }
)

let osmUnavailableUntil = 0
const osmReverseCache = {}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function outOfChina(latitude, longitude) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function transformLatitude(longitude, latitude) {
  let result = -100.0 + (2.0 * longitude) + (3.0 * latitude) + (0.2 * latitude * latitude) +
    (0.1 * longitude * latitude) + (0.2 * Math.sqrt(Math.abs(longitude)))
  result += ((20.0 * Math.sin(6.0 * longitude * Math.PI)) + (20.0 * Math.sin(2.0 * longitude * Math.PI))) * 2.0 / 3.0
  result += ((20.0 * Math.sin(latitude * Math.PI)) + (40.0 * Math.sin(latitude / 3.0 * Math.PI))) * 2.0 / 3.0
  result += ((160.0 * Math.sin(latitude / 12.0 * Math.PI)) + (320 * Math.sin(latitude * Math.PI / 30.0))) * 2.0 / 3.0
  return result
}

function transformLongitude(longitude, latitude) {
  let result = 300.0 + longitude + (2.0 * latitude) + (0.1 * longitude * longitude) +
    (0.1 * longitude * latitude) + (0.1 * Math.sqrt(Math.abs(longitude)))
  result += ((20.0 * Math.sin(6.0 * longitude * Math.PI)) + (20.0 * Math.sin(2.0 * longitude * Math.PI))) * 2.0 / 3.0
  result += ((20.0 * Math.sin(longitude * Math.PI)) + (40.0 * Math.sin(longitude / 3.0 * Math.PI))) * 2.0 / 3.0
  result += ((150.0 * Math.sin(longitude / 12.0 * Math.PI)) + (300.0 * Math.sin(longitude / 30.0 * Math.PI))) * 2.0 / 3.0
  return result
}

function wgs84ToGcj02(latitude, longitude) {
  const lat = toNumber(latitude)
  const lng = toNumber(longitude)
  if (outOfChina(lat, lng)) {
    return {
      latitude: lat,
      longitude: lng
    }
  }

  let dLat = transformLatitude(lng - 105.0, lat - 35.0)
  let dLng = transformLongitude(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((EARTH_A * (1 - EE)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180.0) / (EARTH_A / sqrtMagic * Math.cos(radLat) * Math.PI)

  return {
    latitude: lat + dLat,
    longitude: lng + dLng
  }
}

function gcj02ToWgs84(latitude, longitude) {
  const lat = toNumber(latitude)
  const lng = toNumber(longitude)
  if (outOfChina(lat, lng)) {
    return {
      latitude: lat,
      longitude: lng
    }
  }

  const converted = wgs84ToGcj02(lat, lng)
  return {
    latitude: lat * 2 - converted.latitude,
    longitude: lng * 2 - converted.longitude
  }
}

function formatDistanceText(distanceKm) {
  const numeric = toNumber(distanceKm)
  if (numeric <= 0) return '附近'
  if (numeric < 1) {
    const meters = Math.max(50, Math.round(numeric * 1000))
    return `${meters}m`
  }
  return `${numeric.toFixed(1)}km`
}

function getCityByPointId(point = {}) {
  return point.city || CITY_BY_ID[point.id] || ''
}

function getNearestLocalPoi(point = {}) {
  const latitude = toNumber(
    point.latitude !== undefined ? point.latitude : point.location && point.location.lat,
    NaN
  )
  const longitude = toNumber(
    point.longitude !== undefined ? point.longitude : point.location && point.location.lng,
    NaN
  )

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  return LOCAL_POI_LIBRARY.reduce((best, item) => {
    const distanceKm = getDistanceKm(
      { latitude, longitude },
      item
    )
    if (!best || distanceKm < best.distanceKm) {
      return {
        item,
        distanceKm
      }
    }
    return best
  }, null)
}

function getLocalPoiCandidates(point = {}, maxDistanceKm = Infinity) {
  const latitude = toNumber(
    point.latitude !== undefined ? point.latitude : point.location && point.location.lat,
    NaN
  )
  const longitude = toNumber(
    point.longitude !== undefined ? point.longitude : point.location && point.location.lng,
    NaN
  )

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return []
  }

  return LOCAL_POI_LIBRARY
    .map((item) => ({
      item,
      distanceKm: getDistanceKm({ latitude, longitude }, item)
    }))
    .filter((item) => item.distanceKm <= toNumber(maxDistanceKm, Infinity))
}

function getPoiClusterKey(item = {}) {
  const tags = Array.isArray(item.tags)
    ? item.tags.map((tag) => `${tag || ''}`.trim()).filter((tag) => tag.length >= 4)
    : []

  if (tags.length) {
    return tags[0]
  }

  return `${item.name || ''}`.split(/[-(（]/)[0].trim()
}

function getBestLocalPoiMatch(point = {}, maxDistanceKm = MAP_PICKER_POI_MATCH_DISTANCE_KM) {
  const candidates = getLocalPoiCandidates(point, maxDistanceKm)
  if (!candidates.length) {
    return null
  }

  return candidates.reduce((best, current) => {
    const clusterKey = getPoiClusterKey(current.item)
    const clusterCount = clusterKey
      ? candidates.filter((item) => getPoiClusterKey(item.item) === clusterKey).length
      : 1
    const clusterBonus = Math.min(0.24, Math.max(0, clusterCount - 1) * 0.08)
    const exactNameBonus = current.item.name === clusterKey ? 0.03 : 0
    const score = current.distanceKm - clusterBonus - exactNameBonus

    if (!best || score < best.score || (score === best.score && current.distanceKm < best.distanceKm)) {
      return {
        ...current,
        score
      }
    }

    return best
  }, null)
}

function shouldUseExactPoi(distanceKm) {
  return toNumber(distanceKm, 9999) <= EXACT_POI_MATCH_DISTANCE_KM
}

function shouldUseMapPickerPoi(distanceKm) {
  return toNumber(distanceKm, 9999) <= MAP_PICKER_POI_MATCH_DISTANCE_KM
}

function shouldUseNearestPoiBySource(source, distanceKm) {
  if (source === 'map' || source === 'currentLocation' || source === 'nearby') {
    return shouldUseMapPickerPoi(distanceKm)
  }
  return shouldUseExactPoi(distanceKm)
}

function buildApproximateAddress(point = {}, nearest) {
  const matched = nearest || getBestLocalPoiMatch(point) || getNearestLocalPoi(point)
  if (matched && shouldUseMapPickerPoi(matched.distanceKm)) {
    return `${matched.item.name}附近`
  }

  const city = getCityByPointId(point) || guessCity(point)
  return city ? `${city}附近` : '系统定位到的当前位置'
}

function buildNearestPoiPoint(selectedPoint = {}, nearest, options = {}) {
  if (!nearest || !nearest.item) {
    return null
  }

  const source = options.source || 'map'
  return normalizeAddressPoint({
    ...nearest.item,
    latitude: toNumber(selectedPoint.latitude, nearest.item.latitude),
    longitude: toNumber(selectedPoint.longitude, nearest.item.longitude),
    source
  })
}

function isSameAddressEntity(left, right) {
  if (!left || !right) return false

  const normalizedLeft = normalizeAddressPoint(left)
  const normalizedRight = normalizeAddressPoint(right)

  if (normalizedLeft.id && normalizedRight.id) {
    return normalizedLeft.id === normalizedRight.id
  }

  return normalizedLeft.name === normalizedRight.name &&
    normalizedLeft.address === normalizedRight.address
}

function guessCity(point = {}) {
  if (point.city) return point.city
  if (point.ad_info && point.ad_info.city) return point.ad_info.city

  const text = `${point.name || ''}${point.title || ''}${point.address || ''}${point.addr || ''}`
  if (text.includes('上海')) return '上海市'
  if (text.includes('北京')) return '北京市'
  if (text.includes('深圳')) return '深圳市'
  if (text.includes('香港')) return '香港特别行政区'
  if (text.includes('澳门')) return '澳门特别行政区'
  if (text.includes('苏州')) return '苏州市'

  const nearest = getNearestLocalPoi(point)
  if (nearest && nearest.distanceKm <= CITY_INFER_DISTANCE_KM) {
    const inferredCity = getCityByPointId(nearest.item)
    if (inferredCity) return inferredCity
  }

  return CITY_BY_ID[point.id] || DEFAULT_CITY
}

function normalizeAddressPoint(source = {}, extra = {}) {
  const latitude = toNumber(
    source.latitude !== undefined ? source.latitude : source.location && source.location.lat,
    toNumber(extra.latitude, DEFAULT_LOCATION.latitude)
  )
  const longitude = toNumber(
    source.longitude !== undefined ? source.longitude : source.location && source.location.lng,
    toNumber(extra.longitude, DEFAULT_LOCATION.longitude)
  )
  const name = source.name || source.title || source.address || extra.name || '地图选点'
  const address = source.address || source.addr || source.name || source.title || extra.address || '已选择地址'
  const city = source.city || source.ad_info && source.ad_info.city || extra.city || guessCity(source)
  const district = source.district || source.ad_info && source.ad_info.district || extra.district || ''

  return {
    id: source.id || source.uid || extra.id || createId('addr-'),
    name,
    address,
    latitude,
    longitude,
    city,
    district,
    source: source.source || extra.source || 'manual',
    tags: Array.isArray(source.tags) ? source.tags.slice() : [],
    raw: source.raw || extra.raw || null
  }
}

function attachDistanceMeta(point, currentLocation) {
  const normalized = normalizeAddressPoint(point)
  const hasCurrentLocation = currentLocation &&
    currentLocation.latitude !== undefined &&
    currentLocation.longitude !== undefined
  const distanceKm = hasCurrentLocation ? getDistanceKm(currentLocation, normalized) : 0

  return {
    ...normalized,
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceText: formatDistanceText(distanceKm)
  }
}

function sortByDistance(list = []) {
  return list.slice().sort((left, right) => {
    return toNumber(left.distanceKm, 9999) - toNumber(right.distanceKm, 9999)
  })
}

function getKeywordScore(point, keyword) {
  const normalized = normalizeAddressPoint(point)
  const target = `${keyword || ''}`.trim().toLowerCase()
  if (!target) return 0

  const name = `${normalized.name || ''}`.toLowerCase()
  const address = `${normalized.address || ''}`.toLowerCase()
  const tags = Array.isArray(normalized.tags) ? normalized.tags.join(',').toLowerCase() : ''
  let score = 0

  if (name === target) score += 120
  if (name.startsWith(target)) score += 80
  if (name.includes(target)) score += 50
  if (address.startsWith(target)) score += 36
  if (address.includes(target)) score += 18
  if (tags.includes(target)) score += 12

  return score
}

function sortByKeywordAndDistance(list = [], keyword) {
  return list.slice().sort((left, right) => {
    const scoreDiff = getKeywordScore(right, keyword) - getKeywordScore(left, keyword)
    if (scoreDiff !== 0) return scoreDiff
    return toNumber(left.distanceKm, 9999) - toNumber(right.distanceKm, 9999)
  })
}

function dedupeAddressList(list = []) {
  const cache = {}
  return list.filter((item) => {
    const normalized = normalizeAddressPoint(item)
    const key = [
      normalized.name,
      normalized.address,
      normalized.latitude.toFixed(6),
      normalized.longitude.toFixed(6)
    ].join('|')

    if (cache[key]) return false
    cache[key] = true
    return true
  })
}

function paginate(list = [], pageIndex = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const normalizedPage = Math.max(1, Number(pageIndex || 1))
  const normalizedPageSize = Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE))
  const start = (normalizedPage - 1) * normalizedPageSize
  const end = start + normalizedPageSize
  return {
    list: list.slice(start, end),
    hasMore: end < list.length,
    total: list.length,
    pageIndex: normalizedPage,
    pageSize: normalizedPageSize
  }
}

function buildLocalPoiList(currentLocation, keyword) {
  const target = `${keyword || ''}`.trim().toLowerCase()
  const source = target
    ? LOCAL_POI_LIBRARY.filter((item) => `${item.name}${item.address}${(item.tags || []).join(',')}`.toLowerCase().includes(target))
    : LOCAL_POI_LIBRARY.slice()

  const list = source.map((item) => attachDistanceMeta(item, currentLocation || DEFAULT_LOCATION))
  return target ? sortByKeywordAndDistance(list, target) : sortByDistance(list)
}

function filterNearbyListByRadius(list = [], radiusMeters = DEFAULT_RADIUS, fallbackRadiusKm = LOCAL_NEARBY_FALLBACK_RADIUS_KM) {
  const radiusKm = Math.max(Number(radiusMeters || DEFAULT_RADIUS) / 1000, fallbackRadiusKm)
  return list.filter((item) => toNumber(item.distanceKm, 9999) <= radiusKm)
}

function searchAddressLibrary(keyword, currentLocation) {
  return buildLocalPoiList(currentLocation, keyword)
}

function groupAddressesByCity(list = []) {
  const groups = list.reduce((result, item) => {
    const city = item.city || guessCity(item)
    if (!result[city]) {
      result[city] = []
    }
    result[city].push(item)
    return result
  }, {})

  return Object.keys(groups)
    .map((city) => ({
      city,
      items: sortByDistance(groups[city])
    }))
    .sort((left, right) => {
      return toNumber(left.items[0] && left.items[0].distanceKm, 9999) - toNumber(right.items[0] && right.items[0].distanceKm, 9999)
    })
}

function getFavoriteAddresses(currentLocation) {
  return FAVORITE_POI_IDS
    .map((id) => LOCAL_POI_LIBRARY.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      ...attachDistanceMeta(item, currentLocation || DEFAULT_LOCATION),
      favorite: true
    }))
}

function buildCurrentLocationPoint(location, extra = {}) {
  return normalizeAddressPoint({
    id: 'current-location',
    name: extra.name || '我的位置',
    address: extra.address || '系统定位到的当前位置',
    latitude: location.latitude,
    longitude: location.longitude,
    city: extra.city || guessCity(location),
    district: extra.district || '',
    source: 'currentLocation'
  })
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

function hasMapServiceKey() {
  return Boolean(getMapServiceKey())
}

function isTencentWebServiceUnavailable(error) {
  const code = error && error.code !== undefined ? Number(error.code) : NaN
  const message = error && error.message ? `${error.message}` : ''
  return code === 199 ||
    error && error.code === 'MAP_KEY_MISSING' ||
    /WebserviceAPI|未开启WebserviceAPI|未配置腾讯地图/i.test(message)
}

function requestTencentMap(path, params = {}) {
  const key = getMapServiceKey()
  if (!key) {
    return Promise.reject({
      code: 'MAP_KEY_MISSING',
      message: '未配置腾讯地图 Key'
    })
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://apis.map.qq.com${path}`,
      method: 'GET',
      timeout: 8000,
      data: {
        ...params,
        key
      },
      success: (response) => {
        const payload = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300 && Number(payload.status) === 0) {
          resolve(payload)
          return
        }

        reject({
          code: payload.status || response.statusCode || 'MAP_REQUEST_FAILED',
          message: payload.message || '腾讯地图服务请求失败',
          raw: payload
        })
      },
      fail: reject
    })
  })
}

function requestExternalMap(url, params = {}) {
  if (url && url.indexOf('nominatim.openstreetmap.org') !== -1 && Date.now() < osmUnavailableUntil) {
    return Promise.reject({
      code: 'OSM_RATE_LIMITED',
      message: '开放地图服务请求过于频繁，请稍后再试'
    })
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 2500,
      data: params,
      success: (response) => {
        if (Number(response.statusCode) === 429 && url && url.indexOf('nominatim.openstreetmap.org') !== -1) {
          osmUnavailableUntil = Date.now() + OSM_RATE_LIMIT_COOLDOWN_MS
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }

        reject({
          code: response.statusCode || 'EXTERNAL_MAP_FAILED',
          message: '外部地理服务请求失败',
          raw: response.data
        })
      },
      fail: reject
    })
  })
}

function settleRequests(tasks = []) {
  return Promise.all(tasks.map((task) => {
    return task
      .then((value) => ({ ok: true, value }))
      .catch((error) => ({ ok: false, error }))
  }))
}

function extractOpenStreetMapName(item = {}) {
  const address = item.address || {}
  return item.name ||
    address.amenity ||
    address.building ||
    address.attraction ||
    address.shop ||
    address.tourism ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.village ||
    address.town ||
    address.city ||
    `${item.display_name || ''}`.split(',')[0].trim() ||
    '地图选点'
}

function buildOpenStreetMapAddress(item = {}) {
  const address = item.address || {}
  if (item.display_name) {
    return `${item.display_name}`
  }

  return [
    address.road,
    address.neighbourhood || address.suburb || address.city_district,
    address.city || address.town || address.village || address.county,
    address.state
  ].filter(Boolean).join(', ') || extractOpenStreetMapName(item)
}

function normalizeOpenStreetMapPoi(item, currentLocation, source) {
  const coordinate = wgs84ToGcj02(item.lat, item.lon)
  const address = item.address || {}
  const normalized = normalizeAddressPoint({
    id: item.place_id || item.osm_id || item.osm_type,
    name: extractOpenStreetMapName(item),
    address: buildOpenStreetMapAddress(item),
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    city: address.city || address.town || address.village || address.county || address.state,
    district: address.suburb || address.neighbourhood || address.city_district || address.county,
    source
  })

  return {
    ...attachDistanceMeta(normalized, currentLocation),
    raw: item
  }
}

function buildSearchBiasKeywords(currentLocation, keyword) {
  const trimmedKeyword = `${keyword || ''}`.trim()
  return trimmedKeyword ? [trimmedKeyword] : []
}

function searchOpenStreetMapCandidates(keyword, currentLocation, options = {}) {
  const pageSize = Math.max(1, Number(options.pageSize || DEFAULT_PAGE_SIZE))
  const keywords = buildSearchBiasKeywords(currentLocation, keyword)

  const tasks = keywords.slice(0, 3).map((item) => requestExternalMap(OSM_SEARCH_ENDPOINT, {
    q: item,
    format: 'jsonv2',
    addressdetails: 1,
    limit: pageSize,
    'accept-language': 'zh-CN,zh'
  }))

  return settleRequests(tasks).then((results) => {
    const responses = results
      .filter((item) => item.ok)
      .map((item) => item.value)
    if (!responses.length) {
      return Promise.reject({
        code: 'OSM_SEARCH_EMPTY',
        message: '开放地图搜索失败'
      })
    }
    const merged = dedupeAddressList(
      [].concat(...responses.map((items) => items || []))
        .map((item) => normalizeOpenStreetMapPoi(item, currentLocation, 'osm-search'))
    )
    const list = sortByKeywordAndDistance(merged, keyword).slice(0, pageSize)
    return {
      list,
      hasMore: false,
      total: list.length,
      source: 'osm'
    }
  })
}

function searchTencentSuggestionCandidates(keyword, currentLocation, options = {}) {
  const pageSize = Math.max(1, Number(options.pageSize || DEFAULT_PAGE_SIZE))
  const params = {
    keyword,
    page_size: pageSize,
    page_index: Math.max(1, Number(options.pageIndex || 1))
  }

  return requestTencentMap('/ws/place/v1/suggestion', params)
    .then((payload) => {
      const list = sortByKeywordAndDistance(
        dedupeAddressList((payload.data || []).map((item) => normalizeTencentPoi(item, currentLocation, 'search'))),
        keyword
      )
      return {
        list,
        hasMore: list.length >= pageSize,
        total: Number(payload.count || list.length),
        source: 'tencent'
      }
    })
}

function reverseOpenStreetMap(latitude, longitude, options = {}) {
  const point = gcj02ToWgs84(latitude, longitude)
  const cacheKey = [
    Number(point.latitude).toFixed(5),
    Number(point.longitude).toFixed(5),
    options.source || 'map'
  ].join('|')

  if (osmReverseCache[cacheKey]) {
    return Promise.resolve({
      ...osmReverseCache[cacheKey]
    })
  }

  return requestExternalMap(OSM_REVERSE_ENDPOINT, {
    lat: point.latitude,
    lon: point.longitude,
    format: 'jsonv2',
    addressdetails: 1,
    zoom: 18,
    'accept-language': 'zh-CN,zh'
  }).then((item) => {
    const normalized = normalizeOpenStreetMapPoi(item, options.currentLocation, options.source || 'map')
    osmReverseCache[cacheKey] = normalized
    return {
      ...normalized
    }
  })
}

function buildNearbyViewbox(point, radiusMeters = 1200) {
  const latitudeDelta = radiusMeters / 111000
  const longitudeDelta = radiusMeters / (111000 * Math.max(Math.cos(toNumber(point.latitude) * Math.PI / 180), 0.2))
  const minLat = toNumber(point.latitude) - latitudeDelta
  const maxLat = toNumber(point.latitude) + latitudeDelta
  const minLon = toNumber(point.longitude) - longitudeDelta
  const maxLon = toNumber(point.longitude) + longitudeDelta
  return `${minLon},${maxLat},${maxLon},${minLat}`
}

function fetchOpenStreetMapNearbyCandidates(currentLocation, options = {}) {
  const location = currentLocation || DEFAULT_LOCATION

  return reverseOpenStreetMap(location.latitude, location.longitude, {
    currentLocation: location,
    source: 'osm-nearby'
  }).then((anchorPoint) => {
    const rawAddress = anchorPoint.raw && anchorPoint.raw.address ? anchorPoint.raw.address : {}
    const candidates = [
      rawAddress.road,
      rawAddress.neighbourhood,
      rawAddress.suburb,
      rawAddress.city_district,
      rawAddress.town,
      rawAddress.city,
      anchorPoint.name
    ].filter(Boolean)

    const tasks = Array.from(new Set(candidates)).slice(0, 3).map((keyword) => requestExternalMap(OSM_SEARCH_ENDPOINT, {
      q: keyword,
      format: 'jsonv2',
      addressdetails: 1,
      limit: Math.max(8, Number(options.pageSize || DEFAULT_PAGE_SIZE)),
      viewbox: buildNearbyViewbox(location, options.radius || 1200),
      bounded: 1,
      'accept-language': 'zh-CN,zh'
    }))

    return settleRequests(tasks).then((results) => {
      const responses = results
        .filter((item) => item.ok)
        .map((item) => item.value)
      const merged = dedupeAddressList(
        [anchorPoint].concat(
          [].concat(...responses.map((items) => items || []))
            .map((item) => normalizeOpenStreetMapPoi(item, location, 'osm-nearby'))
        )
      )
      const list = sortByDistance(merged).slice(0, Math.max(1, Number(options.pageSize || DEFAULT_PAGE_SIZE)))
      return {
        list,
        hasMore: false,
        total: list.length,
        source: 'osm'
      }
    })
  })
}

function normalizeTencentPoi(item, currentLocation, source) {
  const normalized = normalizeAddressPoint({
    id: item.id || item.uid,
    name: item.title || item.name,
    address: item.address || item.addr,
    location: item.location,
    city: item.ad_info && item.ad_info.city,
    district: item.ad_info && item.ad_info.district,
    source
  })
  const distanceKm = item._distance !== undefined
    ? Number(item._distance) / 1000
    : currentLocation ? getDistanceKm(currentLocation, normalized) : 0

  return {
    ...normalized,
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceText: formatDistanceText(distanceKm)
  }
}

function buildTencentReverseName(result = {}, firstPoi, options = {}) {
  const component = result.address_component || {}
  const roadText = [component.street, component.street_number].filter(Boolean).join('')
  const districtText = [component.district, roadText].filter(Boolean).join('')
  if (districtText) {
    return districtText
  }

  const cityText = [component.city, component.district].filter(Boolean).join('')
  if (cityText) {
    return cityText
  }

  if (options.name) {
    return options.name
  }

  return result.address || '地图选点'
}

function buildTencentAnchorPoint(location, result = {}, firstPoi, options = {}) {
  const component = result.address_component || {}
  const source = options.source || 'map'

  return normalizeAddressPoint({
    id: createId('geo-'),
    name: buildTencentReverseName(result, firstPoi, options),
    address: result.address || options.address || buildApproximateAddress(location),
    latitude: location.latitude,
    longitude: location.longitude,
    city: component.city,
    district: component.district,
    source,
    raw: result
  })
}

function buildLocalNearbyResult(currentLocation, options = {}) {
  const nearbyList = filterNearbyListByRadius(
    buildLocalPoiList(currentLocation || DEFAULT_LOCATION, ''),
    options.radius,
    LOCAL_NEARBY_FALLBACK_RADIUS_KM
  )
  const filteredNearbyList = options.anchorPoint
    ? nearbyList.filter((item) => !isSameAddressEntity(item, options.anchorPoint))
    : nearbyList
  const seedList = options.anchorPoint ? [options.anchorPoint].concat(filteredNearbyList) : filteredNearbyList
  const normalizedList = sortByDistance(dedupeAddressList(seedList))
  const pageData = paginate(normalizedList, options.pageIndex, options.pageSize)
  return {
    list: pageData.list,
    hasMore: pageData.hasMore,
    total: pageData.total,
    source: 'local'
  }
}

function buildLocalSearchResult(keyword, currentLocation, options = {}) {
  const list = buildLocalPoiList(currentLocation || DEFAULT_LOCATION, keyword)
  const pageData = paginate(list, options.pageIndex, options.pageSize)
  return {
    list: pageData.list,
    hasMore: pageData.hasMore,
    total: pageData.total,
    source: 'local'
  }
}

function fetchNearbyAddressCandidates(currentLocation, options = {}) {
  const location = currentLocation || DEFAULT_LOCATION
  const pageIndex = Math.max(1, Number(options.pageIndex || 1))
  const pageSize = Math.max(1, Number(options.pageSize || DEFAULT_PAGE_SIZE))
  const fallbackAnchorPoint = options.anchorPoint
    ? attachDistanceMeta(options.anchorPoint, location)
    : attachDistanceMeta(resolvePointFromCoordinateSync(location.latitude, location.longitude, location, {
        source: 'map'
      }), location)

  if (!hasMapServiceKey()) {
    return Promise.resolve(buildLocalNearbyResult(location, {
      pageIndex,
      pageSize,
      radius: options.radius,
      anchorPoint: fallbackAnchorPoint
    }))
  }

  return requestTencentMap('/ws/geocoder/v1/', {
    location: `${location.latitude},${location.longitude}`,
    get_poi: 1,
    poi_options: `policy=2;radius=${options.radius || DEFAULT_RADIUS};page_size=${pageSize};page_index=${pageIndex}`
  })
    .then((payload) => {
      const result = payload.result || {}
      const pois = Array.isArray(result.pois) ? result.pois : []
      const anchorPoint = attachDistanceMeta(
        buildTencentAnchorPoint(location, result, null, {
          source: 'map'
        }),
        location
      )
      const list = sortByDistance(dedupeAddressList([
        anchorPoint
      ].concat(pois.map((item) => normalizeTencentPoi(item, location, 'nearby')))))
      return {
        list,
        hasMore: list.length >= pageSize,
        total: list.length,
        source: 'tencent',
        city: result.address_component && result.address_component.city
      }
    })
    .catch(() => {
      return buildLocalNearbyResult(location, {
        pageIndex,
        pageSize,
        radius: options.radius,
        anchorPoint: fallbackAnchorPoint
      })
    })
}

function searchAddressCandidates(keyword, currentLocation, options = {}) {
  const trimmedKeyword = `${keyword || ''}`.trim()
  const location = currentLocation || DEFAULT_LOCATION
  const pageIndex = Math.max(1, Number(options.pageIndex || 1))
  const pageSize = Math.max(1, Number(options.pageSize || DEFAULT_PAGE_SIZE))

  if (!trimmedKeyword) {
    return fetchNearbyAddressCandidates(location, { pageIndex, pageSize })
  }

  if (!hasMapServiceKey()) {
    return Promise.resolve(buildLocalSearchResult(trimmedKeyword, location, { pageIndex, pageSize }))
  }

  return searchTencentSuggestionCandidates(trimmedKeyword, location, {
    pageIndex,
    pageSize
  }).catch((error) => {
    if (isTencentWebServiceUnavailable(error)) {
      return buildLocalSearchResult(trimmedKeyword, location, { pageIndex, pageSize })
    }

    return searchOpenStreetMapCandidates(trimmedKeyword, location, {
      pageIndex,
      pageSize
    }).catch(() => buildLocalSearchResult(trimmedKeyword, location, { pageIndex, pageSize }))
  })
}

function reverseGeocode(latitude, longitude, options = {}) {
  const location = {
    latitude: toNumber(latitude, DEFAULT_LOCATION.latitude),
    longitude: toNumber(longitude, DEFAULT_LOCATION.longitude)
  }

  if (!hasMapServiceKey()) {
    const fallback = resolvePointFromCoordinateSync(location.latitude, location.longitude, options.currentLocation, options)
    return Promise.resolve({
      ...fallback,
      source: options.source || fallback.source
    })
  }

  return requestTencentMap('/ws/geocoder/v1/', {
    location: `${location.latitude},${location.longitude}`,
    get_poi: 1,
    poi_options: 'policy=2;radius=300;page_size=5;page_index=1'
  })
    .then((payload) => {
      const result = payload.result || {}
      const firstPoi = Array.isArray(result.pois) && result.pois.length
        ? normalizeTencentPoi(result.pois[0], location, options.source || 'map')
        : null
      return buildTencentAnchorPoint(location, result, firstPoi, options)
    })
    .catch((error) => {
      if (isTencentWebServiceUnavailable(error)) {
        const fallback = resolvePointFromCoordinateSync(location.latitude, location.longitude, options.currentLocation, options)
        return {
          ...fallback,
          source: options.source || fallback.source
        }
      }

      return reverseOpenStreetMap(location.latitude, location.longitude, {
        currentLocation: location,
        source: options.source || 'map'
      }).catch(() => {
        const fallback = resolvePointFromCoordinateSync(location.latitude, location.longitude, options.currentLocation, options)
        return {
          ...fallback,
          source: options.source || fallback.source
        }
      })
    })
}

function resolvePointFromCoordinateSync(latitude, longitude, currentLocation, options = {}) {
  const selected = {
    latitude: toNumber(latitude),
    longitude: toNumber(longitude)
  }

  const source = options.source || 'map'
  const nearest = source === 'map' || source === 'currentLocation' || source === 'nearby'
    ? getBestLocalPoiMatch(selected, MAP_PICKER_POI_MATCH_DISTANCE_KM) || getNearestLocalPoi(selected)
    : getNearestLocalPoi(selected)
  const useNearest = nearest && shouldUseNearestPoiBySource(source, nearest.distanceKm)
  const basePoint = useNearest
    ? buildNearestPoiPoint(selected, nearest, { source })
    : {
        id: createId('map-'),
        name: options.name || (source === 'currentLocation' ? '我的位置' : '地图选点'),
        address: buildApproximateAddress(selected, nearest),
        latitude: selected.latitude,
        longitude: selected.longitude,
        city: guessCity(selected),
        source
      }

  return attachDistanceMeta(basePoint, currentLocation)
}

function resolvePointFromCoordinate(latitude, longitude, currentLocation) {
  return reverseGeocode(latitude, longitude, {
    currentLocation,
    source: 'map'
  })
}

function withLocationPermission(operation, options = {}) {
  return new Promise((resolve, reject) => {
    operation({
      success: resolve,
      fail: (error) => {
        const message = error && error.errMsg ? error.errMsg : ''
        const permissionDenied = /auth deny|auth denied|authorize no response|permission denied/i.test(message)

        if (!permissionDenied || options.silent) {
          reject(error)
          return
        }

        wx.showModal({
          title: '需要定位权限',
          content: '开启定位权限后，才能获取附近地址、我的位置和地图选点能力。',
          confirmText: '去开启',
          cancelText: '暂不',
          success: (modalResult) => {
            if (!modalResult.confirm) {
              reject(error)
              return
            }

            wx.openSetting({
              success: (settingResult) => {
                if (settingResult.authSetting && settingResult.authSetting['scope.userLocation']) {
                  resolve({ reopened: true })
                  return
                }

                reject(error)
              },
              fail: reject
            })
          },
          fail: reject
        })
      }
    })
  })
}

function getUserLocation(options = {}) {
  return withLocationPermission((callbacks) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
      ...callbacks
    })
  }, options)
}

function getResolvedCurrentLocation(options = {}) {
  return getUserLocation(options).then((location) => {
    if (location && location.reopened) {
      return getResolvedCurrentLocation({ silent: true })
    }

    return reverseGeocode(location.latitude, location.longitude, {
      currentLocation: location,
      source: 'currentLocation',
      name: '我的位置'
    }).then((point) => {
      const resolvedName = point && point.name && point.name !== '地图选点'
        ? point.name
        : '我的位置'
      return buildCurrentLocationPoint(location, {
        name: resolvedName,
        address: point.address || buildApproximateAddress(location),
        city: point.city,
        district: point.district
      })
    }).catch(() => buildCurrentLocationPoint(location))
  })
}

module.exports = {
  attachDistanceMeta,
  buildCurrentLocationPoint,
  fetchNearbyAddressCandidates,
  formatDistanceText,
  getFavoriteAddresses,
  hasMapServiceKey,
  getResolvedCurrentLocation,
  getUserLocation,
  groupAddressesByCity,
  guessCity,
  normalizeAddressPoint,
  resolvePointFromCoordinate,
  reverseGeocode,
  searchAddressCandidates,
  searchAddressLibrary,
  withLocationPermission
}
