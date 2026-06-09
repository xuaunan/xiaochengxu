import type { AppMode, HealthStatus } from '@/types'

const TOKEN_KEY = 'sunshine_desktop_tokens'
const BASE_KEY = 'sunshine_desktop_base_url'

const demoAccounts: Record<AppMode, { phone: string; password: string; roleCode: string }> = {
  passenger: { phone: '13800000001', password: '123456', roleCode: 'USER' },
  driver: { phone: '13700000009', password: '123456', roleCode: 'DRIVER' },
  admin: { phone: '13700000001', password: '123456', roleCode: 'ADMIN' }
}

function getStoredTokens(): Partial<Record<AppMode, string>> {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}') as Partial<Record<AppMode, string>>
  } catch {
    return {}
  }
}

function setStoredToken(mode: AppMode, token: string) {
  const tokens = getStoredTokens()
  tokens[mode] = token
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

export function getBaseUrl() {
  return localStorage.getItem(BASE_KEY) || 'http://127.0.0.1:8080'
}

export function setBaseUrl(value: string) {
  localStorage.setItem(BASE_KEY, value.replace(/\/$/, ''))
}

export async function login(mode: AppMode) {
  const account = demoAccounts[mode]
  const response = await fetch(`${getBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  })
  const payload = await response.json()
  if (payload?.code !== 0) throw new Error(payload?.msg || '登录失败')
  const token = payload?.data?.token
  if (token) setStoredToken(mode, token)
  return payload.data
}

export async function request<T>(mode: AppMode, path: string, init: RequestInit = {}): Promise<T> {
  const tokens = getStoredTokens()
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (tokens[mode]) headers.set('Authorization', `Bearer ${tokens[mode]}`)

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers
  })
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()
  if (payload && typeof payload === 'object' && 'code' in payload) {
    if (payload.code === 0) return payload.data as T
    throw new Error(payload.msg || '请求失败')
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return payload as T
}

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${getBaseUrl()}/app/health`, { cache: 'no-store' })
  const payload = await response.json()
  const data = payload?.data || {}
  if (payload?.code !== 0) throw new Error(payload?.msg || '健康检查失败')
  return {
    frontend: true,
    backend: data.backend === true,
    database: data.database === true,
    admin: true,
    web: data.web !== false,
    mode: data.backend === true ? 'live' : 'demo',
    checkedAt: new Date().toLocaleString()
  }
}
