const { ORDER_STATUS } = require('./constants')

const SPEED_KM_PER_MINUTE = 1.5
const SECONDS_PER_KM = 60 / SPEED_KM_PER_MINUTE

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? fallback : numeric
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function toDegrees(value) {
  return (value * 180) / Math.PI
}

function parseTime(value) {
  if (!value) return 0
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    const timestamp = new Date(year, (month || 1) - 1, day || 1, hour, minute, second).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }
  const text = String(value)
  const timestamp = new Date(text).getTime()
  if (!Number.isNaN(timestamp)) return timestamp
  const fallbackTimestamp = new Date(text.replace(/-/g, '/')).getTime()
  return Number.isNaN(fallbackTimestamp) ? 0 : fallbackTimestamp
}

function hashString(value) {
  let hash = 2166136261
  const text = String(value || 'trip-simulator')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed) {
  let state = seed >>> 0 || 1
  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
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

function getBearing(start, end) {
  const startLat = toRadians(start.latitude)
  const endLat = toRadians(end.latitude)
  const deltaLng = toRadians(end.longitude - start.longitude)
  const y = Math.sin(deltaLng) * Math.cos(endLat)
  const x = Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function interpolatePoint(start, end, ratio) {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * ratio,
    longitude: start.longitude + (end.longitude - start.longitude) * ratio
  }
}

function offsetPoint(point, distanceKm, bearingDeg) {
  const bearing = toRadians(bearingDeg)
  const latitudeOffset = (distanceKm * Math.cos(bearing)) / 111
  const longitudeFactor = 111 * Math.cos(toRadians(point.latitude)) || 111
  const longitudeOffset = (distanceKm * Math.sin(bearing)) / longitudeFactor
  return {
    latitude: point.latitude + latitudeOffset,
    longitude: point.longitude + longitudeOffset
  }
}

function normalizePoint(source = {}) {
  return {
    latitude: toNumber(source.latitude || source.startLat || source.endLat),
    longitude: toNumber(source.longitude || source.startLng || source.endLng)
  }
}

function createDriverSpawnPoint(start, seedKey) {
  const rng = createRandom(hashString(`${seedKey}:driver-spawn`))
  const distanceKm = 1 + rng()
  const bearing = rng() * 360
  return offsetPoint(start, distanceKm, bearing)
}

function createRoutePoints(start, end, seedKey, phase = 'trip') {
  const rng = createRandom(hashString(`${seedKey}:${phase}:route`))
  const distanceKm = Math.max(getDistanceKm(start, end), phase === 'approach' ? 0.9 : 1.2)
  const bearing = getBearing(start, end)
  const controlCount = phase === 'approach' ? 3 : 4
  const amplitudeKm = Math.min(Math.max(distanceKm * (phase === 'approach' ? 0.1 : 0.13), 0.06), phase === 'approach' ? 0.22 : 0.4)
  const anchors = [start]

  for (let index = 1; index <= controlCount; index += 1) {
    const ratio = index / (controlCount + 1)
    const basePoint = interpolatePoint(start, end, ratio)
    const lateralOffset = (rng() - 0.5) * 2 * amplitudeKm * (0.25 + Math.sin(Math.PI * ratio))
    const forwardOffset = (rng() - 0.5) * Math.min(distanceKm * 0.08, 0.12)
    let nextPoint = offsetPoint(basePoint, lateralOffset, bearing + 90)
    nextPoint = offsetPoint(nextPoint, forwardOffset, bearing)
    anchors.push(nextPoint)
  }

  anchors.push(end)

  const points = []
  const segmentCount = Math.max(4, Math.ceil(distanceKm * (phase === 'approach' ? 3.5 : 4.5)))
  for (let index = 0; index < anchors.length - 1; index += 1) {
    for (let step = 0; step < segmentCount; step += 1) {
      const ratio = step / segmentCount
      if (index > 0 && step === 0) continue
      const point = interpolatePoint(anchors[index], anchors[index + 1], ratio)
      points.push({
        latitude: Number(point.latitude.toFixed(6)),
        longitude: Number(point.longitude.toFixed(6))
      })
    }
  }

  points.push({
    latitude: Number(end.latitude.toFixed(6)),
    longitude: Number(end.longitude.toFixed(6))
  })

  return points
}

function buildSegments(points, seedKey, phase) {
  const rng = createRandom(hashString(`${seedKey}:${phase}:lights`))
  const segments = []
  let elapsedSeconds = 0
  let totalDistanceKm = 0

  for (let index = 1; index < points.length; index += 1) {
    const startPoint = points[index - 1]
    const endPoint = points[index]
    const distanceKm = getDistanceKm(startPoint, endPoint)
    const travelSeconds = distanceKm * SECONDS_PER_KM
    const moveStart = elapsedSeconds
    const moveEnd = moveStart + travelSeconds
    totalDistanceKm += distanceKm

    const looksLikeIntersection = index < points.length - 1 && (index % 4 === 0 || rng() < 0.18)
    const waitSeconds = looksLikeIntersection && rng() < 0.42 ? Math.round(18 + rng() * 47) : 0

    const waitStart = moveEnd
    const waitEnd = waitStart + waitSeconds
    segments.push({
      index,
      startPoint,
      endPoint,
      heading: getBearing(startPoint, endPoint),
      distanceKm,
      cumulativeStartKm: totalDistanceKm - distanceKm,
      cumulativeEndKm: totalDistanceKm,
      moveStart,
      moveEnd,
      waitStart,
      waitEnd,
      waitSeconds
    })
    elapsedSeconds = waitEnd
  }

  return {
    segments,
    totalDistanceKm,
    totalSeconds: elapsedSeconds
  }
}

function getApproachProgressCap(order = {}) {
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return 0.42
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return 0.88
  return 1
}

function locateOnRoute(route, elapsedSeconds) {
  const safeElapsed = clamp(elapsedSeconds, 0, route.totalSeconds)
  if (!route.segments.length) {
    const point = route.points[0] || { latitude: 0, longitude: 0 }
    return {
      currentPoint: point,
      heading: 0,
      progress: 0,
      traveledDistanceKm: 0,
      waitingRedLight: false,
      currentRedLightSeconds: 0
    }
  }

  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index]
    if (safeElapsed <= segment.moveEnd) {
      const ratio = segment.moveEnd === segment.moveStart
        ? 1
        : (safeElapsed - segment.moveStart) / (segment.moveEnd - segment.moveStart)
      const currentPoint = interpolatePoint(segment.startPoint, segment.endPoint, clamp(ratio, 0, 1))
      const traveledDistanceKm = segment.cumulativeStartKm + segment.distanceKm * clamp(ratio, 0, 1)
      return {
        currentPoint,
        heading: segment.heading,
        progress: route.totalDistanceKm ? traveledDistanceKm / route.totalDistanceKm : 0,
        traveledDistanceKm,
        waitingRedLight: false,
        currentRedLightSeconds: 0
      }
    }

    if (safeElapsed <= segment.waitEnd) {
      return {
        currentPoint: segment.endPoint,
        heading: segment.heading,
        progress: route.totalDistanceKm ? segment.cumulativeEndKm / route.totalDistanceKm : 1,
        traveledDistanceKm: segment.cumulativeEndKm,
        waitingRedLight: segment.waitSeconds > 0,
        currentRedLightSeconds: Math.max(0, Math.ceil(segment.waitEnd - safeElapsed)),
        waitSeconds: segment.waitSeconds
      }
    }
  }

  const lastSegment = route.segments[route.segments.length - 1]
  return {
    currentPoint: lastSegment.endPoint,
    heading: lastSegment.heading,
    progress: 1,
    traveledDistanceKm: route.totalDistanceKm,
    waitingRedLight: false,
    currentRedLightSeconds: 0
  }
}

function buildActiveRoutePoints(points, progress) {
  if (!points.length) return { traveledPoints: [], remainPoints: [] }
  const splitIndex = Math.min(points.length - 1, Math.max(1, Math.round((points.length - 1) * progress)))
  return {
    traveledPoints: points.slice(0, splitIndex + 1),
    remainPoints: points.slice(Math.max(0, splitIndex))
  }
}

function getApproachStartTime(order, route) {
  return parseTime(order.acceptedAt || order.updatedAt || order.createdAt) || (Date.now() - route.totalSeconds * 1000)
}

function getTripStartTime(order, approachRoute, tripRoute) {
  return parseTime(order.startedAt) ||
    (getApproachStartTime(order, approachRoute) + approachRoute.totalSeconds * 1000) ||
    (Date.now() - tripRoute.totalSeconds * 1000)
}

function formatTrafficText(waitingRedLight, seconds = 0) {
  return waitingRedLight ? `红灯等待中，约 ${Math.max(0, Math.ceil(seconds))} 秒后通行` : '按道路路线行驶中'
}

function createSimulation(order = {}, now = Date.now()) {
  const start = normalizePoint({
    latitude: order.startLat,
    longitude: order.startLng
  })
  const end = normalizePoint({
    latitude: order.endLat,
    longitude: order.endLng
  })
  const seedKey = `${order.id || order.orderNo || 'order'}`
  const driverStart = createDriverSpawnPoint(start, seedKey)
  const approachPoints = createRoutePoints(driverStart, start, seedKey, 'approach')
  const tripPoints = createRoutePoints(start, end, seedKey, 'trip')
  const approachRoute = {
    points: approachPoints,
    ...buildSegments(approachPoints, seedKey, 'approach')
  }
  const tripRoute = {
    points: tripPoints,
    ...buildSegments(tripPoints, seedKey, 'trip')
  }
  const phase = [ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED].includes(order.orderStatus) ? 'trip' : 'approach'
  const activeRoute = phase === 'trip' ? tripRoute : approachRoute
  const phaseStartTime = phase === 'trip'
    ? getTripStartTime(order, approachRoute, tripRoute)
    : getApproachStartTime(order, approachRoute)
  const finishedTime = parseTime(order.finishedAt)
  const rawElapsedSeconds = order.orderStatus === ORDER_STATUS.FINISHED && finishedTime
    ? Math.max(0, (finishedTime - phaseStartTime) / 1000)
    : Math.max(0, (now - phaseStartTime) / 1000)
  const progressCap = phase === 'approach' ? getApproachProgressCap(order) : 1
  const elapsedSeconds = Math.min(rawElapsedSeconds, activeRoute.totalSeconds * progressCap)
  const location = locateOnRoute(activeRoute, elapsedSeconds)
  const traveledDistanceKm = location.traveledDistanceKm
  const remainDistanceKm = Math.max(0, activeRoute.totalDistanceKm - traveledDistanceKm)
  const usedSeconds = Math.min(elapsedSeconds, activeRoute.totalSeconds)
  const remainingSeconds = Math.max(0, activeRoute.totalSeconds - usedSeconds)
  const routeSplit = buildActiveRoutePoints(activeRoute.points, location.progress)
  const percent = Math.round(location.progress * 100)

  return {
    phase,
    driverStart,
    approachRoute,
    tripRoute,
    activeRoute,
    currentPoint: location.currentPoint,
    heading: Number(location.heading.toFixed(1)),
    progress: location.progress,
    percent,
    traveledDistanceKm,
    remainDistanceKm,
    usedSeconds,
    remainingSeconds,
    totalSeconds: activeRoute.totalSeconds,
    waitingRedLight: location.waitingRedLight,
    currentRedLightSeconds: location.currentRedLightSeconds,
    trafficText: formatTrafficText(location.waitingRedLight, location.currentRedLightSeconds),
    speedKmh: location.waitingRedLight ? 0 : SPEED_KM_PER_MINUTE * 60,
    traveledPoints: routeSplit.traveledPoints,
    remainPoints: routeSplit.remainPoints
  }
}

module.exports = {
  createSimulation,
  getBearing,
  getDistanceKm
}
