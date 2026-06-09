<template>
  <section class="page international-page">
    <article class="panel international-hero">
      <div>
        <span class="panel-kicker">International Operations</span>
        <h3 class="panel-title">国际出行运营台</h3>
        <p class="panel-subtitle">集中查看跨境订单、美元结算、汇率配置和乘客预约材料。</p>
      </div>
      <div class="rate-card">
        <span>结算汇率</span>
        <strong>1 USD ≈ {{ exchangeRate }} CNY</strong>
        <small>影响国际订单估算与结算展示</small>
      </div>
    </article>

    <div class="stat-grid">
      <div class="stat-card">
        <span>国际订单</span>
        <strong>{{ dashboard.internationalOrderTotal || 0 }}</strong>
      </div>
      <div class="stat-card">
        <span>国际成交额</span>
        <strong>{{ formatMoney(dashboard.internationalTurnover, 'USD') }}</strong>
      </div>
      <div class="stat-card">
        <span>进行中</span>
        <strong>{{ processingCount }}</strong>
      </div>
      <div class="stat-card">
        <span>待支付</span>
        <strong>{{ unpaidCount }}</strong>
      </div>
    </div>

    <article class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Orders</span>
          <h3 class="panel-title">跨境订单实时列表</h3>
          <p class="panel-subtitle">查看国际预约订单、联系人和行程材料。</p>
        </div>
        <div class="toolbar-actions">
          <el-input v-model="keyword" clearable placeholder="搜索订单号/路线/联系人" style="width: 260px" @keyup.enter="loadData" />
          <el-button type="primary" @click="loadData">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="filteredOrders" stripe row-key="id">
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column label="预约产品" min-width="170">
          <template #default="{ row }">{{ row.meta.productName || '国际出行' }}</template>
        </el-table-column>
        <el-table-column label="预约时间" min-width="170">
          <template #default="{ row }">{{ row.meta.appointmentTime || formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="联系人" min-width="150">
          <template #default="{ row }">{{ row.meta.contactName || '未填写' }} {{ row.meta.contactPhone || '' }}</template>
        </el-table-column>
        <el-table-column label="路线" min-width="260">
          <template #default="{ row }">{{ row.startName }} → {{ row.endName }}</template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount, row.currencyCode) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getOrderStatusType(row)">{{ getOrderStatusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="服务材料" min-width="220">
          <template #default="{ row }">{{ row.meta.documentsText }}</template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import http from '../api/http'
import { formatDateTime, formatMoney, getOrderStatusLabel, getOrderStatusType } from '../utils/admin'

const loading = ref(false)
const keyword = ref('')
const dashboard = ref({})
const orders = ref([])
const exchangeRate = ref('7.15')

const processingCount = computed(() => orders.value.filter((item) => ['ACCEPTED', 'PICKING_UP', 'IN_TRIP', 'DISPATCHING'].includes(item.status)).length)
const unpaidCount = computed(() => orders.value.filter((item) => item.payStatus === 'UNPAID').length)
const filteredOrders = computed(() => {
  const target = keyword.value.trim().toLowerCase()
  if (!target) return orders.value
  return orders.value.filter((item) => [
    item.orderNo,
    item.startName,
    item.endName,
    item.meta.productName,
    item.meta.contactName,
    item.meta.contactPhone
  ].some((value) => `${value || ''}`.toLowerCase().includes(target)))
})

function parseInternationalMeta(order = {}) {
  const remark = `${order.remark || ''}`
  const matched = remark.match(/\[INTERNATIONAL_META\]([\s\S]*?)\[\/INTERNATIONAL_META\]/)
  if (!matched || !matched[1]) return {}
  try {
    const meta = JSON.parse(matched[1])
    const documents = Array.isArray(meta.documents) ? meta.documents : []
    const serviceItems = Array.isArray(meta.serviceItems) ? meta.serviceItems : []
    return {
      ...meta,
      documentsText: documents.length ? documents.join('、') : '按目的地要求携带有效证件',
      serviceItemsText: serviceItems.length ? serviceItems.join(' · ') : '中文客服 · 跨境接送'
    }
  } catch (error) {
    return {}
  }
}

async function loadData() {
  loading.value = true
  try {
    const [dashboardPayload, orderPayload, configs] = await Promise.all([
      http.get('/admin/dashboard'),
      http.get('/admin/orders', { params: { current: 1, size: 50, serviceType: 'INTERNATIONAL' } }),
      http.get('/admin/system/configs')
    ])
    dashboard.value = dashboardPayload || {}
    exchangeRate.value = (configs || []).find((item) => item.configKey === 'intlExchangeRate')?.configValue || '7.15'
    orders.value = (orderPayload?.records || []).map((item) => ({
      ...item,
      meta: parseInternationalMeta(item)
    }))
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.international-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.international-hero {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 20px;
  background:
    linear-gradient(135deg, rgba(17, 24, 39, 0.94), rgba(29, 78, 216, 0.88) 58%, rgba(255, 122, 0, 0.86));
  color: #fff;
}

.international-hero .panel-title,
.international-hero .panel-subtitle,
.international-hero .panel-kicker {
  color: #fff;
}

.rate-card {
  min-width: 280px;
  padding: 22px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.14);
  display: grid;
  gap: 8px;
}

.rate-card span,
.rate-card small {
  color: rgba(255, 255, 255, 0.72);
}

.rate-card strong {
  font-size: 24px;
}
</style>
