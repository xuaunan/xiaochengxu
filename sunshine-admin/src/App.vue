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

      <button class="logout-btn" type="button" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>
        <span>退出登录</span>
      </button>
    </aside>

    <main class="main">
      <RouterView />
    </main>
  </div>

  <AdminLoginGate v-if="!unlocked" @success="handleLoginSuccess" />
</template>

<script setup>
import { SwitchButton } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import AdminLoginGate from './components/AdminLoginGate.vue'
import http, { adminLogin, baseURL } from './api/http'
import { clearAdminSession, hasAdminSession } from './utils/adminAuth'

const importantMessageCount = ref(0)
let importantMessageTimer
let healthTimer

// 登录门禁：未登录时后台界面照常渲染，但会被登录弹窗盖住并深度模糊
const unlocked = ref(hasAdminSession())

const navItems = [
  { path: '/dashboard', label: '数据大盘', desc: '实时运营洞察' },
  { path: '/users', label: '用户管理', desc: '用户、实名、密码' },
  { path: '/drivers', label: '司机管理', desc: '审核、启禁、接单' },
  { path: '/orders', label: '订单管理', desc: '详情、退款、投诉' },
  { path: '/members', label: '会员管理', desc: '乘客会员与周券' },
  { path: '/international', label: '国际出行', desc: '跨境订单、汇率、材料' },
  { path: '/support', label: '客服服务', desc: '乘客/司机在线对话' },
  { path: '/messages', label: '消息列表', desc: '投诉、审核、提现、客服', badge: true },
  { path: '/coupons', label: '营销中心', desc: '优惠券全生命周期' },
  { path: '/ai-settings', label: 'AI客服设置', desc: '模型、密钥、调试参数' },
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

// 静默准备后台接口凭证，保证登录弹窗后面的页面能渲染出真实数据
async function ensureAdminToken() {
  if (localStorage.getItem('sunshine_admin_token')) return
  try {
    const result = await adminLogin()
    localStorage.setItem('sunshine_admin_token', result.token)
  } catch (error) {
    return
  }
  window.location.reload()
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

function startMessagePolling() {
  loadImportantMessageCount()
  clearInterval(importantMessageTimer)
  importantMessageTimer = setInterval(loadImportantMessageCount, 30000)
}

function handleLoginSuccess() {
  unlocked.value = true
  startMessagePolling()
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('退出后需要重新输入管理员账号和密码才能进入后台。', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出登录',
      cancelButtonText: '取消'
    })
  } catch (error) {
    return
  }
  clearAdminSession()
  ElMessage.success('已退出登录')
  window.setTimeout(() => window.location.reload(), 400)
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
  ensureAdminToken()
  if (unlocked.value) {
    startMessagePolling()
  }
})

onBeforeUnmount(() => {
  clearInterval(importantMessageTimer)
  clearInterval(healthTimer)
})
</script>

<style scoped>
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 14px;
  padding: 11px 14px;
  border-radius: 14px;
  border: 1px dashed rgba(226, 232, 240, 0.95);
  background: rgba(248, 250, 252, 0.75);
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.logout-btn:hover {
  color: #c2410c;
  border-color: rgba(253, 186, 116, 0.95);
  background: rgba(255, 247, 237, 0.95);
}
</style>
