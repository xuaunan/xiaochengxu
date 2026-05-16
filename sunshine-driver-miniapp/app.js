const { createDefaultDriverStore } = require('./utils/driver-store')
const { hasUsableRoute } = require('./utils/route-display')

function getCurrentPageInstance() {
  if (typeof getCurrentPages !== 'function') return null
  const pages = getCurrentPages()
  return pages && pages.length ? pages[pages.length - 1] : null
}

function animatePageRoot(page, frames, duration) {
  if (!page || typeof page.animate !== 'function') return

  ;['.page-shell', '.dashboard-page', '.trip-page', '.profile-page'].forEach((selector) => {
    try {
      page.animate(selector, frames, duration)
    } catch (error) {
    }
  })
}

function resetPageRootAnimation(page) {
  if (!page || typeof page.clearAnimation !== 'function') return

  ;['.page-shell', '.dashboard-page', '.trip-page', '.profile-page'].forEach((selector) => {
    try {
      page.clearAnimation(selector, {
        opacity: true,
        transform: true
      })
    } catch (error) {
    }
  })
}

function markGlobalNavTransition(app, type) {
  if (!app || !app.globalData) return
  app.globalData.uiTransition = {
    ...(app.globalData.uiTransition || {}),
    globalNavAt: Date.now(),
    globalNavType: type || 'navigate',
    globalNavConsumed: false
  }
}

function playGlobalPageEnter(page, app) {
  const transition = app && app.globalData ? app.globalData.uiTransition || {} : {}
  const navAt = Number(transition.globalNavAt || 0)

  if (!navAt || transition.globalNavConsumed || Date.now() - navAt > 1000) return

  app.globalData.uiTransition = {
    ...transition,
    globalNavConsumed: true
  }

  setTimeout(() => {
    animatePageRoot(page, [
      { opacity: 0.96, transform: 'translateY(8rpx) scale(0.998)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], 260)
  }, 16)
}

function stripInternalNavOptions(options = {}) {
  const cleanOptions = { ...options }
  delete cleanOptions.__silkyHandled
  delete cleanOptions.__silkyImmediate
  return cleanOptions
}

function installGlobalNavigationBridge(app) {
  if (!wx || wx.__sunshineDriverNavBridgeInstalled) return

  const navApis = [
    ['navigateTo', 96],
    ['redirectTo', 96],
    ['switchTab', 96],
    ['navigateBack', 130]
  ]

  navApis.forEach(([name, duration]) => {
    const original = wx[name]
    if (typeof original !== 'function') return

    wx[name] = function sunshineDriverNavBridge(options = {}) {
      const cleanOptions = stripInternalNavOptions(options)

      markGlobalNavTransition(app, name)

      if (options.__silkyImmediate || options.__silkyHandled) {
        return original.call(wx, cleanOptions)
      }

      animatePageRoot(getCurrentPageInstance(), [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0.9, transform: 'translateY(3rpx) scale(0.999)' }
      ], duration)

      setTimeout(() => {
        original.call(wx, cleanOptions)
      }, duration)
      return undefined
    }
  })

  wx.__sunshineDriverNavBridgeInstalled = true
}

function installGlobalPageBridge(app) {
  if (typeof Page !== 'function' || Page.__sunshineDriverPageBridgeInstalled) return

  const originalPage = Page
  Page = function sunshineDriverPageBridge(config = {}) {
    const originalOnShow = config.onShow
    const originalOnUnload = config.onUnload

    config.onShow = function sunshineDriverPageOnShow(...args) {
      resetPageRootAnimation(this)
      const result = originalOnShow ? originalOnShow.apply(this, args) : undefined
      playGlobalPageEnter(this, app)
      return result
    }

    config.onUnload = function sunshineDriverPageOnUnload(...args) {
      clearTimeout(this.__sunshineDriverEnterTimer)
      return originalOnUnload ? originalOnUnload.apply(this, args) : undefined
    }

    return originalPage(config)
  }

  Page.__sunshineDriverPageBridgeInstalled = true
}

App({
  globalData: {
    baseUrl: 'http://127.0.0.1:8080',
    uploadEndpoints: [
      '/driver/upload'
    ],
    runtimeCache: {},
    uiTransition: {},
    mapConfig: {
      tencentKey: 'NHNBZ-F5FW3-Z4C3Q-R4WUM-ODTPE-DRFDV'
    },
    driverStore: null,
    token: '',
    loginInfo: null
  },

  onLaunch() {
    installGlobalNavigationBridge(this)
    installGlobalPageBridge(this)
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
