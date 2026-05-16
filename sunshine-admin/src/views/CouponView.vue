<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">Marketing Hub</span>
        <h3 class="panel-title">营销中心 - 优惠券管理</h3>
        <p class="panel-subtitle">支持新建、编辑、上下架、发券和领取/使用记录查看，所有操作均实时写入后端数据库。</p>
      </div>
      <div class="toolbar-actions">
        <el-input v-model="query.keyword" placeholder="搜索优惠券名称" clearable style="width: 220px" @keyup.enter="loadCoupons" />
        <el-select v-model="query.status" clearable placeholder="筛选状态" style="width: 150px">
          <el-option label="已上架" :value="1" />
          <el-option label="已下架" :value="0" />
        </el-select>
        <el-button @click="loadCoupons">查询</el-button>
        <el-button type="primary" @click="openCreate">新建优惠券</el-button>
      </div>
    </article>

    <article class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Coupon List</span>
          <h3 class="panel-title">优惠券模板列表</h3>
        </div>
        <el-button type="success" plain @click="openGrant()">手动发券</el-button>
      </div>

      <el-table v-loading="loading" :data="list" stripe row-key="id">
        <el-table-column prop="couponName" label="券名称" min-width="180" />
        <el-table-column label="券类型" width="120">
          <template #default="{ row }">{{ textOf(couponTypeMap, row.couponType) }}</template>
        </el-table-column>
        <el-table-column label="适用范围" width="120">
          <template #default="{ row }">{{ textOf(couponScopeMap, row.serviceScope) }}</template>
        </el-table-column>
        <el-table-column label="优惠规则" min-width="160">
          <template #default="{ row }">
            <span v-if="row.couponType === 'CASH'">满 {{ formatMoney(row.thresholdAmount) }} 减 {{ formatMoney(row.discountAmount) }}</span>
            <span v-else>{{ formatDiscountFold(row.discountRate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="120">
          <template #default="{ row }">{{ row.remainCount || 0 }}/{{ row.totalCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="发放/使用" width="130">
          <template #default="{ row }">{{ row.receivedCount || 0 }}/{{ row.usedCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="领取上限" width="100">
          <template #default="{ row }">{{ row.receiveLimitPerUser || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '已上架' : '已下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期" min-width="220">
          <template #default="{ row }">
            {{ formatDateTime(row.validStartTime) }} 至 {{ formatDateTime(row.validEndTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
                {{ row.status === 1 ? '下架' : '上架' }}
              </el-button>
              <el-button link type="success" @click="openGrant(row)">发券</el-button>
              <el-button link type="primary" @click="openRecords(row)">领取/使用记录</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">
            <el-empty description="暂无优惠券模板数据" />
          </div>
        </template>
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

    <el-dialog v-model="formVisible" :title="form.id ? '编辑优惠券' : '新建优惠券'" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <div class="coupon-form-grid">
          <el-form-item label="券名称" prop="couponName">
            <el-input v-model="form.couponName" maxlength="30" show-word-limit />
          </el-form-item>
          <el-form-item label="券类型" prop="couponType">
            <el-select v-model="form.couponType" style="width: 100%">
              <el-option label="满减券" value="CASH" />
              <el-option label="折扣券" value="DISCOUNT" />
            </el-select>
          </el-form-item>
          <el-form-item label="适用范围" prop="serviceScope">
            <el-select v-model="form.serviceScope" style="width: 100%">
              <el-option label="全场通用" value="ALL" />
              <el-option label="即时打车" value="TAXI" />
              <el-option label="顺风车" value="CARPOOL" />
              <el-option label="国际出行" value="INTERNATIONAL" />
            </el-select>
          </el-form-item>
          <el-form-item label="门槛金额" prop="thresholdAmount">
            <el-input-number v-model="form.thresholdAmount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item v-if="form.couponType === 'CASH'" label="减免金额" prop="discountAmount">
            <el-input-number v-model="form.discountAmount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item v-else label="折扣力度" prop="discountFold">
            <el-input-number v-model="form.discountFold" :min="0.1" :max="10" :step="0.1" :precision="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="总库存" prop="totalCount">
            <el-input-number v-model="form.totalCount" :min="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="领取上限" prop="receiveLimitPerUser">
            <el-input-number v-model="form.receiveLimitPerUser" :min="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="开始时间" prop="validStartTime">
            <el-date-picker
              v-model="form.validStartTime"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="结束时间" prop="validEndTime">
            <el-date-picker
              v-model="form.validEndTime"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
          </el-form-item>
        </div>

        <el-form-item label="规则说明" prop="ruleDesc">
          <el-input v-model="form.ruleDesc" type="textarea" :rows="4" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button :loading="formSubmitting" type="primary" @click="submitForm">保存并同步列表</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="grantVisible" title="发放优惠券" width="460px" destroy-on-close>
      <el-form ref="grantFormRef" :model="grantForm" :rules="grantRules" label-width="90px">
        <el-form-item label="优惠券ID" prop="couponId">
          <el-input-number v-model="grantForm.couponId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用户ID" prop="userId">
          <el-input-number v-model="grantForm.userId" :min="1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grantVisible = false">取消</el-button>
        <el-button :loading="grantSubmitting" type="primary" @click="submitGrant">确认发券</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="recordVisible" title="优惠券领取与使用记录" size="820px" destroy-on-close>
      <el-table v-loading="recordLoading" :data="records" stripe>
        <el-table-column prop="couponId" label="券ID" width="90" />
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="userCouponId" label="用户券ID" width="110" />
        <el-table-column prop="orderId" label="订单ID" width="100" />
        <el-table-column prop="operationType" label="操作类型" width="120" />
        <el-table-column prop="content" label="说明" min-width="260" />
        <el-table-column label="操作时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">
            <el-empty description="暂无领取或使用记录" />
          </div>
        </template>
      </el-table>
    </el-drawer>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import {
  couponScopeMap,
  couponTypeMap,
  formatDateTime,
  formatMoney,
  textOf
} from '../utils/admin'

const loading = ref(false)
const formSubmitting = ref(false)
const grantSubmitting = ref(false)
const recordLoading = ref(false)
const total = ref(0)
const list = ref([])
const records = ref([])
const formVisible = ref(false)
const grantVisible = ref(false)
const recordVisible = ref(false)
const formRef = ref()
const grantFormRef = ref()

const query = reactive({
  current: 1,
  size: 10,
  keyword: '',
  status: undefined
})

const createForm = () => ({
  id: null,
  couponName: '',
  couponType: 'CASH',
  serviceScope: 'ALL',
  thresholdAmount: 50,
  discountAmount: 10,
  discountFold: 8,
  totalCount: 100,
  receiveLimitPerUser: 1,
  validStartTime: '2026-04-19 00:00:00',
  validEndTime: '2026-12-31 23:59:59',
  ruleDesc: ''
})

const form = reactive(createForm())
const grantForm = reactive({
  couponId: 1,
  userId: 2
})

const rules = {
  couponName: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  couponType: [{ required: true, message: '请选择券类型', trigger: 'change' }],
  serviceScope: [{ required: true, message: '请选择适用范围', trigger: 'change' }],
  thresholdAmount: [
    {
      validator: (_, value, callback) => {
        if (Number(value) < 0) return callback(new Error('门槛金额不能为负数'))
        if (form.couponType === 'CASH' && Number(value) <= 0) return callback(new Error('满减券门槛金额必须大于0'))
        callback()
      },
      trigger: 'change'
    }
  ],
  discountAmount: [
    {
      validator: (_, value, callback) => {
        if (form.couponType !== 'CASH') return callback()
        if (Number(value) <= 0) return callback(new Error('减免金额必须大于0'))
        if (Number(value) > Number(form.thresholdAmount || 0)) return callback(new Error('减免金额不能大于门槛金额'))
        callback()
      },
      trigger: 'change'
    }
  ],
  discountFold: [
    {
      validator: (_, value, callback) => {
        if (form.couponType !== 'DISCOUNT') return callback()
        if (Number(value) <= 0 || Number(value) > 10) return callback(new Error('折扣力度必须在 0.1 折到 10 折之间'))
        callback()
      },
      trigger: 'change'
    }
  ],
  totalCount: [{ required: true, message: '请输入总库存', trigger: 'change' }],
  receiveLimitPerUser: [{ required: true, message: '请输入领取上限', trigger: 'change' }],
  validStartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  validEndTime: [
    {
      validator: (_, value, callback) => {
        if (!value) return callback(new Error('请选择结束时间'))
        if (new Date(value).getTime() <= new Date(form.validStartTime).getTime()) {
          return callback(new Error('结束时间必须晚于开始时间'))
        }
        callback()
      },
      trigger: 'change'
    }
  ],
  ruleDesc: [{ required: true, message: '请输入规则说明', trigger: 'blur' }]
}

const grantRules = {
  couponId: [{ required: true, message: '请输入优惠券ID', trigger: 'change' }],
  userId: [{ required: true, message: '请输入用户ID', trigger: 'change' }]
}

function normalizePickerDateTime(value) {
  return formatDateTime(value)
}

function normalizeApiDateTime(value) {
  return normalizePickerDateTime(value).replace(' ', 'T')
}

async function loadCoupons() {
  loading.value = true
  try {
    const response = await http.get('/admin/coupons', { params: query })
    list.value = response?.records || []
    total.value = response?.total || 0
  } finally {
    loading.value = false
  }
}

function resetForm(row) {
  Object.assign(form, createForm())
  if (!row) return
  Object.assign(form, {
    ...form,
    ...row,
    discountFold: row.discountRate ? Number(row.discountRate) * 10 : 8,
    validStartTime: normalizePickerDateTime(row.validStartTime),
    validEndTime: normalizePickerDateTime(row.validEndTime)
  })
}

function openCreate() {
  resetForm()
  formVisible.value = true
}

function openEdit(row) {
  resetForm(row)
  formVisible.value = true
}

function openGrant(row) {
  grantForm.couponId = row?.id || 1
  grantForm.userId = 2
  grantVisible.value = true
}

async function submitForm() {
  await formRef.value.validate()
  formSubmitting.value = true
  try {
    const payload = {
      couponName: form.couponName,
      couponType: form.couponType,
      serviceScope: form.serviceScope,
      thresholdAmount: Number(form.thresholdAmount || 0),
      discountAmount: form.couponType === 'CASH' ? Number(form.discountAmount || 0) : null,
      discountRate: form.couponType === 'DISCOUNT' ? Number((Number(form.discountFold || 0) / 10).toFixed(2)) : null,
      stackable: 0,
      totalCount: Number(form.totalCount || 0),
      receiveLimitPerUser: Number(form.receiveLimitPerUser || 0),
      validStartTime: normalizeApiDateTime(form.validStartTime),
      validEndTime: normalizeApiDateTime(form.validEndTime),
      ruleDesc: form.ruleDesc
    }
    if (form.id) {
      await http.put(`/admin/coupons/${form.id}`, payload)
      ElMessage.success('优惠券已更新')
    } else {
      await http.post('/admin/coupons', payload)
      ElMessage.success('优惠券创建成功')
    }
    formVisible.value = false
    await loadCoupons()
  } finally {
    formSubmitting.value = false
  }
}

async function toggleStatus(row) {
  const nextStatus = row.status === 1 ? 0 : 1
  await ElMessageBox.confirm(
    `确认要${nextStatus === 1 ? '上架' : '下架'}优惠券「${row.couponName}」吗？`,
    '优惠券状态变更',
    { type: 'warning' }
  )
  await http.post(`/admin/coupons/${row.id}/status`, { status: nextStatus })
  ElMessage.success(nextStatus === 1 ? '优惠券已上架' : '优惠券已下架')
  await loadCoupons()
}

async function submitGrant() {
  await grantFormRef.value.validate()
  grantSubmitting.value = true
  try {
    await http.post('/admin/coupons/grant', {
      couponId: grantForm.couponId,
      userId: grantForm.userId
    })
    ElMessage.success('优惠券发放成功')
    grantVisible.value = false
    await loadCoupons()
  } finally {
    grantSubmitting.value = false
  }
}

async function openRecords(row) {
  recordVisible.value = true
  recordLoading.value = true
  try {
    const response = await http.get('/admin/coupon-records', {
      params: {
        current: 1,
        size: 100,
        couponId: row.id
      }
    })
    records.value = response?.records || []
  } finally {
    recordLoading.value = false
  }
}

function formatDiscountFold(rate) {
  return `${(Number(rate || 0) * 10).toFixed(1)} 折`
}

function handlePageChange(current) {
  query.current = current
  loadCoupons()
}

onMounted(loadCoupons)
</script>

<style scoped>
.coupon-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

@media (max-width: 900px) {
  .coupon-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
