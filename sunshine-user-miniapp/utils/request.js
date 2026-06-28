const { ERROR_CODE } = require('./constants')
const { reLaunchSilky } = require('./page')

let refreshingPromise = null
let reloginPromise = null

function buildUrl(baseUrl, url) {
  if (/^https?:\/\//.test(url)) {
    return url
  }
  const base = `${baseUrl || ''}`.replace(/\/$/, '')
  const path = `${url || ''}`.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

function rawRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    })
  })
}

function normalizeError(payload = {}, response = {}) {
  return {
    code: payload.code || response.statusCode || ERROR_CODE.SYSTEM_ERROR,
    message: payload.msg || payload.message || 'Request failed',
    data: payload.data,
    statusCode: response.statusCode || 0
  }
}

function redirectToLogin() {
  const pages = getCurrentPages()
  const active = pages[pages.length - 1]
  if (active && active.route === 'pages/login/index') {
    return
  }

  if (active && typeof active.setData === 'function') {
    reLaunchSilky(active, {
      url: '/pages/login/index'
    })
    return
  }

  wx.reLaunch({
    url: '/pages/login/index'
  })
}

function isSessionInvalid(payload = {}, response = {}) {
  const statusCode = Number(response.statusCode || 0)
  const message = `${payload.msg || payload.message || ''}`
  return statusCode === 401 ||
    payload.code === ERROR_CODE.UNAUTHORIZED ||
    /用户不存在|登录失效|token|未登录|无效凭证/i.test(message)
}

function requestRefreshToken() {
  if (refreshingPromise) {
    return refreshingPromise
  }

  const app = getApp()
  refreshingPromise = rawRequest({
    url: buildUrl(app.globalData.baseUrl, '/auth/refresh'),
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : ''
    }
  }).then((response) => {
    const payload = response.data || {}
    if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS && payload.data && payload.data.token) {
      app.setLoginInfo(payload.data)
      return payload.data.token
    }
    throw normalizeError(payload, response)
  }).finally(() => {
    refreshingPromise = null
  })

  return refreshingPromise
}

function requestRelogin() {
  if (reloginPromise) {
    return reloginPromise
  }

  const app = getApp()
  const authAccount = app.globalData.authAccount
  if (!authAccount || !authAccount.phone || !authAccount.password) {
    return Promise.reject(new Error('Missing cached login account'))
  }

  reloginPromise = rawRequest({
    url: buildUrl(app.globalData.baseUrl, '/auth/login'),
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    data: authAccount
  }).then((response) => {
    const payload = response.data || {}
    if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS && payload.data && payload.data.token) {
      app.setLoginInfo(payload.data)
      return payload.data.token
    }
    throw normalizeError(payload, response)
  }).finally(() => {
    reloginPromise = null
  })

  return reloginPromise
}

function request(options = {}) {
  const app = getApp()
  const normalized = {
    method: 'GET',
    data: {},
    header: {},
    skipToast: false,
    skipAuth: false,
    _retry: false,
    ...options
  }

  const header = {
    'Content-Type': 'application/json',
    ...normalized.header
  }

  if (!normalized.skipAuth && app.globalData.token) {
    header.Authorization = `Bearer ${app.globalData.token}`
  }

  return rawRequest({
    url: buildUrl(app.globalData.baseUrl, normalized.url),
    method: normalized.method,
    data: normalized.data,
    header
  }).then((response) => {
    const payload = response.data || {}

    if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS) {
      return payload
    }

    const canRetry = !normalized.skipAuth && !normalized._retry && app.globalData.token && isSessionInvalid(payload, response)

    if (canRetry) {
      return requestRefreshToken()
        .then(() => request({ ...normalized, _retry: true }))
        .catch((error) => {
          return requestRelogin()
            .then(() => request({ ...normalized, _retry: true }))
            .catch(() => {
              if (app.clearSession) {
                app.clearSession()
              }
              wx.showToast({
                title: '登录已过期，请重新登录',
                icon: 'none'
              })
              setTimeout(() => {
                redirectToLogin()
              }, 180)
              throw error
            })
        })
    }

    const error = normalizeError(payload, response)
    if (!normalized.skipToast) {
      wx.showToast({
        title: error.message || 'Request failed',
        icon: 'none'
      })
    }
    throw error
  }).catch((error) => {
    if (error && error.errMsg) {
      if (!normalized.skipToast) {
        wx.showToast({
          title: '网络连接失败，请稍后重试',
          icon: 'none'
        })
      }
      throw {
        code: ERROR_CODE.SYSTEM_ERROR,
        message: error.errMsg,
        raw: error
      }
    }
    throw error
  })
}

function uploadFile(options = {}) {
  const app = getApp()
  const normalized = {
    url: '',
    filePath: '',
    name: 'file',
    formData: {},
    header: {},
    skipToast: false,
    ...options
  }

  const header = {
    ...normalized.header
  }

  if (app.globalData.token) {
    header.Authorization = `Bearer ${app.globalData.token}`
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: buildUrl(app.globalData.baseUrl, normalized.url),
      filePath: normalized.filePath,
      name: normalized.name,
      formData: normalized.formData,
      header,
      success: (response) => {
        let payload = {}
        try {
          payload = typeof response.data === 'string' ? JSON.parse(response.data || '{}') : (response.data || {})
        } catch (error) {
          payload = {}
        }

        if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS) {
          resolve(payload)
          return
        }

        reject(normalizeError(payload, response))
      },
      fail: reject
    })
  }).catch((error) => {
    if (error && error.errMsg) {
      if (!normalized.skipToast) {
        wx.showToast({
          title: '头像上传失败，请检查网络',
          icon: 'none'
        })
      }
      throw {
        code: ERROR_CODE.SYSTEM_ERROR,
        message: error.errMsg,
        raw: error
      }
    }

    if (!normalized.skipToast) {
      wx.showToast({
        title: error.message || '头像上传失败',
        icon: 'none'
      })
    }
    throw error
  })
}

module.exports = {
  request,
  uploadFile
}
