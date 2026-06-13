const { publishCarpool } = require('../../utils/api')
const { joinDateTime, splitDateTime } = require('../../utils/format')
const { redirectToSilky } = require('../../utils/page')

Page({
  data: {
    form: {
      startName: '陆家嘴中心',
      endName: '上海交通大学闵行校区',
      departDate: '2026-04-20',
      departTime: '07:40',
      seats: 3,
      price: 39,
      baggageRule: '20 寸行李箱 1 件',
      remark: '支持工作日通勤拼车，准点发车'
    },
    submitting: false
  },

  onLoad(options) {
    const nextForm = { ...this.data.form }
    if (options.startName) nextForm.startName = decodeURIComponent(options.startName)
    if (options.endName) nextForm.endName = decodeURIComponent(options.endName)
    if (options.departTime) {
      const { date, time } = splitDateTime(decodeURIComponent(options.departTime))
      nextForm.departDate = date
      nextForm.departTime = time
    }
    this.setData({ form: nextForm })
  },

  updateField(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  chooseDepartDate(e) {
    this.setData({
      'form.departDate': e.detail.value
    })
  },

  chooseDepartTime(e) {
    this.setData({
      'form.departTime': e.detail.value
    })
  },

  async submitTrip() {
    if (this.data.submitting) return
    const departTime = joinDateTime(this.data.form.departDate, this.data.form.departTime)
    if (!departTime) {
      wx.showToast({ title: '请选择出发时间', icon: 'none' })
      return
    }
    if (!this.data.form.startName || !this.data.form.endName) {
      wx.showToast({ title: '请补充起终点信息', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await publishCarpool({
        startName: this.data.form.startName,
        endName: this.data.form.endName,
        departTime,
        seatCount: Number(this.data.form.seats),
        sharedAmount: Number(this.data.form.price),
        baggageRule: this.data.form.baggageRule,
        tripRemark: this.data.form.remark
      })
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        redirectToSilky(this, { url: '/pages/carpool-trips/index' })
      }, 320)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
