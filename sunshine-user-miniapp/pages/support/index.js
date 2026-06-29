const { fetchSupportConversation, fetchSupportMessages, sendSupportMessage } = require('../../utils/api')
const { formatDateTime } = require('../../utils/format')
const { buildMediaUrl } = require('../../utils/media')
const { runExclusive } = require('../../utils/page')

const DEFAULT_USER_AVATAR = '/images/avatar-user.svg'
const SUPPORT_AVATAR = '/images/support-avatar.png'
const SUPPORT_WELCOME_MESSAGE = '您好，阳光出行客服已接入，请描述您遇到的问题。'
const PREVIOUS_SUPPORT_WELCOME_MESSAGE = '您好，阳光出行AI客服已接入，请描述您遇到的问题。'

function normalizeSupportWelcomeContent(content) {
  return content === PREVIOUS_SUPPORT_WELCOME_MESSAGE ? SUPPORT_WELCOME_MESSAGE : content
}

function formatSupportMessageContent(content, message = {}) {
  const raw = `${normalizeSupportWelcomeContent(content) || ''}`.trim()
  if (!raw || (!message.fromAi && !message.fromAdmin)) return raw

  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/([：:])\s*(?=\d+[.．、])/g, '$1\n')
    .replace(/\s+(\d+[.．、])/g, '\n$1')
    .replace(/\s+([-•])\s*/g, '\n$1 ')
    .replace(/([。！？；;])\s*(?=(注意|温馨提示|小贴士|如果|建议|请|遇到|涉及))/g, '$1\n')
    .replace(/\s*(⚠️|⚠|注意[:：])/g, '\n$1')
    .replace(/\s*(小贴士[:：]|温馨提示[:：])/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decorateMessage(message = {}, index = 0, options = {}) {
  const isSelf = !message.fromAi && !message.fromAdmin
  const content = normalizeSupportWelcomeContent(message.content)
  const senderName = isSelf ? '我' : '阳光客服'
  const senderRoleText = isSelf ? '乘客端' : (message.systemNotice ? '系统' : (message.fromAdmin ? '人工客服' : 'AI客服'))
  return {
    ...message,
    content,
    isSelf,
    senderName,
    senderRoleText,
    avatarSrc: isSelf ? (options.userAvatarSrc || DEFAULT_USER_AVATAR) : SUPPORT_AVATAR,
    avatarText: isSelf ? '我' : '阳',
    anchorId: `support-msg-${message.id || index}`,
    displayContent: formatSupportMessageContent(content, message),
    timeText: formatDateTime(message.createdAt, { fallback: '刚刚' })
  }
}

function normalizeMessageList(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  return payload.records || payload.messages || payload.list || payload.rows || []
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchSupportSnapshot() {
  const conversationResponse = await fetchSupportConversation()
  try {
    return {
      conversationResponse,
      messageResponse: await fetchSupportMessages()
    }
  } catch (error) {
    await sleep(350)
    return {
      conversationResponse,
      messageResponse: await fetchSupportMessages()
    }
  }
}

function createPendingMessages(content, userAvatarSrc) {
  const now = Date.now()
  const userMessage = {
    id: `local-user-${now}`,
    anchorId: `support-msg-local-user-${now}`,
    content,
    timeText: '刚刚'
  }
  const typingMessage = {
    id: `local-ai-${now}`,
    anchorId: `support-msg-local-ai-${now}`,
    content: 'AI回复中...',
    fromAi: true,
    isTyping: true,
    timeText: '刚刚'
  }
  return [
    decorateMessage(userMessage, 0, { userAvatarSrc }),
    decorateMessage(typingMessage, 1, { userAvatarSrc })
  ]
}

function findLatestUserMessageIndex(messages, content) {
  const target = `${content || ''}`.trim()
  if (!target) return -1
  let userMessageIndex = -1
  messages.forEach((message, index) => {
    if (!message.fromAi && !message.fromAdmin && `${message.content || ''}`.trim() === target) {
      userMessageIndex = index
    }
  })
  return userMessageIndex
}

function shouldKeepPendingReply(messages, content) {
  const userMessageIndex = findLatestUserMessageIndex(messages, content)
  if (userMessageIndex < 0) return false
  return !messages.slice(userMessageIndex + 1).some((message) => message.fromAi || message.fromAdmin)
}

function appendPendingReplyIfNeeded(messages, content, userAvatarSrc) {
  if (!shouldKeepPendingReply(messages, content)) {
    return { messages, pending: false }
  }
  const [, typingMessage] = createPendingMessages(content, userAvatarSrc)
  return { messages: messages.concat(typingMessage), pending: true }
}

function isManualRequest(content) {
  const normalized = `${content || ''}`.replace(/\s+/g, '')
  return normalized.includes('联系人工')
    || normalized.includes('人工客服')
    || normalized.includes('转人工')
    || normalized.includes('找人工')
    || normalized.includes('真人客服')
}

function supportStatusText(conversation = {}) {
  if (conversation.status === 'MANUAL' || conversation.manualMode) return '人工接待中'
  if (conversation.status === 'CLOSED') return '已关闭'
  return 'AI接待中'
}

function isManualConversation(conversation = {}) {
  return conversation.status === 'MANUAL' || conversation.manualMode === true
}

Page({
  data: {
    conversation: {},
    supportStatusText: 'AI接待中',
    messages: [],
    messagesReady: false,
    scrollIntoView: '',
    inputText: '',
    quickQuestions: ['订单问题', '支付退款', '发票优惠券', '投诉建议', '联系人工'],
    sending: false,
    loading: false,
    loadError: ''
  },

  supportTimer: null,
  messageRevealTimer: null,
  sendingLock: false,
  pendingReplyContent: '',

  async onShow() {
    this.clearMessageRevealTimer()
    this.setData({
      loading: true,
      loadError: '',
      messagesReady: false
    })
    await this.refreshSupport().catch(() => {})
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
    this.clearMessageRevealTimer()
  },

  onUnload() {
    this.stopPolling()
    this.clearMessageRevealTimer()
  },

  clearMessageRevealTimer() {
    if (this.messageRevealTimer) {
      clearTimeout(this.messageRevealTimer)
      this.messageRevealTimer = null
    }
  },

  revealMessagesAfterLoad() {
    this.clearMessageRevealTimer()
    this.messageRevealTimer = setTimeout(() => {
      this.messageRevealTimer = null
      this.setData({ messagesReady: true })
    }, 180)
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

  getUserAvatarSrc() {
    const app = getApp()
    const profile = (app.globalData.userStore && app.globalData.userStore.profile) || {}
    return buildMediaUrl(profile.avatar || DEFAULT_USER_AVATAR, app.globalData.baseUrl) || DEFAULT_USER_AVATAR
  },

  async refreshSupport(options = {}) {
    if (options.fromPolling && this.data.sending) return
    return runExclusive(this, '__refreshSupportPromise', async () => {
      if (!options.fromPolling && !this.data.messages.length) {
        this.setData({ loading: true, loadError: '' })
      }
      try {
        const { conversationResponse, messageResponse } = await fetchSupportSnapshot()
        const userAvatarSrc = this.getUserAvatarSrc()
        const conversation = conversationResponse.data || {}
        const serverMessages = normalizeMessageList(messageResponse.data).map((item, index) => decorateMessage(item, index, { userAvatarSrc }))
        const pendingState = isManualConversation(conversation)
          ? { messages: serverMessages, pending: false }
          : appendPendingReplyIfNeeded(serverMessages, this.pendingReplyContent, userAvatarSrc)
        if (this.pendingReplyContent && !pendingState.pending) {
          this.pendingReplyContent = ''
        }
        const messages = pendingState.messages
        const nextLast = messages[messages.length - 1] || {}
        const shouldScroll = !options.fromPolling
        this.setData({
          conversation,
          supportStatusText: supportStatusText(conversation),
          messages,
          loadError: '',
          scrollIntoView: shouldScroll && nextLast.anchorId ? nextLast.anchorId : ''
        })
        if (!options.fromPolling) {
          this.revealMessagesAfterLoad()
        }
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
      }
    })
  },

  handleInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  handleMessageScroll() {
    if (this.data.scrollIntoView) {
      this.setData({ scrollIntoView: '' })
    }
  },

  handleQuickQuestion(e) {
    const content = `${e.currentTarget.dataset.content || ''}`.trim()
    if (!content || this.data.sending || this.sendingLock) return
    this.sendMessage(content)
  },

  async resolveManualActiveForSend() {
    if (isManualConversation(this.data.conversation)) {
      return true
    }
    try {
      const response = await fetchSupportConversation()
      const conversation = response.data || {}
      this.setData({
        conversation,
        supportStatusText: supportStatusText(conversation)
      })
      return isManualConversation(conversation)
    } catch (error) {
      return false
    }
  },

  async sendMessage(contentOverride) {
    const content = `${typeof contentOverride === 'string' ? contentOverride : (this.data.inputText || '')}`.trim()
    if (!content || this.data.sending || this.sendingLock) return
    this.sendingLock = true
    const manualActive = await this.resolveManualActiveForSend()
    const previousMessages = this.data.messages
    const [userMessage, typingMessage] = createPendingMessages(content, this.getUserAvatarSrc())
    const waitForAi = !manualActive && !isManualRequest(content)
    this.pendingReplyContent = waitForAi ? content : ''
    this.setData({
      sending: true,
      inputText: '',
      messages: previousMessages.concat(waitForAi ? [userMessage, typingMessage] : [userMessage]),
      messagesReady: true,
      scrollIntoView: waitForAi ? typingMessage.anchorId : userMessage.anchorId
    })
    try {
      await sendSupportMessage(content)
      await this.refreshSupport()
    } catch (error) {
      this.pendingReplyContent = ''
      this.setData({
        inputText: content,
        messages: previousMessages,
        scrollIntoView: previousMessages.length ? previousMessages[previousMessages.length - 1].anchorId : ''
      })
      wx.showToast({
        title: (error && error.message) || '发送失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.sendingLock = false
      this.setData({ sending: false })
    }
  }
})
