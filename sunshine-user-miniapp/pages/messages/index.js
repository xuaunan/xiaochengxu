const { fetchMessages } = require('../../utils/api')

Page({
  data: {
    list: []
  },

  async onShow() {
    const cachedMessages = getApp().globalData.userStore.messages || []
    this.setData({
      list: cachedMessages
    })
    try {
      const response = await fetchMessages()
      const remoteMessages = response.data || []
      getApp().globalData.userStore.messages = remoteMessages
      getApp().saveUserStore()
      this.setData({
        list: remoteMessages
      })
    } catch (error) {
      wx.showToast({
        title: '消息同步失败，请确认本地后端已启动',
        icon: 'none'
      })
    }
  }
})
