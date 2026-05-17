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
    this.updateSetting(key, !this.data.settings[key])
  },

  changeSetting(e) {
    const key = e.currentTarget.dataset.key
    this.updateSetting(key, Boolean(e.detail.value))
  },

  noop() {},

  updateSetting(key, value) {
    if (!key) return
    const settings = {
      ...this.data.settings,
      [key]: value
    }
    this.setData({ settings })
    getApp().globalData.userStore.settings = settings
    getApp().saveUserStore()
  }
})
