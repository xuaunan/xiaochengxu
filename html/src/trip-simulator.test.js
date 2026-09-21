import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDemoTrackPayload,
  createDemoRideRuntime,
  createSimulation,
  getDispatchWaitState,
  mapProgressOntoRoute,
  resolveDemoRouteEndpoints
} from './trip-simulator.js'

const order = {
  id: 88,
  orderNo: 'DEMO-88',
  orderStatus: 'PICKING_UP',
  startLat: 39.982,
  startLng: 117.081,
  endLat: 39.994,
  endLng: 117.112,
  acceptedAt: '2026-09-21T10:00:00.000Z'
}

test('simulation stays deterministic for the same order and time', () => {
  const now = Date.parse('2026-09-21T10:01:00.000Z')
  const first = createSimulation(order, now)
  const second = createSimulation(order, now)

  assert.deepEqual(first.currentPoint, second.currentPoint)
  assert.deepEqual(first.activeRoute.points, second.activeRoute.points)
  assert.equal(first.phase, 'approach')
  assert.ok(first.percent >= 0 && first.percent <= 88)
})

test('demo runtime and telemetry use the mini-program DEMO_ROUTE contract', () => {
  const now = Date.parse('2026-09-21T10:01:00.000Z')
  const runtime = createDemoRideRuntime(order, null, now)
  const payload = buildDemoTrackPayload(order, runtime, now)

  assert.equal(runtime.traceMode, 'DEMO')
  assert.equal(runtime.live, true)
  assert.equal(payload.traceMode, 'DEMO')
  assert.match(payload.remark, /^DEMO_ROUTE:approach;/)
  assert.equal(typeof payload.latitude, 'string')
  assert.equal(typeof payload.longitude, 'string')
})

test('dispatch estimate counts down by whole minutes and expands at zero', () => {
  const createdAt = Date.parse('2026-09-21T10:00:00.000Z')
  const waitingOrder = { createdAt }

  assert.equal(getDispatchWaitState(waitingOrder, createdAt + 59_000).title, '预估3分钟有车主接单')
  assert.equal(getDispatchWaitState(waitingOrder, createdAt + 60_000).title, '预估2分钟有车主接单')
  assert.equal(getDispatchWaitState(waitingOrder, createdAt + 120_000).title, '预估1分钟有车主接单')
  assert.equal(getDispatchWaitState(waitingOrder, createdAt + 180_000).title, '正在扩大范围寻找司机中...')
  assert.equal(getDispatchWaitState(waitingOrder, createdAt + 180_000).expandedSearch, true)
})

test('active route endpoints follow the mini-program phase rules', () => {
  const runtime = createDemoRideRuntime(order, null, Date.parse('2026-09-21T10:01:00.000Z'))
  const approach = resolveDemoRouteEndpoints(order, runtime)
  const trip = resolveDemoRouteEndpoints({ ...order, orderStatus: 'IN_TRIP' }, runtime)

  assert.equal(approach.phase, 'approach')
  assert.deepEqual(approach.end, { latitude: order.startLat, longitude: order.startLng })
  assert.notDeepEqual(approach.start, approach.end)
  assert.equal(trip.phase, 'trip')
  assert.deepEqual(trip.start, { latitude: order.startLat, longitude: order.startLng })
  assert.deepEqual(trip.end, { latitude: order.endLat, longitude: order.endLng })
})

test('simulation progress is projected onto a planned road route', () => {
  const plannedRoute = [
    { latitude: 39.98, longitude: 117.08 },
    { latitude: 39.99, longitude: 117.08 },
    { latitude: 40.00, longitude: 117.08 }
  ]
  const mapped = mapProgressOntoRoute(plannedRoute, 0.25)

  assert.equal(mapped.routePoints.length, 3)
  assert.equal(mapped.traveledPoints.length, 2)
  assert.equal(mapped.remainPoints.length, 3)
  assert.equal(mapped.currentPoint.longitude, 117.08)
  assert.ok(mapped.currentPoint.latitude > 39.984 && mapped.currentPoint.latitude < 39.986)
  assert.equal(mapped.traveledPoints.at(-1).latitude, mapped.currentPoint.latitude)
  assert.equal(mapped.remainPoints[0].latitude, mapped.currentPoint.latitude)
  assert.ok(mapped.heading < 1 || mapped.heading > 359)
})
