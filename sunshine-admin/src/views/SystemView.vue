<template>
  <section class="page">
    <div class="two-column">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">系统配置</span>
            <h3 class="panel-title">全局参数配置</h3>
            <p class="panel-subtitle">
              统一管理汇率、佣金比例、免费取消时长和夜间附加费时段，保存后影响业务计算规则。
            </p>
          </div>
          <el-button :loading="configLoading" type="primary" @click="saveConfigs">保存配置</el-button>
        </div>

        <div class="config-groups">
          <div v-for="group in groupedConfigs" :key="group.name" class="config-group">
            <div class="config-group-head">
              <h4>{{ group.name }}</h4>
              <span>{{ group.items.length }} 项</span>
            </div>
            <el-form label-width="138px">
              <el-form-item v-for="item in group.items" :key="item.configKey" :label="item.configName">
                <el-input v-model="item.configValue" :placeholder="configPlaceholder(item.configKey)" />
                <div class="config-remark">{{ item.remark || configHint(item.configKey) }}</div>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">运行环境</span>
            <h3 class="panel-title">环境信息</h3>
            <p class="panel-subtitle">
              查看当前运营后台、网页端和小程序端的运行信息。
            </p>
          </div>
        </div>
        <div class="summary-list runtime-summary-list">
          <div class="summary-item">
            <span>业务接口地址</span>
            <strong>http://127.0.0.1:8080</strong>
          </div>
          <div class="summary-item">
            <span>管理后台地址</span>
            <strong>http://127.0.0.1:5173</strong>
          </div>
          <div class="summary-item">
            <span>管理员账号</span>
            <strong>13700000001 / 123456</strong>
          </div>
          <div class="summary-item">
            <span>乘客测试账号</span>
            <strong>13800000001 / 123456</strong>
          </div>
          <div class="summary-item">
            <span>司机测试账号</span>
            <strong>13900000001 / 123456</strong>
          </div>
          <div class="summary-item">
            <span>联动状态</span>
            <strong>多端业务数据一致</strong>
          </div>
        </div>
      </article>
    </div>

    <div class="two-column">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">公告中心</span>
            <h3 class="panel-title">公告管理</h3>
            <p class="panel-subtitle">公告可在首页展示，支持新增、编辑和启停管理；首页优先级越高越靠前。</p>
          </div>
          <div class="toolbar-actions">
            <el-input
              v-model="noticeQuery.keyword"
              clearable
              placeholder="搜索公告标题或内容"
              style="width: 240px"
              @keyup.enter="loadNotices(true)"
            />
            <el-button @click="loadNotices(true)">查询</el-button>
            <el-button type="primary" @click="openNoticeCreate">新增公告</el-button>
          </div>
        </div>

        <el-table v-loading="noticeLoading" :data="noticeList" stripe>
          <el-table-column prop="title" label="公告标题" min-width="180" />
          <el-table-column prop="targetRole" label="目标角色" width="120">
            <template #default="{ row }">
              {{ targetRoleLabel(row.targetRole) }}
            </template>
          </el-table-column>
          <el-table-column prop="sortNo" label="首页优先级" width="110" />
          <el-table-column label="显示时段" width="150">
            <template #default="{ row }">
              {{ displayTimeRangeText(row) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="noticeStatusType(row)" effect="light">
                {{ noticeStatusText(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="发布时间" min-width="160">
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" @click="openNoticeEdit(row)">编辑</el-button>
                <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleNotice(row)">
                  {{ row.status === 1 ? '停用' : '启用' }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :current-page="noticeQuery.current"
            :page-size="noticeQuery.size"
            :total="noticeTotal"
            @current-change="handleNoticePageChange"
          />
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">版本中心</span>
            <h3 class="panel-title">版本管理</h3>
            <p class="panel-subtitle">统一管理后台、乘客端和司机端版本信息，支持发布和停用。</p>
          </div>
          <div class="toolbar-actions">
            <el-select v-model="versionQuery.clientType" clearable placeholder="客户端类型" style="width: 180px">
              <el-option label="管理后台" value="ADMIN" />
              <el-option label="乘客端小程序" value="USER_MINIAPP" />
              <el-option label="司机端小程序" value="DRIVER_MINIAPP" />
            </el-select>
            <el-button @click="loadVersions(true)">查询</el-button>
            <el-button type="primary" @click="openVersionCreate">新增版本</el-button>
          </div>
        </div>

        <el-table v-loading="versionLoading" :data="versionList" stripe>
          <el-table-column prop="versionNo" label="版本号" width="110" />
          <el-table-column label="客户端" width="150">
            <template #default="{ row }">
              {{ textOf(clientTypeMap, row.clientType) }}
            </template>
          </el-table-column>
          <el-table-column label="强制更新" width="100">
            <template #default="{ row }">
              <el-tag :type="row.forceUpdate === 1 ? 'danger' : 'info'" effect="light">
                {{ row.forceUpdate === 1 ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light">
                {{ row.status === 1 ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="releaseNote" label="更新说明" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" @click="openVersionEdit(row)">编辑</el-button>
                <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleVersion(row)">
                  {{ row.status === 1 ? '停用' : '启用' }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :current-page="versionQuery.current"
            :page-size="versionQuery.size"
            :total="versionTotal"
            @current-change="handleVersionPageChange"
          />
        </div>
      </article>
    </div>

    <el-dialog v-model="noticeVisible" :title="noticeForm.id ? '编辑公告' : '新增公告'" width="620px" destroy-on-close>
      <el-form ref="noticeFormRef" :model="noticeForm" :rules="noticeRules" label-width="92px">
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="noticeForm.title" maxlength="40" placeholder="请输入公告标题" />
        </el-form-item>
        <el-form-item label="公告内容" prop="content">
          <el-input
            v-model="noticeForm.content"
            :rows="5"
            maxlength="500"
            show-word-limit
            type="textarea"
            placeholder="请输入公告内容"
          />
        </el-form-item>
        <el-form-item label="目标角色" prop="targetRole">
          <el-select v-model="noticeForm.targetRole" placeholder="请选择目标角色">
            <el-option label="全部角色" value="ALL" />
            <el-option label="乘客" value="USER" />
            <el-option label="司机" value="DRIVER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="首页优先级" prop="sortNo">
          <el-input-number v-model="noticeForm.sortNo" :min="1" :max="9999" />
          <div class="config-remark">数值越大，乘客端和网页端首页公告越靠前。</div>
        </el-form-item>
        <el-form-item label="显示时段">
          <el-time-picker
            v-model="noticeForm.displayTimeWindow"
            is-range
            format="HH:mm"
            value-format="HH:mm"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%"
          />
          <div class="config-remark">不选择则全天显示；支持跨零点，例如 23:00 至 06:00。</div>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="noticeForm.enabledFlag" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noticeVisible = false">取消</el-button>
        <el-button :loading="noticeSubmitting" type="primary" @click="submitNotice">保存公告</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionVisible" :title="versionForm.id ? '编辑版本' : '新增版本'" width="640px" destroy-on-close>
      <el-form ref="versionFormRef" :model="versionForm" :rules="versionRules" label-width="100px">
        <el-form-item label="版本号" prop="versionNo">
          <el-input v-model="versionForm.versionNo" placeholder="例如 v1.2.0" />
        </el-form-item>
        <el-form-item label="客户端" prop="clientType">
          <el-select v-model="versionForm.clientType" placeholder="请选择客户端">
            <el-option label="管理后台" value="ADMIN" />
            <el-option label="乘客端小程序" value="USER_MINIAPP" />
            <el-option label="司机端小程序" value="DRIVER_MINIAPP" />
          </el-select>
        </el-form-item>
        <el-form-item label="更新说明" prop="releaseNote">
          <el-input
            v-model="versionForm.releaseNote"
            :rows="5"
            maxlength="500"
            show-word-limit
            type="textarea"
            placeholder="请输入更新说明"
          />
        </el-form-item>
        <el-form-item label="下载地址">
          <el-input v-model="versionForm.downloadUrl" placeholder="可选，填写下载链接" />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="versionForm.forceUpdateFlag" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="versionForm.enabledFlag" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="versionVisible = false">取消</el-button>
        <el-button :loading="versionSubmitting" type="primary" @click="submitVersion">保存版本</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import { clientTypeMap, formatDateTime, textOf } from '../utils/admin'

const configLoading = ref(false)
const noticeLoading = ref(false)
const versionLoading = ref(false)
const noticeSubmitting = ref(false)
const versionSubmitting = ref(false)

const configList = ref([])
const noticeList = ref([])
const versionList = ref([])

const noticeVisible = ref(false)
const versionVisible = ref(false)

const noticeFormRef = ref()
const versionFormRef = ref()

const noticeQuery = reactive({
  current: 1,
  size: 6,
  keyword: ''
})

const versionQuery = reactive({
  current: 1,
  size: 6,
  clientType: ''
})

const noticeTotal = ref(0)
const versionTotal = ref(0)

const createNoticeForm = () => ({
  id: null,
  title: '',
  content: '',
  targetRole: 'ALL',
  sortNo: 100,
  displayTimeWindow: [],
  enabledFlag: true
})

const createVersionForm = () => ({
  id: null,
  versionNo: '',
  clientType: 'ADMIN',
  releaseNote: '',
  downloadUrl: '',
  forceUpdateFlag: false,
  enabledFlag: true
})

const noticeForm = reactive(createNoticeForm())
const versionForm = reactive(createVersionForm())

const noticeRules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }],
  targetRole: [{ required: true, message: '请选择目标角色', trigger: 'change' }],
  sortNo: [{ required: true, message: '请输入首页优先级', trigger: 'change' }]
}

const versionRules = {
  versionNo: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
  clientType: [{ required: true, message: '请选择客户端类型', trigger: 'change' }],
  releaseNote: [{ required: true, message: '请输入更新说明', trigger: 'blur' }]
}

const groupedConfigs = computed(() => {
  const groups = new Map()
  for (const item of configList.value) {
    const groupName = item.configGroup || '其他配置'
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName).push(item)
  }
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }))
})

async function loadConfigs() {
  configLoading.value = true
  try {
    configList.value = await http.get('/admin/system/configs')
  } finally {
    configLoading.value = false
  }
}

async function loadNotices(resetPage = false) {
  if (resetPage) {
    noticeQuery.current = 1
  }
  noticeLoading.value = true
  try {
    const res = await http.get('/admin/system/notices', { params: noticeQuery })
    noticeList.value = res?.records || []
    noticeTotal.value = res?.total || 0
  } finally {
    noticeLoading.value = false
  }
}

async function loadVersions(resetPage = false) {
  if (resetPage) {
    versionQuery.current = 1
  }
  versionLoading.value = true
  try {
    const res = await http.get('/admin/system/versions', { params: versionQuery })
    versionList.value = res?.records || []
    versionTotal.value = res?.total || 0
  } finally {
    versionLoading.value = false
  }
}

async function saveConfigs() {
  try {
    validateConfigs()
    configLoading.value = true
    await http.post('/admin/system/configs', {
      items: configList.value.map((item) => ({
        configKey: item.configKey,
        configValue: `${item.configValue ?? ''}`.trim()
      }))
    })
    ElMessage.success('系统配置已保存')
    await loadConfigs()
  } catch (error) {
    ElMessage.error(error?.message || '系统配置保存失败')
  } finally {
    configLoading.value = false
  }
}

function openNoticeCreate() {
  Object.assign(noticeForm, createNoticeForm())
  noticeVisible.value = true
}

function openNoticeEdit(row) {
  Object.assign(noticeForm, {
    id: row.id,
    title: row.title,
    content: row.content,
    targetRole: row.targetRole || 'ALL',
    sortNo: row.sortNo,
    displayTimeWindow: parseDisplayTimeRange(row.displayTimeRange),
    enabledFlag: row.status === 1
  })
  noticeVisible.value = true
}

async function submitNotice() {
  await noticeFormRef.value.validate()
  noticeSubmitting.value = true
  try {
    const payload = {
      title: noticeForm.title.trim(),
      content: noticeForm.content.trim(),
      targetRole: noticeForm.targetRole,
      sortNo: noticeForm.sortNo,
      displayTimeRange: buildDisplayTimeRange(noticeForm.displayTimeWindow),
      status: noticeForm.enabledFlag ? 1 : 0
    }
    if (noticeForm.id) {
      await http.put(`/admin/system/notices/${noticeForm.id}`, payload)
      ElMessage.success('公告已更新')
    } else {
      await http.post('/admin/system/notices', payload)
      ElMessage.success('公告已创建')
    }
    noticeVisible.value = false
    await loadNotices()
  } finally {
    noticeSubmitting.value = false
  }
}

async function toggleNotice(row) {
  await ElMessageBox.confirm(`确认要${row.status === 1 ? '停用' : '启用'}公告「${row.title}」吗？`, '公告状态变更', {
    type: 'warning'
  })
  await http.put(`/admin/system/notices/${row.id}`, {
    title: row.title,
    content: row.content,
    targetRole: row.targetRole,
    sortNo: row.sortNo,
    displayTimeRange: row.displayTimeRange || '',
    status: row.status === 1 ? 0 : 1
  })
  ElMessage.success(row.status === 1 ? '公告已停用' : '公告已启用')
  await loadNotices()
}

function openVersionCreate() {
  Object.assign(versionForm, createVersionForm())
  versionVisible.value = true
}

function openVersionEdit(row) {
  Object.assign(versionForm, {
    id: row.id,
    versionNo: row.versionNo,
    clientType: row.clientType,
    releaseNote: row.releaseNote,
    downloadUrl: row.downloadUrl,
    forceUpdateFlag: row.forceUpdate === 1,
    enabledFlag: row.status === 1
  })
  versionVisible.value = true
}

async function submitVersion() {
  await versionFormRef.value.validate()
  versionSubmitting.value = true
  try {
    const payload = {
      versionNo: versionForm.versionNo.trim(),
      clientType: versionForm.clientType,
      releaseNote: versionForm.releaseNote.trim(),
      downloadUrl: versionForm.downloadUrl?.trim() || '',
      forceUpdate: versionForm.forceUpdateFlag ? 1 : 0,
      status: versionForm.enabledFlag ? 1 : 0
    }
    if (versionForm.id) {
      await http.put(`/admin/system/versions/${versionForm.id}`, payload)
      ElMessage.success('版本信息已更新')
    } else {
      await http.post('/admin/system/versions', payload)
      ElMessage.success('版本信息已创建')
    }
    versionVisible.value = false
    await loadVersions()
  } finally {
    versionSubmitting.value = false
  }
}

async function toggleVersion(row) {
  await ElMessageBox.confirm(
    `确认要${row.status === 1 ? '停用' : '启用'}版本 ${row.versionNo} 吗？`,
    '版本状态变更',
    { type: 'warning' }
  )
  await http.put(`/admin/system/versions/${row.id}`, {
    versionNo: row.versionNo,
    clientType: row.clientType,
    releaseNote: row.releaseNote,
    downloadUrl: row.downloadUrl,
    forceUpdate: row.forceUpdate,
    status: row.status === 1 ? 0 : 1
  })
  ElMessage.success(row.status === 1 ? '版本已停用' : '版本已启用')
  await loadVersions()
}

function handleNoticePageChange(current) {
  noticeQuery.current = current
  loadNotices()
}

function handleVersionPageChange(current) {
  versionQuery.current = current
  loadVersions()
}

function parseDisplayTimeRange(value) {
  const text = `${value || ''}`.trim()
  if (!text) return []
  const parts = text.split('-')
  return parts.length === 2 && parts[0] && parts[1] ? parts : []
}

function buildDisplayTimeRange(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
    return ''
  }
  return `${value[0]}-${value[1]}`
}

function displayTimeRangeText(row) {
  return row.displayTimeRange || '全天'
}

function noticeStatusType(row) {
  if (row.status !== 1) return 'info'
  return row.activeNow === false ? 'warning' : 'success'
}

function noticeStatusText(row) {
  if (row.status !== 1) return '停用'
  return row.activeNow === false ? '未到时段' : '当前生效'
}

function targetRoleLabel(value) {
  if (value === 'ALL') return '全部角色'
  if (value === 'USER') return '乘客'
  if (value === 'DRIVER') return '司机'
  if (value === 'ADMIN') return '管理员'
  return value || '全部角色'
}

function configPlaceholder(configKey) {
  if (configKey === 'platformCommissionRate') return '例如 0.18'
  if (configKey === 'intlExchangeRate') return '例如 7.15'
  if (configKey === 'freeCancelMinutes') return '例如 5'
  if (configKey === 'nightTimeRange') return '例如 22:00-06:00'
  return '请输入配置值'
}

function configHint(configKey) {
  if (configKey === 'platformCommissionRate') return '佣金比例建议输入 0-1 之间的小数'
  if (configKey === 'intlExchangeRate') return '国际出行汇率必须大于 0'
  if (configKey === 'freeCancelMinutes') return '免费取消时长必须是大于等于 0 的整数'
  if (configKey === 'nightTimeRange') return '请按 22:00-06:00 的格式填写'
  return '修改后会影响业务计算逻辑'
}

function validateConfigs() {
  for (const item of configList.value) {
    const value = `${item.configValue ?? ''}`.trim()
    if (!value) {
      throw new Error(`${item.configName}不能为空`)
    }
    if (item.configKey === 'platformCommissionRate') {
      const number = Number(value)
      if (Number.isNaN(number) || number < 0 || number > 1) {
        throw new Error('平台佣金比例必须是 0 到 1 之间的小数')
      }
    }
    if (item.configKey === 'intlExchangeRate') {
      const number = Number(value)
      if (Number.isNaN(number) || number <= 0) {
        throw new Error('国际出行汇率必须大于 0')
      }
    }
    if (item.configKey === 'freeCancelMinutes') {
      const number = Number(value)
      if (!Number.isInteger(number) || number < 0) {
        throw new Error('免费取消时长必须是大于等于 0 的整数')
      }
    }
    if (item.configKey === 'nightTimeRange' && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value)) {
      throw new Error('夜间附加费时段格式必须为 HH:mm-HH:mm')
    }
  }
}

onMounted(() => {
  loadConfigs()
  loadNotices()
  loadVersions()
})
</script>

<style scoped>
.config-groups {
  display: grid;
  gap: 18px;
}

.config-group {
  padding: 18px;
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.config-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.config-group-head h4 {
  margin: 0;
  font-size: 18px;
}

.config-group-head span,
.config-remark {
  color: #64748b;
  font-size: 12px;
}

.config-remark {
  margin-top: 6px;
  line-height: 1.6;
}

.runtime-summary-list {
  gap: 10px;
}

.runtime-summary-list .summary-item {
  gap: 4px;
  padding: 12px 14px;
}

.runtime-summary-list .summary-item span {
  font-size: 11px;
}

.runtime-summary-list .summary-item strong {
  font-size: 14px;
  line-height: 1.3;
  font-weight: 700;
  word-break: break-word;
}
</style>
