const { updateServiceStatus } = require('../../utils/api')
const { DRIVER_SERVICE_STATUS, ORDER_STATUS } = require('../../utils/constants')
const { broadcastDriver } = require('../../utils/notify')
const { TRACK_MODE_OPTIONS, getTrackModeDesc, getTrackModeLabel, normalizeTrackMode } = require('../../utils/track-mode')
const { LOCATION_MODE_OPTIONS, getLocationModeDesc, getLocationModeLabel, normalizeLocationMode } = require('../../utils/location-mode')
const { VOICE_STYLE_OPTIONS, getVoiceStyleLabel, normalizeVoiceStyle } = require('../../utils/voice-config')

Page({
  data: {
    settings: {},
    currentVoiceStyleLabel: '',
    currentTrackModeLabel: '',
    currentTrackModeDesc: '',
    trackModeOptions: TRACK_MODE_OPTIONS,
    locationModeOptions: LOCATION_MODE_OPTIONS,
    currentLocationModeLabel: '',
    currentLocationModeDesc: '',
    locating: false,
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
    settings.locationMode = normalizeLocationMode(settings.locationMode)
    this.setData({
      settings,
      currentTrackModeLabel: getTrackModeLabel(settings.trackMode),
      currentTrackModeDesc: getTrackModeDesc(settings.trackMode),
      currentLocationModeLabel: getLocationModeLabel(settings.locationMode),
      currentLocationModeDesc: getLocationModeDesc(settings.locationMode),
      currentVoiceStyleLabel: getVoiceStyleLabel(settings.voiceStyle)
    })
  },

  persistSettings(settings) {
    const nextSettings = {
      ...settings,
      voiceStyle: normalizeVoiceStyle(settings.voiceStyle),
      trackMode: normalizeTrackMode(settings.trackMode),
      locationMode: normalizeLocationMode(settings.locationMode)
    }
    this.setData({
      settings: nextSettings,
      currentTrackModeLabel: getTrackModeLabel(nextSettings.trackMode),
      currentTrackModeDesc: getTrackModeDesc(nextSettings.trackMode),
      currentLocationModeLabel: getLocationModeLabel(nextSettings.locationMode),
      currentLocationModeDesc: getLocationModeDesc(nextSettings.locationMode),
      currentVoiceStyleLabel: getVoiceStyleLabel(nextSettings.voiceStyle)
    })
    getApp().globalData.driverStore.settings = nextSettings
    getApp().saveStore()
  },

  // 是否有进行中的行程（ACCEPTED/PICKING_UP/IN_TRIP），行程中禁止切换定位模式
  isDriverBusyInTrip() {
    const store = getApp().globalData.driverStore || {}
    const activeTrip = (store.tripOrders || []).some((item) => (
      [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(item.orderStatus)
    ))
    return activeTrip || ((store.profile || {}).serviceStatus) === DRIVER_SERVICE_STATUS.BUSY
  },

  // 获取真实定位，失败返回 null（不回退假坐标）
  acquireRealLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: () => resolve(null)
      })
    })
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

  async selectLocationMode(e) {
    if (this.data.locating) return
    const value = normalizeLocationMode(e.currentTarget.dataset.value)
    if (value === this.data.settings.locationMode) {
      return
    }
    if (this.isDriverBusyInTrip()) {
      wx.showToast({
        title: '行程中无法切换定位模式',
        icon: 'none'
      })
      return
    }

    if (value === 'DEMO') {
      this.persistSettings({
        ...this.data.settings,
        locationMode: 'DEMO',
        realLocationReady: false
      })
      wx.showToast({
        title: '已切换为演示定位',
        icon: 'none'
      })
      return
    }

    // 切换为真实定位：必须真正取到 GPS 才算切换成功
    this.setData({ locating: true })
    wx.showToast({ title: '正在获取真实定位...', icon: 'loading', duration: 10000 })
    const location = await this.acquireRealLocation()
    wx.hideToast()
    this.setData({ locating: false })

    if (location) {
      const settings = {
        ...this.data.settings,
        locationMode: 'REAL',
        realLatitude: location.latitude,
        realLongitude: location.longitude,
        realLocationReady: true
      }
      this.persistSettings(settings)
      // 把真实坐标同步给后端（保持当前上下线状态不变）
      const serviceStatus = settings.listenMode ? DRIVER_SERVICE_STATUS.ONLINE : DRIVER_SERVICE_STATUS.OFFLINE
      updateServiceStatus({
        serviceStatus,
        longitude: `${location.longitude}`,
        latitude: `${location.latitude}`
      }, { skipToast: true }).catch(() => {})
      wx.showToast({
        title: '已切换为真实定位，行程中乘客端同步真实位置',
        icon: 'none',
        duration: 2500
      })
      return
    }

    // 获取失败：仍记为真实定位，但标记未就绪 —— 快车/国际出行订单将无法接收，直到定位成功
    this.persistSettings({
      ...this.data.settings,
      locationMode: 'REAL',
      realLocationReady: false
    })
    wx.showModal({
      title: '真实定位获取失败',
      content: '未获取到真实定位，快车/国际出行订单将无法接收（顺风车不受影响）。请检查微信定位授权后，重新点击"真实定位"。',
      confirmText: '去授权',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({})
        }
      }
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
