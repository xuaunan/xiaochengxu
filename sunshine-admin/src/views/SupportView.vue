<script setup>
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import { formatDateTime } from '../utils/admin'

const loading = ref(false)
const messageLoading = ref(false)
const replyLoading = ref(false)
const aiSuggestLoading = ref(false)
const aiContextLoading = ref(false)
const total = ref(0)
const conversations = ref([])
const selectedId = ref(null)
const selectedConversation = ref(null)
const messages = ref([])
const aiContext = ref(null)
const aiContextVisible = ref(false)
const replyText = ref('')
let supportTimer

const query = reactive({
  current: 1,
  size: 8,
  keyword: '',
  role: '',
  status: ''
})

const aiContextSources = computed(() => {
  const sources = Array.isArray(aiContext.value?.sources) ? aiContext.value.sources : []
  return sources.length ? sources.map(sourceLabel).join('、') : '点击查看读取资料'
})

const aiContextSummary = computed(() => aiContext.value?.summary || {})

const aiContextSourceLabels = computed(() => {
  const sources = Array.isArray(aiContext.value?.sources) ? aiContext.value.sources : []
  return sources.map(sourceLabel)
})

const aiContextSections = computed(() => {
  const sections = Array.isArray(aiContext.value?.sections) ? aiContext.value.sections : []
  return sections.filter((section) => {
    const fields = Array.isArray(section.fields) ? section.fields : []
    const rows = Array.isArray(section.rows) ? section.rows : []
    return fields.length || rows.length
  })
})

const sourceLabelMap = {
  t_platform_user: '用户资料',
  t_ride_order: '订单',
  t_payment_record: '支付/退款',
  t_complaint: '投诉',
  t_user_coupon: '用户优惠券',
  t_coupon: '优惠券规则',
  t_driver_profile: '司机资料',
  t_vehicle: '车辆资料',
  t_withdraw_application: '提现记录'
}

function sourceLabel(source) {
  return sourceLabelMap[source] || source
}

function contextFields(section) {
  return Array.isArray(section?.fields) ? section.fields : []
}

function contextRows(section) {
  return Array.isArray(section?.rows) ? section.rows : []
}

function contextRowEntries(row) {
  if (!row || typeof row !== 'object') return []
  return Object.entries(row).filter(([, value]) => value !== null && value !== undefined && `${value}`.trim() !== '')
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  return payload.records || payload.messages || payload.list || payload.rows || []
}

async function loadConversations(resetPage = false) {
  if (resetPage) {
    query.current = 1
  }
  loading.value = true
  try {
    const response = await http.get('/admin/support/conversations', { params: query })
    conversations.value = response?.records || []
    total.value = response?.total || 0
    if (selectedId.value) {
      const latestSelected = conversations.value.find((item) => item.id === selectedId.value)
      if (latestSelected) {
        selectedConversation.value = latestSelected
      }
    } else if (conversations.value.length) {
      await selectConversation(conversations.value[0])
    }
  } finally {
    loading.value = false
  }
}

async function selectConversation(item) {
  selectedId.value = item.id
  selectedConversation.value = item
  aiContext.value = null
  aiContextVisible.value = false
  await loadMessages()
}

async function loadMessages() {
  if (!selectedId.value) return
  messageLoading.value = true
  try {
    const response = await http.get(`/admin/support/conversations/${selectedId.value}/messages`)
    messages.value = normalizeList(response)
  } finally {
    messageLoading.value = false
  }
}

async function requestAiSuggestion() {
  if (!selectedId.value) return
  aiSuggestLoading.value = true
  try {
    const response = await http.post(`/admin/support/conversations/${selectedId.value}/ai-suggest`)
    if (response?.aiContext) {
      aiContext.value = response.aiContext
    }
    const suggestion = `${response?.reply || ''}`.trim()
    if (!suggestion) {
      ElMessage.warning('AI暂未生成建议')
      return
    }
    replyText.value = suggestion
    ElMessage.success('AI建议已按当前会话数据生成')
  } finally {
    aiSuggestLoading.value = false
  }
}

async function loadAiContext(showDrawer = true) {
  if (!selectedId.value) return
  aiContextLoading.value = true
  try {
    aiContext.value = await http.get(`/admin/support/conversations/${selectedId.value}/ai-context`)
    if (showDrawer) {
      aiContextVisible.value = true
    }
  } finally {
    aiContextLoading.value = false
  }
}

async function sendReply() {
  const content = replyText.value.trim()
  if (!selectedId.value || !content) {
    ElMessage.warning('请输入回复内容')
    return
  }
  replyLoading.value = true
  try {
    await http.post(`/admin/support/conversations/${selectedId.value}/messages`, { content })
    replyText.value = ''
    await Promise.all([loadMessages(), loadConversations(false)])
    ElMessage.success('回复已发送')
  } finally {
    replyLoading.value = false
  }
}

async function toggleStatus() {
  if (!selectedConversation.value) return
  const status = selectedConversation.value.status === 'OPEN' ? 'CLOSED' : 'OPEN'
  await http.post(`/admin/support/conversations/${selectedConversation.value.id}/status`, { status })
  await loadConversations(false)
  ElMessage.success(status === 'OPEN' ? '会话已重新打开' : '会话已关闭')
}

function handlePageChange(current) {
  query.current = current
  selectedId.value = null
  selectedConversation.value = null
  messages.value = []
  aiContext.value = null
  aiContextVisible.value = false
  loadConversations()
}

onMounted(() => {
  loadConversations()
  supportTimer = setInterval(async () => {
    await loadConversations(false)
    if (selectedId.value) {
      await loadMessages()
    }
  }, 3000)
})

onBeforeUnmount(() => {
  clearInterval(supportTimer)
})
</script>

<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">客服服务</span>
        <h3 class="panel-title">在线客服对话</h3>
        <p class="panel-subtitle">乘客端、司机端与AI客服消息统一进入后台，人工可随时接管。</p>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索昵称、手机号、消息"
          style="width: 230px"
          @keyup.enter="loadConversations(true)"
        />
        <el-select v-model="query.role" clearable placeholder="身份" style="width: 120px">
          <el-option label="乘客" value="USER" />
          <el-option label="司机" value="DRIVER" />
        </el-select>
        <el-select v-model="query.status" clearable placeholder="状态" style="width: 120px">
          <el-option label="处理中" value="OPEN" />
          <el-option label="已关闭" value="CLOSED" />
        </el-select>
        <el-button @click="loadConversations(true)">查询</el-button>
      </div>
    </article>

    <div class="support-layout">
      <article class="panel support-list-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">会话</span>
            <h3 class="panel-title">客服队列</h3>
          </div>
          <el-button @click="loadConversations(false)">刷新</el-button>
        </div>

        <div v-loading="loading" class="support-list">
          <button
            v-for="item in conversations"
            :key="item.id"
            class="support-row"
            :class="{ active: selectedId === item.id }"
            type="button"
            @click="selectConversation(item)"
          >
            <div class="support-row__top">
              <span class="support-row__name">{{ item.nickname || '未命名用户' }}</span>
              <el-badge :value="item.unreadForAdmin || 0" :hidden="!item.unreadForAdmin" />
            </div>
            <div class="support-row__meta">
              <el-tag size="small" effect="light">{{ item.roleText }}</el-tag>
              <el-tag v-if="item.member" size="small" type="warning" effect="light">
                {{ item.memberLevel || '会员' }}
              </el-tag>
              <el-tag size="small" :type="item.status === 'OPEN' ? 'success' : 'info'" effect="light">
                {{ item.status === 'OPEN' ? '处理中' : '已关闭' }}
              </el-tag>
            </div>
            <p>{{ item.lastMessage || '暂无消息' }}</p>
            <span>{{ formatDateTime(item.lastMessageAt) }}</span>
          </button>
          <el-empty v-if="!loading && !conversations.length" description="暂无客服会话" />
        </div>

        <div class="pagination-wrap">
          <el-pagination
            small
            background
            layout="prev, pager, next"
            :current-page="query.current"
            :page-size="query.size"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </article>

      <article class="panel support-chat-panel">
        <template v-if="selectedConversation">
          <div class="support-chat-head">
            <div>
              <span class="panel-kicker">{{ selectedConversation.roleText }}</span>
              <h3 class="panel-title">
                {{ selectedConversation.nickname }}
                <el-tag v-if="selectedConversation.member" type="warning" effect="light">
                  {{ selectedConversation.memberLevel || '会员' }}
                </el-tag>
              </h3>
              <p class="panel-subtitle">{{ selectedConversation.phone || '未留手机号' }}</p>
            </div>
            <div class="support-chat-actions">
              <el-button :loading="aiContextLoading" plain @click="loadAiContext(true)">AI读取资料</el-button>
              <el-button
                :type="selectedConversation.status === 'OPEN' ? 'warning' : 'success'"
                plain
                @click="toggleStatus"
              >
                {{ selectedConversation.status === 'OPEN' ? '关闭会话' : '重新打开' }}
              </el-button>
            </div>
          </div>

          <div class="ai-context-strip">
            <div>
              <span>AI读取资料</span>
              <strong>生成建议前会读取当前{{ selectedConversation.roleText }}的订单、支付等资料</strong>
            </div>
            <button type="button" @click="loadAiContext(true)">
              {{ aiContextSources }}
            </button>
          </div>

          <div v-loading="messageLoading" class="message-list">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message-item"
              :class="{ admin: message.fromAdmin, ai: message.fromAi }"
            >
              <div class="message-bubble">
                <div v-if="message.fromAi" class="message-badge">AI客服</div>
                <p>{{ message.content }}</p>
                <span>{{ formatDateTime(message.createdAt) }}</span>
              </div>
            </div>
            <el-empty v-if="!messageLoading && !messages.length" description="暂无消息" />
          </div>

          <div class="reply-box">
            <el-input
              v-model="replyText"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="输入客服回复，或先生成AI建议"
            />
            <div class="reply-actions">
              <el-button :loading="aiSuggestLoading" @click="requestAiSuggestion">AI建议</el-button>
              <el-button :loading="replyLoading" type="primary" @click="sendReply">发送回复</el-button>
            </div>
          </div>

          <el-drawer v-model="aiContextVisible" title="AI读取的业务资料" size="520px">
            <div v-loading="aiContextLoading" class="ai-context-drawer">
              <div class="ai-context-explain">
                <strong>这是AI生成回复前读取到的当前会话资料</strong>
                <p>用于核对AI回答有没有依据；这里只展示脱敏后的业务信息，不展示密钥、身份证、银行卡等敏感内容。</p>
              </div>
              <div class="ai-context-stats">
                <div>
                  <span>订单</span>
                  <strong>{{ aiContextSummary.orderCount ?? 0 }}</strong>
                </div>
                <div>
                  <span>支付</span>
                  <strong>{{ aiContextSummary.paymentCount ?? 0 }}</strong>
                </div>
                <div>
                  <span>投诉</span>
                  <strong>{{ aiContextSummary.complaintCount ?? 0 }}</strong>
                </div>
              </div>
              <div class="ai-context-tags">
                <el-tag
                  v-for="source in aiContextSourceLabels"
                  :key="source"
                  size="small"
                  effect="plain"
                >
                  {{ source }}
                </el-tag>
              </div>
              <div v-if="aiContextSections.length" class="ai-context-sections">
                <section
                  v-for="section in aiContextSections"
                  :key="section.title"
                  class="ai-context-section"
                >
                  <h4>{{ section.title }}</h4>
                  <div v-if="contextFields(section).length" class="ai-context-fields">
                    <div
                      v-for="field in contextFields(section)"
                      :key="`${section.title}-${field.label}`"
                    >
                      <span>{{ field.label }}</span>
                      <strong>{{ field.value }}</strong>
                    </div>
                  </div>
                  <div v-if="contextRows(section).length" class="ai-context-rows">
                    <div
                      v-for="(row, rowIndex) in contextRows(section)"
                      :key="`${section.title}-${rowIndex}`"
                      class="ai-context-row"
                    >
                      <div
                        v-for="[label, value] in contextRowEntries(row)"
                        :key="`${section.title}-${rowIndex}-${label}`"
                      >
                        <span>{{ label }}</span>
                        <strong>{{ value }}</strong>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <el-empty v-else description="暂无读取资料，请先选择会话或点击刷新。" />
            </div>
          </el-drawer>
        </template>
        <el-empty v-else description="请选择左侧会话" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.support-layout {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  column-gap: 24px;
  margin-top: 24px;
  height: clamp(680px, calc(100vh - 140px), 860px);
  min-height: 0;
}

.support-list-panel,
.support-chat-panel {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.support-list-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.support-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
}

.support-row {
  width: 100%;
  min-height: auto;
  padding: 10px 12px;
  border: 1px solid #edf1f6;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.support-row.active,
.support-row:hover {
  border-color: rgba(255, 122, 24, 0.42);
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.08);
}

.support-row__top,
.support-chat-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.support-chat-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.support-chat-actions .el-button {
  margin-left: 0;
}

.support-row__name {
  color: #172033;
  font-size: 14px;
  font-weight: 500;
}

.support-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.support-row p {
  margin: 8px 0 4px;
  color: #334155;
  font-size: 13px;
  line-height: 1.35;
}

.support-row span {
  color: #94a3b8;
  font-size: 12px;
}

.support-chat-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
}

.ai-context-strip {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}

.ai-context-strip div {
  display: grid;
  gap: 3px;
}

.ai-context-strip span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}

.ai-context-strip strong {
  color: #172033;
  font-size: 13px;
  font-weight: 600;
}

.ai-context-strip button {
  min-width: 0;
  max-width: 48%;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  text-align: right;
  cursor: pointer;
}

.ai-context-drawer {
  display: grid;
  gap: 14px;
}

.ai-context-explain {
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}

.ai-context-explain strong {
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 650;
}

.ai-context-explain p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
}

.ai-context-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ai-context-stats div {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.ai-context-stats span {
  color: #64748b;
  font-size: 12px;
}

.ai-context-stats strong {
  color: #0f172a;
  font-size: 18px;
  font-weight: 650;
}

.ai-context-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-context-sections {
  display: grid;
  gap: 12px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 2px;
}

.ai-context-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.ai-context-section h4 {
  margin: 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.ai-context-fields,
.ai-context-rows {
  display: grid;
  gap: 8px;
}

.ai-context-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-context-fields div,
.ai-context-row {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.ai-context-fields span,
.ai-context-row span {
  display: block;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 12px;
}

.ai-context-fields strong,
.ai-context-row strong {
  display: block;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
  word-break: break-word;
}

.ai-context-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.message-list {
  min-height: 0;
  padding: 14px;
  border-radius: 8px;
  background: #f7f8fb;
  overscroll-behavior: contain;
  overflow-y: auto;
}

.message-item {
  display: flex;
  margin-bottom: 12px;
}

.message-item.admin {
  justify-content: flex-end;
}

.message-item.ai {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 68%;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #edf1f6;
}

.message-item.admin .message-bubble {
  color: #fff;
  background: #ff7a18;
  border-color: transparent;
}

.message-item.ai .message-bubble {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.message-badge {
  display: inline-flex;
  margin-bottom: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  color: #15803d;
  background: #dcfce7;
  font-size: 11px;
  font-weight: 600;
}

.message-bubble p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.message-bubble span {
  display: block;
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.message-item.admin .message-bubble span {
  color: rgba(255, 255, 255, 0.78);
}

.reply-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 12px;
  align-items: flex-end;
}

.reply-actions {
  display: grid;
  gap: 8px;
}

.reply-actions .el-button {
  width: 100%;
  margin-left: 0;
}

@media (max-width: 960px) {
  .support-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .support-list-panel,
  .support-chat-panel {
    min-height: 560px;
    height: auto;
  }

  .reply-box {
    grid-template-columns: 1fr;
  }

  .reply-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-context-strip {
    align-items: flex-start;
    flex-direction: column;
  }

  .ai-context-strip button {
    max-width: 100%;
    text-align: left;
  }

  .ai-context-fields,
  .ai-context-row {
    grid-template-columns: 1fr;
  }
}
</style>
