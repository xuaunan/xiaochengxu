const { resolveVoiceAudioPath, normalizeVoiceStyle } = require('./voice-config')
const { enqueueVoiceAudio } = require('./voice-player')

function timeText() {
  const date = new Date()
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getStore() {
  return getApp().globalData.driverStore
}

function ensureSets(store) {
  store.voiceHistory = store.voiceHistory || {}
  store.noticeHistory = store.noticeHistory || {}
  return store
}

function pushDriverMessage(title, content, options = {}) {
  const store = ensureSets(getStore())
  const id = options.id || `driver-msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (store.noticeHistory[id]) return null
  store.noticeHistory[id] = true
  const message = {
    id,
    title,
    content,
    time: options.time || timeText(),
    unread: true,
    type: options.type || 'notice'
  }
  store.messages = [message].concat(store.messages || []).slice(0, 30)
  getApp().saveStore()
  return message
}

function showMiniPopup(page, popup) {
  if (!page || !page.setData || !popup) return
  clearTimeout(page.__driverPopupTimer)
  page.setData({
    noticePopup: {
      ...popup,
      visible: true
    }
  })
  page.__driverPopupTimer = setTimeout(() => {
    page.setData({
      'noticePopup.visible': false
    })
  }, popup.duration || 2600)
}

function pickBaseAudioPath(key = '', text = '', options = {}) {
  if (options.audioPath) return options.audioPath

  const source = `${options.audioKey || key || ''} ${text || ''}`
  if (source.includes('auto-accept') || text.includes('自动接单')) return '/audio/driver-auto-accept.wav'
  if (source.includes('carpool') || text.includes('顺风车')) return '/audio/driver-carpool-order.wav'
  if (source.includes('passenger-cancel') || text.includes('取消订单')) return '/audio/driver-passenger-cancel.wav'
  if (source.includes('pickup-500') || text.includes('上车点还有500米')) return '/audio/driver-pickup-500.wav'
  if (source.includes('passenger-onboard') || text.includes('乘客已上车')) return '/audio/driver-passenger-onboard.wav'
  if (source.includes('passenger-reminder-after-onboard') || text.includes('安全带')) return '/audio/driver-onboard-reminder.wav'
  if (source.includes('destination-500') || text.includes('目的地还有500米')) return '/audio/driver-destination-500.wav'
  return '/audio/driver-carpool-order.wav'
}

function getAudioPath(key = '', text = '', options = {}, voiceStyle = 'default') {
  return resolveVoiceAudioPath(pickBaseAudioPath(key, text, options), voiceStyle)
}

function notifyDriver(page, title, content, options = {}) {
  const message = pushDriverMessage(title, content, options)
  if (!message) return null
  showMiniPopup(page, {
    type: options.type || 'notice',
    title,
    content
  })
  return message
}

function broadcastDriver(page, text, key, options = {}) {
  const store = ensureSets(getStore())
  const historyKey = key || text
  if (!text || store.voiceHistory[historyKey]) return false
  store.voiceHistory[historyKey] = true
  getApp().saveStore()

  if (!options.force && store.settings && store.settings.voiceBroadcast === false) {
    return false
  }

  const voiceStyle = normalizeVoiceStyle(store.settings && store.settings.voiceStyle)
  showMiniPopup(page, {
    type: 'voice',
    title: options.title || '司机端语音播报',
    content: text,
    duration: options.duration || 3200
  })

  const audioPath = getAudioPath(historyKey, text, options, voiceStyle)
  enqueueVoiceAudio(audioPath).catch(() => {
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({
        title: text.length > 18 ? `${text.slice(0, 18)}...` : text,
        icon: 'none'
      })
    }
  })
  return true
}

module.exports = {
  broadcastDriver,
  getAudioPath,
  notifyDriver,
  pushDriverMessage,
  showMiniPopup
}
