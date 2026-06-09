<template>
  <div class="layout-shell">
    <aside class="sidebar">
      <div class="brand-card">
        <div
          class="system-health"
          :class="{ online: allSystemsOnline, offline: !allSystemsOnline }"
          :aria-label="connectionTooltip"
          tabindex="0"
        >
          <span class="system-health-dot"></span>
          <span v-if="!allSystemsOnline" class="system-health-tooltip">
            {{ connectionTooltip }}
          </span>
        </div>
        <span class="brand-kicker">运营后台</span>
        <h1>阳光出行</h1>
        <p>后台管理平台</p>
      </div>

      <nav class="nav-list">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
        >
          <span class="nav-dot"></span>
          <div class="nav-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.desc }}</small>
          </div>
          <span v-if="item.badge && importantMessageCount" class="nav-badge">
            {{ importantMessageCount > 99 ? '99+' : importantMessageCount }}
          </span>
        </RouterLink>
      </nav>
    </aside>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import http, { adminLogin, baseURL } from './api/http'

const importantMessageCount = ref(0)
let importantMessageTimer
let healthTimer

const navItems = [
  { path: '/dashboard', label: '数据大盘', desc: '实时运营洞察' },
  { path: '/messages', label: '消息列表', desc: '投诉、审核、提现', badge: true },
  { path: '/users', label: '用户管理', desc: '用户、实名、密码' },
  { path: '/drivers', label: '司机管理', desc: '审核、启禁、接单' },
  { path: '/orders', label: '订单管理', desc: '详情、退款、投诉' },
  { path: '/support', label: '客服服务', desc: '乘客/司机在线对话' },
  { path: '/international', label: '国际出行', desc: '跨境订单、汇率、材料' },
  { path: '/coupons', label: '营销中心', desc: '优惠券全生命周期' },
  { path: '/members', label: '会员管理', desc: '乘客会员与周券' },
  { path: '/system', label: '系统配置', desc: '公告、版本、参数' }
]

const webClientUrl = import.meta.env.VITE_SUNSHINE_WEB_URL || 'http://127.0.0.1:5174/'
const connectionLabels = {
  frontend: '小程序',
  backend: '业务接口',
  admin: '管理后台',
  database: '数据状态',
  web: '网页端'
}
const connectionStatus = ref({
  frontend: true,
  backend: false,
  admin: true,
  database: false,
  web: false
})

const allSystemsOnline = computed(() => Object.values(connectionStatus.value).every(Boolean))
const connectionTooltip = computed(() => {
  const offline = Object.entries(connectionStatus.value)
    .filter(([, online]) => !online)
    .map(([key]) => connectionLabels[key])
  return offline.length ? `未连接：${offline.join('、')}` : '全部连接正常'
})

async function handleAdminLogin() {
  try {
    const result = await adminLogin()
    localStorage.setItem('sunshine_admin_token', result.token)
    ElMessage.success('管理员登录成功')
    window.location.reload()
  } catch (error) {
    ElMessage.error(error.message || '管理员登录失败')
  }
}

async function loadImportantMessageCount() {
  if (!localStorage.getItem('sunshine_admin_token')) return
  try {
    const list = await http.get('/admin/important-messages')
    importantMessageCount.value = Array.isArray(list) ? list.length : 0
  } catch (error) {
    importantMessageCount.value = 0
  }
}

async function checkBackendAndDatabase() {
  try {
    const response = await fetch(`${baseURL}/app/health`, { cache: 'no-store' })
    const result = await response.json()
    const data = result?.data || {}
    connectionStatus.value.backend = response.ok && result?.code === 0 && data.backend === true
    connectionStatus.value.database = data.database === true
  } catch (error) {
    connectionStatus.value.backend = false
    connectionStatus.value.database = false
  }
}

async function checkWebClient() {
  try {
    await fetch(webClientUrl, { mode: 'no-cors', cache: 'no-store' })
    connectionStatus.value.web = true
  } catch (error) {
    connectionStatus.value.web = false
  }
}

async function checkConnections() {
  connectionStatus.value.frontend = true
  connectionStatus.value.admin = true
  await Promise.all([checkBackendAndDatabase(), checkWebClient()])
}

onMounted(() => {
  localStorage.removeItem('sunshine_admin_use_mock_api')
  localStorage.removeItem('sunshine_admin_mock_db_v1')
  checkConnections()
  healthTimer = setInterval(checkConnections, 15000)
  if (localStorage.getItem('sunshine_admin_token') === 'mock-admin-token') {
    localStorage.removeItem('sunshine_admin_token')
  }
  if (!localStorage.getItem('sunshine_admin_token')) {
    handleAdminLogin()
  } else {
    loadImportantMessageCount()
    importantMessageTimer = setInterval(loadImportantMessageCount, 30000)
  }
})

onBeforeUnmount(() => {
  clearInterval(importantMessageTimer)
  clearInterval(healthTimer)
})
</script>
