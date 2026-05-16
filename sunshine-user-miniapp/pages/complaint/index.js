const { fetchOrderDetail, submitComplaint: submitComplaintRequest } = require('../../utils/api')
const { buildComplaintRecord } = require('../../utils/user-store')

Page({
  data: {
    order: null,
    content: '',
    history: []
  },

  async onLoad(options) {
    if (options.id) {
      const response = await fetchOrderDetail(options.id)
      this.setData({
        order: response.data
      })
    }
  },

  onShow() {
    this.setData({
      history: getApp().globalData.userStore.complaints
    })
  },

  updateContent(e) {
    this.setData({ content: e.detail.value })
  },

  async submitComplaint() {
    if (!this.data.order) {
      wx.showToast({ title: '请从订单详情进入投诉页', icon: 'none' })
      return
    }
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    await submitComplaintRequest({
      orderId: this.data.order.id,
      complaintType: 'SERVICE',
      content: this.data.content.trim()
    })
    const app = getApp()
    app.globalData.userStore.complaints.unshift(buildComplaintRecord(this.data.order, this.data.content.trim()))
    app.saveUserStore()
    this.setData({
      content: '',
      history: app.globalData.userStore.complaints
    })
    wx.showToast({ title: '投诉已提交', icon: 'success' })
  }
})
