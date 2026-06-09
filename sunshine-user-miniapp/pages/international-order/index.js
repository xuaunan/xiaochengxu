const { createOrder } = require('../../utils/api')
const { SERVICE_TYPE } = require('../../utils/constants')
const {
  buildEstimateFromRoute,
  buildInternationalOptions,
  buildInternationalRemark,
  decorateCarType,
  getInternationalExchangeRate,
  syncOrderToCache
} = require('../../utils/user-store')
const { POI_LIBRARY } = require('../../utils/catalog')

function pad(value) {
  return `${value}`.padStart(2, '0')
}

function buildDefaultAppointment() {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(9, 0, 0, 0)
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: '09:00'
  }
}

function buildInitialForm() {
  const app = typeof getApp === 'function' ? getApp() : null
  const store = app && app.globalData ? app.globalData.userStore || {} : {}
  const profile = store.profile || {}
  const authAccount = app && app.globalData ? app.globalData.authAccount || {} : {}
  const loginInfo = app && app.globalData ? app.globalData.loginInfo || {} : {}
  const appointment = buildDefaultAppointment()
  const phone = profile.phone || authAccount.phone || loginInfo.phone || ''
  return {
    date: appointment.date,
    time: appointment.time,
    passengerCount: 1,
    contactName: profile.realName || (phone ? profile.nickname : '') || '',
    contactPhone: phone,
    flightNo: '',
    luggageCount: 1,
    pickupSign: '',
    note: ''
  }
}

function findPoi(name) {
  const displayName = `${name || ''}`.trim()
  const shortName = displayName.split(/[，,]/)[0].trim()
  const matched = POI_LIBRARY.find((item) => {
    return item.name === displayName ||
      item.name === shortName ||
      displayName.startsWith(item.name) ||
      item.name.startsWith(shortName)
  })
  if (matched) {
    return {
      ...matched,
      name: displayName || matched.name
    }
  }
  return {
    name: displayName,
    address: name,
    latitude: 22.308,
    longitude: 113.9185
  }
}

function normalizeForm(form = {}) {
  return {
    ...form,
    date: `${form.date || ''}`.trim(),
    time: `${form.time || ''}`.trim(),
    passengerCount: Number(form.passengerCount || 0),
    luggageCount: Number(form.luggageCount || 0),
    contactName: `${form.contactName || ''}`.trim(),
    contactPhone: `${form.contactPhone || ''}`.replace(/[^\d+]/g, '').trim(),
    flightNo: `${form.flightNo || ''}`.trim().toUpperCase(),
    pickupSign: `${form.pickupSign || ''}`.trim(),
    note: `${form.note || ''}`.trim()
  }
}

function validateForm(form = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
    return '请选择有效预约日期和时间'
  }
  if (form.passengerCount < 1 || form.passengerCount > 6) {
    return '乘车人数需在 1-6 人之间'
  }
  if (form.luggageCount < 0 || form.luggageCount > 20) {
    return '行李件数需在 0-20 件之间'
  }
  if (!form.contactName || !form.contactPhone) {
    return '请填写联系人和电话'
  }
  if (!/^\+?\d{6,20}$/.test(form.contactPhone)) {
    return '请填写有效联系电话'
  }
  return ''
}

Page({
  data: {
    option: null,
    submitting: false,
    estimate: {
      amountText: '$0.00',
      distanceText: '--',
      durationText: '--',
      rateText: '1 USD ≈ 7.15 CNY'
    },
    serviceItems: [],
    documentItems: [],
    form: buildInitialForm()
  },

  onLoad(options) {
    const option = buildInternationalOptions().find((item) => item.id === options.id) || buildInternationalOptions()[0]
    this.setData({
      option,
      serviceItems: option.inclusions || [],
      documentItems: option.documents || [],
      form: buildInitialForm()
    })
    this.refreshEstimate(option)
  },

  updateField(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  onDateChange(e) {
    this.setData({
      'form.date': e.detail.value
    })
  },

  onTimeChange(e) {
    this.setData({
      'form.time': e.detail.value
    })
  },

  async submitOrder() {
    if (this.data.submitting) return
    const form = normalizeForm(this.data.form)
    const invalidMessage = validateForm(form)
    if (invalidMessage) {
      wx.showToast({ title: invalidMessage, icon: 'none' })
      return
    }
    this.setData({
      form,
      submitting: true
    })
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
    const appointmentTime = `${form.date} ${form.time}:00`
    const exchangeRate = getInternationalExchangeRate()
    const remark = buildInternationalRemark({
      optionId: this.data.option.id,
      routeCode: this.data.option.routeCode,
      countryText: this.data.option.countryText,
      productName: this.data.option.titleZh,
      productNameEn: this.data.option.titleEn,
      startName: this.data.option.startName,
      endName: this.data.option.endName,
      appointmentTime,
      passengerCount: form.passengerCount,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      flightNo: form.flightNo,
      luggageCount: form.luggageCount,
      pickupSign: form.pickupSign || form.contactName,
      languageCode: 'zh-CN',
      currencyCode: 'USD',
      exchangeRate,
      serviceItems: this.data.serviceItems,
      documents: this.data.documentItems,
      riskNotice: '请提前确认通关证件、航班时间与目的地政策。',
      distanceText: `${estimate.route.distanceKm.toFixed(1)} km`,
      durationText: `${Math.round(estimate.route.durationMin)} min`,
      amountText: `$${estimate.payable.toFixed(2)}`,
      syncStatus: 'BACKEND_ORDER',
      submitSource: 'USER_MINIAPP'
    }, form.note)
    const payload = {
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
    }
    try {
      const response = await createOrder(payload)
      if (response && response.data) {
        syncOrderToCache({
          ...response.data,
          ...payload,
          exchangeRate
        })
      }
      wx.showToast({ title: '国际行程预约成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/international-orders/index' })
      }, 300)
    } finally {
      this.setData({ submitting: false })
    }
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
