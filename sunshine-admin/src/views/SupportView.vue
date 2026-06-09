<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">客服服务</span>
        <h3 class="panel-title">在线客服对话</h3>
        <p class="panel-subtitle">乘客和司机客服会话统一进入后台，会员乘客显示会员标识。</p>
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
            <el-button
              :type="selectedConversation.status === 'OPEN' ? 'warning' : 'success'"
              plain
              @click="toggleStatus"
            >
              {{ selectedConversation.status === 'OPEN' ? '关闭会话' : '重新打开' }}
            </el-button>
          </div>

          <div v-loading="messageLoading" class="message-list">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message-item"
              :class="{ admin: message.fromAdmin }"
            >
              <div class="message-bubble">
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
              placeholder="输入客服回复"
            />
            <el-button :loading="replyLoading" type="primary" @click="sendReply">发送回复</el-button>
          </div>
        </template>
        <el-empty v-else description="请选择左侧会话" />
      </article>
    </div>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import http from '../api/http'
import { formatDateTime } from '../utils/admin'

const loading = ref(false)
const messageLoading = ref(false)
const replyLoading = ref(false)
const total = ref(0)
const conversations = ref([])
const selectedId = ref(null)
const selectedConversation = ref(null)
const messages = ref([])
const replyText = ref('')
let supportTimer

const query = reactive({
  current: 1,
  size: 8,
  keyword: '',
  role: '',
  status: ''
})

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

<style scoped>
.support-layout {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 16px;
}

.support-list-panel,
.support-chat-panel {
  min-height: calc(100vh - 170px);
}

.support-list {
  display: grid;
  align-content: start;
  gap: 8px;
  margin-top: 10px;
  min-height: 0;
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
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
}

.message-list {
  min-height: 360px;
  padding: 14px;
  border-radius: 8px;
  background: #f7f8fb;
  overflow-y: auto;
}

.message-item {
  display: flex;
  margin-bottom: 12px;
}

.message-item.admin {
  justify-content: flex-end;
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

.message-bubble p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: flex-end;
}

@media (max-width: 960px) {
  .support-layout {
    grid-template-columns: 1fr;
  }

  .support-list-panel,
  .support-chat-panel {
    min-height: auto;
  }
}
</style>
