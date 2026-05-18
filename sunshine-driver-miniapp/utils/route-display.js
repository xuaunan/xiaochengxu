const MIN_ROUTE_POINT_COUNT = 3

function toNumber(value, fallback = NaN) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function isValidCoordinate(point) {
  if (!point) return false
  const latitude = toNumber(point.latitude !== undefined ? point.latitude : point.lat)
  const longitude = toNumber(point.longitude !== undefined ? point.longitude : point.lng)
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001)
}

function normalizePoint(point) {
  return {
    latitude: toNumber(point.latitude !== undefined ? point.latitude : point.lat),
    longitude: toNumber(point.longitude !== undefined ? point.longitude : point.lng)
  }
}

function samePoint(left, right) {
  return Math.abs(left.latitude - right.latitude) < 0.000001 &&
    Math.abs(left.longitude - right.longitude) < 0.000001
}

function normalizeRoutePoints(points = []) {
  return (Array.isArray(points) ? points : [])
    .filter(isValidCoordinate)
    .map(normalizePoint)
    .reduce((result, point) => {
      if (!result.length || !samePoint(result[result.length - 1], point)) {
        result.push(point)
      }
      return result
    }, [])
}

function getDistanceScore(left, right) {
  if (!isValidCoordinate(left) || !isValidCoordinate(right)) return Infinity
  const start = normalizePoint(left)
  const end = normalizePoint(right)
  const latDiff = start.latitude - end.latitude
  const lngDiff = start.longitude - end.longitude
  return latDiff * latDiff + lngDiff * lngDiff
}

function getNearestPointIndex(points, target) {
  let nearestIndex = 0
  let nearestScore = Infinity
  points.forEach((point, index) => {
    const score = getDistanceScore(point, target)
    if (score < nearestScore) {
      nearestIndex = index
      nearestScore = score
    }
  })
  return nearestIndex
}

function mergeRouteParts(left = [], right = []) {
  return normalizeRoutePoints([].concat(left, right))
}

function hasDetailedRoute(points = []) {
  return normalizeRoutePoints(points).length >= MIN_ROUTE_POINT_COUNT
}

function getFallbackFullRoute(fallback = {}, phase = '') {
  if (fallback.activeRoute && Array.isArray(fallback.activeRoute.points)) {
    return fallback.activeRoute.points
  }
  if (phase === 'trip' && fallback.tripRoute && Array.isArray(fallback.tripRoute.points)) {
    return fallback.tripRoute.points
  }
  if (phase === 'approach' && fallback.approachRoute && Array.isArray(fallback.approachRoute.points)) {
    return fallback.approachRoute.points
  }
  return mergeRouteParts(fallback.traveledPoints, fallback.remainPoints)
}

function pickFullRoute(runtime = {}, fallback = {}, phase = '') {
  const phaseRouteKey = phase === 'trip' ? 'tripRoutePoints' : 'approachRoutePoints'
  const candidates = [
    runtime[phaseRouteKey],
    runtime.routePoints,
    runtime.fullRoutePoints,
    runtime.points,
    runtime.activeRoute && runtime.activeRoute.points,
    phase === 'trip' ? (runtime.tripRoute && runtime.tripRoute.points) : (runtime.approachRoute && runtime.approachRoute.points),
    mergeRouteParts(runtime.traveledPoints, runtime.remainPoints),
    getFallbackFullRoute(fallback, phase)
  ]
  const normalizedCandidates = candidates.map(normalizeRoutePoints)

  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const points = normalizedCandidates[index]
    if (points.length >= MIN_ROUTE_POINT_COUNT) return points
  }

  return []
}

function splitRouteByCurrentPoint(points, currentPoint) {
  const routePoints = normalizeRoutePoints(points)
  const current = isValidCoordinate(currentPoint) ? normalizePoint(currentPoint) : null
  if (routePoints.length < 2) {
    return {
      traveledPoints: [],
      remainPoints: []
    }
  }
  if (!current) {
    return {
      traveledPoints: [],
      remainPoints: routePoints
    }
  }

  const splitIndex = getNearestPointIndex(routePoints, current)
  const traveledPoints = normalizeRoutePoints(routePoints.slice(0, splitIndex + 1).concat([current]))
  const remainPoints = normalizeRoutePoints([current].concat(routePoints.slice(splitIndex + 1)))

  return {
    traveledPoints,
    remainPoints
  }
}

function buildPolyline(points, color = '#ff7a00', width = 8) {
  const safePoints = normalizeRoutePoints(points)
  if (safePoints.length < MIN_ROUTE_POINT_COUNT) return []

  return [{
    points: safePoints,
    color,
    width,
    arrowLine: true,
    borderWidth: 1,
    borderColor: '#ffffff'
  }]
}

function buildExplicitRoutePolylines(runtime = {}, options = {}) {
  const traveledPoints = normalizeRoutePoints(runtime.traveledPoints)
  const remainPoints = normalizeRoutePoints(runtime.remainPoints)
  if (traveledPoints.length < MIN_ROUTE_POINT_COUNT && remainPoints.length < MIN_ROUTE_POINT_COUNT) {
    return []
  }

  return [
    ...buildPolyline(traveledPoints, options.traveledColor || '#ff7a00', options.traveledWidth || 10),
    ...buildPolyline(remainPoints, options.remainColor || '#9db5ff', options.remainWidth || 6)
  ]
}

function buildRoutePolylines(options = {}) {
  const runtime = options.runtime || {}
  const fallback = options.fallback || {}
  const phase = options.phase || runtime.phase || fallback.phase || ''
  const currentPoint = options.currentPoint || runtime.currentPoint || fallback.currentPoint
  const routePoints = pickFullRoute(runtime, fallback, phase)
  if (routePoints.length >= MIN_ROUTE_POINT_COUNT) {
    const routeParts = splitRouteByCurrentPoint(routePoints, currentPoint)
    return [
      ...buildPolyline(routeParts.traveledPoints, options.traveledColor || '#ff7a00', options.traveledWidth || 10),
      ...buildPolyline(routeParts.remainPoints, options.remainColor || '#9db5ff', options.remainWidth || 6)
    ]
  }

  return buildExplicitRoutePolylines(runtime, options)
}

function hasUsableRoute(runtime = {}) {
  const source = runtime || {}
  return hasDetailedRoute(source.traveledPoints) ||
    hasDetailedRoute(source.remainPoints) ||
    hasDetailedRoute(source.tripRoutePoints) ||
    hasDetailedRoute(source.approachRoutePoints) ||
    hasDetailedRoute(source.routePoints) ||
    hasDetailedRoute(source.fullRoutePoints) ||
    hasDetailedRoute(source.points) ||
    hasDetailedRoute(source.activeRoute && source.activeRoute.points) ||
    hasDetailedRoute(source.tripRoute && source.tripRoute.points) ||
    hasDetailedRoute(source.approachRoute && source.approachRoute.points) ||
    hasDetailedRoute(mergeRouteParts(source.traveledPoints, source.remainPoints))
}

module.exports = {
  buildPolyline,
  buildRoutePolylines,
  hasDetailedRoute,
  hasUsableRoute,
  normalizeRoutePoints
}
