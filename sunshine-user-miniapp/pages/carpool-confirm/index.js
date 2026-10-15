const { createOrder, fetchHome } = require('../../utils/api')
const { buildEstimateFromRoute, decorateCarType } = require('../../utils/user-store')
const { formatPrice } = require('../../utils/format')
const { navigateToSilky } = require('../../utils/page')

function getFallbackContext() {
  const app = getApp()
  return {
    draft: app.globalData.routeDraft || {},
    departDate: '',
    selectedTimeRange: '06:00-09:00',
    selectedTimeRangeLabel: '06:00 - 09:00',
    passengerCount: 1,
    selectedPassengerLabel: '1 人',
    luggageLabel: '无行李',
    tollLabel: '高速费协商',
    note: ''
  }
}

function getDepartTime(context) {
  const start = (String(context.selectedTimeRange || '08:00-09:00').split('-')[0] || '08:00').trim()
  return context.departDate + ' ' + start + ':00'
}

function getDepartEndTime(context) {
  const end = (String(context.selectedTimeRange || '00:00-03:00').split('-')[1] || '03:00').trim()
  if (end === '24:00') {
    const nextDay = new Date(`${context.departDate}T00:00:00`)
    nextDay.setDate(nextDay.getDate() + 1)
    const year = nextDay.getFullYear()
    const month = `${nextDay.getMonth() + 1}`.padStart(2, '0')
    const day = `${nextDay.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day} 00:00:00`
  }
  return context.departDate + ' ' + end + ':00'
}

function getSharedAmount(estimate, passengerCount = 1) {
  const amount = Number(estimate && estimate.amount)
  if (Number.isFinite(amount) && amount > 0) return Number((amount / Math.max(1, Number(passengerCount) || 1)).toFixed(2))
  const distance = Number(estimate && estimate.route && estimate.route.distanceKm)
  return Number((Math.max(1, (Number.isFinite(distance) ? distance : 1) * 1.5) / Math.max(1, Number(passengerCount) || 1)).toFixed(2))
}

function getCoordinate(point, axis) {
  if (!point) return '0'
  const alias = axis === 'lng' ? 'longitude' : 'latitude'
  const value = point[axis] !== undefined ? point[axis] : point[alias]
  return String(value !== undefined && value !== null ? value : 0)
}

Page({
  data: {
    context: getFallbackContext(),
    estimate: null,
    sharedAmountText: '--',
    loading: true,
    publishing: false
  },

  async onShow() {
    this.loadContext()
    await this.loadEstimate()
  },

  loadContext() {
    const app = getApp()
    const cached = app.globalData.carpoolConfirmContext || wx.getStorageSync('sunshine-carpool-confirm') || {}
    this.setData({
      context: {
        ...getFallbackContext(),
        ...cached,
        draft: cached.draft || app.globalData.routeDraft || {}
      }
    })
  },

  async loadEstimate() {
    const draft = this.data.context.draft || {}
    if (!draft.start || !draft.end) {
      this.setData({ loading: false })
      return
    }
    try {
      const response = await fetchHome()
      const home = response.data || {}
      getApp().updateTencentMapKey((home.systemConfigs || {}).tencentMapKey)
      const carTypes = home.carTypes || []
      this.carTypeId = (carTypes[0] && carTypes[0].id) || 1
      const carType = decorateCarType(carTypes[0] || { id: 1, startPrice: 14, startDistanceKm: 3, distancePrice: 2.6, durationPrice: 0.5 })
      const estimate = buildEstimateFromRoute(carType, 'CARPOOL', draft.start, draft.end, 0)
      this.setData({ estimate, sharedAmountText: formatPrice(getSharedAmount(estimate, this.data.context.passengerCount), estimate.currencyCode) })
    } catch (error) {
      this.setData({ estimate: null, sharedAmountText: formatPrice(1 / Math.max(1, Number(this.data.context.passengerCount) || 1)) })
    } finally {
      this.setData({ loading: false })
    }
  },

  async publishRequest() {
    const context = this.data.context
    const draft = context.draft || {}
    const estimate = this.data.estimate
    if (this.data.publishing || !draft.start || !draft.end) {
      wx.showToast({ title: '请先选择起点和终点', icon: 'none' })
      return
    }
    if (!context.departDate) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' })
      return
    }
    const departTime = getDepartTime(context)
    const departure = new Date(departTime.replace(/-/g, '/'))
    if (!Number.isNaN(departure.getTime()) && departure.getTime() < Date.now() + 30 * 60 * 1000) {
      wx.showToast({ title: '出发时间至少要提前30分钟', icon: 'none' })
      return
    }
    this.setData({ publishing: true })
    try {
      const departureAt = departTime.replace(' ', 'T')
      const departureEndAt = getDepartEndTime(context).replace(' ', 'T')
      const distanceKm = Number(estimate && estimate.route && estimate.route.distanceKm) || 1
      const durationMin = Number(estimate && estimate.route && estimate.route.durationMin) || Math.max(1, distanceKm * 2)
      const passengerCount = Math.max(1, Number(context.passengerCount) || 1)
      const carpoolMeta = {
        departDate: context.departDate,
        timeRange: context.selectedTimeRangeLabel || context.selectedTimeRange,
        passengerCount,
        hasLuggage: context.luggageMode === 'HAS_LUGGAGE' || context.luggageLabel === '有行李',
        tollMode: context.tollMode || 'NEGOTIABLE',
        originalAmount: getSharedAmount(estimate),
        note: context.note || ''
      }
      const response = await createOrder({
        carTypeId: this.carTypeId || 1,
        serviceType: 'CARPOOL',
        startName: draft.start.name,
        startLng: getCoordinate(draft.start, 'lng'),
        startLat: getCoordinate(draft.start, 'lat'),
        endName: draft.end.name,
        endLng: getCoordinate(draft.end, 'lng'),
        endLat: getCoordinate(draft.end, 'lat'),
        estimatedDistanceKm: Math.max(0.1, distanceKm),
        estimatedDurationMin: Math.max(1, durationMin),
        dispatchMode: 'SMART',
        carpoolDepartureAt: departureAt,
        carpoolDepartureEndAt: departureEndAt,
        carpoolPassengerCount: passengerCount,
        remark: `[CARPOOL_META]${JSON.stringify(carpoolMeta)}[/CARPOOL_META]微信小程序乘客端下单${context.note ? ` | ${context.note}` : ''}`
      })
      const order = response.data || {}
      wx.removeStorageSync('sunshine-carpool-confirm')
      getApp().globalData.carpoolConfirmContext = null
      wx.showToast({ title: '订单已提交，等待车主接单', icon: 'success' })
      setTimeout(() => navigateToSilky(this, { url: `/pages/order-detail/index?id=${order.id}` }), 320)
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '发布失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  }
})
