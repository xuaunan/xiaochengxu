const { updateServiceStatus } = require('../../utils/api')
const { DRIVER_SERVICE_STATUS } = require('../../utils/constants')
const { broadcastDriver } = require('../../utils/notify')
const { TRACK_MODE_OPTIONS, getTrackModeDesc, getTrackModeLabel, normalizeTrackMode } = require('../../utils/track-mode')
const { VOICE_STYLE_OPTIONS, getVoiceStyleLabel, normalizeVoiceStyle } = require('../../utils/voice-config')

Page({
  data: {
    settings: {},
    currentVoiceStyleLabel: '',
    currentTrackModeLabel: '',
    currentTrackModeDesc: '',
    trackModeOptions: TRACK_MODE_OPTIONS,
    voiceStyleOptions: VOICE_STYLE_OPTIONS
  },

  onShow() {
    this.syncSettings()
  },

  syncSettings() {
    const settings = {
      ...(getApp().globalData.driverStore.settings || {})
    }
    settings.voiceStyle = normalizeVoiceStyle(settings.voiceStyle)
    settings.trackMode = normalizeTrackMode(settings.trackMode)
    this.setData({
      settings,
      currentTrackModeLabel: getTrackModeLabel(settings.trackMode),
      currentTrackModeDesc: getTrackModeDesc(settings.trackMode),
      currentVoiceStyleLabel: getVoiceStyleLabel(settings.voiceStyle)
    })
  },

  persistSettings(settings) {
    const nextSettings = {
      ...settings,
      voiceStyle: normalizeVoiceStyle(settings.voiceStyle),
      trackMode: normalizeTrackMode(settings.trackMode)
    }
    this.setData({
      settings: nextSettings,
      currentTrackModeLabel: getTrackModeLabel(nextSettings.trackMode),
      currentTrackModeDesc: getTrackModeDesc(nextSettings.trackMode),
      currentVoiceStyleLabel: getVoiceStyleLabel(nextSettings.voiceStyle)
    })
    getApp().globalData.driverStore.settings = nextSettings
    getApp().saveStore()
  },

  safeGetLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: () => resolve({ latitude: 31.2304, longitude: 121.4737 })
      })
    })
  },

  async toggle(e) {
    const key = e.currentTarget.dataset.key
    const settings = {
      ...this.data.settings,
      voiceStyle: normalizeVoiceStyle(this.data.settings.voiceStyle),
      trackMode: normalizeTrackMode(this.data.settings.trackMode),
      [key]: !this.data.settings[key]
    }

    if (key === 'listenMode') {
      const nextStatus = settings.listenMode ? DRIVER_SERVICE_STATUS.ONLINE : DRIVER_SERVICE_STATUS.OFFLINE
      const location = await this.safeGetLocation()
      await updateServiceStatus({
        serviceStatus: nextStatus,
        longitude: `${location.longitude}`,
        latitude: `${location.latitude}`
      })
      settings.manualResting = nextStatus === DRIVER_SERVICE_STATUS.OFFLINE
      settings.listeningSince = settings.listenMode ? Date.now() : 0
      wx.showToast({
        title: settings.listenMode ? '已开始接单' : '已停止接单',
        icon: 'success'
      })
    }

    this.persistSettings(settings)
  },

  selectTrackMode(e) {
    const value = normalizeTrackMode(e.currentTarget.dataset.value)
    if (value === this.data.settings.trackMode) {
      return
    }

    const settings = {
      ...this.data.settings,
      trackMode: value
    }
    this.persistSettings(settings)
    wx.showToast({
      title: `已切换为${getTrackModeLabel(value)}轨迹`,
      icon: 'none'
    })
  },

  selectVoiceStyle(e) {
    const value = normalizeVoiceStyle(e.currentTarget.dataset.value)
    if (value === this.data.settings.voiceStyle) {
      return
    }

    const settings = {
      ...this.data.settings,
      voiceStyle: value
    }
    this.persistSettings(settings)
    wx.showToast({
      title: `已切换为${getVoiceStyleLabel(value)}`,
      icon: 'none'
    })
  },

  previewVoice() {
    const voiceStyleLabel = this.data.currentVoiceStyleLabel || '默认声音'
    broadcastDriver(
      this,
      `当前声音为${voiceStyleLabel}，请确认播报效果`,
      `voice-preview-${Date.now()}`,
      {
        title: '语音试听',
        duration: 2800,
        audioKey: 'carpool-order',
        force: true
      }
    )
  }
})
