<template>
  <section class="page messages-page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">消息列表</span>
        <h3 class="panel-title">重要事项中心</h3>
        <p class="panel-subtitle">只展示需要后台介入的事项：投诉、发票申请、司机/车辆资料审核、提现申请；普通打车消息不进入这里。</p>
      </div>
      <div class="toolbar-actions">
        <el-segmented v-model="levelFilter" :options="levelOptions" />
        <el-button :loading="loading" type="primary" @click="loadMessages">刷新消息</el-button>
      </div>
    </article>

    <div class="message-summary">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="panel summary-card"
        :style="{ '--summary-accent': card.accent, '--summary-bg': card.bg }"
      >
        <span class="summary-icon">
          <el-icon>
            <component :is="card.icon" />
          </el-icon>
        </span>
        <div>
          <span>{{ card.title }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.desc }}</small>
        </div>
      </article>
    </div>

    <article class="panel message-panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">待办流</span>
          <h3 class="panel-title">后台重要消息</h3>
        </div>
        <el-tag type="info" effect="plain">已过滤普通订单聊天与行程通知</el-tag>
      </div>

      <div v-loading="loading" class="message-list">
        <div
          v-for="item in filteredMessages"
          :key="item.id"
          class="message-item"
          :class="item.level?.toLowerCase()"
          :style="{ '--message-accent': typeMeta(item).accent, '--message-bg': typeMeta(item).bg }"
        >
          <div class="message-mark">
            <el-icon>
              <component :is="typeMeta(item).icon" />
            </el-icon>
          </div>
          <div class="message-copy">
            <div class="message-title-row">
              <strong>{{ item.title }}</strong>
              <el-tag :type="typeMeta(item).tagType" size="small" effect="plain">{{ typeMeta(item).label }}</el-tag>
            </div>
            <p>{{ item.content }}</p>
            <span>{{ formatDateTime(item.createdAt) }}</span>
          </div>
          <el-button text type="primary" @click="handleMessageAction(item)">{{ item.actionText || '查看' }}</el-button>
        </div>

        <el-empty v-if="!filteredMessages.length && !loading" description="暂无重要待办消息" />
      </div>
    </article>

    <el-dialog v-model="invoiceVisible" title="处理发票申请" width="460px">
      <el-form label-width="86px">
        <el-form-item label="订单号">
          <span>{{ invoiceForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="处理结果">
          <el-select v-model="invoiceForm.invoiceStatus" style="width: 100%">
            <el-option label="已开票" value="ISSUED" />
            <el-option label="驳回申请" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="invoiceForm.remark"
            type="textarea"
            :rows="3"
            maxlength="120"
            show-word-limit
            placeholder="例如：电子发票已发送至乘客预留邮箱"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="invoiceVisible = false">取消</el-button>
        <el-button :loading="invoiceSubmitting" type="primary" @click="submitInvoice">确认处理</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import {
  BellFilled,
  Money,
  Tickets,
  UserFilled,
  Van,
  WarningFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/http'
import { formatDateTime } from '../utils/admin'

const router = useRouter()
const loading = ref(false)
const messages = ref([])
const levelFilter = ref('ALL')
const invoiceVisible = ref(false)
const invoiceSubmitting = ref(false)
const invoiceForm = ref({
  orderId: null,
  orderNo: '',
  invoiceStatus: 'ISSUED',
  remark: ''
})

const levelOptions = [
  { label: '全部', value: 'ALL' },
  { label: '高优先级', value: 'HIGH' },
  { label: '发票', value: 'INVOICE' },
  { label: '审核', value: 'AUDIT' },
  { label: '提现', value: 'WITHDRAW' }
]

const summary = computed(() => ({
  total: messages.value.length,
  high: messages.value.filter((item) => item.level === 'HIGH').length,
  audit: messages.value.filter((item) => ['DRIVER_AUDIT', 'VEHICLE_AUDIT', 'INVOICE'].includes(item.type)).length
}))

const summaryCards = computed(() => [
  {
    key: 'high',
    title: '高优先级',
    value: summary.value.high,
    desc: '投诉等需要快速处理',
    icon: WarningFilled,
    accent: '#ef4444',
    bg: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 68%)'
  },
  {
    key: 'audit',
    title: '资料与发票',
    value: summary.value.audit,
    desc: '司机、车辆、发票申请',
    icon: Tickets,
    accent: '#f97316',
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 68%)'
  },
  {
    key: 'total',
    title: '全部重要事项',
    value: summary.value.total,
    desc: '来自后端实时汇总',
    icon: BellFilled,
    accent: '#2563eb',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 68%)'
  }
])

const filteredMessages = computed(() => {
  if (levelFilter.value === 'ALL') return messages.value
  if (levelFilter.value === 'AUDIT') {
    return messages.value.filter((item) => ['DRIVER_AUDIT', 'VEHICLE_AUDIT'].includes(item.type))
  }
  if (levelFilter.value === 'WITHDRAW') {
    return messages.value.filter((item) => item.type === 'WITHDRAW')
  }
  if (levelFilter.value === 'INVOICE') {
    return messages.value.filter((item) => item.type === 'INVOICE')
  }
  return messages.value.filter((item) => item.level === levelFilter.value)
})

function typeMeta(item = {}) {
  const map = {
    COMPLAINT: { label: '投诉', tagType: 'danger', icon: WarningFilled, accent: '#ef4444', bg: 'linear-gradient(135deg, #fff1f2, #ffffff)' },
    INVOICE: { label: '发票', tagType: 'primary', icon: Tickets, accent: '#f97316', bg: 'linear-gradient(135deg, #fff7ed, #ffffff)' },
    DRIVER_AUDIT: { label: '司机资料', tagType: 'warning', icon: UserFilled, accent: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #ffffff)' },
    VEHICLE_AUDIT: { label: '车辆资料', tagType: 'warning', icon: Van, accent: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #ffffff)' },
    WITHDRAW: { label: '提现', tagType: 'success', icon: Money, accent: '#16a34a', bg: 'linear-gradient(135deg, #ecfdf5, #ffffff)' }
  }
  return map[item.type] || { label: '事项', tagType: 'info', icon: BellFilled, accent: '#64748b', bg: 'linear-gradient(135deg, #f8fafc, #ffffff)' }
}

async function loadMessages() {
  loading.value = true
  try {
    const result = await http.get('/admin/important-messages')
    messages.value = Array.isArray(result) ? result : []
  } catch (error) {
    ElMessage.error(error.message || '重要消息加载失败')
  } finally {
    loading.value = false
  }
}

function handleMessageAction(item) {
  if (item.type === 'INVOICE' && item.orderId) {
    invoiceForm.value = {
      orderId: item.orderId,
      orderNo: item.orderNo || '',
      invoiceStatus: 'ISSUED',
      remark: '电子发票已处理'
    }
    invoiceVisible.value = true
    return
  }
  if (item.actionPath && item.actionPath !== '/messages') {
    router.push(item.actionPath)
    return
  }
  ElMessage.info('该事项已在当前消息列表中展示')
}

async function submitInvoice() {
  if (!invoiceForm.value.orderId) return
  invoiceSubmitting.value = true
  try {
    await http.post(`/admin/orders/${invoiceForm.value.orderId}/invoice`, {
      invoiceStatus: invoiceForm.value.invoiceStatus,
      remark: invoiceForm.value.remark
    })
    ElMessage.success('发票处理已同步')
    invoiceVisible.value = false
    await loadMessages()
  } catch (error) {
    ElMessage.error(error.message || '发票处理失败')
  } finally {
    invoiceSubmitting.value = false
  }
}

onMounted(loadMessages)
</script>

<style scoped>
.messages-page {
  display: grid;
  gap: 18px;
}

.message-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-height: 118px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.94), transparent 34%),
    var(--summary-bg, #ffffff);
  border-color: rgba(226, 232, 240, 0.92);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.055);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 122, 24, 0.2);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.summary-icon {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  color: var(--summary-accent, #ff7a18);
  font-size: 24px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.96)),
    var(--summary-bg, #ffffff);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.summary-card span {
  color: #64748b;
  font-weight: 700;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: #111827;
  font-size: 34px;
  line-height: 1;
}

.summary-card small {
  color: #94a3b8;
}

.message-panel {
  min-height: 460px;
}

.message-list {
  display: grid;
  gap: 12px;
  min-height: 300px;
}

.message-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 4% 10%, rgba(255, 255, 255, 0.94), transparent 36%),
    var(--message-bg, #ffffff);
  border: 1px solid rgba(226, 232, 240, 0.9);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.message-item:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 122, 24, 0.28);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.message-item.high {
  border-left: 4px solid #ef4444;
}

.message-item.medium {
  border-left: 4px solid #f59e0b;
}

.message-item.normal {
  border-left: 4px solid #2563eb;
}

.message-mark {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--message-accent, #f97316);
  font-size: 22px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.055);
}

.message-copy {
  min-width: 0;
}

.message-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.message-title-row strong {
  min-width: 0;
  overflow: hidden;
  color: #172033;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-copy p {
  margin: 7px 0;
  color: #475569;
  line-height: 1.45;
}

.message-copy span {
  color: #94a3b8;
  font-size: 13px;
}

@media (max-width: 960px) {
  .message-summary,
  .message-item {
    grid-template-columns: 1fr;
  }

  .message-item {
    align-items: start;
  }
}
</style>
