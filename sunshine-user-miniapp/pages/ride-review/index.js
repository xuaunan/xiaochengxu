const { fetchOrderDetail, submitEvaluation } = require('../../utils/api')
const { buildReviewRecord } = require('../../utils/user-store')
const { switchTabSilky } = require('../../utils/page')

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
    loadError: '',
    submitting: false,
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
    const currentOrder = getApp().globalData.userStore.currentRideOrder || {}
    const orderId = options.id || currentOrder.id || ''
    this.setData({ orderId })
    await this.loadOrder()
  },

  async loadOrder() {
    if (!this.data.orderId) {
      this.setData({
        loading: false,
        loadError: '订单信息缺失，请返回订单中心重试'
      })
      return
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const response = await fetchOrderDetail(this.data.orderId)
      this.setData({
        order: response.data || null
      })
    } catch (error) {
      this.setData({
        loadError: (error && error.message) || '订单加载失败，请稍后重试'
      })
      wx.showToast({
        title: '订单加载失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
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
    if (this.data.submitting) return
    if (!this.data.order || !this.data.order.id) {
      wx.showToast({ title: '订单未加载完成，请稍后重试', icon: 'none' })
      return
    }
    const content = this.data.content || '司机服务专业，整体体验很好。'
    this.setData({ submitting: true })
    try {
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
        switchTabSilky(this, {
          url: '/pages/orders/index'
        })
      }, 360)
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '评价提交失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
