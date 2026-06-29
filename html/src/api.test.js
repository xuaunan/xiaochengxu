import test from 'node:test'
import assert from 'node:assert/strict'

import { dispatchInvalidSession, resolveRoleCodeFromToken, resolveSessionFromToken, shouldInvalidateSession } from './auth-session.js'

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function makeJwt(payload) {
  return `header.${toBase64Url(payload)}.signature`
}

test('resolveRoleCodeFromToken reads demo role code', () => {
  assert.equal(resolveRoleCodeFromToken('demo.USER.2.1712345678901'), 'USER')
  assert.equal(resolveRoleCodeFromToken('demo.DRIVER.7.1712345678901'), 'DRIVER')
})

test('dispatchInvalidSession emits browser event for expired app session', () => {
  const events = []
  const originalWindow = globalThis.window
  const originalCustomEvent = globalThis.CustomEvent
  globalThis.window = {
    dispatchEvent(event) {
      events.push(event)
      return true
    }
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type
      this.detail = options.detail
    }
  }

  try {
    const emitted = dispatchInvalidSession({
      token: makeJwt({ role: 'USER', sub: '2' }),
      status: 401,
      code: 4002,
      message: '登录已过期'
    })
    assert.equal(emitted, true)
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'sunshine-auth-session-invalid')
    assert.equal(events[0].detail.roleCode, 'USER')
    assert.equal(events[0].detail.code, 4002)
  } finally {
    globalThis.window = originalWindow
    globalThis.CustomEvent = originalCustomEvent
  }
})

test('resolveRoleCodeFromToken reads jwt role claim', () => {
  assert.equal(resolveRoleCodeFromToken(makeJwt({ role: 'USER', sub: '2' })), 'USER')
  assert.equal(resolveRoleCodeFromToken(makeJwt({ role: 'DRIVER', sub: '7' })), 'DRIVER')
})

test('resolveSessionFromToken reads demo and jwt actor identity', () => {
  assert.deepEqual(resolveSessionFromToken('demo.USER.2.1712345678901'), { roleCode: 'USER', userId: 2 })
  assert.deepEqual(resolveSessionFromToken(makeJwt({ role: 'DRIVER', sub: '7' })), { roleCode: 'DRIVER', userId: 7 })
})

test('shouldInvalidateSession returns true for protected auth failures', () => {
  const token = makeJwt({ role: 'USER', sub: '2' })
  assert.equal(shouldInvalidateSession({ token, status: 401, code: 4002, skipAuth: false }), true)
  assert.equal(shouldInvalidateSession({ token, status: 200, code: 4002, skipAuth: false }), true)
})

test('shouldInvalidateSession ignores anonymous or non-user roles', () => {
  assert.equal(shouldInvalidateSession({ token: '', status: 401, code: 4002, skipAuth: false }), false)
  assert.equal(shouldInvalidateSession({ token: makeJwt({ role: 'ADMIN', sub: '1' }), status: 401, code: 4002, skipAuth: false }), false)
  assert.equal(shouldInvalidateSession({ token: makeJwt({ role: 'USER', sub: '2' }), status: 401, code: 4002, skipAuth: true }), false)
  assert.equal(shouldInvalidateSession({ token: makeJwt({ role: 'USER', sub: '2' }), status: 500, code: 5000, skipAuth: false }), false)
})
