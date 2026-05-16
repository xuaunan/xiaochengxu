const { fetchMessages } = require('../../utils/api')

Page({
  data: {
    list: []
  },

  async onShow() {
    const localMessages = getApp().globalData.driverStore.messages || []
    this.setData({
      list: localMessages
    })
    try {
      const response = await fetchMessages()
      const remoteMessages = response.data || []
      const remoteIds = new Set(remoteMessages.map((item) => `${item.id}`))
      this.setData({
        list: remoteMessages.concat(localMessages.filter((item) => !remoteIds.has(`${item.id}`)))
      })
    } catch (error) {
      wx.showToast({
        title: '消息同步失败，请确认本地后端已启动',
        icon: 'none'
      })
    }
  }
})
