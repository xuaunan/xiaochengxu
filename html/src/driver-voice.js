export const DRIVER_VOICE_STYLES = [
  { value: 'default', label: '播音声音', directory: 'default', extension: '.mp3' },
  { value: 'original-default', label: '默认声音', directory: '', extension: '.wav' },
  { value: 'gentle-female', label: '亲切自然女声', directory: 'gentle-female', extension: '.mp3' },
  { value: 'sunny-energetic', label: '阳光活力男声', directory: 'sunny-energetic', extension: '.mp3' },
  { value: 'mature-man', label: '稳重大叔声音', directory: 'mature-man', extension: '.mp3' },
  { value: 'playful', label: '儿童声音', directory: 'playful', extension: '.mp3' },
  { value: 'original-playful', label: '搞怪声音', directory: 'playful', extension: '.wav' }
]

const STYLE_MAP = new Map(DRIVER_VOICE_STYLES.map((item) => [item.value, item]))
const EVENT_FILES = {
  'auto-accept': 'driver-auto-accept',
  'carpool-order': 'driver-carpool-order',
  'pickup-500': 'driver-pickup-500',
  'passenger-onboard': 'driver-passenger-onboard',
  'onboard-reminder': 'driver-onboard-reminder',
  'destination-500': 'driver-destination-500',
  'passenger-cancel': 'driver-passenger-cancel'
}

export const DRIVER_VOICE_EVENT_LABELS = {
  'auto-accept': '已接单，开始接驾',
  'carpool-order': '新的顺风车订单',
  'pickup-500': '距离上车点还有 500 米',
  'passenger-onboard': '乘客已上车',
  'onboard-reminder': '请提醒乘客系好安全带',
  'destination-500': '距离目的地还有 500 米',
  'passenger-cancel': '乘客已取消订单'
}

export function normalizeDriverVoiceStyle(value) {
  return STYLE_MAP.has(value) ? value : 'default'
}

export function driverVoiceStyleLabel(value) {
  return STYLE_MAP.get(normalizeDriverVoiceStyle(value)).label
}

export function resolveDriverVoicePath(eventKey, voiceStyle = 'default') {
  const filename = EVENT_FILES[eventKey]
  if (!filename) return ''
  const style = STYLE_MAP.get(normalizeDriverVoiceStyle(voiceStyle))
  const directory = style.directory ? `/voices/${style.directory}` : ''
  return `/audio${directory}/${filename}${style.extension}`
}

export function createBrowserVoiceQueue(audioFactory = () => new Audio()) {
  const queue = []
  let playing = false
  let current = null

  const playNext = () => {
    if (playing || !queue.length) return
    const task = queue.shift()
    const audio = audioFactory()
    if (!audio) {
      task.reject(new Error('当前浏览器无法播放语音'))
      queueMicrotask(playNext)
      return
    }
    playing = true
    current = audio
    let settled = false
    const settle = (error) => {
      if (settled) return
      settled = true
      playing = false
      current = null
      audio.onended = null
      audio.onerror = null
      if (error) task.reject(error)
      else task.resolve()
      queueMicrotask(playNext)
    }
    audio.preload = 'auto'
    audio.src = task.path
    audio.volume = task.volume
    audio.onended = () => settle()
    audio.onerror = () => settle(new Error('语音资源播放失败'))
    Promise.resolve(audio.play()).catch((error) => settle(error))
  }

  return {
    enqueue(path, options = {}) {
      return new Promise((resolve, reject) => {
        if (!path) {
          reject(new Error('语音资源不存在'))
          return
        }
        queue.push({ path, volume: Number.isFinite(options.volume) ? options.volume : 1, resolve, reject })
        playNext()
      })
    },
    reset() {
      queue.length = 0
      if (current) {
        try { current.pause() } catch (error) {}
      }
      current = null
      playing = false
    },
    getState() {
      return { playing, queueLength: queue.length, currentPath: current?.src || '' }
    }
  }
}

const playedEvents = new Set()
const sharedQueue = typeof window === 'undefined' ? null : createBrowserVoiceQueue()

export function driverVoiceEventId(order = {}, eventKey = '') {
  const orderId = order.id || order.orderNo || 'unknown'
  return `${orderId}:${eventKey}`
}

export function detectDriverVoiceEvents(previousOrder = null, currentOrder = null, previousRuntime = null, currentRuntime = null) {
  if (!currentOrder) return []
  const events = []
  const previousStatus = String(previousOrder?.orderStatus || '')
  const currentStatus = String(currentOrder.orderStatus || '')
  if (currentStatus === 'CANCELLED' && previousStatus && previousStatus !== 'CANCELLED' && (!currentOrder.cancelByRole || currentOrder.cancelByRole === 'USER')) {
    events.push('passenger-cancel')
  }
  if (['ACCEPTED', 'PICKING_UP'].includes(currentStatus) && !['ACCEPTED', 'PICKING_UP', 'IN_TRIP'].includes(previousStatus)) {
    events.push('auto-accept')
  }
  if (currentStatus === 'IN_TRIP' && previousStatus && previousStatus !== 'IN_TRIP') {
    events.push('passenger-onboard', 'onboard-reminder')
  }
  const previousDistance = Number(previousRuntime?.remainDistanceKm)
  const currentDistance = Number(currentRuntime?.remainDistanceKm)
  const crossedFiveHundredMeters = Number.isFinite(currentDistance) && currentDistance <= 0.5 && (!Number.isFinite(previousDistance) || previousDistance > 0.5)
  if (crossedFiveHundredMeters && currentStatus === 'PICKING_UP') events.push('pickup-500')
  if (crossedFiveHundredMeters && currentStatus === 'IN_TRIP') events.push('destination-500')
  return [...new Set(events)]
}

export function playDriverVoice(eventKey, voiceStyle = 'default', options = {}) {
  const path = resolveDriverVoicePath(eventKey, voiceStyle)
  if (!sharedQueue) return Promise.reject(new Error('当前环境无法播放语音'))
  const eventId = options.eventId || eventKey
  if (options.dedupe !== false && playedEvents.has(eventId)) return Promise.resolve(false)
  if (options.dedupe !== false) playedEvents.add(eventId)
  return sharedQueue.enqueue(path, options).then(() => true).catch((error) => {
    if (options.dedupe !== false) playedEvents.delete(eventId)
    throw error
  })
}

export async function primeDriverVoice(voiceStyle = 'default') {
  if (typeof Audio === 'undefined') throw new Error('当前浏览器无法播放语音')
  const audio = new Audio(resolveDriverVoicePath('auto-accept', voiceStyle))
  audio.preload = 'auto'
  audio.volume = 0
  await audio.play()
  audio.pause()
  audio.currentTime = 0
  return true
}
