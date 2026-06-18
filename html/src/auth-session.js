const APP_SESSION_ROLES = new Set(['USER', 'DRIVER'])

function decodeBase64Url(segment = '') {
  const normalized = String(segment || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  if (typeof atob === 'function') {
    return decodeURIComponent(Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8')
  }
  return ''
}

export function resolveRoleCodeFromToken(token = '') {
  const value = String(token || '').trim()
  if (!value) return ''

  const demoParts = value.split('.')
  if (demoParts[0] === 'demo') {
    return demoParts[1] || ''
  }

  if (demoParts.length < 2) return ''
  try {
    const payload = JSON.parse(decodeBase64Url(demoParts[1]))
    return typeof payload?.role === 'string' ? payload.role : ''
  } catch (error) {
    return ''
  }
}

export function shouldInvalidateSession({ token = '', skipAuth = false, status, code }) {
  if (skipAuth || !token) return false
  const roleCode = resolveRoleCodeFromToken(token)
  if (!APP_SESSION_ROLES.has(roleCode)) return false
  return Number(status) === 401 || Number(code) === 4002
}

export function dispatchInvalidSession({ token = '', skipAuth = false, status, code, message = '' }) {
  if (!shouldInvalidateSession({ token, skipAuth, status, code })) return false
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return false
  }
  window.dispatchEvent(new CustomEvent('sunshine-auth-session-invalid', {
    detail: {
      roleCode: resolveRoleCodeFromToken(token),
      status: Number(status) || 0,
      code: Number(code) || 0,
      message: String(message || '')
    }
  }))
  return true
}
