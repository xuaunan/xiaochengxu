const { fetchOrders, fetchProfile } = require('../../utils/api')
const { buildWalletView, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    wallet: {}
  },

  async onShow() {
    this.renderCachedWallet()
    await this.refreshWallet()
  },

  renderCachedWallet() {
    const app = getApp()
    this.setData({
      wallet: buildWalletView(app.globalData.userStore.profile || {}, app.globalData.userStore.coupons, app.globalData.userStore.orders || [])
    })
  },

  async refreshWallet() {
    return runExclusive(this, '__refreshWalletPromise', async () => {
      const [profileResponse, ordersResponse] = await Promise.all([
        fetchProfile(),
        fetchOrders()
      ])
      const app = getApp()
      app.applyProfile(profileResponse.data || {})
      syncOrdersToCache(ordersResponse.data || [])
      this.renderCachedWallet()
    })
  },

  recharge() {
    wx.showToast({ title: '后端暂未开放充值接口，当前展示余额与券额度', icon: 'none' })
  },

  withdraw() {
    wx.showToast({ title: '乘客端当前仅展示钱包信息', icon: 'none' })
  }
})
