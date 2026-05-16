const { fetchOrderDetail, submitEvaluation } = require('../../utils/api')
const { buildReviewRecord } = require('../../utils/user-store')

Page({
  data: {
    order: null,
    score: 5,
    scoreOptions: [1, 2, 3, 4, 5],
    tags: [
      { label: '准时到达', active: true },
      { label: '驾驶平稳', active: false },
      { label: '服务热情', active: false },
      { label: '车内整洁', active: true },
      { label: '路线合理', active: false }
    ],
    content: '',
    anonymous: false
  },

  async onLoad(options) {
    const orderId = options.id || getApp().globalData.userStore.currentRideOrder.id
    const response = await fetchOrderDetail(orderId)
    this.setData({
      order: response.data
    })
  },

  chooseScore(e) {
    this.setData({
      score: Number(e.currentTarget.dataset.score)
    })
  },

  toggleTag(e) {
    const label = e.currentTarget.dataset.tag
    this.setData({
      tags: this.data.tags.map((item) => (item.label === label ? { ...item, active: !item.active } : item))
    })
  },

  updateContent(e) {
    this.setData({
      content: e.detail.value
    })
  },

  toggleAnonymous(e) {
    this.setData({
      anonymous: e.detail.value
    })
  },

  async submitReview() {
    const content = this.data.content || '司机服务专业，整体体验很好。'
    await submitEvaluation({
      orderId: this.data.order.id,
      score: this.data.score,
      content
    })
    const app = getApp()
    app.globalData.userStore.rideReviews.unshift(
      buildReviewRecord(
        this.data.order,
        this.data.score,
        content,
        this.data.tags.filter((item) => item.active).map((item) => item.label),
        this.data.anonymous
      )
    )
    app.setCurrentRideOrder(null)
    app.saveUserStore()
    wx.showToast({
      title: '评价提交成功',
      icon: 'success'
    })
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/orders/index'
      })
    }, 360)
  }
})
