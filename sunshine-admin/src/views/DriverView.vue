<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">司机运营</span>
        <h3 class="panel-title">司机管理</h3>
        <p class="panel-subtitle">
          聚焦司机审核、账号启停、资料编辑和接单记录联动，所有动作提交后实时刷新列表与详情。
        </p>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索司机编号、昵称、手机号、车牌号"
          style="width: 300px"
          @keyup.enter="loadDrivers(true)"
        />
        <el-select v-model="query.auditStatus" clearable placeholder="审核状态" style="width: 140px">
          <el-option label="待审核" :value="1" />
          <el-option label="已通过" :value="2" />
          <el-option label="已驳回" :value="3" />
        </el-select>
        <el-select v-model="query.serviceStatus" clearable placeholder="接单状态" style="width: 140px">
          <el-option label="听单中" value="ONLINE" />
          <el-option label="服务中" value="BUSY" />
          <el-option label="休息中" value="OFFLINE" />
          <el-option label="已禁用" value="DISABLED" />
        </el-select>
        <el-button @click="loadDrivers(true)">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </div>
    </article>

    <article class="panel">
      <el-table v-loading="tableLoading" :data="list" stripe>
        <el-table-column prop="driverNo" label="司机编号" min-width="130" />
        <el-table-column prop="nickname" label="司机昵称" min-width="120" />
        <el-table-column prop="phone" label="手机号" min-width="130" />
        <el-table-column label="车辆信息" min-width="220">
          <template #default="{ row }">
            <div class="vehicle-cell">
              <strong>{{ row.vehicle?.plateNo || '暂未提交车辆' }}</strong>
              <span>{{ vehicleTitle(row.vehicle) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="接单状态" width="120">
          <template #default="{ row }">
            <el-tag :type="serviceStatusMeta(row).type" effect="light" round>
              {{ serviceStatusMeta(row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="120">
          <template #default="{ row }">
            <span class="audit-badge" :class="auditStatusMeta(row).className">
              {{ auditStatusMeta(row).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="司机评分" width="110">
          <template #default="{ row }">{{ formatNumber(row.score, 2) }}</template>
        </el-table-column>
        <el-table-column label="累计收益" width="120">
          <template #default="{ row }">{{ formatMoney(row.income) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="openDetail(row.userId)">详情</el-button>
              <template v-if="row.actionState === 'PENDING'">
                <el-button link type="success" @click="approveVehicle(row)">通过</el-button>
                <el-button link type="danger" @click="rejectVehicle(row)">驳回</el-button>
              </template>
              <template v-if="row.actionState !== 'PENDING'">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              </template>
              <el-button
                link
                :type="isEnabled(row.enabled) ? 'warning' : 'success'"
                @click="toggleEnable(row)"
              >
                {{ isEnabled(row.enabled) ? '禁用' : '启用' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :current-page="query.current"
          :page-size="query.size"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </article>

    <el-dialog v-model="formVisible" title="编辑司机资料" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="司机昵称" prop="nickname">
          <el-input v-model="form.nickname" maxlength="20" placeholder="请输入司机昵称" />
        </el-form-item>
        <el-form-item label="城市编码" prop="cityCode">
          <el-input v-model="form.cityCode" placeholder="例如 310100" />
        </el-form-item>
        <el-form-item label="驾驶证号" prop="licenseNo">
          <el-input v-model="form.licenseNo" placeholder="请输入驾驶证号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button :loading="submitLoading" type="primary" @click="submitForm">保存并刷新</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="司机详情" size="920px" destroy-on-close>
      <div v-if="detail.profile" class="drawer-stack">
        <div class="stat-grid">
          <div class="stat-card">
            <span>司机昵称</span>
            <strong>{{ detail.user?.nickname || '-' }}</strong>
          </div>
          <div class="stat-card">
            <span>接单状态</span>
            <strong>{{ serviceStatusMeta(detail.profile).label }}</strong>
          </div>
          <div class="stat-card">
            <span>审核状态</span>
            <strong>{{ auditStatusMeta(detail.profile).label }}</strong>
          </div>
          <div class="stat-card">
            <span>累计收益</span>
            <strong>{{ formatMoney(detail.profile.income) }}</strong>
          </div>
        </div>

        <el-descriptions title="基础资料" :column="2" border>
          <el-descriptions-item label="司机编号">{{ detail.profile.driverNo }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail.user?.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="驾驶证号">{{ detail.profile.licenseNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="城市编码">{{ detail.profile.cityCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="账号状态">
            {{ isEnabled(detail.user?.enabled) ? '正常' : '已禁用' }}
          </el-descriptions-item>
          <el-descriptions-item label="司机评分">{{ formatNumber(detail.profile.score, 2) }}</el-descriptions-item>
          <el-descriptions-item label="审核备注" :span="2">
            {{ detail.profile.vehicleAuditRemark || detail.profile.auditRemark || '暂无备注' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions title="车辆信息" :column="2" border>
          <el-descriptions-item label="车牌号">{{ detail.vehicle?.plateNo || '暂未提交' }}</el-descriptions-item>
          <el-descriptions-item label="车型">{{ vehicleTitle(detail.vehicle) }}</el-descriptions-item>
          <el-descriptions-item label="颜色">{{ detail.vehicle?.color || '-' }}</el-descriptions-item>
          <el-descriptions-item label="座位数">{{ detail.vehicle?.seatCount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="行驶证图片" :span="2">
            {{ detail.vehicle?.vehicleLicenseImageUrl || '暂无上传' }}
          </el-descriptions-item>
          <el-descriptions-item label="驾驶证图片" :span="2">
            {{ detail.vehicle?.driverLicenseImageUrl || '暂无上传' }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="document-gallery">
          <div class="document-card">
            <span class="document-title">行驶证图片</span>
            <template v-if="detail.vehicle?.vehicleLicenseImageUrl">
              <a :href="buildDocumentUrl(detail.vehicle?.vehicleLicenseImageUrl)" target="_blank" rel="noreferrer">
                <img class="document-preview" :src="buildDocumentUrl(detail.vehicle?.vehicleLicenseImageUrl)" alt="行驶证图片" />
              </a>
            </template>
            <div v-else class="document-empty">暂无上传</div>
          </div>
          <div class="document-card">
            <span class="document-title">驾驶证图片</span>
            <template v-if="detail.vehicle?.driverLicenseImageUrl">
              <a :href="buildDocumentUrl(detail.vehicle?.driverLicenseImageUrl)" target="_blank" rel="noreferrer">
                <img class="document-preview" :src="buildDocumentUrl(detail.vehicle?.driverLicenseImageUrl)" alt="驾驶证图片" />
              </a>
            </template>
            <div v-else class="document-empty">暂无上传</div>
          </div>
        </div>

        <div>
          <h4 class="sub-title">审核记录</h4>
          <el-table v-if="detail.auditRecords?.length" :data="detail.auditRecords" stripe>
            <el-table-column label="操作时间" min-width="168">
              <template #default="{ row }">
                {{ formatDateTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="operatorRole" label="操作角色" width="120" />
            <el-table-column prop="action" label="动作" width="120" />
            <el-table-column prop="content" label="处理说明" min-width="260" />
          </el-table>
          <div v-else class="empty-block">暂无审核记录</div>
        </div>

        <div>
          <h4 class="sub-title">接单记录</h4>
          <el-table v-if="detail.orders?.length" :data="detail.orders" stripe>
            <el-table-column prop="orderNo" label="订单号" min-width="180" />
            <el-table-column label="业务类型" width="110">
              <template #default="{ row }">
                {{ textOf(serviceTypeMap, row.serviceType) }}
              </template>
            </el-table-column>
            <el-table-column label="订单状态" width="110">
              <template #default="{ row }">
                <el-tag :type="getOrderStatusType(row)" effect="light">
                  {{ getOrderStatusLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="110">
              <template #default="{ row }">
                {{ formatMoney(row.amount, row.currencyCode) }}
              </template>
            </el-table-column>
            <el-table-column prop="startName" label="起点" min-width="160" />
            <el-table-column prop="endName" label="终点" min-width="160" />
          </el-table>
          <div v-else class="empty-block">暂无接单记录</div>
        </div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  getOrderStatusLabel,
  getOrderStatusType,
  serviceTypeMap,
  textOf
} from '../utils/admin'

const tableLoading = ref(false)
const submitLoading = ref(false)

const query = reactive({
  current: 1,
  size: 10,
  keyword: '',
  auditStatus: undefined,
  serviceStatus: ''
})

const total = ref(0)
const list = ref([])
const detail = ref({})
const detailVisible = ref(false)
const formVisible = ref(false)
const editingId = ref(null)
const formRef = ref()

const form = reactive({
  nickname: '',
  cityCode: '310100',
  licenseNo: ''
})

const rules = {
  nickname: [
    { required: true, message: '请输入司机昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度需为 2-20 位', trigger: 'blur' }
  ],
  cityCode: [{ required: true, message: '请输入城市编码', trigger: 'blur' }],
  licenseNo: [{ required: true, message: '请输入驾驶证号', trigger: 'blur' }]
}

function isEnabled(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['1', 'true', 'enabled', 'enable', 'on'].includes(normalized)
  }
  return value !== 0 && value !== null && value !== undefined
}

function hasUploadedDocument(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)
}

function shouldLockDriver(row = {}) {
  const vehicle = row.vehicle || {}
  const hasVehicle = Boolean(vehicle.id || row.vehicleId || row.plateNo || vehicle.plateNo)
  const hasRequiredDocs = hasUploadedDocument(vehicle.vehicleLicenseImageUrl || row.vehicleLicenseImageUrl) &&
    hasUploadedDocument(vehicle.driverLicenseImageUrl || row.driverLicenseImageUrl)
  const auditStatus = typeof row.vehicleAuditStatus === 'number'
    ? row.vehicleAuditStatus
    : (typeof vehicle.auditStatus === 'number' ? vehicle.auditStatus : undefined)

  if (!isEnabled(row.enabled)) return true
  if (!hasVehicle) return true
  if (!hasRequiredDocs) return true
  if (auditStatus !== 2) return true
  return false
}

function normalizeDriverRecord(row = {}) {
  if (!shouldLockDriver(row)) return row
  return {
    ...row,
    serviceStatus: 'DISABLED'
  }
}

function normalizeDriverDetail(payload = {}) {
  if (!payload || !payload.profile) return payload
  return {
    ...payload,
    profile: normalizeDriverRecord({
      ...payload.profile,
      enabled: payload.user?.enabled,
      vehicle: payload.vehicle
    })
  }
}

async function loadDrivers(resetPage = false) {
  if (resetPage) {
    query.current = 1
  }
  tableLoading.value = true
  try {
    const res = await http.get('/admin/drivers', { params: query })
    list.value = (res?.records || []).map(normalizeDriverRecord)
    total.value = res?.total || 0
  } finally {
    tableLoading.value = false
  }
}

function resetQuery() {
  query.current = 1
  query.keyword = ''
  query.auditStatus = undefined
  query.serviceStatus = ''
  loadDrivers()
}

async function openDetail(driverId) {
  detail.value = normalizeDriverDetail(await http.get(`/admin/drivers/${driverId}`))
  detailVisible.value = true
}

function openEdit(row) {
  editingId.value = row.userId
  form.nickname = row.nickname || ''
  form.cityCode = row.cityCode || '310100'
  form.licenseNo = row.licenseNo || ''
  formVisible.value = true
}

async function submitForm() {
  await formRef.value.validate()
  submitLoading.value = true
  try {
    await http.put(`/admin/drivers/${editingId.value}`, { ...form })
    ElMessage.success('司机资料已更新')
    formVisible.value = false
    await syncCurrentDriver(editingId.value)
    await loadDrivers()
  } finally {
    submitLoading.value = false
  }
}

async function approveVehicle(row) {
  await ElMessageBox.confirm(`确认通过司机 ${row.nickname} 的车辆审核吗？`, '车辆审核通过', {
    type: 'warning'
  })
  await http.post(`/admin/drivers/${row.userId}/audit`, {
    authStatus: 2,
    remark: '车辆资料审核通过，司机可正常接单'
  })
  ElMessage.success('车辆审核已通过')
  await syncCurrentDriver(row.userId)
  await loadDrivers()
}

async function rejectVehicle(row) {
  const result = await ElMessageBox.prompt('请输入驳回原因，提交后司机端会看到审核结果。', '驳回车辆审核', {
    confirmButtonText: '提交驳回',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '例如：证件照片不清晰，请重新上传',
    inputValidator: (value) => (value && value.trim() ? true : '请输入驳回原因')
  })
  await http.post(`/admin/drivers/${row.userId}/audit`, {
    authStatus: 3,
    remark: result.value.trim()
  })
  ElMessage.success('车辆审核已驳回')
  await syncCurrentDriver(row.userId)
  await loadDrivers()
}

async function toggleEnable(row) {
  const nextEnabled = isEnabled(row.enabled) ? 0 : 1
  await ElMessageBox.confirm(
    `确认要${nextEnabled === 1 ? '启用' : '禁用'}司机 ${row.nickname} 吗？`,
    '司机账号状态变更',
    { type: 'warning' }
  )
  await http.post(`/admin/users/${row.userId}/enable`, { enabled: nextEnabled })
  ElMessage.success(nextEnabled === 1 ? '司机账号已启用' : '司机账号已禁用')
  await syncCurrentDriver(row.userId)
  await loadDrivers()
}

function handlePageChange(current) {
  query.current = current
  loadDrivers()
}

async function syncCurrentDriver(driverId) {
  if (detailVisible.value && detail.value?.profile?.userId === driverId) {
    detail.value = normalizeDriverDetail(await http.get(`/admin/drivers/${driverId}`))
  }
}

function vehicleTitle(vehicle) {
  if (!vehicle) return '未提交品牌和车型'
  return `${vehicle.brand || ''} ${vehicle.modelName || ''}`.trim() || '未填写品牌和车型'
}

function buildDocumentUrl(url = '') {
  if (!url) return ''
  if (/^(https?:)?\/\//.test(url)) return url
  return `http://127.0.0.1:8080${`${url}`.startsWith('/') ? url : `/${url}`}`
}

function auditStatusMeta(row = {}) {
  if (!isEnabled(row.enabled) || row.vehicleAuditStatus === -1 || row.actionState === 'DISABLED') {
    return { label: '已禁用', className: 'disabled' }
  }
  if (row.vehicleAuditStatus === 2) {
    return { label: '已通过', className: 'approved' }
  }
  if (row.vehicleAuditStatus === 3) {
    return { label: '已驳回', className: 'rejected' }
  }
  if (row.vehicleAuditStatus === 1) {
    return { label: '待审核', className: 'pending' }
  }
  return { label: '未提交', className: 'unsigned' }
}

function serviceStatusMeta(row = {}) {
  if (!isEnabled(row.enabled) || row.serviceStatus === 'DISABLED') {
    return { label: '已禁用', type: 'info' }
  }
  if (row.serviceStatus === 'ONLINE') {
    return { label: '听单中', type: 'success' }
  }
  if (row.serviceStatus === 'BUSY') {
    return { label: '服务中', type: 'warning' }
  }
  return { label: '休息中', type: '' }
}

onMounted(() => {
  loadDrivers()
})
</script>

<style scoped>
.page > .panel + .panel {
  margin-top: 20px;
}

.vehicle-cell {
  display: grid;
  gap: 4px;
}

.vehicle-cell strong {
  color: #1f2937;
}

.vehicle-cell span {
  color: #64748b;
  font-size: 13px;
}

.audit-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.audit-badge.pending {
  color: #b45309;
  background: rgba(245, 158, 11, 0.15);
}

.audit-badge.approved {
  color: #15803d;
  background: rgba(34, 197, 94, 0.14);
}

.audit-badge.rejected {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.14);
}

.audit-badge.disabled,
.audit-badge.unsigned {
  color: #64748b;
  background: rgba(148, 163, 184, 0.18);
}

.document-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.document-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid #e8edf3;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.document-title {
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.document-preview-wrap {
  margin-top: 10px;
}

.document-preview {
  display: block;
  width: 100%;
  max-width: 320px;
  height: 180px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid #dbeafe;
  background: #fff;
}

.document-empty {
  color: #94a3b8;
  font-size: 13px;
}
</style>
