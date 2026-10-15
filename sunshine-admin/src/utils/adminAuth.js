/**
 * 后台登录门禁（前端演示版）
 *
 * 说明：这是给演示后台加的一层「登录弹窗门禁」，账号密码存在 localStorage，
 * 只拦界面、不做服务端校验，真实项目请改成后端登录接口下发凭证。
 * 目前只允许一个管理员账号（默认 admin / 123456），不提供注册入口。
 */

const ACCOUNT_KEY = 'sunshine_admin_account'
const SESSION_KEY = 'sunshine_admin_session'
const GUARD_KEY = 'sunshine_admin_login_guard'

/** 同一自然日内允许的最大连续失败次数 */
export const MAX_LOGIN_ATTEMPTS = 5

const DEFAULT_ACCOUNT = { username: 'admin', password: '123456', updatedAt: '' }

function todayKey() {
  const now = new Date()
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch (error) {
    return null
  }
}

/* ---------------- 管理员账号 ---------------- */

export function getAdminAccount() {
  const stored = readJSON(ACCOUNT_KEY)
  if (stored && stored.username && stored.password) {
    return { ...DEFAULT_ACCOUNT, ...stored }
  }
  return { ...DEFAULT_ACCOUNT }
}

export function saveAdminAccount({ username, password }) {
  const next = {
    username: `${username ?? ''}`.trim() || DEFAULT_ACCOUNT.username,
    password: `${password ?? ''}` || DEFAULT_ACCOUNT.password,
    updatedAt: new Date().toISOString()
  }
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next))
  return next
}

export function verifyAdminCredential(username, password) {
  const account = getAdminAccount()
  return `${username ?? ''}`.trim() === account.username && `${password ?? ''}` === account.password
}

/* ---------------- 登录会话 ---------------- */

export function hasAdminSession() {
  return localStorage.getItem(SESSION_KEY) === 'active'
}

export function startAdminSession(username) {
  localStorage.setItem(SESSION_KEY, 'active')
  localStorage.setItem('sunshine_admin_session_at', new Date().toISOString())
  localStorage.setItem('sunshine_admin_session_user', `${username || ''}`)
}

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('sunshine_admin_session_at')
  localStorage.removeItem('sunshine_admin_session_user')
}

export function getSessionInfo() {
  if (!hasAdminSession()) return null
  return {
    username: localStorage.getItem('sunshine_admin_session_user') || '',
    loginAt: localStorage.getItem('sunshine_admin_session_at') || ''
  }
}

/* ---------------- 失败次数保护（按自然日重置） ---------------- */

export function getLoginGuard() {
  const stored = readJSON(GUARD_KEY)
  if (stored && stored.date === todayKey() && Number.isFinite(stored.count)) {
    return { date: stored.date, count: Math.max(0, stored.count) }
  }
  const fresh = { date: todayKey(), count: 0 }
  localStorage.setItem(GUARD_KEY, JSON.stringify(fresh))
  return fresh
}

export function getRemainingAttempts() {
  return Math.max(0, MAX_LOGIN_ATTEMPTS - getLoginGuard().count)
}

export function isLoginLocked() {
  return getLoginGuard().count >= MAX_LOGIN_ATTEMPTS
}

export function recordLoginFailure() {
  const guard = getLoginGuard()
  guard.count += 1
  localStorage.setItem(GUARD_KEY, JSON.stringify(guard))
  return guard
}

export function clearLoginGuard() {
  localStorage.setItem(GUARD_KEY, JSON.stringify({ date: todayKey(), count: 0 }))
}
