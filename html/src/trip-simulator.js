const SPEED_KM_PER_MINUTE = 1.5
const SECONDS_PER_KM = 60 / SPEED_KM_PER_MINUTE
const ESTIMATED_WAIT_MINUTES = 3
const MINUTE_MS = 60 * 1000

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
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
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
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

export function getDistanceKm(start, end) {
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

export function getBearing(start, end) {
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
    latitude: toNumber(source.latitude ?? source.startLat ?? source.endLat),
    longitude: toNumber(source.longitude ?? source.startLng ?? source.endLng)
  }
}

function isUsablePoint(point) {
  return Boolean(
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  )
}

function normalizeRoutePoints(points = []) {
  return Array.isArray(points)
    ? points.map(normalizePoint).filter(isUsablePoint)
    : []
}

function createDriverSpawnPoint(start, seedKey) {
  const random = createRandom(hashString(`${seedKey}:driver-spawn`))
  return offsetPoint(start, 1 + random(), random() * 360)
}

function createRoutePoints(start, end, seedKey, phase = 'trip') {
  const random = createRandom(hashString(`${seedKey}:${phase}:route`))
  const distanceKm = Math.max(getDistanceKm(start, end), phase === 'approach' ? 0.9 : 1.2)
  const bearing = getBearing(start, end)
  const controlCount = phase === 'approach' ? 3 : 4
  const amplitudeKm = Math.min(
    Math.max(distanceKm * (phase === 'approach' ? 0.1 : 0.13), 0.06),
    phase === 'approach' ? 0.22 : 0.4
  )
  const anchors = [start]

  for (let index = 1; index <= controlCount; index += 1) {
    const ratio = index / (controlCount + 1)
    const basePoint = interpolatePoint(start, end, ratio)
    const lateralOffset = (random() - 0.5) * 2 * amplitudeKm * (0.25 + Math.sin(Math.PI * ratio))
    const forwardOffset = (random() - 0.5) * Math.min(distanceKm * 0.08, 0.12)
    let nextPoint = offsetPoint(basePoint, lateralOffset, bearing + 90)
    nextPoint = offsetPoint(nextPoint, forwardOffset, bearing)
    anchors.push(nextPoint)
  }
  anchors.push(end)

  const points = []
  const segmentCount = Math.max(4, Math.ceil(distanceKm * (phase === 'approach' ? 3.5 : 4.5)))
  for (let index = 0; index < anchors.length - 1; index += 1) {
    for (let step = 0; step < segmentCount; step += 1) {
      if (index > 0 && step === 0) continue
      const point = interpolatePoint(anchors[index], anchors[index + 1], step / segmentCount)
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
  const random = createRandom(hashString(`${seedKey}:${phase}:lights`))
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
    const looksLikeIntersection = index < points.length - 1 && (index % 4 === 0 || random() < 0.18)
    const waitSeconds = looksLikeIntersection && random() < 0.42 ? Math.round(18 + random() * 47) : 0
    const waitStart = moveEnd
    const waitEnd = waitStart + waitSeconds
    segments.push({
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
  return { segments, totalDistanceKm, totalSeconds: elapsedSeconds }
}

function getApproachProgressCap(order = {}) {
  if (order.orderStatus === 'ACCEPTED') return 0.42
  if (order.orderStatus === 'PICKING_UP') return 0.88
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

  for (const segment of route.segments) {
    if (safeElapsed <= segment.moveEnd) {
      const ratio = segment.moveEnd === segment.moveStart
        ? 1
        : (safeElapsed - segment.moveStart) / (segment.moveEnd - segment.moveStart)
      const progress = clamp(ratio, 0, 1)
      const traveledDistanceKm = segment.cumulativeStartKm + segment.distanceKm * progress
      return {
        currentPoint: interpolatePoint(segment.startPoint, segment.endPoint, progress),
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
        currentRedLightSeconds: Math.max(0, Math.ceil(segment.waitEnd - safeElapsed))
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

export function resolveDemoRouteEndpoints(order = {}, runtime = null) {
  const phase = ['IN_TRIP', 'FINISHED'].includes(String(order.orderStatus || '')) ? 'trip' : 'approach'
  const pickup = normalizePoint({ latitude: order.startLat, longitude: order.startLng })
  const destination = normalizePoint({ latitude: order.endLat, longitude: order.endLng })
  const approachRoute = normalizeRoutePoints(runtime?.approachRoute?.points || runtime?.approachRoutePoints)
  const driverStart = normalizePoint(
    runtime?.driverStartPoint ||
    runtime?.driverStart ||
    approachRoute[0] ||
    runtime?.currentPoint ||
    runtime?.driverLocation ||
    pickup
  )

  return phase === 'trip'
    ? { phase, start: pickup, end: destination }
    : { phase, start: driverStart, end: pickup }
}

export function mapProgressOntoRoute(points = [], progress = 0) {
  const routePoints = normalizeRoutePoints(points)
  if (!routePoints.length) {
    return {
      routePoints: [],
      traveledPoints: [],
      remainPoints: [],
      currentPoint: null,
      heading: 0,
      progress: 0
    }
  }
  if (routePoints.length === 1) {
    return {
      routePoints,
      traveledPoints: routePoints,
      remainPoints: routePoints,
      currentPoint: routePoints[0],
      heading: 0,
      progress: 0
    }
  }

  const segments = []
  let totalDistanceKm = 0
  for (let index = 1; index < routePoints.length; index += 1) {
    const startPoint = routePoints[index - 1]
    const endPoint = routePoints[index]
    const distanceKm = getDistanceKm(startPoint, endPoint)
    segments.push({ startPoint, endPoint, distanceKm, startIndex: index - 1 })
    totalDistanceKm += distanceKm
  }

  const normalizedProgress = clamp(toNumber(progress), 0, 1)
  const targetDistanceKm = totalDistanceKm * normalizedProgress
  let traveledDistanceKm = 0
  let activeSegment = segments[segments.length - 1]
  let segmentProgress = 1

  for (const segment of segments) {
    if (traveledDistanceKm + segment.distanceKm >= targetDistanceKm) {
      activeSegment = segment
      segmentProgress = segment.distanceKm
        ? (targetDistanceKm - traveledDistanceKm) / segment.distanceKm
        : 0
      break
    }
    traveledDistanceKm += segment.distanceKm
  }

  const currentPoint = interpolatePoint(activeSegment.startPoint, activeSegment.endPoint, clamp(segmentProgress, 0, 1))
  const traveledPoints = routePoints.slice(0, activeSegment.startIndex + 1)
  const remainPoints = routePoints.slice(activeSegment.startIndex + 1)
  traveledPoints.push(currentPoint)
  remainPoints.unshift(currentPoint)

  return {
    routePoints,
    traveledPoints,
    remainPoints,
    currentPoint,
    heading: getBearing(activeSegment.startPoint, activeSegment.endPoint),
    progress: normalizedProgress
  }
}

function getApproachStartTime(order, route, now) {
  return parseTime(order.acceptedAt || order.updatedAt || order.createdAt) || (now - route.totalSeconds * 1000)
}

function getTripStartTime(order, approachRoute, tripRoute, now) {
  return parseTime(order.startedAt) ||
    (getApproachStartTime(order, approachRoute, now) + approachRoute.totalSeconds * 1000) ||
    (now - tripRoute.totalSeconds * 1000)
}

export function createSimulation(order = {}, now = Date.now()) {
  const start = normalizePoint({ latitude: order.startLat, longitude: order.startLng })
  const end = normalizePoint({ latitude: order.endLat, longitude: order.endLng })
  const seedKey = `${order.id || order.orderNo || 'order'}`
  const driverStart = createDriverSpawnPoint(start, seedKey)
  const approachPoints = createRoutePoints(driverStart, start, seedKey, 'approach')
  const tripPoints = createRoutePoints(start, end, seedKey, 'trip')
  const approachRoute = { points: approachPoints, ...buildSegments(approachPoints, seedKey, 'approach') }
  const tripRoute = { points: tripPoints, ...buildSegments(tripPoints, seedKey, 'trip') }
  const phase = ['IN_TRIP', 'FINISHED'].includes(order.orderStatus) ? 'trip' : 'approach'
  const activeRoute = phase === 'trip' ? tripRoute : approachRoute
  const phaseStartTime = phase === 'trip'
    ? getTripStartTime(order, approachRoute, tripRoute, now)
    : getApproachStartTime(order, approachRoute, now)
  const finishedTime = parseTime(order.finishedAt)
  const rawElapsedSeconds = order.orderStatus === 'FINISHED' && finishedTime
    ? Math.max(0, (finishedTime - phaseStartTime) / 1000)
    : Math.max(0, (now - phaseStartTime) / 1000)
  const progressCap = phase === 'approach' ? getApproachProgressCap(order) : 1
  const elapsedSeconds = Math.min(rawElapsedSeconds, activeRoute.totalSeconds * progressCap)
  const location = locateOnRoute(activeRoute, elapsedSeconds)
  const remainDistanceKm = Math.max(0, activeRoute.totalDistanceKm - location.traveledDistanceKm)
  const remainingSeconds = Math.max(0, activeRoute.totalSeconds - Math.min(elapsedSeconds, activeRoute.totalSeconds))
  const routeSplit = buildActiveRoutePoints(activeRoute.points, location.progress)

  return {
    phase,
    driverStart,
    approachRoute,
    tripRoute,
    activeRoute,
    currentPoint: location.currentPoint,
    heading: Number(location.heading.toFixed(1)),
    progress: location.progress,
    percent: Math.round(location.progress * 100),
    traveledDistanceKm: location.traveledDistanceKm,
    remainDistanceKm,
    usedSeconds: Math.min(elapsedSeconds, activeRoute.totalSeconds),
    elapsedSeconds: Math.min(elapsedSeconds, activeRoute.totalSeconds),
    remainingSeconds,
    totalSeconds: activeRoute.totalSeconds,
    waitingRedLight: location.waitingRedLight,
    currentRedLightSeconds: location.currentRedLightSeconds,
    trafficText: location.waitingRedLight
      ? `红灯等待中，约 ${Math.max(0, Math.ceil(location.currentRedLightSeconds))} 秒后通行`
      : '按道路路线行驶中',
    speedKmh: location.waitingRedLight ? 0 : SPEED_KM_PER_MINUTE * 60,
    traveledPoints: routeSplit.traveledPoints,
    remainPoints: routeSplit.remainPoints
  }
}

export function createDemoRideRuntime(order = {}, backendRuntime = null, now = Date.now()) {
  const status = String(order.orderStatus || '')
  const backend = backendRuntime && typeof backendRuntime === 'object' ? backendRuntime : {}
  if (!['ACCEPTED', 'PICKING_UP', 'IN_TRIP', 'FINISHED'].includes(status)) {
    return {
      ...backend,
      traceMode: 'DEMO',
      live: false,
      driverLocation: null,
      currentPoint: null
    }
  }

  const simulation = createSimulation(order, now)
  return {
    ...backend,
    ...simulation,
    traceMode: 'DEMO',
    displayText: simulation.trafficText,
    phaseText: simulation.phase === 'trip' ? '行程进行中' : '接驾进行中',
    route: simulation.activeRoute.points,
    routePoints: simulation.activeRoute.points,
    currentPoint: simulation.currentPoint,
    driverLocation: simulation.currentPoint,
    lastReportedAt: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    live: true,
    driverArrived: status === 'PICKING_UP' && simulation.progress >= 0.86
  }
}

export function buildDemoTrackPayload(order = {}, runtime = null, now = Date.now()) {
  const demoRuntime = runtime?.currentPoint ? runtime : createDemoRideRuntime(order, runtime, now)
  const point = demoRuntime?.currentPoint || demoRuntime?.driverLocation
  if (!point || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) return null
  const elapsed = Math.round(toNumber(demoRuntime.elapsedSeconds ?? demoRuntime.usedSeconds))
  const remain = toNumber(demoRuntime.remainDistanceKm)
  const traveled = toNumber(demoRuntime.traveledDistanceKm)
  const percent = Math.round(toNumber(demoRuntime.percent))
  const total = Math.round(toNumber(demoRuntime.totalSeconds))
  const wait = Math.round(toNumber(demoRuntime.currentRedLightSeconds))
  return {
    longitude: Number(point.longitude).toFixed(6),
    latitude: Number(point.latitude).toFixed(6),
    speedKmh: Number(toNumber(demoRuntime.speedKmh).toFixed(1)),
    heading: Number(toNumber(demoRuntime.heading).toFixed(1)),
    traceMode: 'DEMO',
    remark: `DEMO_ROUTE:${demoRuntime.phase || 'approach'};elapsed=${elapsed};distance=${traveled.toFixed(3)};remain=${remain.toFixed(3)};percent=${percent};total=${total};wait=${wait}`
  }
}

export function getDispatchWaitState(order = {}, now = Date.now()) {
  const startedAt = parseTime(order.createdAt || order.orderTime) || now
  const elapsedMinutes = Math.floor(Math.max(0, now - startedAt) / MINUTE_MS)
  const remainingMinutes = Math.max(ESTIMATED_WAIT_MINUTES - elapsedMinutes, 0)
  const expandedSearch = remainingMinutes === 0
  return {
    startedAt,
    elapsedMinutes,
    remainingMinutes,
    expandedSearch,
    progressPercent: expandedSearch ? 100 : Math.round((elapsedMinutes / ESTIMATED_WAIT_MINUTES) * 100),
    title: expandedSearch
      ? '正在扩大范围寻找司机中...'
      : `预估${remainingMinutes}分钟有车主接单`,
    hint: expandedSearch
      ? '我们正在通知更远范围内的司机，请再耐心等一会儿'
      : '订单已发送给附近司机，请耐心等待'
  }
}
