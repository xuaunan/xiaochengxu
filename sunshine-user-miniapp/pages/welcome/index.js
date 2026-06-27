const { navigateToSilky, redirectToSilky } = require('../../utils/page')

Page({
  data: {
    couponCount: 3,
    claiming: false
  },

  onShow() {
    const app = getApp()
    if (app.globalData.userStore.hasSeenWelcome) {
      redirectToSilky(this, {
        url: '/pages/login/index'
      }, {
        selector: '.welcome-page'
      })
    }
  },

  async claimWelcomePack() {
    if (this.data.claiming) return
    this.setData({ claiming: true })
    const app = getApp()
    app.globalData.userStore.hasSeenWelcome = true
    app.saveUserStore()
    try {
      await navigateToSilky(this, {
        url: '/pages/login/index'
      }, {
        selector: '.welcome-page'
      })
    } catch (error) {
      this.setData({ claiming: false })
      wx.showToast({
        title: '进入失败，请稍后重试',
        icon: 'none'
      })
    }
  }
})
