const { fetchOrders } = require('../../utils/api')
const { buildReviewListFromOrders, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    list: []
  },

  async onShow() {
    this.renderCachedReviews()
    await this.refreshReviews()
  },

  renderCachedReviews() {
    this.setData({
      list: buildReviewListFromOrders(getApp().globalData.userStore.orders || [])
    })
  },

  async refreshReviews() {
    return runExclusive(this, '__refreshReviewPromise', async () => {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
      this.renderCachedReviews()
    })
  },

  jumpToOrders() {
    wx.switchTab({ url: '/pages/orders/index' })
  }
})
