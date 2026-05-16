Page({
  data: {
    couponCount: 3
  },

  onShow() {
    const app = getApp()
    if (app.globalData.userStore.hasSeenWelcome) {
      wx.redirectTo({
        url: '/pages/login/index'
      })
    }
  },

  claimWelcomePack() {
    const app = getApp()
    app.globalData.userStore.hasSeenWelcome = true
    app.saveUserStore()
    wx.navigateTo({
      url: '/pages/login/index'
    })
  }
})
