<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">会员管理</span>
        <h3 class="panel-title">乘客会员管理</h3>
        <p class="panel-subtitle">只管理乘客会员。开通后每周同步 3 张不同优惠券，司机端不展示会员权益。</p>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索昵称、手机号、真实姓名"
          style="width: 240px"
          @keyup.enter="loadMembers(true)"
        />
        <el-select v-model="query.status" clearable placeholder="会员状态" style="width: 140px">
          <el-option label="会员" value="ACTIVE" />
          <el-option label="普通用户" value="NONE" />
        </el-select>
        <el-button @click="loadMembers(true)">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </div>
    </article>

    <article class="panel">
      <el-table v-loading="loading" class="member-table" :data="list" stripe row-key="userId">
        <el-table-column prop="userId" label="用户ID" width="76" class-name="member-col-id" />
        <el-table-column label="乘客" width="330" class-name="member-col-passenger">
          <template #default="{ row }">
            <div class="member-user">
              <span class="member-user__name">{{ row.nickname || '未命名用户' }}</span>
              <span>{{ row.phone || '未留手机号' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="会员状态" width="180" align="left" header-align="left" class-name="member-col-status">
          <template #default="{ row }">
            <el-tag :type="row.memberStatus === 'ACTIVE' ? 'warning' : 'info'" effect="light">
              {{ row.memberStatus === 'ACTIVE' ? '阳光会员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="210" class-name="member-col-time">
          <template #default="{ row }">{{ formatDateTime(row.memberExpireAt) }}</template>
        </el-table-column>
        <el-table-column prop="memberLastCouponWeek" label="最近发券周次" width="136" class-name="member-col-week">
          <template #default="{ row }">{{ row.memberLastCouponWeek || '未发放' }}</template>
        </el-table-column>
        <el-table-column label="会员券数" width="88" align="center" class-name="member-col-count">
          <template #default="{ row }">{{ row.weeklyCouponTotal || 0 }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="190" class-name="member-col-created">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center" fixed="right" class-name="member-col-actions">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="openMemberDialog(row)">
                {{ row.memberStatus === 'ACTIVE' ? '续期' : '开通' }}
              </el-button>
              <el-button link type="success" :disabled="row.memberStatus !== 'ACTIVE'" @click="grantWeekly(row)">
                同步周券
              </el-button>
              <el-button
                v-if="row.memberStatus === 'ACTIVE'"
                link
                type="warning"
                @click="disableMember(row)"
              >
                关闭
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">
            <el-empty description="暂无会员数据" />
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

    <el-dialog v-model="memberDialogVisible" title="开通/续期会员" width="460px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="乘客">
          <span>{{ currentMember?.nickname }} / {{ currentMember?.phone }}</span>
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker
            v-model="memberForm.memberExpireAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button :loading="submitLoading" type="primary" @click="submitMember">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import { formatDateTime } from '../utils/admin'

const loading = ref(false)
const submitLoading = ref(false)
const total = ref(0)
const list = ref([])
const memberDialogVisible = ref(false)
const currentMember = ref(null)

const query = reactive({
  current: 1,
  size: 10,
  keyword: '',
  status: ''
})

const memberForm = reactive({
  memberExpireAt: ''
})

function plusOneMonthText() {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:00`
}

async function loadMembers(resetPage = false) {
  if (resetPage) {
    query.current = 1
  }
  loading.value = true
  try {
    const response = await http.get('/admin/members', { params: query })
    list.value = response?.records || []
    total.value = response?.total || 0
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.current = 1
  query.keyword = ''
  query.status = ''
  loadMembers()
}

function openMemberDialog(row) {
  currentMember.value = row
  memberForm.memberExpireAt = row.memberExpireAt || plusOneMonthText()
  memberDialogVisible.value = true
}

async function submitMember() {
  if (!currentMember.value) return
  submitLoading.value = true
  try {
    await http.post(`/admin/members/${currentMember.value.userId}`, {
      memberStatus: 'ACTIVE',
      memberExpireAt: memberForm.memberExpireAt || plusOneMonthText()
    })
    ElMessage.success('会员状态已更新')
    memberDialogVisible.value = false
    await loadMembers()
  } finally {
    submitLoading.value = false
  }
}

async function disableMember(row) {
  await ElMessageBox.confirm(`确认关闭 ${row.nickname} 的会员吗？`, '关闭会员', { type: 'warning' })
  await http.post(`/admin/members/${row.userId}`, { memberStatus: 'NONE' })
  ElMessage.success('会员已关闭')
  await loadMembers()
}

async function grantWeekly(row) {
  await http.post(`/admin/members/${row.userId}/weekly-coupons`)
  ElMessage.success('本周会员券已同步')
  await loadMembers()
}

function handlePageChange(current) {
  query.current = current
  loadMembers()
}

onMounted(() => {
  loadMembers()
})
</script>

<style scoped>
.member-user {
  display: grid;
  gap: 4px;
}

.member-user__name {
  color: #172033;
  font-size: 14px;
  font-weight: 500;
}

.member-user span:last-child {
  color: #7a8396;
  font-size: 12px;
}

.member-table :deep(.el-table__cell .cell) {
  line-height: 1.45;
  padding-left: 10px;
  padding-right: 10px;
}

.member-table :deep(.member-col-id .cell),
.member-table :deep(.member-col-count .cell) {
  padding-left: 4px;
  padding-right: 4px;
}

.member-table :deep(.member-col-week .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

.member-table :deep(.member-col-status .cell) {
  justify-content: flex-start;
  padding-left: 0;
  padding-right: 8px;
  text-align: left;
  transform: translateX(-6px);
}

.member-table :deep(.member-col-passenger .cell) {
  padding-left: 14px;
  padding-right: 16px;
}

.member-table :deep(.member-col-time .cell) {
  padding-left: 12px;
  padding-right: 12px;
  white-space: nowrap;
}

.member-table :deep(.member-col-created .cell) {
  padding-left: 12px;
  padding-right: 14px;
  white-space: nowrap;
}

.member-table :deep(.member-col-actions .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

.member-table .table-actions {
  justify-content: center;
  gap: 4px 8px;
  flex-wrap: nowrap;
}

.member-table :deep(.member-col-actions .el-button) {
  margin-left: 0;
  padding: 0 2px;
  font-weight: 400;
}

@media (max-width: 768px) {
  .member-table :deep(.el-table__cell .cell) {
    padding-left: 8px;
    padding-right: 8px;
  }

  .member-table :deep(.member-col-id .cell),
  .member-table :deep(.member-col-count .cell) {
    padding-left: 3px;
    padding-right: 3px;
  }

  .member-table :deep(.member-col-passenger .cell),
  .member-table :deep(.member-col-created .cell) {
    padding-left: 10px;
    padding-right: 10px;
  }

  .member-table :deep(.member-col-time .cell) {
    padding-left: 10px;
    padding-right: 10px;
  }
}
</style>
