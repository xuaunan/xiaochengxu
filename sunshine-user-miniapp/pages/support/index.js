const { fetchSupportConversation, fetchSupportMessages, sendSupportMessage } = require('../../utils/api')
const { formatDateTime } = require('../../utils/format')
const { runExclusive } = require('../../utils/page')

function decorateMessage(message = {}, index = 0) {
  return {
    ...message,
    anchorId: `support-msg-${message.id || index}`,
    timeText: formatDateTime(message.createdAt, { fallback: '刚刚' })
  }
}

function normalizeMessageList(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  return payload.records || payload.messages || payload.list || payload.rows || []
}

Page({
  data: {
    conversation: {},
    messages: [],
    scrollIntoView: '',
    inputText: '',
    sending: false
  },

  supportTimer: null,

  async onShow() {
    await this.refreshSupport()
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  startPolling() {
    this.stopPolling()
    this.supportTimer = setInterval(() => {
      this.refreshSupport({ fromPolling: true }).catch(() => {})
    }, 1800)
  },

  stopPolling() {
    if (this.supportTimer) {
      clearInterval(this.supportTimer)
      this.supportTimer = null
    }
  },

  async refreshSupport(options = {}) {
    return runExclusive(this, '__refreshSupportPromise', async () => {
      const [conversationResponse, messageResponse] = await Promise.all([
        fetchSupportConversation(),
        fetchSupportMessages()
      ])
      const messages = normalizeMessageList(messageResponse.data).map(decorateMessage)
      const previousLast = this.data.messages[this.data.messages.length - 1] || {}
      const nextLast = messages[messages.length - 1] || {}
      const shouldScroll = !options.fromPolling || previousLast.id !== nextLast.id || previousLast.createdAt !== nextLast.createdAt
      this.setData({
        conversation: conversationResponse.data || {},
        messages,
        scrollIntoView: shouldScroll && nextLast.anchorId ? nextLast.anchorId : this.data.scrollIntoView
      })
    })
  },

  handleInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  async sendMessage() {
    const content = `${this.data.inputText || ''}`.trim()
    if (!content || this.data.sending) return
    this.setData({ sending: true })
    try {
      await sendSupportMessage(content)
      this.setData({ inputText: '' })
      await this.refreshSupport()
    } finally {
      this.setData({ sending: false })
    }
  }
})
