const { createOrder } = require('../../utils/api')
const { SERVICE_TYPE } = require('../../utils/constants')
const {
  buildEstimateFromRoute,
  buildInternationalOptions,
  buildInternationalRemark,
  decorateCarType,
  getInternationalExchangeRate
} = require('../../utils/user-store')
const { POI_LIBRARY } = require('../../utils/catalog')

function findPoi(name) {
  return POI_LIBRARY.find((item) => item.name === name) || {
    name,
    address: name,
    latitude: 22.308,
    longitude: 113.9185
  }
}

Page({
  data: {
    option: null,
    estimate: {
      amountText: '$0.00',
      distanceText: '--',
      durationText: '--',
      rateText: '1 USD ≈ 7.15 CNY'
    },
    serviceItems: [],
    documentItems: [],
    form: {
      date: '2026-05-20',
      time: '09:00',
      passengerCount: 2,
      contactName: '张三',
      contactPhone: '13800000001',
      flightNo: '',
      luggageCount: 2,
      pickupSign: '阳光出行',
      note: '请司机协助搬运行李'
    }
  },

  onLoad(options) {
    const option = buildInternationalOptions().find((item) => item.id === options.id) || buildInternationalOptions()[0]
    this.setData({
      option,
      serviceItems: option.inclusions || [],
      documentItems: option.documents || []
    })
    this.refreshEstimate(option)
  },

  updateField(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  async submitOrder() {
    if (!this.data.form.contactName || !this.data.form.contactPhone) {
      wx.showToast({ title: '请填写联系人和电话', icon: 'none' })
      return
    }
    const app = getApp()
    const carType = decorateCarType((app.globalData.userStore.home.carTypes || [])[2] || {
      id: 3,
      crossBorderBasePrice: 260,
      startDistanceKm: 3,
      distancePrice: 4.2,
      durationPrice: 0.75,
      longDistancePrice: 2.5,
      nightSurcharge: 12,
      name: '商务型'
    })
    const start = findPoi(this.data.option.startName)
    const end = findPoi(this.data.option.endName)
    const estimate = buildEstimateFromRoute(carType, SERVICE_TYPE.INTERNATIONAL, start, end, 0)
    const appointmentTime = `${this.data.form.date} ${this.data.form.time}:00`
    const exchangeRate = getInternationalExchangeRate()
    const remark = buildInternationalRemark({
      optionId: this.data.option.id,
      productName: this.data.option.titleZh,
      productNameEn: this.data.option.titleEn,
      appointmentTime,
      passengerCount: this.data.form.passengerCount,
      contactName: this.data.form.contactName,
      contactPhone: this.data.form.contactPhone,
      flightNo: this.data.form.flightNo,
      luggageCount: this.data.form.luggageCount,
      pickupSign: this.data.form.pickupSign,
      languageCode: 'zh-CN',
      currencyCode: 'USD',
      exchangeRate,
      serviceItems: this.data.serviceItems,
      documents: this.data.documentItems,
      riskNotice: '请提前确认通关证件、航班时间与目的地政策。'
    }, this.data.form.note)
    await createOrder({
      carTypeId: carType.id,
      serviceType: SERVICE_TYPE.INTERNATIONAL,
      startName: start.name,
      startLng: `${start.longitude}`,
      startLat: `${start.latitude}`,
      endName: end.name,
      endLng: `${end.longitude}`,
      endLat: `${end.latitude}`,
      estimatedDistanceKm: estimate.route.distanceKm,
      estimatedDurationMin: estimate.route.durationMin,
      dispatchMode: 'SMART',
      languageCode: 'zh-CN',
      currencyCode: 'USD',
      remark
    })
    wx.showToast({ title: '国际行程预约成功', icon: 'success' })
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/international-orders/index' })
    }, 300)
  },

  refreshEstimate(option = this.data.option) {
    const app = getApp()
    const carType = decorateCarType((app.globalData.userStore.home.carTypes || [])[2] || {
      id: 3,
      crossBorderBasePrice: 260,
      startDistanceKm: 3,
      distancePrice: 4.2,
      durationPrice: 0.75,
      longDistancePrice: 2.5,
      nightSurcharge: 12,
      name: '商务型'
    })
    const start = findPoi(option.startName)
    const end = findPoi(option.endName)
    const estimate = buildEstimateFromRoute(carType, SERVICE_TYPE.INTERNATIONAL, start, end, 0)
    this.setData({
      estimate: {
        amountText: `$${estimate.payable.toFixed(2)}`,
        distanceText: `${estimate.route.distanceKm.toFixed(1)} km`,
        durationText: `${Math.round(estimate.route.durationMin)} min`,
        rateText: `1 USD ≈ ${getInternationalExchangeRate().toFixed(2)} CNY`
      }
    })
  }
})
