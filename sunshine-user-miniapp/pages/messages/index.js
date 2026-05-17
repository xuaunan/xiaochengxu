const { fetchMessages } = require('../../utils/api')

function formatMessageTime(value = '') {
  const text = `${value || ''}`.trim()
  const match = text.match(/(\d{2})-(\d{2})[ T](\d{2}:\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]} ${match[3]}`
  }
  return text
}

function inferIconClass(message = {}) {
  const text = `${message.title || ''} ${message.content || ''} ${message.type || ''}`
  if (/取消/.test(text)) return 'cancel'
  if (/创建|提交/.test(text)) return 'order'
  if (/支付|付款/.test(text)) return 'paid'
  if (/结束|完成/.test(text)) return 'finish'
  if (/开始|上车/.test(text)) return 'start'
  if (/接驾|前往/.test(text)) return 'car'
  if (/司机|接单/.test(text)) return 'driver'
  return 'notice'
}

function mapMessageView(message = {}) {
  return {
    ...message,
    iconClass: inferIconClass(message),
    displayTime: formatMessageTime(message.time || message.createdAt)
  }
}

Page({
  data: {
    list: []
  },

  async onShow() {
    const cachedMessages = getApp().globalData.userStore.messages || []
    this.setData({
      list: cachedMessages.map(mapMessageView)
    })
    try {
      const response = await fetchMessages()
      const remoteMessages = response.data || []
      getApp().globalData.userStore.messages = remoteMessages
      getApp().saveUserStore()
      this.setData({
        list: remoteMessages.map(mapMessageView)
      })
    } catch (error) {
      wx.showToast({
        title: '消息同步失败，请确认本地后端已启动',
        icon: 'none'
      })
    }
  }
})
