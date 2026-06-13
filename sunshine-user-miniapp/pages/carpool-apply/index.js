const { applyCarpool, fetchCarpoolDetail } = require('../../utils/api')
const { formatCarpoolDetail } = require('../../utils/carpool')
const { formatPrice } = require('../../utils/format')
const { redirectToSilky } = require('../../utils/page')

Page({
  data: {
    tripId: '',
    trip: null,
    companions: 1,
    note: '',
    totalPriceText: formatPrice(0),
    submitting: false
  },

  async onLoad(options) {
    this.setData({
      tripId: options.id || ''
    })
    await this.loadTrip()
  },

  async loadTrip() {
    if (!this.data.tripId) return
    const response = await fetchCarpoolDetail(this.data.tripId)
    const detail = formatCarpoolDetail(response.data || {})
    this.setData({
      trip: detail.trip,
      totalPriceText: formatPrice(Number(detail.trip.price || 0) * Number(this.data.companions || 1))
    })
  },

  decreaseCompanions() {
    const nextCompanions = Math.max(1, Number(this.data.companions || 1) - 1)
    this.setData({
      companions: nextCompanions,
      totalPriceText: formatPrice(Number(this.data.trip && this.data.trip.price || 0) * nextCompanions)
    })
  },

  increaseCompanions() {
    const maxCount = Math.max(1, Number(this.data.trip && this.data.trip.remainSeatCount) || 1)
    const nextCompanions = Math.min(maxCount, Number(this.data.companions || 1) + 1)
    this.setData({
      companions: nextCompanions,
      totalPriceText: formatPrice(Number(this.data.trip && this.data.trip.price || 0) * nextCompanions)
    })
  },

  updateNote(e) {
    this.setData({ note: e.detail.value })
  },

  async submitApply() {
    if (this.data.submitting || !this.data.trip) return
    this.setData({ submitting: true })
    try {
      await applyCarpool({
        tripId: Number(this.data.tripId),
        companionCount: Math.max(Number(this.data.companions) - 1, 0),
        note: this.data.note
      })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => {
        redirectToSilky(this, { url: '/pages/carpool-trips/index' })
      }, 300)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
