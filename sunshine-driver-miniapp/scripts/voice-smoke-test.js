const fs = require('fs')
const path = require('path')
const { getAudioPath } = require('../utils/notify')
const { VOICE_STYLE_OPTIONS } = require('../utils/voice-config')
const { createVoicePlayer } = require('../utils/voice-player')

const rootDir = path.join(__dirname, '..')
const sampleCases = [
  { key: 'auto-accept-test', text: '已自动接单，乘客从虹桥站前往静安寺' },
  { key: 'carpool-order-test', text: '有新的顺风车订单，从浦东机场前往外滩' },
  { key: 'passenger-cancel-test', text: '乘客已取消订单，虹桥站到静安寺' },
  { key: 'pickup-500-test', text: '距离上车点还有500米，请准备接乘客' },
  { key: 'passenger-onboard-test', text: '乘客已上车，请开始行程' },
  { key: 'passenger-reminder-after-onboard-test', text: '请提醒乘客系好安全带并确认目的地' },
  { key: 'destination-500-test', text: '距离目的地还有500米，请提醒乘客带好随身物品' }
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function resolveLocalAudioPath(audioPath) {
  return path.join(rootDir, audioPath.replace(/^\//, ''))
}

function verifyVoiceAssets() {
  const verified = []
  const baseAudioHashes = new Map()
  sampleCases.forEach((sample) => {
    const defaultPath = getAudioPath(sample.key, sample.text, {}, 'default')
    baseAudioHashes.set(sample.key, fs.readFileSync(resolveLocalAudioPath(defaultPath)).toString('base64'))
  })

  VOICE_STYLE_OPTIONS.forEach((voice) => {
    sampleCases.forEach((sample) => {
      const audioPath = getAudioPath(sample.key, sample.text, {}, voice.value)
      const localPath = resolveLocalAudioPath(audioPath)
      assert(fs.existsSync(localPath), `missing audio asset: ${audioPath}`)
      const size = fs.statSync(localPath).size
      assert(size > 0, `empty audio asset: ${audioPath}`)
      if (voice.value !== 'default') {
        const currentHash = fs.readFileSync(localPath).toString('base64')
        assert(currentHash !== baseAudioHashes.get(sample.key), `voice asset unchanged: ${audioPath}`)
      }
      verified.push(audioPath)
    })
  })

  const compareSample = sampleCases[1]
  const styleFingerprints = VOICE_STYLE_OPTIONS
    .filter((voice) => voice.value !== 'default')
    .map((voice) => fs.readFileSync(resolveLocalAudioPath(getAudioPath(compareSample.key, compareSample.text, {}, voice.value))).slice(0, 128).toString('hex'))
  assert(new Set(styleFingerprints).size === styleFingerprints.length, 'voice styles are too similar at binary level')

  return verified
}

async function verifyQueuePlayback() {
  const playedOrder = []
  const activeStack = []
  let maxActive = 0

  const player = createVoicePlayer(() => {
    let endedHandler = null
    let errorHandler = null
    return {
      src: '',
      onEnded(handler) {
        endedHandler = handler
      },
      onError(handler) {
        errorHandler = handler
      },
      play() {
        playedOrder.push(this.src)
        activeStack.push(this.src)
        maxActive = Math.max(maxActive, activeStack.length)
        setTimeout(() => {
          activeStack.pop()
          if (endedHandler) {
            endedHandler()
            return
          }
          if (errorHandler) {
            errorHandler(new Error('missing ended handler'))
          }
        }, 5)
      },
      stop() {},
      destroy() {}
    }
  })

  const expectedOrder = sampleCases.slice(0, 3).map((sample) => getAudioPath(sample.key, sample.text))
  await Promise.all(expectedOrder.map((audioPath) => player.enqueue(audioPath)))

  assert(JSON.stringify(playedOrder) === JSON.stringify(expectedOrder), 'voice queue playback order mismatch')
  assert(maxActive === 1, `voice queue overlapped playback: ${maxActive}`)
}

async function main() {
  const verified = verifyVoiceAssets()
  await verifyQueuePlayback()
  console.log(`voice smoke test passed: verified ${verified.length} audio mappings and queue playback order`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
