const { POI_LIBRARY, createDefaultUserStore } = require('./utils/catalog')
const { getDefaultDraft } = require('./utils/user-store')
const { ORDER_STATUS, PAY_STATUS } = require('./utils/constants')
const { hasUsableRoute } = require('./utils/route-display')

function restorePoiLabel(point) {
  if (!point) return point
  if (point.name && point.address) {
    return point
  }
  const latitude = Number(point.latitude)
  const longitude = Number(point.longitude)
  const matched = POI_LIBRARY.find((item) => {
    return Math.abs(Number(item.latitude) - latitude) < 0.0001 &&
      Math.abs(Number(item.longitude) - longitude) < 0.0001
  })

  if (!matched) return point

  return {
    ...point,
    id: point.id || matched.id,
    name: matched.name,
    address: matched.address
  }
}

function normalizeDraft(draft) {
  const fallback = getDefaultDraft()
  const nextDraft = draft || fallback
  return {
    ...fallback,
    ...nextDraft,
    start: restorePoiLabel(nextDraft.start) || fallback.start,
    end: restorePoiLabel(nextDraft.end) || fallback.end
  }
}

function isSameOrder(left, right) {
  if (!left || !right) return false
  return `${left.id || ''}` === `${right.id || ''}` || `${left.orderNo || ''}` === `${right.orderNo || ''}`
}

function getOrderIdentity(order) {
  if (!order) return ''
  if (order.id !== undefined && order.id !== null && `${order.id}`) {
    return `id:${order.id}`
  }
  if (order.orderNo) {
    return `orderNo:${order.orderNo}`
  }
  return ''
}

function isActiveRideOrder(order) {
  return Boolean(order && order.id && ![ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(order.orderStatus))
}

function sortOrdersDesc(orders = []) {
  return orders.sort((left, right) => {
    const rightId = Number(right && right.id ? right.id : 0)
    const leftId = Number(left && left.id ? left.id : 0)
    if (rightId !== leftId) return rightId - leftId
    return `${right && right.updatedAt ? right.updatedAt : ''}`.localeCompare(`${left && left.updatedAt ? left.updatedAt : ''}`)
  })
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function normalizeOrders(orders = []) {
  const deduped = new Map()
  ;(Array.isArray(orders) ? orders : []).forEach((item) => {
    const identity = getOrderIdentity(item)
    if (!identity) return
    const existing = deduped.get(identity)
    deduped.set(identity, existing ? { ...existing, ...item } : { ...item })
  })
  return sortOrdersDesc(Array.from(deduped.values())).slice(0, 50)
}

function pickCurrentRideOrder(orders = [], currentRideOrder = null) {
  const normalizedOrders = normalizeOrders(orders)
  const currentFromList = normalizedOrders.find((item) => currentRideOrder && isSameOrder(item, currentRideOrder)) || null
  const normalizedCurrent = currentFromList || (currentRideOrder && getOrderIdentity(currentRideOrder) ? { ...currentRideOrder } : null)
  const latestActive = normalizedOrders.find((item) => isActiveRideOrder(item)) || null

  if (latestActive) {
    return { ...latestActive }
  }

  if (normalizedCurrent &&
    normalizedCurrent.orderStatus === ORDER_STATUS.FINISHED &&
    normalizedCurrent.payStatus === PAY_STATUS.UNPAID) {
    return { ...normalizedCurrent }
  }

  return null
}

function normalizeUserStore(store) {
  const base = createDefaultUserStore()
  const merged = {
    ...base,
    ...(store || {})
  }
  merged.orders = normalizeOrders(merged.orders)
  merged.currentRideOrder = pickCurrentRideOrder(merged.orders, merged.currentRideOrder)
  return merged
}

function getCurrentPageInstance() {
  if (typeof getCurrentPages !== 'function') return null
  const pages = getCurrentPages()
  return pages && pages.length ? pages[pages.length - 1] : null
}

function animatePageRoot(page, frames, duration) {
  if (!page || typeof page.animate !== 'function') return

  ;['.page-shell', '.home-page', '.picker-page', '.address-page'].forEach((selector) => {
    try {
      page.animate(selector, frames, duration)
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
      { opacity: 0.94, transform: 'translateY(12rpx) scale(0.996)' },
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
  if (!wx || wx.__sunshineNavBridgeInstalled) return

  const navApis = [
    ['navigateTo', 96],
    ['redirectTo', 96],
    ['switchTab', 96],
    ['navigateBack', 130]
  ]

  navApis.forEach(([name, duration]) => {
    const original = wx[name]
    if (typeof original !== 'function') return

    wx[name] = function sunshineNavBridge(options = {}) {
      const cleanOptions = stripInternalNavOptions(options)

      markGlobalNavTransition(app, name)

      if (options.__silkyImmediate || options.__silkyHandled) {
        return original.call(wx, cleanOptions)
      }

      animatePageRoot(getCurrentPageInstance(), [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0.82, transform: 'translateY(4rpx) scale(0.998)' }
      ], duration)

      setTimeout(() => {
        original.call(wx, cleanOptions)
      }, duration)
      return undefined
    }
  })

  wx.__sunshineNavBridgeInstalled = true
}

function installGlobalPageBridge(app) {
  if (typeof Page !== 'function' || Page.__sunshinePageBridgeInstalled) return

  const originalPage = Page
  Page = function sunshinePageBridge(config = {}) {
    const originalOnShow = config.onShow
    const originalOnUnload = config.onUnload

    config.onShow = function sunshinePageOnShow(...args) {
      const result = originalOnShow ? originalOnShow.apply(this, args) : undefined
      playGlobalPageEnter(this, app)
      return result
    }

    config.onUnload = function sunshinePageOnUnload(...args) {
      clearTimeout(this.silkyReturnTimer)
      clearTimeout(this.__sunshineGlobalEnterTimer)
      return originalOnUnload ? originalOnUnload.apply(this, args) : undefined
    }

    return originalPage(config)
  }

  Page.__sunshinePageBridgeInstalled = true
}

App({
  globalData: {
    baseUrl: 'http://127.0.0.1:8080',
    token: '',
    poiLibrary: [],
    runtimeCache: {},
    uiTransition: {},
    mapConfig: {
      tencentKey: 'NHNBZ-F5FW3-Z4C3Q-R4WUM-ODTPE-DRFDV'
    },
    routeDraft: {},
    userStore: null,
    locale: 'zh-CN',
    loginInfo: null,
    authAccount: null,
    theme: {
      brand: '#ff7a00',
      accent: '#ffb14a',
      surface: '#ffffff',
      page: '#f7f8fc'
    }
  },

  userStorePersistTimer: null,

  onLaunch() {
    installGlobalNavigationBridge(this)
    installGlobalPageBridge(this)
    this.globalData.poiLibrary = POI_LIBRARY
    this.bootstrapState()
    this.syncSystemTheme()
  },

  bootstrapState() {
    const cachedToken = wx.getStorageSync('sunshine-user-token')
    const cachedStore = wx.getStorageSync('sunshine-user-store')
    const cachedLocale = wx.getStorageSync('sunshine-user-locale')
    const cachedLoginInfo = wx.getStorageSync('sunshine-user-login-info')
    const cachedAuthAccount = wx.getStorageSync('sunshine-user-auth-account')
    const cachedDraft = wx.getStorageSync('sunshine-user-draft')

    this.globalData.token = cachedToken || ''
    this.globalData.locale = cachedLocale || 'zh-CN'
    this.globalData.loginInfo = cachedLoginInfo || null
    this.globalData.authAccount = cachedAuthAccount || null
    this.globalData.userStore = normalizeUserStore(cachedStore || createDefaultUserStore())
    this.globalData.routeDraft = normalizeDraft(cachedDraft)
    this.globalData.userStore.loggedIn = Boolean(this.globalData.token)
  },

  syncSystemTheme() {
    wx.getSystemInfo({
      success: ({ theme }) => {
        this.globalData.userStore.settings.darkMode = theme === 'dark'
        this.saveUserStore()
      }
    })
  },

  saveUserStore() {
    if (this.userStorePersistTimer) {
      clearTimeout(this.userStorePersistTimer)
    }

    this.globalData.userStore = normalizeUserStore(this.globalData.userStore)

    this.userStorePersistTimer = setTimeout(() => {
      this.userStorePersistTimer = null
      if (wx.setStorage) {
        wx.setStorage({
          key: 'sunshine-user-store',
          data: this.globalData.userStore,
          fail: () => {
            wx.setStorageSync('sunshine-user-store', this.globalData.userStore)
          }
        })
        return
      }
      wx.setStorageSync('sunshine-user-store', this.globalData.userStore)
    }, 80)
  },

  setToken(token) {
    this.globalData.token = token || ''
    wx.setStorageSync('sunshine-user-token', this.globalData.token)
  },

  setLoginInfo(loginInfo) {
    this.globalData.loginInfo = loginInfo || null
    this.globalData.token = loginInfo ? loginInfo.token : ''
    this.globalData.userStore.loggedIn = Boolean(loginInfo)
    if (loginInfo) {
      this.globalData.userStore.loginInfo = loginInfo
      wx.setStorageSync('sunshine-user-locale', this.globalData.locale)
    }
    wx.setStorageSync('sunshine-user-login-info', this.globalData.loginInfo)
    wx.setStorageSync('sunshine-user-token', this.globalData.token)
    this.saveUserStore()
  },

  setAuthAccount(authAccount) {
    this.globalData.authAccount = authAccount || null
    if (authAccount) {
      wx.setStorageSync('sunshine-user-auth-account', authAccount)
      return
    }
    wx.removeStorageSync('sunshine-user-auth-account')
  },

  clearSession() {
    const currentStore = this.globalData.userStore || createDefaultUserStore()
    const nextStore = createDefaultUserStore()
    nextStore.hasSeenWelcome = Boolean(currentStore.hasSeenWelcome)
    nextStore.settings = {
      ...nextStore.settings,
      ...currentStore.settings,
      language: this.globalData.locale
    }

    this.globalData.token = ''
    this.globalData.loginInfo = null
    this.globalData.authAccount = null
    this.globalData.userStore = nextStore
    this.globalData.userStore.profileOverride = null
    this.globalData.routeDraft = normalizeDraft()
    wx.removeStorageSync('sunshine-user-token')
    wx.removeStorageSync('sunshine-user-login-info')
    wx.removeStorageSync('sunshine-user-auth-account')
    wx.removeStorageSync('sunshine-user-store')
    wx.removeStorageSync('sunshine-user-draft')
    wx.setStorageSync('sunshine-user-store', this.globalData.userStore)
    wx.setStorageSync('sunshine-user-draft', this.globalData.routeDraft)
  },

  setLocale(locale) {
    this.globalData.locale = locale
    this.globalData.userStore.settings.language = locale
    wx.setStorageSync('sunshine-user-locale', locale)
    this.saveUserStore()
  },

  updateDraft(nextDraft) {
    const normalized = normalizeDraft(nextDraft)
    this.globalData.routeDraft = normalized
    wx.setStorageSync('sunshine-user-draft', normalized)
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

  setCurrentRideOrder(order, options = {}) {
    const store = normalizeUserStore(this.globalData.userStore)
    store.currentRideOrder = order || null
    if (order && order.id) {
      const orders = Array.isArray(store.orders) ? store.orders.slice() : []
      const currentIndex = orders.findIndex((item) => isSameOrder(item, order))
      if (currentIndex >= 0) {
        orders[currentIndex] = {
          ...orders[currentIndex],
          ...order
        }
      } else {
        orders.unshift({ ...order })
      }
      store.orders = orders
    }
    this.globalData.userStore = normalizeUserStore(store)
    if (options.persist === false) {
      return
    }
    this.saveUserStore()
  },

  applyProfile(profile) {
    const previousProfile = this.globalData.userStore.profile || {}
    const source = {
      ...profile
    }
    this.globalData.userStore.profile = {
      ...previousProfile,
      id: source.id,
      name: source.nickname || previousProfile.name || '阳光旅客',
      nickname: source.nickname || previousProfile.nickname || '阳光旅客',
      avatar: firstDefined(source.avatar, previousProfile.avatar, '/images/avatar-user.svg'),
      phone: source.phone || previousProfile.phone || '',
      authStatus: firstDefined(source.authStatus, source.auth_status),
      realName: firstDefined(source.realName, source.real_name, ''),
      idCard: firstDefined(source.idCard, source.id_card, ''),
      memberLevel: '阳光会员',
      walletBalance: Number(source.walletBalance || 0),
      emergencyContact: firstDefined(source.emergencyContact, source.emergency_contact, ''),
      emergencyPhone: firstDefined(source.emergencyPhone, source.emergency_phone, ''),
      defaultLanguage: firstDefined(source.defaultLanguage, source.default_language, this.globalData.locale || 'zh-CN')
    }
    this.globalData.userStore.loggedIn = true
    this.saveUserStore()
  }
})
