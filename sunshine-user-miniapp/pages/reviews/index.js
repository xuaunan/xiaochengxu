const { fetchOrders } = require('../../utils/api')
const { buildReviewListFromOrders, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive, switchTabSilky } = require('../../utils/page')

Page({
  data: {
    list: [],
    loading: false,
    errorText: ''
  },

  async onShow() {
    this.renderCachedReviews()
    await this.refreshReviews().catch(() => {})
  },

  renderCachedReviews() {
    this.setData({
      list: buildReviewListFromOrders(getApp().globalData.userStore.orders || [])
    })
  },

  async refreshReviews() {
    return runExclusive(this, '__refreshReviewPromise', async () => {
      this.setData({
        loading: !this.data.list.length,
        errorText: ''
      })
      try {
        const response = await fetchOrders()
        syncOrdersToCache(response.data || [])
        this.renderCachedReviews()
        this.setData({
          loading: false,
          errorText: ''
        })
      } catch (error) {
        this.setData({
          loading: false,
          errorText: (error && error.message) || '评价记录加载失败，请稍后重试'
        })
        wx.showToast({
          title: '评价记录加载失败，请稍后重试',
          icon: 'none'
        })
        throw error
      }
    })
  },

  jumpToOrders() {
    switchTabSilky(this, { url: '/pages/orders/index' })
  },

  retryRefresh() {
    this.refreshReviews().catch(() => {})
  }
})
