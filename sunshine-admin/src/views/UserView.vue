<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">User Center</span>
        <h3 class="panel-title">用户管理</h3>
        <p class="panel-subtitle">
          统一处理用户资料、实名认证、账号启停与密码重置；司机账号会自动合并司机档案、车辆档案和真实订单数据。
        </p>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索昵称、手机号、真实姓名"
          style="width: 260px"
          @keyup.enter="loadUsers(true)"
        />
        <el-select v-model="query.roleCode" clearable placeholder="角色筛选" style="width: 140px">
          <el-option label="乘客" value="USER" />
          <el-option label="司机" value="DRIVER" />
          <el-option label="管理员" value="ADMIN" />
        </el-select>
        <el-button @click="loadUsers(true)">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="openCreate">新建用户</el-button>
      </div>
    </article>

    <article class="panel">
      <el-table v-loading="tableLoading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="nickname" label="用户昵称" min-width="140" />
        <el-table-column prop="phone" label="手机号" min-width="130" />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag effect="light">{{ textOf(roleMap, row.roleCode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="realName" label="真实姓名" min-width="120">
          <template #default="{ row }">
            {{ row.realName || '未填写' }}
          </template>
        </el-table-column>
        <el-table-column label="业务档案" min-width="220">
          <template #default="{ row }">
            {{ formatDriverArchive(row) }}
          </template>
        </el-table-column>
        <el-table-column label="认证状态" width="120">
          <template #default="{ row }">
            <el-tag :type="authTagType(resolveAuthStatus(row))" effect="light">
              {{ textOf(authStatusMap, resolveAuthStatus(row)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账号状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" effect="light">
              {{ row.enabled === 1 ? '已启用' : '已禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="钱包余额" width="120">
          <template #default="{ row }">
            {{ formatMoney(row.walletBalance) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="168">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="warning" @click="openAuthDialog(row)">
                {{ isDriver(row) ? '司机审核' : '实名认证' }}
              </el-button>
              <el-button link :type="row.enabled === 1 ? 'danger' : 'success'" @click="toggleEnable(row)">
                {{ row.enabled === 1 ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="info" @click="resetPassword(row)">重置密码</el-button>
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

    <el-dialog v-model="formVisible" :title="form.id ? '编辑用户' : '新建用户'" width="640px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="96px">
        <div class="form-grid">
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" maxlength="11" placeholder="请输入手机号" />
          </el-form-item>
          <el-form-item label="用户昵称" prop="nickname">
            <el-input v-model="form.nickname" maxlength="20" placeholder="请输入用户昵称" />
          </el-form-item>
          <el-form-item label="角色" prop="roleCode">
            <el-select v-model="form.roleCode" :disabled="Boolean(form.id)" placeholder="请选择角色">
              <el-option label="乘客" value="USER" />
              <el-option label="司机" value="DRIVER" />
              <el-option label="管理员" value="ADMIN" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!form.id" label="初始密码" prop="password">
            <el-input v-model="form.password" show-password maxlength="20" placeholder="默认 123456" />
          </el-form-item>
          <el-form-item label="真实姓名">
            <el-input v-model="form.realName" maxlength="20" placeholder="请输入真实姓名" />
          </el-form-item>
          <el-form-item label="身份证号">
            <el-input v-model="form.idCard" maxlength="18" placeholder="请输入身份证号" />
          </el-form-item>
          <el-form-item label="紧急联系人">
            <el-input v-model="form.emergencyContact" maxlength="20" placeholder="请输入联系人" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="form.emergencyPhone" maxlength="11" placeholder="请输入联系电话" />
          </el-form-item>
          <el-form-item label="账号启用">
            <el-switch v-model="form.enabledFlag" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button :loading="submitLoading" type="primary" @click="submitForm">保存并刷新</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="authVisible"
      :title="authTarget && isDriver(authTarget) ? '司机审核处理' : '实名认证处理'"
      width="560px"
      destroy-on-close
    >
      <div v-if="authTarget" class="drawer-stack">
        <div class="summary-list">
          <div class="summary-item">
            <span>当前用户</span>
            <strong>{{ authTarget.nickname }}</strong>
          </div>
          <div class="summary-item">
            <span>认证状态</span>
            <strong>{{ textOf(authStatusMap, resolveAuthStatus(authTarget)) }}</strong>
          </div>
        </div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="手机号">{{ authTarget.phone }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ textOf(roleMap, authTarget.roleCode) }}</el-descriptions-item>
          <el-descriptions-item label="真实姓名">{{ authTarget.realName || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ authTarget.idCard || '未填写' }}</el-descriptions-item>
          <el-descriptions-item v-if="authTarget.driverProfile" label="司机编号">
            {{ authTarget.driverProfile.driverNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="authTarget.driverProfile" label="车辆信息">
            {{ driverVehicleText(authTarget.driverProfile.vehicle) }}
          </el-descriptions-item>
          <el-descriptions-item label="历史备注" :span="2">
            {{ resolveAuthRemark(authTarget) || '暂无备注' }}
          </el-descriptions-item>
        </el-descriptions>
        <el-form ref="authFormRef" :model="authForm" :rules="authRules" label-width="84px">
          <el-form-item label="审核备注" prop="remark">
            <el-input
              v-model="authForm.remark"
              :rows="4"
              maxlength="120"
              show-word-limit
              type="textarea"
              placeholder="请输入审核结论或驳回原因"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="authVisible = false">关闭</el-button>
        <el-button :loading="authLoading" type="danger" @click="submitAuth(3)">驳回认证</el-button>
        <el-button :loading="authLoading" type="success" @click="submitAuth(2)">审核通过</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="用户详情" size="920px" destroy-on-close>
      <div v-if="detail.user" class="drawer-stack">
        <div class="stat-grid">
          <div class="stat-card">
            <span>用户昵称</span>
            <strong>{{ detail.user.nickname }}</strong>
          </div>
          <div class="stat-card">
            <span>钱包余额</span>
            <strong>{{ formatMoney(detail.user.walletBalance) }}</strong>
          </div>
          <div v-if="detail.driverProfile" class="stat-card">
            <span>司机收益</span>
            <strong>{{ formatMoney(detail.driverProfile.income) }}</strong>
          </div>
          <div class="stat-card">
            <span>优惠券数量</span>
            <strong>{{ detail.couponTotal || 0 }}</strong>
          </div>
          <div class="stat-card">
            <span>完成订单</span>
            <strong>{{ detail.completedOrderTotal || 0 }}</strong>
          </div>
        </div>

        <el-descriptions title="基础资料" :column="2" border>
          <el-descriptions-item label="手机号">{{ detail.user.phone }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ textOf(roleMap, detail.user.roleCode) }}</el-descriptions-item>
          <el-descriptions-item label="真实姓名">{{ detail.user.realName || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="认证状态">{{ textOf(authStatusMap, detail.user.authStatus) }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ detail.user.idCard || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="紧急联系人">{{ detail.user.emergencyContact || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detail.user.emergencyPhone || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="审核备注" :span="2">{{ detail.user.authRemark || '暂无备注' }}</el-descriptions-item>
        </el-descriptions>

        <el-descriptions v-if="detail.driverProfile" title="司机档案" :column="2" border>
          <el-descriptions-item label="司机编号">{{ detail.driverProfile.driverNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="接单状态">
            {{ driverServiceStatusLabel(detail.driverProfile.serviceStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="驾驶证号">{{ detail.driverProfile.licenseNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="城市编码">{{ detail.driverProfile.cityCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="车牌号">{{ detail.vehicle?.plateNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="车辆信息">{{ driverVehicleText(detail.vehicle) }}</el-descriptions-item>
          <el-descriptions-item label="司机评分">{{ Number(detail.driverProfile.score || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="车辆审核">
            {{ textOf(authStatusMap, detail.driverProfile.vehicleAuditStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="车辆审核备注" :span="2">
            {{ resolveAuthRemark(detail.user) || '暂无备注' }}
          </el-descriptions-item>
        </el-descriptions>

        <div>
          <h4 class="sub-title">历史订单</h4>
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
          <div v-else class="empty-block">暂无用户订单数据</div>
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
  authStatusMap,
  formatDateTime,
  formatMoney,
  getOrderStatusLabel,
  getOrderStatusType,
  roleMap,
  serviceTypeMap,
  textOf
} from '../utils/admin'

const tableLoading = ref(false)
const submitLoading = ref(false)
const authLoading = ref(false)

const query = reactive({
  current: 1,
  size: 10,
  keyword: '',
  roleCode: ''
})

const total = ref(0)
const list = ref([])
const detailVisible = ref(false)
const detail = ref({})
const formVisible = ref(false)
const authVisible = ref(false)
const authTarget = ref(null)

const formRef = ref()
const authFormRef = ref()

const createForm = () => ({
  id: null,
  phone: '',
  nickname: '',
  roleCode: 'USER',
  password: '123456',
  realName: '',
  idCard: '',
  emergencyContact: '',
  emergencyPhone: '',
  enabledFlag: true
})

const form = reactive(createForm())
const authForm = reactive({
  remark: ''
})

const formRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  nickname: [
    { required: true, message: '请输入用户昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度需为 2-20 位', trigger: 'blur' }
  ],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }]
}

const authRules = {
  remark: [{ required: true, message: '请输入审核备注', trigger: 'blur' }]
}

function isDriver(row = {}) {
  return row?.roleCode === 'DRIVER'
}

function resolveAuthStatus(row = {}) {
  if (isDriver(row) && typeof row?.driverProfile?.vehicleAuditStatus === 'number') {
    return row.driverProfile.vehicleAuditStatus
  }
  return row?.authStatus
}

function resolveAuthRemark(row = {}) {
  if (isDriver(row) && row?.driverProfile) {
    return row.driverProfile.vehicleAuditRemark || row.driverProfile.auditRemark || row.authRemark || ''
  }
  return row?.authRemark || ''
}

function driverServiceStatusLabel(status) {
  if (status === 'ONLINE') return '听单中'
  if (status === 'BUSY') return '服务中'
  if (status === 'DISABLED') return '已禁用'
  return '休息中'
}

function driverVehicleText(vehicle = {}) {
  if (!vehicle) return '-'
  return `${vehicle.brand || ''} ${vehicle.modelName || ''}`.trim() || '-'
}

function formatDriverArchive(row = {}) {
  if (!row.driverProfile) return '-'
  const driverNo = row.driverProfile.driverNo || '-'
  const plateNo = row.driverProfile.vehicle?.plateNo || '-'
  const serviceStatus = driverServiceStatusLabel(row.driverProfile.serviceStatus)
  return `${driverNo} / ${plateNo} / ${serviceStatus}`
}

function buildDriverMap(records = []) {
  return new Map(records.map((item) => {
    const profile = normalizeDriverProfile(item)
    return [profile.userId, profile]
  }))
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function normalizeUserRecord(user = {}) {
  if (!user) return user
  return {
    ...user,
    roleCode: firstDefined(user.roleCode, user.role_code, 'USER'),
    realName: firstDefined(user.realName, user.real_name, ''),
    idCard: firstDefined(user.idCard, user.id_card, ''),
    authStatus: firstDefined(user.authStatus, user.auth_status, 0),
    authRemark: firstDefined(user.authRemark, user.auth_remark, ''),
    walletBalance: firstDefined(user.walletBalance, user.wallet_balance, 0),
    emergencyContact: firstDefined(user.emergencyContact, user.emergency_contact, ''),
    emergencyPhone: firstDefined(user.emergencyPhone, user.emergency_phone, ''),
    createdAt: firstDefined(user.createdAt, user.created_at, ''),
    updatedAt: firstDefined(user.updatedAt, user.updated_at, '')
  }
}

function normalizeDriverProfile(profile = {}) {
  if (!profile) return profile
  return {
    ...profile,
    userId: firstDefined(profile.userId, profile.user_id),
    driverNo: firstDefined(profile.driverNo, profile.driver_no, ''),
    cityCode: firstDefined(profile.cityCode, profile.city_code, ''),
    licenseNo: firstDefined(profile.licenseNo, profile.license_no, ''),
    serviceStatus: firstDefined(profile.serviceStatus, profile.service_status, ''),
    vehicleAuditStatus: firstDefined(profile.vehicleAuditStatus, profile.vehicle_audit_status, profile.auditStatus, profile.audit_status),
    vehicleAuditRemark: firstDefined(profile.vehicleAuditRemark, profile.vehicle_audit_remark, profile.auditRemark, profile.audit_remark, '')
  }
}

function mergeUserWithDriver(user = {}, driverMap = new Map()) {
  const normalizedUser = normalizeUserRecord(user)
  const driverProfile = normalizeDriverProfile(driverMap.get(normalizedUser.id))
  if (!driverProfile) return normalizedUser
  return {
    ...normalizedUser,
    driverProfile,
    authStatus: typeof driverProfile.vehicleAuditStatus === 'number' ? driverProfile.vehicleAuditStatus : normalizedUser.authStatus,
    authRemark: driverProfile.vehicleAuditRemark || normalizedUser.authRemark
  }
}

async function loadDriverProfiles() {
  const res = await http.get('/admin/drivers', {
    params: {
      current: 1,
      size: 200,
      keyword: query.keyword || '',
      auditStatus: undefined,
      serviceStatus: ''
    }
  })
  return res?.records || []
}

function countCompletedOrders(orders = []) {
  return orders.filter((item) => ['FINISHED', 'REFUNDED'].includes(item.status)).length
}

async function getUserDetail(userId) {
  const rawUserDetail = await http.get(`/admin/users/${userId}`)
  const userDetail = {
    ...rawUserDetail,
    user: normalizeUserRecord(rawUserDetail?.user)
  }
  if (!isDriver(userDetail?.user)) {
    return userDetail
  }

  try {
    const driverDetail = await http.get(`/admin/drivers/${userId}`)
    const driverProfile = normalizeDriverProfile(driverDetail?.profile)
    const orders = Array.isArray(driverDetail?.orders) && driverDetail.orders.length
      ? driverDetail.orders
      : (userDetail.orders || [])

    return {
      ...userDetail,
      user: {
        ...userDetail.user,
        driverProfile: driverProfile || null,
        authStatus: typeof driverProfile?.vehicleAuditStatus === 'number'
          ? driverProfile.vehicleAuditStatus
          : userDetail.user.authStatus,
        authRemark: driverProfile?.vehicleAuditRemark || userDetail.user.authRemark
      },
      driverProfile: driverProfile || null,
      vehicle: driverDetail?.vehicle || null,
      auditRecords: driverDetail?.auditRecords || [],
      orders,
      completedOrderTotal: countCompletedOrders(orders)
    }
  } catch {
    return userDetail
  }
}

function fillForm(row) {
  const user = normalizeUserRecord(row || {})
  Object.assign(form, createForm(), {
    id: user?.id || null,
    phone: user?.phone || '',
    nickname: user?.nickname || '',
    roleCode: user?.roleCode || 'USER',
    realName: user?.realName || '',
    idCard: user?.idCard || '',
    emergencyContact: user?.emergencyContact || '',
    emergencyPhone: user?.emergencyPhone || '',
    enabledFlag: user?.enabled !== 0
  })
}

async function loadUsers(resetPage = false) {
  if (resetPage) {
    query.current = 1
  }
  tableLoading.value = true
  try {
    const [res, driverRecords] = await Promise.all([
      http.get('/admin/users', { params: query }),
      loadDriverProfiles().catch(() => [])
    ])
    const driverMap = buildDriverMap(driverRecords)
    list.value = (res?.records || []).map((item) => mergeUserWithDriver(item, driverMap))
    total.value = res?.total || 0
  } finally {
    tableLoading.value = false
  }
}

function resetQuery() {
  query.current = 1
  query.keyword = ''
  query.roleCode = ''
  loadUsers()
}

function openCreate() {
  fillForm()
  formVisible.value = true
}

function openEdit(row) {
  fillForm(row)
  formVisible.value = true
}

async function submitForm() {
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const payload = {
      phone: form.phone,
      nickname: form.nickname,
      roleCode: form.roleCode,
      password: form.password,
      realName: form.realName,
      idCard: form.idCard,
      emergencyContact: form.emergencyContact,
      emergencyPhone: form.emergencyPhone,
      enabled: form.enabledFlag ? 1 : 0
    }
    if (form.id) {
      await http.put(`/admin/users/${form.id}`, payload)
      ElMessage.success('用户资料已更新')
      await syncCurrentUser(form.id)
    } else {
      await http.post('/admin/users', payload)
      ElMessage.success('用户已创建并写入数据库')
    }
    formVisible.value = false
    await loadUsers()
  } finally {
    submitLoading.value = false
  }
}

async function openDetail(userId) {
  detail.value = await getUserDetail(userId)
  detailVisible.value = true
}

function openAuthDialog(row) {
  authTarget.value = row
  authForm.remark = resolveAuthRemark(row)
  authVisible.value = true
}

async function submitAuth(authStatus) {
  if (!authTarget.value) return
  await authFormRef.value.validate()
  authLoading.value = true
  try {
    if (isDriver(authTarget.value)) {
      await http.post(`/admin/drivers/${authTarget.value.id}/audit`, {
        authStatus,
        remark: authForm.remark
      })
      ElMessage.success(authStatus === 2 ? '司机审核已通过' : '司机审核已驳回')
    } else {
      await http.post(`/admin/users/${authTarget.value.id}/audit`, {
        authStatus,
        remark: authForm.remark
      })
      ElMessage.success(authStatus === 2 ? '实名认证审核通过' : '实名认证已驳回')
    }
    authVisible.value = false
    await syncCurrentUser(authTarget.value.id)
    await loadUsers()
  } finally {
    authLoading.value = false
  }
}

async function toggleEnable(row) {
  const nextEnabled = row.enabled === 1 ? 0 : 1
  await ElMessageBox.confirm(
    `确认要${nextEnabled === 1 ? '启用' : '禁用'}用户 ${row.nickname} 吗？`,
    '账号状态变更',
    { type: 'warning' }
  )
  await http.post(`/admin/users/${row.id}/enable`, { enabled: nextEnabled })
  ElMessage.success(nextEnabled === 1 ? '用户账号已启用' : '用户账号已禁用')
  await syncCurrentUser(row.id)
  await loadUsers()
}

async function resetPassword(row) {
  const { value } = await ElMessageBox.prompt(`请输入 ${row.nickname} 的新密码`, '重置密码', {
    inputValue: '123456',
    inputPattern: /^.{6,20}$/,
    inputErrorMessage: '密码长度需为 6-20 位',
    confirmButtonText: '确认重置',
    cancelButtonText: '取消'
  })
  await http.post(`/admin/users/${row.id}/reset-password`, { password: value })
  ElMessage.success('密码已重置')
}

function handlePageChange(current) {
  query.current = current
  loadUsers()
}

async function syncCurrentUser(userId) {
  if (detailVisible.value && detail.value?.user?.id === userId) {
    detail.value = await getUserDetail(userId)
  }
}

function authTagType(status) {
  if (status === 2) return 'success'
  if (status === 3) return 'danger'
  if (status === 1) return 'warning'
  return 'info'
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
