const { fetchOrders, fetchProfile } = require('../../utils/api')
const { getAuthStatusLabel } = require('../../utils/constants')
const { buildWalletView, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    profile: {},
    wallet: {},
    logoutText: '\u9000\u51fa\u767b\u5f55',
    verifiedText: '\u5f85\u5b9e\u540d\u8ba4\u8bc1',
    menus: [
      { iconClass: 'user', title: '\u4e2a\u4eba\u8d44\u6599', url: '/pages/profileEdit/index', desc: '\u4fee\u6539\u6635\u79f0\u3001\u771f\u5b9e\u59d3\u540d\u548c\u7d27\u6025\u8054\u7cfb\u4eba' },
      { iconClass: 'shield', title: '\u5b9e\u540d\u8ba4\u8bc1', url: '/pages/auth/index', desc: '\u8eab\u4efd\u8ba4\u8bc1\u4e0e\u8d26\u53f7\u5b89\u5168' },
      { iconClass: 'wallet', title: '\u6211\u7684\u94b1\u5305', url: '/pages/wallet/index', desc: '\u4f59\u989d\u3001\u4f18\u60e0\u5238\u548c\u53d1\u7968\u6c47\u603b' },
      { iconClass: 'star', title: '\u8bc4\u4ef7\u7ba1\u7406', url: '/pages/reviews/index', desc: '\u67e5\u770b\u5386\u53f2\u8bc4\u4ef7\u4e0e\u53f8\u673a\u8bc4\u5206' },
      { iconClass: 'message', title: '\u6295\u8bc9\u5efa\u8bae', url: '/pages/complaint/index', desc: '\u63d0\u4ea4\u53cd\u9988\u5e76\u67e5\u770b\u5904\u7406\u8fdb\u5ea6' },
      { iconClass: 'bell', title: '\u6d88\u606f\u901a\u77e5', url: '/pages/messages/index', desc: '\u8ba2\u5355\u72b6\u6001\u3001\u4f18\u60e0\u5238\u548c\u516c\u544a\u63d0\u9192' },
      { iconClass: 'help', title: '\u5e2e\u52a9\u4e2d\u5fc3', url: '/pages/help/index', desc: '\u5e38\u89c1\u95ee\u9898\u4e0e\u6743\u9650\u8bbe\u7f6e' },
      { iconClass: 'settings', title: '\u7cfb\u7edf\u8bbe\u7f6e', url: '/pages/settings/index', desc: '\u8bed\u8a00\u3001\u63a8\u9001\u548c\u9690\u79c1\u8bbe\u7f6e' },
      { iconClass: 'invoice', title: '\u7535\u5b50\u53d1\u7968', url: '/pages/invoice/index', desc: '\u7533\u8bf7\u884c\u7a0b\u7535\u5b50\u53d1\u7968' }
    ]
  },

  logoutPending: false,

  async onShow() {
    this.renderCachedProfile()
    await this.refreshProfile()
  },

  renderCachedProfile() {
    const app = getApp()
    const profile = app.globalData.userStore.profile || {}
    const orders = app.globalData.userStore.orders || []

    this.setData({
      profile,
      wallet: buildWalletView(profile, app.globalData.userStore.coupons, orders),
      verifiedText: getAuthStatusLabel(profile.authStatus)
    })
  },

  async refreshProfile() {
    return runExclusive(this, '__refreshProfilePromise', async () => {
      const [profileResponse, ordersResponse] = await Promise.all([
        fetchProfile(),
        fetchOrders()
      ])
      const app = getApp()
      app.applyProfile(profileResponse.data || {})
      syncOrdersToCache(ordersResponse.data || [])
      this.renderCachedProfile()
    })
  },

  openMenu(e) {
    const { url } = e.currentTarget.dataset
    wx.navigateTo({ url })
  },

  openOrders() {
    wx.switchTab({ url: '/pages/orders/index' })
  },

  openCoupons() {
    wx.switchTab({ url: '/pages/coupon/index' })
  },

  handleLogout() {
    wx.showModal({
      title: '\u6e29\u99a8\u63d0\u793a',
      content: '\u786e\u5b9a\u8981\u9000\u51fa\u5f53\u524d\u8d26\u53f7\u5417\uff1f',
      cancelText: '\u53d6\u6d88',
      confirmText: '\u9000\u51fa',
      confirmColor: '#ff5b57',
      success: (res) => {
        if (!res.confirm || this.logoutPending) {
          return
        }

        this.logoutPending = true
        const app = getApp()
        if (app.clearSession) {
          app.clearSession()
        }
        wx.reLaunch({
          url: '/pages/login/index'
        })
      }
    })
  }
})
