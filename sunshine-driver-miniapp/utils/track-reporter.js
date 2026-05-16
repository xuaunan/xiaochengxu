const { ORDER_STATUS } = require('./constants')
const { createSimulation, getBearing, getDistanceKm } = require('./trip-simulator')
const { TRACK_MODE, getCurrentTrackMode, normalizeTrackMode } = require('./track-mode')

const DEMO_SPEED_KM_PER_MINUTE = 1.5
const DEMO_SPEED_KMH = DEMO_SPEED_KM_PER_MINUTE * 60
const DEMO_SECONDS_PER_KM = 60 / DEMO_SPEED_KM_PER_MINUTE

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
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
  const text = String(value || 'demo-route')
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

function getLocation() {
  return new Promise((resolve, reject) => {
    if (typeof wx.getLocation !== 'function') {
      reject(new Error('当前环境不支持定位'))
      return
    }
    wx.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject
    })
  })
}

function buildTelemetry(runtime = {}) {
  return {
    waitingRedLight: Boolean(runtime.waitingRedLight),
    waitSeconds: Number(runtime.waitSeconds || 0),
    currentWaitSeconds: Number(runtime.currentWaitSeconds || runtime.currentRedLightSeconds || 0),
    trafficText: runtime.trafficText || '',
    waitingText: runtime.waitingText || '',
    speedKmh: runtime.speedKmh || null,
    heading: runtime.heading || null
  }
}

function normalizeRoutePoints(points = []) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({
      latitude: toNumber(point.latitude),
      longitude: toNumber(point.longitude)
    }))
    .filter((point) => point.latitude && point.longitude)
}

function pickRoadRoutePoints(runtime = {}, phase = 'approach') {
  const phaseKey = phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'
  const candidates = [
    runtime[phaseKey],
    runtime.routePoints,
    runtime.fullRoutePoints,
    runtime.remainPoints,
    runtime.points
  ]
  for (let index = 0; index < candidates.length; index += 1) {
    const points = normalizeRoutePoints(candidates[index])
    if (points.length >= 3) return points
  }
  return []
}

function getPhaseStartTime(order = {}, phase = 'approach') {
  if (phase === 'trip') {
    return parseTime(order.startedAt) || Date.now()
  }
  return parseTime(order.acceptedAt || order.updatedAt || order.createdAt) || Date.now()
}

function buildTimedRoadRoute(points = [], seedKey = 'order', phase = 'approach') {
  const routePoints = normalizeRoutePoints(points)
  const rng = createRandom(hashString(`${seedKey}:${phase}:traffic-lights`))
  const segments = []
  let elapsedSeconds = 0
  let totalDistanceKm = 0
  let distanceSinceLightKm = 0

  for (let index = 1; index < routePoints.length; index += 1) {
    const startPoint = routePoints[index - 1]
    const endPoint = routePoints[index]
    const distanceKm = getDistanceKm(startPoint, endPoint)
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) continue
    const heading = getBearing(startPoint, endPoint)
    const previousHeading = segments.length ? segments[segments.length - 1].heading : heading
    const turnDelta = Math.abs(((heading - previousHeading + 540) % 360) - 180)
    const looksLikeIntersection = index < routePoints.length - 1 &&
      (turnDelta >= 18 || distanceSinceLightKm >= 0.65 + rng() * 0.55)
    const hasRedLight = looksLikeIntersection && rng() < 0.42
    const waitSeconds = hasRedLight ? Math.round(18 + rng() * 47) : 0
    const moveStart = elapsedSeconds
    const moveEnd = moveStart + distanceKm * DEMO_SECONDS_PER_KM

    totalDistanceKm += distanceKm
    segments.push({
      index,
      startPoint,
      endPoint,
      heading,
      distanceKm,
      cumulativeStartKm: totalDistanceKm - distanceKm,
      cumulativeEndKm: totalDistanceKm,
      moveStart,
      moveEnd,
      waitStart: moveEnd,
      waitEnd: moveEnd + waitSeconds,
      waitSeconds
    })

    elapsedSeconds = moveEnd + waitSeconds
    distanceSinceLightKm = looksLikeIntersection ? 0 : distanceSinceLightKm + distanceKm
  }

  return {
    points: routePoints,
    segments,
    totalDistanceKm,
    totalSeconds: elapsedSeconds
  }
}

function splitRouteAtSegment(route, segment, currentPoint) {
  if (!route.points.length || !segment) return { traveledPoints: [], remainPoints: [] }
  const splitIndex = Math.max(1, segment.index)
  return {
    traveledPoints: route.points.slice(0, splitIndex).concat([currentPoint]),
    remainPoints: [currentPoint].concat(route.points.slice(splitIndex))
  }
}

function locateTimedRoute(route, elapsedSeconds) {
  const safeElapsed = clamp(elapsedSeconds, 0, route.totalSeconds || 0)
  if (!route.segments.length) {
    const currentPoint = route.points[0] || { latitude: 0, longitude: 0 }
    return {
      currentPoint,
      heading: 0,
      progress: 0,
      percent: 0,
      traveledDistanceKm: 0,
      remainDistanceKm: 0,
      elapsedSeconds: safeElapsed,
      remainingSeconds: 0,
      waitingRedLight: false,
      waitSeconds: 0,
      currentWaitSeconds: 0,
      traveledPoints: [],
      remainPoints: route.points
    }
  }

  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index]
    if (safeElapsed <= segment.moveEnd) {
      const ratio = segment.moveEnd === segment.moveStart
        ? 1
        : clamp((safeElapsed - segment.moveStart) / (segment.moveEnd - segment.moveStart), 0, 1)
      const currentPoint = {
        latitude: segment.startPoint.latitude + (segment.endPoint.latitude - segment.startPoint.latitude) * ratio,
        longitude: segment.startPoint.longitude + (segment.endPoint.longitude - segment.startPoint.longitude) * ratio
      }
      const traveledDistanceKm = segment.cumulativeStartKm + segment.distanceKm * ratio
      const routeSplit = splitRouteAtSegment(route, segment, currentPoint)
      const progress = route.totalDistanceKm ? traveledDistanceKm / route.totalDistanceKm : 0
      return {
        currentPoint,
        heading: segment.heading,
        progress,
        percent: Math.round(progress * 100),
        traveledDistanceKm,
        remainDistanceKm: Math.max(0, route.totalDistanceKm - traveledDistanceKm),
        elapsedSeconds: safeElapsed,
        remainingSeconds: Math.max(0, route.totalSeconds - safeElapsed),
        waitingRedLight: false,
        waitSeconds: 0,
        currentWaitSeconds: 0,
        traveledPoints: routeSplit.traveledPoints,
        remainPoints: routeSplit.remainPoints
      }
    }

    if (safeElapsed <= segment.waitEnd) {
      const currentPoint = segment.endPoint
      const routeSplit = splitRouteAtSegment(route, segment, currentPoint)
      const progress = route.totalDistanceKm ? segment.cumulativeEndKm / route.totalDistanceKm : 1
      const remainingRedSeconds = Math.max(0, Math.ceil(segment.waitEnd - safeElapsed))
      return {
        currentPoint,
        heading: segment.heading,
        progress,
        percent: Math.round(progress * 100),
        traveledDistanceKm: segment.cumulativeEndKm,
        remainDistanceKm: Math.max(0, route.totalDistanceKm - segment.cumulativeEndKm),
        elapsedSeconds: safeElapsed,
        remainingSeconds: Math.max(0, route.totalSeconds - safeElapsed),
        waitingRedLight: segment.waitSeconds > 0,
        waitSeconds: segment.waitSeconds,
        currentWaitSeconds: remainingRedSeconds,
        traveledPoints: routeSplit.traveledPoints,
        remainPoints: routeSplit.remainPoints
      }
    }
  }

  const lastSegment = route.segments[route.segments.length - 1]
  return {
    currentPoint: lastSegment.endPoint,
    heading: lastSegment.heading,
    progress: 1,
    percent: 100,
    traveledDistanceKm: route.totalDistanceKm,
    remainDistanceKm: 0,
    elapsedSeconds: route.totalSeconds,
    remainingSeconds: 0,
    waitingRedLight: false,
    waitSeconds: 0,
    currentWaitSeconds: 0,
    traveledPoints: route.points,
    remainPoints: [lastSegment.endPoint]
  }
}

function buildRoadRuntime(order = {}, baseRuntime = {}, roadPoints = []) {
  const phase = baseRuntime.phase || (order.orderStatus === ORDER_STATUS.IN_TRIP ? 'trip' : 'approach')
  const route = buildTimedRoadRoute(roadPoints, `${order.id || order.orderNo || 'order'}`, phase)
  const phaseStartTime = getPhaseStartTime(order, phase)
  const elapsedSeconds = Math.max(0, (Date.now() - phaseStartTime) / 1000)
  const location = locateTimedRoute(route, elapsedSeconds)
  const phaseRouteKey = phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'

  return {
    ...baseRuntime,
    ...location,
    phase,
    [phaseRouteKey]: route.points,
    routePoints: route.points,
    fullRoutePoints: route.points,
    routePlanned: true,
    totalSeconds: route.totalSeconds,
    usedSeconds: location.elapsedSeconds,
    speedKmh: location.waitingRedLight ? 0 : DEMO_SPEED_KMH,
    trafficText: location.waitingRedLight ? '红灯等待中' : '按道路路线行驶中',
    waitingText: location.waitingRedLight ? `红灯等待中，约 ${location.currentWaitSeconds} 秒后通行` : '绿灯通行中'
  }
}

function buildDemoRemark(runtime = {}) {
  return [
    `DEMO_ROUTE:${runtime.phase || 'approach'}`,
    `elapsed=${Math.round(Number(runtime.elapsedSeconds || runtime.usedSeconds || 0))}`,
    `distance=${toNumber(runtime.traveledDistanceKm).toFixed(3)}`,
    `remain=${toNumber(runtime.remainDistanceKm).toFixed(3)}`,
    `percent=${Math.round(toNumber(runtime.percent))}`,
    `total=${Math.round(Number(runtime.totalSeconds || 0))}`,
    `wait=${Math.round(Number(runtime.currentWaitSeconds || runtime.waitSeconds || 0))}`
  ].join(';')
}

function buildDemoOrder(order = {}) {
  const nowText = new Date().toISOString()
  return {
    ...order,
    orderStatus: order.orderStatus === ORDER_STATUS.DISPATCHING ? ORDER_STATUS.ACCEPTED : order.orderStatus,
    acceptedAt: order.acceptedAt || nowText,
    updatedAt: order.updatedAt || nowText
  }
}

function buildDemoTrackReport(order = {}, plannedRuntime = {}) {
  const runtime = createSimulation(buildDemoOrder(order))
  const roadPoints = pickRoadRoutePoints(plannedRuntime, runtime.phase)
  const nextRuntime = roadPoints.length >= 3
    ? buildRoadRuntime(buildDemoOrder(order), runtime, roadPoints)
    : {
        ...runtime,
        speedKmh: DEMO_SPEED_KMH
      }
  const currentPoint = nextRuntime.currentPoint || runtime.currentPoint || {}
  return {
    mode: TRACK_MODE.DEMO,
    runtime: nextRuntime,
    payload: {
      longitude: `${toNumber(currentPoint.longitude).toFixed(6)}`,
      latitude: `${toNumber(currentPoint.latitude).toFixed(6)}`,
      ...buildTelemetry(nextRuntime),
      traceMode: TRACK_MODE.DEMO,
      remark: buildDemoRemark(nextRuntime)
    }
  }
}

async function buildRealTrackReport(order = {}, runtime = {}) {
  const location = await getLocation()
  return {
    mode: TRACK_MODE.REAL,
    runtime,
    payload: {
      longitude: `${location.longitude}`,
      latitude: `${location.latitude}`,
      ...buildTelemetry(runtime),
      traceMode: TRACK_MODE.REAL,
      remark: 'REAL_GPS'
    }
  }
}

async function buildTrackReport(order = {}, options = {}) {
  const mode = normalizeTrackMode(options.trackMode || getCurrentTrackMode())
  if (mode === TRACK_MODE.REAL) {
    return buildRealTrackReport(order, options.runtime || {})
  }
  return buildDemoTrackReport(order, options.runtime || {})
}

module.exports = {
  buildDemoTrackReport,
  buildRealTrackReport,
  buildTrackReport
}
