const { createDefaultDriverStore } = require('./utils/driver-store')
const { hasUsableRoute } = require('./utils/route-display')

App({
  globalData: {
    baseUrl: 'http://127.0.0.1:8080',
    uploadEndpoints: [
      '/driver/upload'
    ],
    runtimeCache: {},
    mapConfig: {
      tencentKey: 'NHNBZ-F5FW3-Z4C3Q-R4WUM-ODTPE-DRFDV'
    },
    driverStore: null,
    token: '',
    loginInfo: null
  },

  onLaunch() {
    this.globalData.driverStore = wx.getStorageSync('sunshine-driver-store') || createDefaultDriverStore()
    this.globalData.driverStore.settings = {
      listenMode: false,
      autoAccept: false,
      voiceBroadcast: true,
      voiceStyle: 'default',
      trackMode: 'DEMO',
      manualResting: false,
      listeningSince: 0,
      ...(this.globalData.driverStore.settings || {})
    }
    this.globalData.driverStore.settings.trackMode = this.globalData.driverStore.settings.trackMode === 'REAL' ? 'REAL' : 'DEMO'
    this.globalData.driverStore.messages = this.globalData.driverStore.messages || []
    this.globalData.driverStore.noticeHistory = this.globalData.driverStore.noticeHistory || {}
    this.globalData.driverStore.voiceHistory = this.globalData.driverStore.voiceHistory || {}
    this.globalData.token = wx.getStorageSync('sunshine-driver-token') || ''
    this.globalData.loginInfo = wx.getStorageSync('sunshine-driver-login-info') || null
    this.globalData.driverStore.loggedIn = Boolean(this.globalData.token)
  },

  saveStore() {
    wx.setStorageSync('sunshine-driver-store', this.globalData.driverStore)
  },

  getOrderRuntimeCache(orderId) {
    if (!orderId) return null
    return this.globalData.runtimeCache[String(orderId)] || null
  },

  setOrderRuntimeCache(orderId, runtime) {
    if (!orderId || !runtime) return
    if (!hasUsableRoute(runtime)) {
      return
    }

    const cache = this.globalData.runtimeCache || {}
    cache[String(orderId)] = {
      ...runtime,
      __cachedAt: Date.now()
    }

    const keys = Object.keys(cache)
      .sort((left, right) => Number((cache[right] || {}).__cachedAt || 0) - Number((cache[left] || {}).__cachedAt || 0))
      .slice(0, 20)
    this.globalData.runtimeCache = keys.reduce((result, key) => {
      result[key] = cache[key]
      return result
    }, {})
  },

  setLoginInfo(loginInfo) {
    this.globalData.loginInfo = loginInfo || null
    this.globalData.token = loginInfo ? loginInfo.token : ''
    this.globalData.driverStore.loggedIn = Boolean(loginInfo)
    this.globalData.driverStore.loginInfo = loginInfo || null
    wx.setStorageSync('sunshine-driver-login-info', this.globalData.loginInfo)
    wx.setStorageSync('sunshine-driver-token', this.globalData.token)
    this.saveStore()
  },

  clearSession() {
    this.globalData.driverStore = createDefaultDriverStore()
    this.globalData.token = ''
    this.globalData.loginInfo = null
    wx.removeStorageSync('sunshine-driver-login-info')
    wx.removeStorageSync('sunshine-driver-token')
    wx.removeStorageSync('sunshine-driver-store')
    wx.setStorageSync('sunshine-driver-store', this.globalData.driverStore)
  }
})
