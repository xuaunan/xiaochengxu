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
    quickQuestions: ['听单接单', '提现到账', '资质审核', '行程订单', '语音播报', '联系人工'],
    sending: false,
    loading: false,
    loadError: ''
  },

  supportTimer: null,

  async onShow() {
    await this.refreshSupport().catch(() => {})
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
    if (!options.fromPolling && !this.data.messages.length) {
      this.setData({ loading: true, loadError: '' })
    }
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
        loadError: '',
        scrollIntoView: shouldScroll && nextLast.anchorId ? nextLast.anchorId : this.data.scrollIntoView
      })
    } catch (error) {
      if (!options.fromPolling) {
        this.setData({
          loadError: (error && error.message) || '客服消息加载失败，请稍后重试'
        })
        wx.showToast({
          title: '客服消息加载失败，请稍后重试',
          icon: 'none'
        })
      }
      throw error
    } finally {
      if (!options.fromPolling) {
        this.setData({ loading: false })
      }
      this.__refreshingSupport = false
    }
  },

  handleInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  handleQuickQuestion(e) {
    const content = `${e.currentTarget.dataset.content || ''}`.trim()
    if (!content || this.data.sending) return
    this.setData({ inputText: content })
    this.sendMessage()
  },

  async sendMessage() {
    const content = `${this.data.inputText || ''}`.trim()
    if (!content || this.data.sending) return
    this.setData({ sending: true })
    try {
      await sendSupportMessage(content)
      this.setData({ inputText: '' })
      await this.refreshSupport()
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '发送失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ sending: false })
    }
  }
})
