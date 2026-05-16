Page({
  data: {
    settings: {}
  },

  onShow() {
    this.setData({
      settings: getApp().globalData.userStore.settings
    })
  },

  toggleSetting(e) {
    const key = e.currentTarget.dataset.key
    const settings = {
      ...this.data.settings,
      [key]: !this.data.settings[key]
    }
    this.setData({ settings })
    getApp().globalData.userStore.settings = settings
    getApp().saveUserStore()
  }
})
