const { fetchOrderDetail, submitComplaint: submitComplaintRequest } = require('../../utils/api')
const { buildComplaintRecord } = require('../../utils/user-store')

const FEEDBACK_TYPES = [
  { label: '司机服务', value: 'SERVICE', desc: '迟到、态度、沟通、路线等' },
  { label: '费用争议', value: 'FEE', desc: '金额、优惠券、发票等' },
  { label: '车辆问题', value: 'VEHICLE', desc: '车况、卫生、车牌不符等' },
  { label: '产品建议', value: 'PRODUCT', desc: '功能体验、页面问题等' }
]

function findFeedbackType(value) {
  return FEEDBACK_TYPES.find((item) => item.value === value) || FEEDBACK_TYPES[0]
}

function buildOrderContext(order) {
  if (!order) {
    return {
      orderNoText: '',
      orderRouteText: ''
    }
  }
  const startName = order.startName || (order.start && order.start.name) || ''
  const endName = order.endName || (order.end && order.end.name) || ''
  return {
    orderNoText: order.orderNo || order.id || '',
    orderRouteText: startName && endName ? `${startName} 至 ${endName}` : ''
  }
}

Page({
  data: {
    order: null,
    orderNoText: '',
    orderRouteText: '',
    content: '',
    history: [],
    feedbackTypes: FEEDBACK_TYPES,
    activeType: FEEDBACK_TYPES[0].value,
    feedbackHint: FEEDBACK_TYPES[0].desc,
    submitting: false
  },

  async onLoad(options) {
    if (options.id) {
      try {
        const response = await fetchOrderDetail(options.id)
        const order = response.data
        this.setData({
          order,
          ...buildOrderContext(order)
        })
      } catch (error) {
        console.warn('Failed to load complaint order detail', error)
        wx.showToast({ title: '订单信息加载失败', icon: 'none' })
      }
    }
  },

  onShow() {
    this.setData({
      history: getApp().globalData.userStore.complaints || []
    })
  },

  updateContent(e) {
    this.setData({ content: e.detail.value })
  },

  chooseFeedbackType(e) {
    const activeType = e.currentTarget.dataset.value
    const feedbackType = findFeedbackType(activeType)
    this.setData({
      activeType,
      feedbackHint: feedbackType.desc
    })
  },

  async submitComplaint() {
    if (this.data.submitting) return
    if (!this.data.order) {
      wx.showToast({ title: '请从订单详情进入投诉页', icon: 'none' })
      return
    }
    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    const feedbackType = findFeedbackType(this.data.activeType)
    this.setData({ submitting: true })
    try {
      await submitComplaintRequest({
        orderId: this.data.order.id,
        complaintType: feedbackType.value,
        content
      })
      const app = getApp()
      const record = {
        ...buildComplaintRecord(this.data.order, content),
        typeText: feedbackType.label,
        routeText: this.data.orderRouteText
      }
      app.globalData.userStore.complaints.unshift(record)
      app.saveUserStore()
      this.setData({
        content: '',
        history: app.globalData.userStore.complaints
      })
      wx.showToast({ title: '已提交给客服', icon: 'success' })
    } catch (error) {
      console.warn('Failed to submit complaint', error)
      wx.showToast({ title: '提交失败，请稍后再试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
