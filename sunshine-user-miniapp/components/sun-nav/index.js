const { navigateBackSilky, switchTabSilky } = require('../../utils/page')

Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    subtitle: {
      type: String,
      value: ''
    },
    transparent: {
      type: Boolean,
      value: false
    },
    backable: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 20,
    navHeight: 44,
    sideWidth: 120
  },

  lifetimes: {
    attached() {
      const app = getApp()
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const sideWidth = menuButton
        ? Math.max(windowInfo.windowWidth - menuButton.left + 12, 120)
        : 120

      this.setData({
        statusBarHeight: windowInfo.statusBarHeight || 20,
        navHeight: menuButton ? Math.max(menuButton.height + 10, 44) : 44,
        sideWidth,
        brand: app.globalData.theme.brand
      })
    }
  },

  methods: {
    handleBack() {
      const pages = getCurrentPages()
      const activePage = pages[pages.length - 1] || null
      navigateBackSilky(activePage, {
        selector: '.home-page',
        fail: () => {
          switchTabSilky(activePage, {
            url: '/pages/home/index'
          }, {
            selector: '.home-page'
          })
        }
      })
    }
  }
})
