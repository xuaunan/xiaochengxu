function isAbsoluteUrl(value = '') {
  return /^(https?:)?\/\//.test(value)
}

function isRuntimeFile(value = '') {
  return /^(wxfile|http:\/\/tmp|https:\/\/tmp|cloud|data):/i.test(value)
}

function buildMediaUrl(value = '', baseUrl = '') {
  const source = `${value || ''}`.trim()
  if (!source) return ''
  if (isAbsoluteUrl(source) || isRuntimeFile(source)) return source
  if (!source.startsWith('/uploads/')) return source

  const base = `${baseUrl || ''}`.replace(/\/$/, '')
  return base ? `${base}${source}` : source
}

module.exports = {
  buildMediaUrl
}
