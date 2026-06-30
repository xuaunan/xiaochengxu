const { fetchSupportConversation, fetchSupportMessages, sendSupportMessage } = require('../../utils/api')
const { DRIVER_AVATAR_FALLBACK, buildStaticUrl } = require('../../utils/media')

const SUPPORT_AVATAR = '/images/support-avatar.png'
const SUPPORT_WELCOME_MESSAGE = '您好，阳光出行客服已接入，请描述您遇到的问题。'
const PREVIOUS_SUPPORT_WELCOME_MESSAGE = '您好，阳光出行AI客服已接入，请描述您遇到的问题。'
const MANUAL_TRANSFER_REPLY = '正在为您转接人工客服，请稍后'
const MANUAL_OPEN_NOTICE = '已接入人工客服'

function normalizeSupportWelcomeContent(content) {
  return content === PREVIOUS_SUPPORT_WELCOME_MESSAGE ? SUPPORT_WELCOME_MESSAGE : content
}

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
  const senderRoleText = isSelf ? '司机端' : (message.systemNotice ? '系统' : (message.fromAdmin ? '人工客服' : 'AI客服'))
  return {
    ...message,
    content,
    isSelf,
    senderName,
    senderRoleText,
    avatarSrc: isSelf ? (options.userAvatarSrc || DRIVER_AVATAR_FALLBACK) : SUPPORT_AVATAR,
    avatarText: isSelf ? '我' : '阳',
    anchorId: `support-msg-${message.id || index}`,
    displayContent: formatSupportMessageContent(content, message),
    timeText: formatDateTime(message.createdAt)
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

function isManualRequest(content) {
  const normalized = `${content || ''}`.replace(/\s+/g, '')
  return normalized.includes('联系人工')
    || normalized.includes('人工客服')
    || normalized.includes('转人工')
    || normalized.includes('找人工')
    || normalized.includes('真人客服')
    || normalized.includes('转接人工')
}

function pendingReplyText(content) {
  return isManualRequest(content) ? MANUAL_TRANSFER_REPLY : 'AI回复中...'
}

function createPendingMessages(content, userAvatarSrc, replyContent = 'AI回复中...') {
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
    content: replyContent,
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
  const [, typingMessage] = createPendingMessages(content, userAvatarSrc, pendingReplyText(content))
  return { messages: messages.concat(typingMessage), pending: true }
}

function isManualTransferReply(message = {}) {
  return message.fromAi && `${message.content || ''}`.trim() === MANUAL_TRANSFER_REPLY
}

function isManualOpenNotice(message = {}) {
  return message.systemNotice && `${message.content || ''}`.trim() === MANUAL_OPEN_NOTICE
}

function prepareDisplayMessages(messages = []) {
  return messages.reduce((result, message, index) => {
    if (isManualTransferReply(message)) {
      const hasManualOpenAfter = messages.slice(index + 1).some(isManualOpenNotice)
      const hasManualTransferAfter = messages.slice(index + 1).some(isManualTransferReply)
      if (hasManualOpenAfter) return result
      if (hasManualTransferAfter) return result
      result.push({
        ...message,
        isTyping: true,
        senderRoleText: 'AI客服'
      })
      return result
    }
    result.push(message)
    return result
  }, [])
}

function hasPendingDisplayMessage(messages = []) {
  return messages.some((message) => message && message.isTyping)
}

function removePendingDisplayMessages(messages = []) {
  return messages.filter((message) => !(message && message.isTyping))
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
    quickQuestions: ['听单接单', '提现到账', '资质审核', '行程订单', '语音播报', '联系人工'],
    sending: false,
    loading: false,
    loadError: ''
  },

  supportTimer: null,
  messageRevealTimer: null,
  pendingReplyRefreshTimer: null,
  pendingReplyRefreshCount: 0,
  sendingLock: false,
  pendingReplyContent: '',
  supportSnapshotVersion: 0,

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
    this.clearPendingReplyRefreshTimer()
  },

  onUnload() {
    this.stopPolling()
    this.clearMessageRevealTimer()
    this.clearPendingReplyRefreshTimer()
  },

  clearMessageRevealTimer() {
    if (this.messageRevealTimer) {
      clearTimeout(this.messageRevealTimer)
      this.messageRevealTimer = null
    }
  },

  clearPendingReplyRefreshTimer() {
    if (this.pendingReplyRefreshTimer) {
      clearTimeout(this.pendingReplyRefreshTimer)
      this.pendingReplyRefreshTimer = null
    }
  },

  schedulePendingReplyRefresh() {
    this.clearPendingReplyRefreshTimer()
    if (this.pendingReplyRefreshCount >= 24) return
    const delay = this.pendingReplyRefreshCount < 8 ? 1200 : 2400
    this.pendingReplyRefreshCount += 1
    this.pendingReplyRefreshTimer = setTimeout(() => {
      this.pendingReplyRefreshTimer = null
      this.refreshSupport({ force: true, fromPendingWatch: true }).catch(() => {
        this.schedulePendingReplyRefresh()
      })
    }, delay)
  },

  syncPendingReplyRefresh(messages) {
    if (hasPendingDisplayMessage(messages)) {
      this.schedulePendingReplyRefresh()
      return
    }
    this.pendingReplyRefreshCount = 0
    this.clearPendingReplyRefreshTimer()
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
    const profile = (app.globalData.driverStore && app.globalData.driverStore.profile) || {}
    return buildStaticUrl(app.globalData.baseUrl, profile.avatar || DRIVER_AVATAR_FALLBACK) || DRIVER_AVATAR_FALLBACK
  },

  async refreshSupport(options = {}) {
    const snapshotVersion = this.supportSnapshotVersion
    if (options.fromPolling && this.data.sending) return
    if (this.__refreshingSupport && !options.force) return
    this.__refreshingSupport = true
    if (!options.fromPolling && !this.data.messages.length) {
      this.setData({ loading: true, loadError: '' })
    }
    try {
      const { conversationResponse, messageResponse } = await fetchSupportSnapshot()
      if (options.fromPolling && (snapshotVersion !== this.supportSnapshotVersion || this.data.sending || this.sendingLock)) {
        return
      }
      const userAvatarSrc = this.getUserAvatarSrc()
      const conversation = conversationResponse.data || {}
      const serverMessages = normalizeMessageList(messageResponse.data).map((item, index) => decorateMessage(item, index, { userAvatarSrc }))
      const pendingState = isManualConversation(conversation)
        ? { messages: serverMessages, pending: false }
        : appendPendingReplyIfNeeded(serverMessages, this.pendingReplyContent, userAvatarSrc)
      if (this.pendingReplyContent && !pendingState.pending) {
        this.pendingReplyContent = ''
      }
      const messages = prepareDisplayMessages(pendingState.messages)
      const nextLast = messages[messages.length - 1] || {}
      const shouldScroll = !options.fromPolling
      this.syncPendingReplyRefresh(messages)
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
      this.__refreshingSupport = false
    }
  },

  applySupportSnapshot(payload, options = {}) {
    const snapshot = payload && payload.data ? payload.data : payload
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.messages)) {
      return false
    }
    const userAvatarSrc = this.getUserAvatarSrc()
    const conversation = snapshot.conversation || this.data.conversation || {}
    const serverMessages = normalizeMessageList(snapshot.messages).map((item, index) => decorateMessage(item, index, { userAvatarSrc }))
    const pendingState = isManualConversation(conversation)
      ? { messages: serverMessages, pending: false }
      : appendPendingReplyIfNeeded(serverMessages, this.pendingReplyContent, userAvatarSrc)
    if (this.pendingReplyContent && !pendingState.pending) {
      this.pendingReplyContent = ''
    }
    const messages = prepareDisplayMessages(pendingState.messages)
    const nextLast = messages[messages.length - 1] || {}
    this.syncPendingReplyRefresh(messages)
    this.setData({
      conversation,
      supportStatusText: supportStatusText(conversation),
      messages,
      messagesReady: true,
      loadError: '',
      scrollIntoView: options.scroll !== false && nextLast.anchorId ? nextLast.anchorId : ''
    })
    return true
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
    this.supportSnapshotVersion += 1
    const manualActive = await this.resolveManualActiveForSend()
    const previousMessages = removePendingDisplayMessages(this.data.messages)
    const userAvatarSrc = this.getUserAvatarSrc()
    const [userMessage, typingMessage] = createPendingMessages(content, userAvatarSrc, pendingReplyText(content))
    const waitForAi = !manualActive
    const nextMessages = waitForAi ? [userMessage, typingMessage] : [userMessage]
    const nextLastMessage = nextMessages[nextMessages.length - 1]
    this.pendingReplyContent = waitForAi ? content : ''
    this.pendingReplyRefreshCount = waitForAi ? 0 : this.pendingReplyRefreshCount
    this.setData({
      sending: true,
      inputText: '',
      messages: previousMessages.concat(nextMessages),
      messagesReady: true,
      scrollIntoView: nextLastMessage.anchorId
    })
    if (waitForAi) {
      this.schedulePendingReplyRefresh()
    }
    try {
      const response = await sendSupportMessage(content)
      if (!this.applySupportSnapshot(response, { scroll: true })) {
        await this.refreshSupport({ force: true })
      }
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
