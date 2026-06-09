const { fetchSupportConversation, fetchSupportMessages, sendSupportMessage } = require('../../utils/api')

function formatDateTime(value) {
  if (!value) return '刚刚'
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0] = value
    if (year && month && day) {
      return `${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')} ${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
    }
  }
  const text = `${value}`.replace('T', ' ')
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (matched) {
    return `${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}`
  }
  return text || '刚刚'
}

function decorateMessage(message = {}, index = 0) {
  return {
    ...message,
    anchorId: `support-msg-${message.id || index}`,
    timeText: formatDateTime(message.createdAt)
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
    if (this.__refreshingSupport) return
    this.__refreshingSupport = true
    try {
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
    } finally {
      this.__refreshingSupport = false
    }
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
