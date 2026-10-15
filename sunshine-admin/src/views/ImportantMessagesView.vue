<template>
  <section class="page messages-page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">待办工作台</span>
        <p class="panel-subtitle">集中处理投诉、发票申请、司机/车辆资料审核和提现申请。</p>
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
          <span class="panel-kicker">当前列表</span>
          <h3 class="panel-title">待处理事项</h3>
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
          <div
            class="message-copy"
            :class="{ clickable: isAuditItem(item) }"
            @click="isAuditItem(item) && openAuditDetail(item)"
          >
            <div class="message-title-row">
              <strong>{{ item.title }}</strong>
              <el-tag :type="typeMeta(item).tagType" size="small" effect="plain">{{ typeMeta(item).label }}</el-tag>
              <el-tag
                v-for="scope in auditScopesOf(item)"
                :key="scope"
                size="small"
                type="warning"
                effect="light"
              >
                {{ scope === 'DRIVER' ? '司机资质' : '车辆资料' }}
              </el-tag>
            </div>
            <p>{{ item.content }}</p>
            <span>{{ formatDateTime(item.createdAt) }}{{ isAuditItem(item) ? ' · 点击查看详情' : '' }}</span>
          </div>
          <div class="message-actions">
            <template v-if="item.type === 'COMPLAINT'">
              <el-button
                :loading="isActionLoading(item, 'complaint')"
                type="danger"
                plain
                @click="handleComplaint(item)"
              >
                处理投诉
              </el-button>
            </template>
            <template v-else-if="item.type === 'WITHDRAW'">
              <el-button
                :loading="isActionLoading(item, 'withdraw-approve')"
                type="success"
                plain
                @click="auditWithdraw(item, 'APPROVE')"
              >
                通过
              </el-button>
              <el-button
                :loading="isActionLoading(item, 'withdraw-reject')"
                type="danger"
                plain
                @click="auditWithdraw(item, 'REJECT')"
              >
                驳回
              </el-button>
            </template>
            <template v-else-if="item.type === 'DRIVER_AUDIT' || item.type === 'VEHICLE_AUDIT'">
              <el-button
                :loading="isActionLoading(item, 'audit-pass')"
                type="success"
                plain
                @click="auditDriver(item, 2)"
              >
                通过
              </el-button>
              <el-button
                :loading="isActionLoading(item, 'audit-reject')"
                type="danger"
                plain
                @click="auditDriver(item, 3)"
              >
                驳回
              </el-button>
            </template>
            <template v-else-if="item.type === 'INVOICE'">
              <el-button type="primary" plain @click="openInvoiceDialog(item)">处理发票</el-button>
            </template>
            <el-button v-else text type="primary" @click="handleMessageAction(item)">
              {{ item.actionText || '查看' }}
            </el-button>
          </div>
        </div>

        <el-empty v-if="!filteredMessages.length && !loading" description="暂无重要待办消息" />
      </div>
    </article>

    <el-dialog v-model="invoiceVisible" title="处理发票申请" width="520px">
      <el-form label-width="96px">
        <el-form-item label="订单号">
          <span>{{ invoiceForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="处理结果">
          <el-select v-model="invoiceForm.invoiceStatus" style="width: 100%">
            <el-option label="已开票" value="ISSUED" />
            <el-option label="驳回申请" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票抬头">
          <el-input v-model="invoiceForm.invoiceTitle" maxlength="40" placeholder="个人或企业名称" />
        </el-form-item>
        <el-form-item label="税号">
          <el-input v-model="invoiceForm.taxNo" maxlength="32" placeholder="个人可填写：个人无需填写" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="invoiceForm.buyerPhone" maxlength="20" placeholder="购买方联系电话" />
        </el-form-item>
        <el-form-item :label="invoiceForm.invoiceStatus === 'REJECTED' ? '驳回原因' : '处理备注'">
          <el-input
            v-model="invoiceForm.remark"
            type="textarea"
            :rows="3"
            maxlength="160"
            show-word-limit
            :placeholder="invoiceForm.invoiceStatus === 'REJECTED' ? '请输入驳回原因，会通知用户' : '例如：电子发票已生成，可在用户端我的发票查看'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="invoiceVisible = false">取消</el-button>
        <el-button :loading="invoiceSubmitting" type="primary" @click="submitInvoice">确认处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="auditDetailVisible" :title="auditDetailTitle" width="700px">
      <div v-loading="detailLoading" class="audit-detail">
        <template v-if="auditDetail">
          <div class="detail-block">
            <div class="detail-block-head">
              <strong>司机资质</strong>
              <el-tag size="small" :type="auditDetail.profile?.auditStatus === 1 ? 'warning' : 'success'">
                {{ auditStatusText(auditDetail.profile?.auditStatus) }}
              </el-tag>
            </div>
            <div class="detail-grid">
              <div><label>姓名</label><span>{{ auditDetail.user?.realName || auditDetail.user?.nickname || '-' }}</span></div>
              <div><label>手机号</label><span>{{ auditDetail.user?.phone || '-' }}</span></div>
              <div><label>驾驶证号</label><span>{{ auditDetail.profile?.licenseNo || '-' }}</span></div>
            </div>
            <div v-if="auditDetail.vehicle?.driverLicenseImageUrl" class="detail-photo">
              <el-image
                :src="resolveImageUrl(auditDetail.vehicle.driverLicenseImageUrl)"
                :preview-src-list="[resolveImageUrl(auditDetail.vehicle.driverLicenseImageUrl)]"
                fit="cover"
                class="detail-img"
                preview-teleported
              />
              <span class="detail-photo-label">驾驶证照片</span>
            </div>
            <div v-if="detailItemCanAudit('DRIVER')" class="detail-actions">
              <el-button size="small" type="success" plain @click="auditFromDetail('DRIVER', 2)">通过司机资质</el-button>
              <el-button size="small" type="danger" plain @click="auditFromDetail('DRIVER', 3)">驳回司机资质</el-button>
            </div>
          </div>

          <div v-if="auditDetail.vehicle" class="detail-block">
            <div class="detail-block-head">
              <strong>车辆资料</strong>
              <el-tag size="small" :type="auditDetail.vehicle.auditStatus === 1 ? 'warning' : 'success'">
                {{ auditStatusText(auditDetail.vehicle.auditStatus) }}
              </el-tag>
            </div>
            <div class="detail-grid">
              <div><label>车牌号</label><span>{{ auditDetail.vehicle.plateNo || '-' }}</span></div>
              <div><label>品牌车型</label><span>{{ (auditDetail.vehicle.brand || '-') + ' ' + (auditDetail.vehicle.modelName || '') }}</span></div>
              <div><label>颜色 / 座位</label><span>{{ (auditDetail.vehicle.color || '-') + ' / ' + (auditDetail.vehicle.seatCount || '-') + ' 座' }}</span></div>
              <div><label>保险到期</label><span>{{ auditDetail.vehicle.insuranceExpireDate || '-' }}</span></div>
              <div><label>年检到期</label><span>{{ auditDetail.vehicle.annualInspectExpireDate || '-' }}</span></div>
            </div>
            <div v-if="auditDetail.vehicle.vehicleLicenseImageUrl" class="detail-photo">
              <el-image
                :src="resolveImageUrl(auditDetail.vehicle.vehicleLicenseImageUrl)"
                :preview-src-list="[resolveImageUrl(auditDetail.vehicle.vehicleLicenseImageUrl)]"
                fit="cover"
                class="detail-img"
                preview-teleported
              />
              <span class="detail-photo-label">行驶证照片</span>
            </div>
            <div v-if="detailItemCanAudit('VEHICLE')" class="detail-actions">
              <el-button size="small" type="success" plain @click="auditFromDetail('VEHICLE', 2)">通过车辆资料</el-button>
              <el-button size="small" type="danger" plain @click="auditFromDetail('VEHICLE', 3)">驳回车辆资料</el-button>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="auditDetailVisible = false">关闭</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import http, { baseURL } from '../api/http'
import { formatDateTime } from '../utils/admin'

const router = useRouter()
const loading = ref(false)
const messages = ref([])
const levelFilter = ref('ALL')
const actionLoadingId = ref('')
const invoiceVisible = ref(false)
const invoiceSubmitting = ref(false)
const auditDetailVisible = ref(false)
const detailLoading = ref(false)
const auditDetail = ref(null)
const detailItem = ref(null)
const invoiceForm = ref({
  orderId: null,
  orderNo: '',
  invoiceStatus: 'ISSUED',
  invoiceTitle: '个人',
  taxNo: '个人无需填写',
  buyerPhone: '13800000000',
  remark: ''
})

const levelOptions = [
  { label: '全部', value: 'ALL' },
  { label: '高优先级', value: 'HIGH' },
  { label: '发票', value: 'INVOICE' },
  { label: '审核', value: 'AUDIT' },
  { label: '提现', value: 'WITHDRAW' },
  { label: '客服', value: 'SUPPORT' }
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
    desc: '按当前待办汇总',
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
  if (levelFilter.value === 'SUPPORT') {
    return messages.value.filter((item) => item.type === 'SUPPORT')
  }
  return messages.value.filter((item) => item.level === levelFilter.value)
})

function typeMeta(item = {}) {
  const map = {
    COMPLAINT: { label: '投诉', tagType: 'danger', icon: WarningFilled, accent: '#ef4444', bg: 'linear-gradient(135deg, #fff1f2, #ffffff)' },
    INVOICE: { label: '发票', tagType: 'primary', icon: Tickets, accent: '#f97316', bg: 'linear-gradient(135deg, #fff7ed, #ffffff)' },
    DRIVER_AUDIT: { label: '司机资料', tagType: 'warning', icon: UserFilled, accent: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #ffffff)' },
    VEHICLE_AUDIT: { label: '车辆资料', tagType: 'warning', icon: Van, accent: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #ffffff)' },
    WITHDRAW: { label: '提现', tagType: 'success', icon: Money, accent: '#16a34a', bg: 'linear-gradient(135deg, #ecfdf5, #ffffff)' },
    SUPPORT: { label: '客服', tagType: 'primary', icon: BellFilled, accent: '#2563eb', bg: 'linear-gradient(135deg, #eff6ff, #ffffff)' }
  }
  return map[item.type] || { label: '事项', tagType: 'info', icon: BellFilled, accent: '#64748b', bg: 'linear-gradient(135deg, #f8fafc, #ffffff)' }
}

function isActionLoading(item, action) {
  return actionLoadingId.value === `${item.id}:${action}`
}

function isAuditItem(item) {
  return item?.type === 'DRIVER_AUDIT' || item?.type === 'VEHICLE_AUDIT'
}

function auditScopesOf(item) {
  if (Array.isArray(item?.auditScopes) && item.auditScopes.length) return item.auditScopes
  if (!isAuditItem(item)) return []
  return [item.type === 'VEHICLE_AUDIT' ? 'VEHICLE' : 'DRIVER']
}

function auditStatusText(status) {
  return { 0: '未认证', 1: '待审核', 2: '已通过', 3: '已驳回' }[status] || '未知'
}

function resolveImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return baseURL + url
}

const auditDetailTitle = computed(() => {
  if (!detailItem.value) return '审核详情'
  const scopes = auditScopesOf(detailItem.value)
  if (scopes.includes('DRIVER') && scopes.includes('VEHICLE')) return '司机资质审核详情'
  if (scopes.includes('VEHICLE')) return '车辆资料审核详情'
  return '司机资料审核详情'
})

function detailItemCanAudit(scope) {
  return auditScopesOf(detailItem.value).includes(scope)
}

async function openAuditDetail(item) {
  const driverId = resolveTargetId(item, 'driverId', 'driver-audit-')
  if (!driverId) {
    ElMessage.warning('当前审核消息缺少司机ID，无法查看详情')
    return
  }
  detailItem.value = item
  auditDetailVisible.value = true
  detailLoading.value = true
  try {
    const result = await http.get(`/admin/drivers/${driverId}`)
    auditDetail.value = result || null
  } catch (error) {
    ElMessage.error(error.message || '审核详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

async function auditFromDetail(scope, authStatus) {
  const item = detailItem.value
  if (!item) return
  await auditDriver(item, authStatus, scope)
  // 审核后刷新详情；若两项都已处理完则关闭弹窗
  const remaining = auditScopesOf(item).filter((s) => s !== scope)
  if (!remaining.length) {
    auditDetailVisible.value = false
    return
  }
  detailItem.value = { ...item, auditScopes: remaining }
  if (auditDetailVisible.value) {
    await openAuditDetail(detailItem.value)
  }
}

function parseTargetId(item, prefix) {
  if (!item?.id || !prefix) return null
  const value = String(item.id).replace(prefix, '')
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function resolveTargetId(item, field, fallbackPrefix) {
  const direct = Number(item?.[field])
  if (Number.isFinite(direct) && direct > 0) return direct
  return parseTargetId(item, fallbackPrefix)
}

function withActionLoading(item, action, task) {
  actionLoadingId.value = `${item.id}:${action}`
  return Promise.resolve()
    .then(task)
    .finally(() => {
      actionLoadingId.value = ''
    })
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

function openInvoiceDialog(item) {
  if (!item.orderId) {
    ElMessage.warning('当前发票消息缺少订单ID，无法直接处理')
    return
  }
  invoiceForm.value = {
    orderId: item.orderId,
    orderNo: item.orderNo || '',
    invoiceStatus: 'ISSUED',
    invoiceTitle: item.invoiceTitle || item.buyerName || '个人',
    taxNo: item.taxNo || item.buyerTaxNo || '个人无需填写',
    buyerPhone: item.buyerPhone || '13800000000',
    remark: '电子发票已生成，可在用户端我的发票查看'
  }
  invoiceVisible.value = true
}

async function handleSupportReception(item) {
  const conversationId = resolveTargetId(item, 'conversationId', 'support-')
  if (!conversationId) {
    ElMessage.warning('当前客服消息缺少会话ID，无法直接接待')
    return
  }
  ElMessage.info('已打开客服对话，请根据当前会话状态处理')
  router.push({ path: '/support', query: { conversationId } })
}

function handleMessageAction(item) {
  if (item?.type === 'SUPPORT') {
    handleSupportReception(item)
    return
  }
  if (item?.actionPath) {
    router.push(item.actionPath)
    return
  }
  ElMessage.info(`${item.actionText || '该事项'}已在当前页展示，可直接处理`)
}

async function handleComplaint(item) {
  const complaintId = resolveTargetId(item, 'complaintId', 'complaint-')
  if (!complaintId) {
    ElMessage.warning('当前投诉消息缺少投诉ID，无法直接处理')
    return
  }
  const prompt = await ElMessageBox.prompt('请输入投诉处理结果，提交后会更新订单详情和消息待办。', '处理投诉', {
    confirmButtonText: '确认处理',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '例如：已联系乘客核实并完成补偿/解释处理',
    inputValidator: (value) => (value && value.trim() ? true : '请输入处理结果')
  })
  await withActionLoading(item, 'complaint', async () => {
    await http.post(`/admin/complaints/${complaintId}/handle`, {
      handleResult: prompt.value.trim()
    })
    ElMessage.success('投诉已处理并从待办移除')
    await loadMessages()
  })
}

async function auditWithdraw(item, action) {
  const withdrawId = resolveTargetId(item, 'withdrawId', 'withdraw-')
  if (!withdrawId) {
    ElMessage.warning('当前提现消息缺少提现ID，无法直接审核')
    return
  }

  let rejectReason = ''
  if (action === 'APPROVE') {
    await ElMessageBox.confirm(`确认通过这笔提现申请吗？${item.applyAmount ? ` 金额：${item.applyAmount} 元` : ''}`, '提现审核', {
      type: 'warning'
    })
  } else {
    const result = await ElMessageBox.prompt('请输入驳回原因，提交后司机端会看到审核结果。', '驳回提现', {
      confirmButtonText: '提交驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '例如：银行卡信息不完整，请重新提交',
      inputValidator: (value) => (value && value.trim() ? true : '请输入驳回原因')
    })
    rejectReason = result.value.trim()
  }

  await withActionLoading(item, action === 'APPROVE' ? 'withdraw-approve' : 'withdraw-reject', async () => {
    await http.post(`/admin/withdraws/${withdrawId}/audit`, {
      action,
      rejectReason
    })
    ElMessage.success(action === 'APPROVE' ? '提现已通过' : '提现已驳回')
    await loadMessages()
  })
}

async function auditDriver(item, authStatus, scopeOverride) {
  const driverId = resolveTargetId(item, 'driverId', 'driver-audit-')
  if (!driverId) {
    ElMessage.warning('当前审核消息缺少司机ID，无法直接审核')
    return
  }

  const scopes = scopeOverride ? [scopeOverride] : auditScopesOf(item)
  const scope = scopes.length > 1 ? 'ALL' : scopes[0]
  const scopeNames = { DRIVER: '司机资质', VEHICLE: '车辆资料' }
  const targetName = scopes.map((s) => scopeNames[s] || s).join(' 与 ') || '司机资料'
  let remark = `${targetName}审核通过`
  if (authStatus === 2) {
    await ElMessageBox.confirm(
      scopes.length > 1
        ? `将同时通过${targetName}，确认吗？如需分开审核，请点击消息内容查看详情后单独处理。`
        : `确认通过该${targetName}吗？`,
      `${targetName}审核`,
      { type: 'warning' }
    )
  } else {
    const result = await ElMessageBox.prompt(`请输入${targetName}驳回原因。`, `驳回${targetName}`, {
      confirmButtonText: '提交驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '例如：证件照片不清晰，请重新上传',
      inputValidator: (value) => (value && value.trim() ? true : '请输入驳回原因')
    })
    remark = result.value.trim()
  }

  await withActionLoading(item, authStatus === 2 ? 'audit-pass' : 'audit-reject', async () => {
    await http.post(`/admin/drivers/${driverId}/audit`, {
      authStatus,
      remark,
      scope
    })
    ElMessage.success(authStatus === 2 ? `${targetName}已通过` : `${targetName}已驳回`)
    await loadMessages()
  })
}

async function submitInvoice() {
  if (!invoiceForm.value.orderId) return
  const remark = `${invoiceForm.value.remark || ''}`.trim()
  if (invoiceForm.value.invoiceStatus === 'REJECTED' && !remark) {
    ElMessage.warning('驳回发票申请必须填写原因')
    return
  }
  invoiceSubmitting.value = true
  try {
    await http.post(`/admin/orders/${invoiceForm.value.orderId}/invoice`, {
      invoiceStatus: invoiceForm.value.invoiceStatus,
      invoiceTitle: invoiceForm.value.invoiceTitle || '个人',
      taxNo: invoiceForm.value.taxNo || '个人无需填写',
      buyerPhone: invoiceForm.value.buyerPhone || '13800000000',
      remark: remark || '电子发票已生成，可在用户端我的发票查看'
    })
    ElMessage.success(invoiceForm.value.invoiceStatus === 'REJECTED' ? '发票申请已驳回并通知用户' : '电子发票已生成，用户端可查看')
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
  gap: 20px;
}

.message-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  min-height: 82px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
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
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--summary-accent, #ff7a18);
  font-size: 18px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.96)),
    var(--summary-bg, #ffffff);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.summary-card span {
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
}

.summary-card strong {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 26px;
  line-height: 1;
}

.summary-card small {
  color: #94a3b8;
  font-size: 12px;
}

.message-panel {
  min-height: 0;
}

.message-panel .panel-head {
  margin-bottom: 14px;
}

.message-list {
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: 10px;
  min-height: 0;
}

.message-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 14px;
  min-height: 86px;
  padding: 14px 16px;
  border-radius: 16px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--message-accent, #f97316) 7%, transparent), transparent 22%),
    radial-gradient(circle at 5% 18%, rgba(255, 255, 255, 0.98), transparent 34%),
    var(--message-bg, #ffffff);
  border: 1px solid color-mix(in srgb, var(--message-accent, #f97316) 22%, rgba(226, 232, 240, 0.9));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.045);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.message-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--message-accent, #f97316) 42%, #e2e8f0);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.075);
}

.message-item.high {
  border-left: 3px solid #ef4444;
}

.message-item.medium {
  border-left: 3px solid #f59e0b;
}

.message-item.normal {
  border-left: 3px solid #2563eb;
}

.message-mark {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.76)),
    color-mix(in srgb, var(--message-accent, #f97316) 12%, white);
  color: var(--message-accent, #f97316);
  font-size: 18px;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.055);
}

.message-copy {
  min-width: 0;
}

.message-copy.clickable {
  cursor: pointer;
}

.audit-detail {
  display: grid;
  gap: 18px;
  min-height: 120px;
}

.detail-block {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  background: linear-gradient(180deg, #fffdf9 0%, #ffffff 60%);
}

.detail-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.detail-block-head strong {
  font-size: 15px;
  color: #172033;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px 18px;
}

.detail-grid > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-grid label {
  color: #94a3b8;
  font-size: 12px;
}

.detail-grid span {
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
}

.detail-photo {
  margin-top: 10px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.detail-img {
  width: 220px;
  height: 140px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.detail-photo-label {
  color: #94a3b8;
  font-size: 12px;
}

.detail-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.message-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-title-row strong {
  min-width: 0;
  overflow: hidden;
  color: #172033;
  font-size: 15px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-copy p {
  margin: 5px 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.45;
}

.message-copy span {
  color: #94a3b8;
  font-size: 12px;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.message-actions :deep(.el-button) {
  min-width: 76px;
  min-height: 32px;
  padding: 7px 12px;
  margin-left: 0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 960px) {
  .message-summary,
  .message-item {
    grid-template-columns: 1fr;
  }

  .message-item {
    align-items: start;
  }

  .message-actions {
    justify-content: flex-start;
  }
}
</style>
