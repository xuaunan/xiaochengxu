const { ERROR_CODE } = require('./constants')

let refreshingPromise = null

function buildUrl(baseUrl, url) {
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
  if (active && active.route === 'pages/onboarding/index') {
    return
  }
  wx.reLaunch({
    url: '/pages/onboarding/index'
  })
}

function requestRefreshToken() {
  if (refreshingPromise) {
    return refreshingPromise
  }
  const app = getApp()
  refreshingPromise = rawRequest({
    url: buildUrl(app.globalData.baseUrl, '/auth/refresh'),
    method: 'POST',
    timeout: 12000,
    header: {
      'Content-Type': 'application/json',
      Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : ''
    }
  }).then((response) => {
    const payload = response.data || {}
    if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS && payload.data && payload.data.token) {
      app.setLoginInfo(payload.data)
      return payload
    }
    throw normalizeError(payload, response)
  }).finally(() => {
    refreshingPromise = null
  })
  return refreshingPromise
}

function request(options = {}) {
  const app = getApp()
  const normalized = {
    method: 'GET',
    data: {},
    header: {},
    skipToast: false,
    skipAuth: false,
    timeout: 12000,
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
    timeout: normalized.timeout,
    header
  }).then((response) => {
    const payload = response.data || {}
    if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === ERROR_CODE.SUCCESS) {
      return payload
    }

    const canRetry = !normalized.skipAuth && !normalized._retry && app.globalData.token &&
      (response.statusCode === 401 || payload.code === ERROR_CODE.UNAUTHORIZED)
    if (canRetry) {
      return requestRefreshToken()
        .then(() => request({ ...normalized, _retry: true }))
        .catch((error) => {
          app.clearSession()
          wx.showToast({ title: 'Session expired, please log in again', icon: 'none' })
          setTimeout(() => redirectToLogin(), 180)
          throw error
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
          title: 'Network connection failed, please try again later',
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

function getUploadValue(source, preferredKeys = []) {
  if (typeof source === 'string') {
    return source.trim()
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const value = getUploadValue(item, preferredKeys)
      if (value) return value
    }
    return ''
  }

  if (!source || typeof source !== 'object') {
    return ''
  }

  const keys = [
    ...preferredKeys,
    'url',
    'path',
    'fileUrl',
    'filePath',
    'location',
    'src',
    'fullUrl',
    'downloadUrl',
    'previewUrl'
  ]

  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      return source[key].trim()
    }
  }

  for (const key of ['data', 'result', 'file', 'value']) {
    const value = getUploadValue(source[key], preferredKeys)
    if (value) return value
  }

  for (const value of Object.values(source)) {
    const next = getUploadValue(value, preferredKeys)
    if (next) return next
  }

  return ''
}

function normalizeUploadData(payload = {}, preferredKeys = []) {
  return getUploadValue(payload, preferredKeys)
}

function uploadFile(options = {}) {
  const app = getApp()
  const normalized = {
    filePath: '',
    name: 'file',
    formData: {},
    header: {},
    skipToast: false,
    uploadUrls: app.globalData.uploadEndpoints || [],
    responseFileKeys: [],
    ...options
  }

  const header = {
    ...normalized.header
  }

  if (app.globalData.token) {
    header.Authorization = `Bearer ${app.globalData.token}`
  }

  const urls = Array.isArray(normalized.uploadUrls)
    ? normalized.uploadUrls.filter(Boolean)
    : [normalized.uploadUrls].filter(Boolean)

  if (!urls.length) {
    return Promise.reject({
      code: ERROR_CODE.SYSTEM_ERROR,
      message: 'Upload endpoint is not configured'
    })
  }

  const tryUpload = (index = 0) => {
    if (index >= urls.length) {
      const error = {
        code: ERROR_CODE.SYSTEM_ERROR,
        message: 'File upload failed, please contact the administrator to check the upload endpoint'
      }
      if (!normalized.skipToast) {
        wx.showToast({
          title: error.message,
          icon: 'none'
        })
      }
      return Promise.reject(error)
    }

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: buildUrl(app.globalData.baseUrl, urls[index]),
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
            const fileUrl = normalizeUploadData(payload, normalized.responseFileKeys)
            if (fileUrl) {
              resolve({
                ...payload,
                fileUrl
              })
              return
            }
          }

          reject(normalizeError(payload, response))
        },
        fail: reject
      })
    }).catch((error) => {
      const statusCode = error?.statusCode || error?.code || 0
      const canFallback = !statusCode || statusCode === 404 || statusCode === 405
      if (canFallback) {
        return tryUpload(index + 1)
      }
      if (error && error.errMsg) {
        if (!normalized.skipToast) {
          wx.showToast({
            title: 'File upload failed, please check your network',
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
          title: error.message || 'File upload failed',
          icon: 'none'
        })
      }
      throw error
    })
  }

  return tryUpload(0)
}

module.exports = {
  request,
  uploadFile
}
