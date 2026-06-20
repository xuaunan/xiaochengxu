import test from 'node:test'
import assert from 'node:assert/strict'

import { isAnyOrderActionPending, isOrderActionPending, orderActionPendingKey } from './interaction-state.js'

test('orderActionPendingKey scopes busy state to an action and order', () => {
  assert.equal(orderActionPendingKey('cancel', { id: 42 }), 'cancel:42')
  assert.equal(orderActionPendingKey('pickup', { orderNo: 'NO-8' }), 'pickup:NO-8')
  assert.equal(orderActionPendingKey('', { id: 42 }), '')
  assert.equal(orderActionPendingKey('cancel', {}), '')
})

test('isOrderActionPending only matches the same action on the same order', () => {
  const pendingKey = orderActionPendingKey('cancel', { id: 42 })

  assert.equal(isOrderActionPending(pendingKey, 'cancel', { id: 42 }), true)
  assert.equal(isOrderActionPending(pendingKey, 'pickup', { id: 42 }), false)
  assert.equal(isOrderActionPending(pendingKey, 'cancel', { id: 43 }), false)
})

test('isAnyOrderActionPending locks every action for the same order', () => {
  const pendingKey = orderActionPendingKey('cancel', { id: 42 })

  assert.equal(isAnyOrderActionPending(pendingKey, { id: 42 }), true)
  assert.equal(isAnyOrderActionPending(pendingKey, { id: 43 }), false)
  assert.equal(isAnyOrderActionPending('', { id: 42 }), false)
})
