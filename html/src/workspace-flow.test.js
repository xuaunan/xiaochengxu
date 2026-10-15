import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAmount, bookingEstimateKey, createSnapshotGate, getRouteMapViewport, reconcileOrderList, reconcileOrderSnapshot } from './workspace-flow.js'

test('a fully discounted order keeps its zero payable amount', () => {
  assert.equal(orderAmount({ payableAmount: 0, actualAmount: 38, estimatedAmount: 42 }), 0)
  assert.equal(orderAmount({ actualAmount: '38.50', estimatedAmount: 42 }), 38.5)
  assert.equal(orderAmount({ estimatedAmount: 42 }), 42)
})

test('changing coordinates invalidates an estimate even when address ids are unchanged', () => {
  const booking = { startId: 'location', endId: 'target', startPoint: { latitude: 39, longitude: 117 } }
  assert.notEqual(bookingEstimateKey(booking), bookingEstimateKey({ ...booking, startPoint: { latitude: 40, longitude: 117 } }))
  assert.equal(bookingEstimateKey(booking), bookingEstimateKey({ ...booking, remark: 'hello' }))
})

test('old polls cannot overwrite newer snapshots or successful actions', () => {
  const gate = createSnapshotGate()
  const slowPoll = gate.begin()
  const latest = gate.begin()
  assert.equal(gate.isCurrent(slowPoll), false)
  assert.equal(gate.isCurrent(latest), true)
  gate.invalidate()
  assert.equal(gate.isCurrent(latest), false)
})

test('route viewport fits both endpoints in the actual map dimensions', () => {
  const route = [{ latitude: 39.91, longitude: 116.4 }, { latitude: 39.95, longitude: 116.43 }]
  const normal = getRouteMapViewport(route, 760, 734)
  const narrow = getRouteMapViewport(route, 360, 500)
  assert.ok(normal.zoom >= narrow.zoom)
  assert.ok(normal.zoom <= 15)
  assert.ok(Math.abs(normal.latitude - 39.93) < 0.01)
  assert.ok(Math.abs(normal.longitude - 116.415) < 0.01)
})

test('order reconciliation keeps a newer trip stage when an older poll returns', () => {
  const current = { id: 7, orderStatus: 'IN_TRIP', payStatus: 'UNPAID', endName: '目的地' }
  const stale = { id: 7, orderStatus: 'PICKING_UP', payStatus: 'UNPAID', startName: '上车点' }
  const merged = reconcileOrderSnapshot(current, stale)
  assert.equal(merged.orderStatus, 'IN_TRIP')
  assert.equal(merged.startName, '上车点')
  assert.equal(merged.endName, '目的地')
})

test('order reconciliation preserves cancellation and paid state', () => {
  const cancelled = reconcileOrderSnapshot(
    { id: 8, orderStatus: 'CANCELLED', payStatus: 'REFUNDED' },
    { id: 8, orderStatus: 'DISPATCHING', payStatus: 'UNPAID' }
  )
  assert.equal(cancelled.orderStatus, 'CANCELLED')
  assert.equal(cancelled.payStatus, 'REFUNDED')

  const paid = reconcileOrderSnapshot(
    { id: 9, orderStatus: 'FINISHED', payStatus: 'PAID' },
    { id: 9, orderStatus: 'FINISHED', payStatus: 'UNPAID' }
  )
  assert.equal(paid.payStatus, 'PAID')
})

test('order list reconciliation keeps a locally active order until it returns', () => {
  const current = [{ id: 10, orderStatus: 'PICKING_UP' }]
  const next = reconcileOrderList(current, [])
  assert.deepEqual(next.map((item) => item.id), [10])
})

test('dispatching orders are never upgraded to picking-up by the runtime phase fallback', () => {
  // 后端 runtime 对等待派单的订单也返回 phase=approach（兜底值），
  // 乘客刚下单时绝不能被误显示成「司机正在接驾」。
  const dispatching = { id: 11, orderStatus: 'DISPATCHING' }
  const merged = reconcileOrderSnapshot(dispatching, { ...dispatching }, { phase: 'approach' })
  assert.equal(merged.orderStatus, 'DISPATCHING')

  const created = reconcileOrderSnapshot(
    { id: 12, orderStatus: 'CREATED' },
    { id: 12, orderStatus: 'DISPATCHING' },
    { phase: 'approach' }
  )
  assert.equal(created.orderStatus, 'DISPATCHING')
})

test('runtime phase still advances orders that already have a driver', () => {
  const accepted = reconcileOrderSnapshot(
    { id: 13, orderStatus: 'ACCEPTED' },
    { id: 13, orderStatus: 'ACCEPTED' },
    { phase: 'approach' }
  )
  assert.equal(accepted.orderStatus, 'ACCEPTED')

  const pickingUp = reconcileOrderSnapshot(
    { id: 14, orderStatus: 'PICKING_UP' },
    { id: 14, orderStatus: 'ACCEPTED' },
    { phase: 'approach' }
  )
  assert.equal(pickingUp.orderStatus, 'PICKING_UP')

  const inTrip = reconcileOrderSnapshot(
    { id: 15, orderStatus: 'IN_TRIP' },
    { id: 15, orderStatus: 'PICKING_UP' },
    { phase: 'trip' }
  )
  assert.equal(inTrip.orderStatus, 'IN_TRIP')
})
