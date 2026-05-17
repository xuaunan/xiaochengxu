<template>
  <div class="layout-shell">
    <aside class="sidebar">
      <div class="brand-card">
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
          <div>
            <strong>{{ item.label }}</strong>
            <small>{{ item.desc }}</small>
          </div>
        </RouterLink>
      </nav>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>阳光出行</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.group || '后台管理' }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title || '工作台' }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="topbar-title">
            <h2>{{ route.meta.title || '后台管理平台' }}</h2>
            <p>{{ statusDescription }}</p>
          </div>
        </div>

        <div class="topbar-actions">
          <div class="status-pill">
            <span class="status-dot"></span>
            <span>{{ statusText }}</span>
          </div>
          <el-button type="primary" @click="handleAdminLogin">一键登录管理员</el-button>
        </div>
      </header>

      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { adminLogin } from './api/http'

const route = useRoute()

const navItems = [
  { path: '/dashboard', label: '数据大盘', desc: '实时运营洞察' },
  { path: '/users', label: '用户管理', desc: '用户、实名、密码' },
  { path: '/drivers', label: '司机管理', desc: '审核、启禁、接单' },
  { path: '/orders', label: '订单管理', desc: '详情、退款、投诉' },
  { path: '/international', label: '国际出行', desc: '跨境订单、汇率、材料' },
  { path: '/coupons', label: '营销中心', desc: '优惠券全生命周期' },
  { path: '/system', label: '系统配置', desc: '公告、版本、参数' }
]

const statusText = '后端接口在线'
const statusDescription = '管理员账号 13700000001 已拥有全部演示权限，所有页面均连接真实后端数据。'

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

onMounted(() => {
  localStorage.removeItem('sunshine_admin_use_mock_api')
  localStorage.removeItem('sunshine_admin_mock_db_v1')
  if (localStorage.getItem('sunshine_admin_token') === 'mock-admin-token') {
    localStorage.removeItem('sunshine_admin_token')
  }
  if (!localStorage.getItem('sunshine_admin_token')) {
    handleAdminLogin()
  }
})
</script>
