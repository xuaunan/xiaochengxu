const {
  cancelCarpoolApplication,
  fetchMyCarpool,
  passengerConfirmCarpool
} = require('../../utils/api')
const { formatMyCarpool } = require('../../utils/carpool')

Page({
  data: {
    tabs: [
      { key: 'pending', label: '待确认' },
      { key: 'upcoming', label: '待出发' },
      { key: 'processing', label: '行程中' },
      { key: 'completed', label: '已完成' }
    ],
    active: 'pending',
    list: [],
    allList: [],
    summary: {
      ownerTripTotal: 0,
      passengerTripTotal: 0,
      pendingTotal: 0,
      upcomingTotal: 0,
      processingTotal: 0,
      completedTotal: 0
    },
    submitting: false
  },

  async onShow() {
    await this.loadTrips()
  },

  async loadTrips() {
    const response = await fetchMyCarpool()
    const payload = formatMyCarpool(response.data || {})
    const defaultActive = this.pickDefaultTab(payload.summary)
    this.setData({
      active: defaultActive,
      allList: payload.allList,
      summary: payload.summary
    })
    this.applyFilter()
  },

  pickDefaultTab(summary = {}) {
    if (summary.pendingTotal > 0) return 'pending'
    if (summary.upcomingTotal > 0) return 'upcoming'
    if (summary.processingTotal > 0) return 'processing'
    return 'completed'
  },

  chooseTab(e) {
    this.setData({ active: e.currentTarget.dataset.key })
    this.applyFilter()
  },

  applyFilter() {
    const list = (this.data.allList || []).filter((item) => {
      return item.statusBucket === this.data.active
    })
    this.setData({ list })
  },

  openDetail(e) {
    wx.navigateTo({
      url: `/pages/carpool-detail/index?id=${e.currentTarget.dataset.id}`
    })
  },

  async handleAction(e) {
    const { type, id, applicationId } = e.currentTarget.dataset
    if (!type) return
    if (type === 'detail') {
      this.openDetail({ currentTarget: { dataset: { id } } })
      return
    }
    if (this.data.submitting || !applicationId) return
    this.setData({ submitting: true })
    try {
      if (type === 'confirm') {
        await passengerConfirmCarpool({
          applicationId: Number(applicationId),
          action: 'CONFIRM',
          note: '乘客已确认同行'
        })
        wx.showToast({ title: '已确认同行', icon: 'success' })
      } else if (type === 'cancel') {
        await cancelCarpoolApplication({
          applicationId: Number(applicationId),
          reason: '用户在我的顺风车中主动取消'
        })
        wx.showToast({ title: '已取消申请', icon: 'success' })
      }
      await this.loadTrips()
    } finally {
      this.setData({ submitting: false })
    }
  }
})
