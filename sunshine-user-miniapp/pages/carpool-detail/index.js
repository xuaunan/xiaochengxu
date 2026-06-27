const {
  cancelCarpoolApplication,
  fetchCarpoolDetail,
  ownerConfirmCarpool,
  passengerConfirmCarpool
} = require('../../utils/api')
const { formatCarpoolDetail } = require('../../utils/carpool')
const { navigateToSilky } = require('../../utils/page')

Page({
  data: {
    tripId: '',
    detail: null,
    loading: false,
    loadError: '',
    submitting: false
  },

  async onLoad(options) {
    this.setData({ tripId: options.id || '' })
    await this.loadDetail()
  },

  async loadDetail() {
    if (!this.data.tripId) {
      this.setData({
        loading: false,
        loadError: '行程信息缺失，请返回后重试'
      })
      return
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const response = await fetchCarpoolDetail(this.data.tripId)
      this.setData({
        detail: formatCarpoolDetail(response.data || {})
      })
    } catch (error) {
      this.setData({
        loadError: (error && error.message) || '行程加载失败，请稍后重试'
      })
      wx.showToast({
        title: '行程加载失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async withSubmitting(task) {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      await task()
      await this.loadDetail()
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '操作失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  applyRide() {
    const trip = this.data.detail && this.data.detail.trip
    if (!trip || !trip.canApply) {
      wx.showToast({ title: '当前行程暂不可申请', icon: 'none' })
      return
    }
    navigateToSilky(this, {
      url: `/pages/carpool-apply/index?id=${trip.id}`
    })
  },

  async confirmPassenger() {
    const myApplication = this.data.detail && this.data.detail.myApplication
    if (!myApplication || !myApplication.canPassengerConfirm) return
    await this.withSubmitting(async () => {
      await passengerConfirmCarpool({
        applicationId: myApplication.id,
        action: 'CONFIRM',
        note: '乘客已确认同行'
      })
      wx.showToast({ title: '已确认同行', icon: 'success' })
    })
  },

  async cancelApplication(e) {
    const applicationId = e.currentTarget.dataset.id
    if (!applicationId) return
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '取消申请',
        content: '取消后会释放座位名额，可再次搜索其他顺风车行程。',
        success: (res) => resolve(res.confirm)
      })
    })
    if (!confirmed) return
    await this.withSubmitting(async () => {
      await cancelCarpoolApplication({
        applicationId: Number(applicationId),
        reason: '用户主动取消拼车申请'
      })
      wx.showToast({ title: '已取消申请', icon: 'success' })
    })
  },

  async handleOwnerAction(e) {
    const { id, action } = e.currentTarget.dataset
    if (!id || !action) return
    const isReject = action === 'REJECT'
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: isReject ? '拒绝申请' : '确认同行',
        content: isReject ? '拒绝后会自动释放该乘客占用的座位。' : '确认后将等待乘客最终确认。',
        success: (res) => resolve(res.confirm)
      })
    })
    if (!confirmed) return
    await this.withSubmitting(async () => {
      await ownerConfirmCarpool({
        applicationId: Number(id),
        action,
        note: isReject ? '车主暂时不便同行' : '车主已确认同行'
      })
      wx.showToast({ title: isReject ? '已拒绝申请' : '已确认乘客', icon: 'success' })
    })
  }
})
