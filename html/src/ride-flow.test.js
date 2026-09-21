import test from 'node:test'
import assert from 'node:assert/strict'

import { formatRideDistance, formatRideDuration, getRideProgressPercent, normalizeRideRuntime } from './ride-flow.js'

test('normalizeRideRuntime maps backend runtime fields to the web map model', () => {
  const runtime = normalizeRideRuntime({
    currentPoint: { latitude: 39.9, longitude: 116.8 },
    percent: 47,
    remainingSeconds: 125,
    remainDistanceKm: 1.24,
    traceCount: 4
  })

  assert.deepEqual(runtime.driverLocation, { latitude: 39.9, longitude: 116.8 })
  assert.equal(runtime.percent, 47)
  assert.equal(runtime.etaMinutes, 3)
  assert.equal(runtime.distanceKm, 1.24)
  assert.equal(runtime.live, true)
})

test('getRideProgressPercent prefers backend progress and does not invent active progress', () => {
  assert.equal(getRideProgressPercent({ orderStatus: 'IN_TRIP' }, { progress: 0.62 }), 62)
  assert.equal(getRideProgressPercent({ orderStatus: 'PICKING_UP' }, null), null)
  assert.equal(getRideProgressPercent({ orderStatus: 'FINISHED' }, null), 100)
  assert.equal(getRideProgressPercent({ orderStatus: 'CANCELLED' }, { percent: 88 }), 0)
})

test('ride metric formatters keep short values readable', () => {
  assert.equal(formatRideDuration(125), '3 分钟')
  assert.equal(formatRideDuration(20), '< 1 分钟')
  assert.equal(formatRideDistance(0.42), '420 米')
  assert.equal(formatRideDistance(12.34), '12.3 公里')
})
