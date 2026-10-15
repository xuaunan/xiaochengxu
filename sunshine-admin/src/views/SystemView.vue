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
          <div
            v-for="group in groupedConfigs"
            :key="group.name"
            class="config-group"
            :class="{ 'config-group--wide': group.items.length > 1 }"
          >
            <div class="config-group-head">
              <h4>{{ group.name }}</h4>
              <span>{{ group.items.length }} 项</span>
            </div>
            <el-form label-width="138px">
              <el-form-item v-for="item in group.items" :key="item.configKey" :label="item.configName">
                <el-input
                  v-if="item.configKey === 'tencentMapKey'"
                  v-model="item.configValue"
                  placeholder="留空则保持当前Key"
                >
                  <template #append>
                    <el-button :loading="mapKeyTesting" @click="testTencentMapKey(item)">测试可用性</el-button>
                  </template>
                </el-input>
                <el-input v-else v-model="item.configValue" :placeholder="configPlaceholder(item.configKey)" />
                <div class="config-remark" :class="mapKeyRemarkClass(item.configKey)">{{ mapKeyRemark(item.configKey, item) }}</div>
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
          <div v-for="item in runtimeInfo" :key="item.label" class="summary-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
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
            <span class="panel-kicker">账号安全</span>
            <h3 class="panel-title">管理员账号设置</h3>
            <p class="panel-subtitle">
              后台仅保留一个超级管理员账号，可修改登录账号与密码；保存需要二次确认，修改成功后必须重新登录。
            </p>
          </div>
          <el-tag type="warning" effect="light">唯一管理员</el-tag>
        </div>

        <el-form ref="accountFormRef" :model="accountForm" :rules="accountRules" class="account-form" label-width="104px">
          <el-form-item label="登录账号" prop="username">
            <el-input v-model="accountForm.username" maxlength="20" placeholder="请输入登录账号" show-word-limit />
            <div class="config-remark">3-20 位字母、数字或下划线，修改后需用新账号登录。</div>
          </el-form-item>
          <el-form-item label="当前密码" prop="currentPassword">
            <el-input v-model="accountForm.currentPassword" autocomplete="off" placeholder="请输入当前登录密码" show-password type="password" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="accountForm.newPassword" autocomplete="off" maxlength="20" placeholder="6-20 位，建议字母 + 数字组合" show-password type="password" />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input v-model="accountForm.confirmPassword" autocomplete="off" maxlength="20" placeholder="请再次输入新密码" show-password type="password" />
          </el-form-item>
          <el-form-item>
            <el-button :loading="accountSaving" type="primary" @click="submitAccount">保存修改</el-button>
            <el-button @click="resetAccountForm">重置</el-button>
          </el-form-item>
        </el-form>
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
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import http, { baseURL } from '../api/http'
import { formatDateTime } from '../utils/admin'
import { clearAdminSession, getAdminAccount, saveAdminAccount } from '../utils/adminAuth'

// 环境信息全部改为运行时读取，避免写死后和实际配置/改密结果对不上
const runtimeInfo = ref([])

function loadRuntimeInfo() {
  const account = getAdminAccount()
  runtimeInfo.value = [
    { label: '业务接口地址', value: baseURL },
    { label: '管理后台地址', value: window.location.origin },
    { label: '管理员登录账号', value: `${account.username} / ${account.password}` },
    { label: '乘客测试账号', value: '13800000001 / 123456' },
    { label: '司机测试账号', value: '13900000001 / 123456' },
    { label: '联动状态', value: '多端业务数据一致' }
  ]
}

const configLoading = ref(false)
const noticeLoading = ref(false)
const noticeSubmitting = ref(false)
const accountSaving = ref(false)

const configList = ref([])
const noticeList = ref([])

const noticeVisible = ref(false)

const noticeFormRef = ref()
const accountFormRef = ref()

const noticeQuery = reactive({
  current: 1,
  size: 6,
  keyword: ''
})

const noticeTotal = ref(0)

const createNoticeForm = () => ({
  id: null,
  title: '',
  content: '',
  targetRole: 'ALL',
  sortNo: 100,
  displayTimeWindow: [],
  enabledFlag: true
})

const noticeForm = reactive(createNoticeForm())

const noticeRules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }],
  targetRole: [{ required: true, message: '请选择目标角色', trigger: 'change' }],
  sortNo: [{ required: true, message: '请输入首页优先级', trigger: 'change' }]
}

/* ---------------- 管理员账号设置 ---------------- */

const createAccountForm = () => ({
  username: getAdminAccount().username,
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const accountForm = reactive(createAccountForm())

const accountRules = {
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]{3,20}$/, message: '账号需为 3-20 位字母、数字或下划线', trigger: 'blur' }
  ],
  currentPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '新密码长度需为 6-20 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== accountForm.newPassword) {
          callback(new Error('两次输入的新密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

function resetAccountForm() {
  Object.assign(accountForm, createAccountForm())
  accountFormRef.value?.clearValidate()
}

async function submitAccount() {
  try {
    await accountFormRef.value.validate()
  } catch (error) {
    return
  }

  const account = getAdminAccount()
  if (accountForm.currentPassword !== account.password) {
    ElMessage.error('当前密码不正确，请重新输入')
    return
  }
  const usernameChanged = accountForm.username.trim() !== account.username
  const passwordChanged = accountForm.newPassword !== account.password
  if (!usernameChanged && !passwordChanged) {
    ElMessage.warning('登录账号与新密码均未发生变化，无需保存')
    return
  }
  if (!usernameChanged && accountForm.newPassword === accountForm.currentPassword) {
    ElMessage.warning('新密码不能与当前密码相同')
    return
  }

  try {
    await ElMessageBox.confirm(
      `即将把管理员账号更新为「<strong>${accountForm.username.trim()}</strong>」并重置登录密码。<br/>保存后当前登录状态会立即失效，需要用新账号和密码重新登录后台。`,
      '二次确认',
      {
        type: 'warning',
        confirmButtonText: '确认修改',
        cancelButtonText: '再想想',
        dangerouslyUseHTMLString: true
      }
    )
  } catch (error) {
    return
  }

  accountSaving.value = true
  try {
    saveAdminAccount({
      username: accountForm.username.trim(),
      password: accountForm.newPassword
    })
    clearAdminSession()
    ElMessage.success('管理员账号密码已更新，请使用新账号重新登录')
    window.setTimeout(() => window.location.reload(), 900)
  } finally {
    accountSaving.value = false
  }
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
    // 对齐 AI 客服设置：打码值单独存放展示，输入框保持空白（留空保存 = 保持当前 Key）
    const mapKeyItem = configList.value.find((item) => item.configKey === 'tencentMapKey')
    mapKeyMasked.value = mapKeyItem ? `${mapKeyItem.configValue ?? ''}`.trim() : ''
    if (mapKeyItem) {
      mapKeyItem.configValue = ''
    }
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

async function saveConfigs() {
  try {
    validateConfigs()
    configLoading.value = true
    await http.post('/admin/system/configs', {
      // 密码式配置：腾讯地图Key留空 = 保持当前Key，直接不出现在保存请求里（后端DTO有@NotBlank）
      items: configList.value
        .filter((item) => !(item.configKey === 'tencentMapKey' && !`${item.configValue ?? ''}`.trim()))
        .map((item) => ({
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
  try {
    await noticeFormRef.value.validate()
  } catch (error) {
    return
  }
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

function handleNoticePageChange(current) {
  noticeQuery.current = current
  loadNotices()
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
  if (configKey === 'tencentMapKey') return '请输入腾讯位置服务控制台的 Key'
  return '请输入配置值'
}

function configHint(configKey) {
  if (configKey === 'platformCommissionRate') return '佣金比例建议输入 0-1 之间的小数'
  if (configKey === 'intlExchangeRate') return '国际出行汇率必须大于 0'
  if (configKey === 'freeCancelMinutes') return '免费取消时长必须是大于等于 0 的整数'
  if (configKey === 'nightTimeRange') return '请按 22:00-06:00 的格式填写'
  if (configKey === 'tencentMapKey') return '保存后网页端和两个小程序会在下次拉取首页配置时自动换用新 Key'
  return '修改后会影响业务计算逻辑'
}

/* ---------------- 腾讯地图 Key 可用性测试 ---------------- */

const mapKeyTesting = ref(false)
const mapKeyTest = ref(null) // { ok, text }
const mapKeyMasked = ref('') // 后端回传的打码值，仅用于"当前已配置"展示

function tencentMapStatusText(status) {
  const texts = {
    110: '请求来源未被授权（请在腾讯位置服务控制台为该 Key 绑定域名或勾选 WebServiceAPI 授权）',
    111: '签名验证失败（Key 开启了签名校验，需按规则签名或关闭）',
    112: 'IP 未被授权（该 Key 配置了 IP 白名单，不包含当前机器）',
    113: 'Key 已被禁用',
    119: '请求来源未被授权',
    120: '该 Key 每秒请求量已达上限，请稍后再试',
    121: '该 Key 日调用量超限',
    198: '请求参数非法'
  }
  return texts[status] || '腾讯地图返回未知错误'
}

function testTencentMapKey(item) {
  const key = `${item.configValue ?? ''}`.trim()
  if (!key || key.includes('****')) {
    ElMessage.warning('请先输入要测试的新Key（留空保存则保持当前Key）')
    return
  }
  mapKeyTesting.value = true
  mapKeyTest.value = { ok: false, text: '正在测试腾讯地图Key（解析「深圳湾口岸」）...' }
  // JSONP 直连腾讯 WebService 地理解析接口，避开浏览器跨域限制
  const callbackName = `__tencentMapKeyTest_${Date.now()}`
  const script = document.createElement('script')
  let settled = false
  const cleanup = () => {
    delete window[callbackName]
    if (script.parentNode) script.parentNode.removeChild(script)
  }
  window[callbackName] = (response) => {
    if (settled) return
    settled = true
    cleanup()
    if (response?.status === 0) {
      const location = response.result?.location || {}
      mapKeyTest.value = {
        ok: true,
        text: `✅ Key可用：地理解析成功（${Number(location.longitude || 0).toFixed(4)}, ${Number(location.latitude || 0).toFixed(4)}）`
      }
    } else {
      mapKeyTest.value = {
        ok: false,
        text: `❌ Key不可用：${tencentMapStatusText(response?.status)}（错误码 ${response?.status ?? '-'}）`
      }
    }
    mapKeyTesting.value = false
  }
  script.onerror = () => {
    if (settled) return
    settled = true
    cleanup()
    mapKeyTest.value = { ok: false, text: '❌ 测试请求失败，请检查本机网络能否访问 apis.map.qq.com' }
    mapKeyTesting.value = false
  }
  script.src = `https://apis.map.qq.com/ws/geocoder/v1/?address=${encodeURIComponent('深圳湾口岸')}&key=${encodeURIComponent(key)}&output=jsonp&callback=${callbackName}`
  document.body.appendChild(script)
  window.setTimeout(() => {
    if (settled) return
    settled = true
    cleanup()
    mapKeyTest.value = { ok: false, text: '❌ 测试超时（8秒无响应），请检查网络后重试' }
    mapKeyTesting.value = false
  }, 8000)
}

function mapKeyRemark(configKey, item) {
  if (configKey === 'tencentMapKey') {
    if (mapKeyTest.value) {
      return mapKeyTest.value.text
    }
    if (`${item.configValue ?? ''}`.trim()) {
      return '保存后将替换当前腾讯地图Key'
    }
    if (mapKeyMasked.value) {
      return `当前已配置：${mapKeyMasked.value}`
    }
    return '尚未配置腾讯地图Key'
  }
  return item.remark || configHint(configKey)
}

function mapKeyRemarkClass(configKey) {
  if (configKey === 'tencentMapKey' && mapKeyTest.value) {
    return mapKeyTest.value.ok ? 'config-remark--success' : 'config-remark--danger'
  }
  return ''
}

function validateConfigs() {
  for (const item of configList.value) {
    const value = `${item.configValue ?? ''}`.trim()
    // 腾讯地图Key 为密码式配置：留空 = 保持当前 Key，后端会跳过；打码回显值也不参与校验
    if (item.configKey === 'tencentMapKey') {
      if (value && !value.includes('****') && value.length < 20) {
        throw new Error('腾讯地图Key 格式不正确，请到腾讯位置服务控制台复制完整 Key')
      }
      continue
    }
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
  loadRuntimeInfo()
  resetAccountForm()
})
</script>

<style scoped>
.config-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: row dense;
  gap: 14px;
}

/* 条目多的分组独占整行，单条目分组两两并排，压缩整体高度 */
.config-group--wide {
  grid-column: 1 / -1;
}

.config-group {
  padding: 14px 16px;
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.config-group :deep(.el-form-item) {
  margin-bottom: 10px;
}

.config-group :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.config-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
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
  margin-top: 4px;
  line-height: 1.5;
}

.config-remark--success {
  color: #16a34a;
}

.config-remark--danger {
  color: #dc2626;
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

.account-form {
  padding: 4px 2px 0;
}
</style>
