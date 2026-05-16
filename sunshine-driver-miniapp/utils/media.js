const DRIVER_AVATAR_FALLBACK = '/images/avatar-driver-main.svg'
const DRIVER_DOCUMENT_PLACEHOLDER = '/images/document-placeholder.svg'

function isRemoteUrl(url = '') {
  return /^(https?:)?\/\//.test(url)
}

function isLocalTempUrl(url = '') {
  return /^(wxfile:|data:)/.test(url)
}

function buildStaticUrl(baseUrl, url) {
  if (!url) return ''
  if (isRemoteUrl(url) || isLocalTempUrl(url) || url.startsWith('/images/')) {
    return url
  }

  const base = `${baseUrl || ''}`.replace(/\/$/, '')
  const path = `${url}`.startsWith('/') ? url : `/${url}`
  return base ? `${base}${path}` : path
}

function getVehicleDocumentPreviewUrl(baseUrl, fileUrl) {
  if (!fileUrl) return ''
  if (isRemoteUrl(fileUrl) || isLocalTempUrl(fileUrl)) {
    return fileUrl
  }
  return buildStaticUrl(baseUrl, fileUrl)
}

module.exports = {
  DRIVER_AVATAR_FALLBACK,
  DRIVER_DOCUMENT_PLACEHOLDER,
  buildStaticUrl,
  getVehicleDocumentPreviewUrl
}
