const { normalizeRoutePoints } = require('./route-display')

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

function interpolateRoute(start, end, segments = 24) {
  const points = []
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments
    points.push({
      latitude: start.latitude + (end.latitude - start.latitude) * progress,
      longitude: start.longitude + (end.longitude - start.longitude) * progress
    })
  }

  const distanceKm = getDistanceKm(start, end)
  const durationMin = distanceKm * 3.3 + 8

  return {
    points,
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin: Math.round(durationMin)
  }
}

function getPointByProgress(points, progress) {
  if (!points.length) return null
  const index = Math.min(points.length - 1, Math.max(0, Math.round((points.length - 1) * progress)))
  return points[index]
}

function createDriverApproachPoints(start) {
  const driverStart = {
    latitude: start.latitude + 0.018,
    longitude: start.longitude - 0.02
  }
  return interpolateRoute(driverStart, start, 18).points
}

function buildPolyline(points, color = '#ff7a00', width = 8) {
  const safePoints = normalizeRoutePoints(points)
  if (safePoints.length < 2) return []

  return [
    {
      points: safePoints,
      color,
      width,
      arrowLine: true,
      borderWidth: 1,
      borderColor: '#ffffff'
    }
  ]
}

module.exports = {
  buildPolyline,
  createDriverApproachPoints,
  getDistanceKm,
  getPointByProgress,
  interpolateRoute
}
