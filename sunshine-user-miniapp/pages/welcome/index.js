const { navigateToSilky, redirectToSilky } = require('../../utils/page')

Page({
  data: {
    couponCount: 3
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

  claimWelcomePack() {
    const app = getApp()
    app.globalData.userStore.hasSeenWelcome = true
    app.saveUserStore()
    navigateToSilky(this, {
      url: '/pages/login/index'
    }, {
      selector: '.welcome-page'
    })
  }
})
