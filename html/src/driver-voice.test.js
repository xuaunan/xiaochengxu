import test from 'node:test'
import assert from 'node:assert/strict'

import { createBrowserVoiceQueue, detectDriverVoiceEvents, resolveDriverVoicePath } from './driver-voice.js'

test('resolveDriverVoicePath uses the miniapp voice directory convention', () => {
  assert.equal(resolveDriverVoicePath('auto-accept', 'default'), '/audio/voices/default/driver-auto-accept.mp3')
  assert.equal(resolveDriverVoicePath('passenger-cancel', 'original-default'), '/audio/driver-passenger-cancel.wav')
  assert.equal(resolveDriverVoicePath('destination-500', 'original-playful'), '/audio/voices/playful/driver-destination-500.wav')
})

test('detectDriverVoiceEvents emits state and distance transitions once', () => {
  assert.deepEqual(
    detectDriverVoiceEvents({ orderStatus: 'DISPATCHING' }, { orderStatus: 'PICKING_UP' }),
    ['auto-accept']
  )
  assert.deepEqual(
    detectDriverVoiceEvents(
      { orderStatus: 'PICKING_UP' },
      { orderStatus: 'IN_TRIP' },
      { remainDistanceKm: 1.2 },
      { remainDistanceKm: 0.4 }
    ),
    ['passenger-onboard', 'onboard-reminder', 'destination-500']
  )
})

test('browser voice queue plays clips in order', async () => {
  const played = []
  const queue = createBrowserVoiceQueue(() => ({
    set src(value) { this._src = value },
    get src() { return this._src },
    volume: 1,
    play() {
      played.push(this.src)
      queueMicrotask(() => this.onended?.())
      return Promise.resolve()
    },
    pause() {}
  }))

  await Promise.all([queue.enqueue('/one.mp3'), queue.enqueue('/two.mp3')])
  assert.deepEqual(played, ['/one.mp3', '/two.mp3'])
})
