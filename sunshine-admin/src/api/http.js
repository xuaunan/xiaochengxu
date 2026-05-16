import axios from 'axios'
import { ElMessage } from 'element-plus'

const baseURL = 'http://127.0.0.1:8080'

const service = axios.create({
  baseURL,
  timeout: 15000
})

service.interceptors.request.use((config) => {
  const token = localStorage.getItem('sunshine_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code === 0) {
        return payload.data
      }
      ElMessage.error(payload.msg || 'Request failed')
      return Promise.reject(new Error(payload.msg || 'Request failed'))
    }
    return payload
  },
  (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.msg || error?.message || 'Request error'
    if (status === 401) {
      localStorage.removeItem('sunshine_admin_token')
      ElMessage.warning('Login expired, reloading admin session')
      window.location.reload()
      return Promise.reject(error)
    }
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export function adminLogin() {
  return fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '13700000001',
      password: '123456',
      roleCode: 'ADMIN'
    })
  }).then(async (response) => {
    const result = await response.json()
    if (result.code === 0) {
      return result.data
    }
    throw new Error(result.msg || 'Admin login failed')
  })
}

export default service
