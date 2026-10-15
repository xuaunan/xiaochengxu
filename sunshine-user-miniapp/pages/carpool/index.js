const { formatDate, formatPrice } = require('../../utils/format')
const { SERVICE_TYPE, ORDER_STATUS, PAY_STATUS } = require('../../utils/constants')
const { navigateToSilky } = require('../../utils/page')
const { fetchOrders } = require('../../utils/api')

function getToday() {
  return formatDate(new Date())
}

function findTimeRangeIndex(options = [], key = '') {
  const index = options.findIndex((item) => item.key === key)
  return index >= 0 ? index : 0
}

function findPassengerIndex(options = [], count = 1) {
  const index = options.findIndex((item) => Number(item) === Number(count))
  return index >= 0 ? index : 0
}

function getSelectedTimeRangeLabel(options = [], index = 0) {
  return (options[index] && options[index].label) || (options[0] && options[0].label) || ''
}

function getSelectedPassengerLabel(options = [], index = 0) {
  return options[index] || options[0] || ''
}

function pickActiveCarpoolOrder(orders = []) {
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => {
      if (!order || !order.id || order.serviceType !== SERVICE_TYPE.CARPOOL) return false
      if (order.orderStatus === ORDER_STATUS.CANCELLED) return false
      if (order.orderStatus === ORDER_STATUS.FINISHED) {
        return order.payStatus === PAY_STATUS.UNPAID
      }
      return true
    })
    .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0] || null
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function getOngoingStatusText(order = {}) {
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID) {
    return '待支付'
  }
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) return '行程进行中'
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return '车主接驾中'
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return '已匹配车主'
  return '匹配车主中'
}

function formatOngoingOrder(order = {}) {
  const amount = firstPresent(order.actualAmount, order.payableAmount, order.estimatedAmount)
  return {
    id: order.id,
    orderNo: order.orderNo || '',
    startName: order.startName || '待补充出发地',
    endName: order.endName || '待补充目的地',
    statusText: getOngoingStatusText(order),
    amountText: formatPrice(amount, order.currencyCode)
  }
}

Page({
  data: {
    minDate: getToday(),
    departDate: getToday(),
    timeRangeOptions: [
      { key: '00:00-03:00', label: '00:00 - 03:00' },
      { key: '03:00-06:00', label: '03:00 - 06:00' },
      { key: '06:00-09:00', label: '06:00 - 09:00' },
      { key: '09:00-12:00', label: '09:00 - 12:00' },
      { key: '12:00-15:00', label: '12:00 - 15:00' },
      { key: '15:00-18:00', label: '15:00 - 18:00' },
      { key: '18:00-21:00', label: '18:00 - 21:00' },
      { key: '21:00-24:00', label: '21:00 - 24:00' }
    ],
    passengerOptions: [1, 2, 3, 4],
    passengerPickerOptions: ['1 人', '2 人', '3 人', '4 人'],
    luggageOptions: [
      { key: 'NO_LUGGAGE', label: '\u65e0\u884c\u674e' },
      { key: 'HAS_LUGGAGE', label: '\u6709\u884c\u674e' }
    ],
    tollOptions: [
      { key: 'PASSENGER_PAYS', label: '\u4e58\u5ba2\u51fa\u9ad8\u901f\u8d39' },
      { key: 'NEGOTIABLE', label: '\u9ad8\u901f\u8d39\u534f\u5546' }
    ],
    selectedTimeRange: '06:00-09:00',
    selectedTimeRangeIndex: 2,
    selectedTimeRangeLabel: '06:00 - 09:00',
    passengerCount: 1,
    selectedPassengerIndex: 0,
    selectedPassengerLabel: '1 人',
    luggageMode: 'NO_LUGGAGE',
    luggageLabel: '无行李',
    tollMode: 'NEGOTIABLE',
    tollLabel: '高速费协商',
    note: '',
    noteDraft: '',
    noteDraftCount: 0,
    noteModalVisible: false,
    draft: {},
    navigating: false,
    checkingOngoing: true,
    ongoingOrder: null
  },

  onShow() {
    this.syncDraft()
    this.checkOngoingOrder()
  },

  async checkOngoingOrder() {
    if (this.checkingOngoingOrder) return
    this.checkingOngoingOrder = true
    if (!this.data.ongoingOrder) {
      this.setData({ checkingOngoing: true })
    }
    try {
      const ongoingOrder = await this.findOngoingCarpoolOrder()
      this.setData({
        ongoingOrder,
        checkingOngoing: false
      })
    } catch (error) {
      this.setData({ checkingOngoing: false })
    } finally {
      this.checkingOngoingOrder = false
    }
  },

  async findOngoingCarpoolOrder() {
    const response = await fetchOrders()
    const activeOrder = pickActiveCarpoolOrder((response && response.data) || [])
    return activeOrder ? formatOngoingOrder(activeOrder) : null
  },

  openOngoingDetail() {
    const ongoingOrder = this.data.ongoingOrder
    if (!ongoingOrder || !ongoingOrder.id) return
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${ongoingOrder.id}`
    })
  },

  syncDraft() {
    const app = getApp()
    const routeDraft = app.globalData.routeDraft || {}
    const nextDraft = {
      ...routeDraft,
      serviceType: SERVICE_TYPE.CARPOOL,
      selectedCarTypeId: routeDraft.selectedCarTypeId || 1
    }
    app.updateDraft(nextDraft)
    this.setData({ draft: nextDraft })
  },

  chooseDepartDate(e) {
    this.setData({ departDate: e.detail.value })
  },

  chooseTimeRange(e) {
    const nextKey = e.currentTarget.dataset.key
    const selectedTimeRangeIndex = findTimeRangeIndex(this.data.timeRangeOptions, nextKey)
    this.setData({
      selectedTimeRange: nextKey,
      selectedTimeRangeIndex,
      selectedTimeRangeLabel: getSelectedTimeRangeLabel(this.data.timeRangeOptions, selectedTimeRangeIndex)
    })
  },

  chooseTimeRangeByPicker(e) {
    const selectedTimeRangeIndex = Number(e.detail.value || 0)
    const current = this.data.timeRangeOptions[selectedTimeRangeIndex] || this.data.timeRangeOptions[0]
    this.setData({
      selectedTimeRange: current.key,
      selectedTimeRangeIndex,
      selectedTimeRangeLabel: getSelectedTimeRangeLabel(this.data.timeRangeOptions, selectedTimeRangeIndex)
    })
  },

  choosePassengerCount(e) {
    const passengerCount = Number(e.currentTarget.dataset.count)
    const selectedPassengerIndex = findPassengerIndex(this.data.passengerOptions, passengerCount)
    this.setData({
      passengerCount,
      selectedPassengerIndex,
      selectedPassengerLabel: getSelectedPassengerLabel(this.data.passengerPickerOptions, selectedPassengerIndex)
    })
  },

  choosePassengerCountByPicker(e) {
    const selectedPassengerIndex = Number(e.detail.value || 0)
    const passengerCount = Number(this.data.passengerOptions[selectedPassengerIndex] || this.data.passengerOptions[0] || 1)
    this.setData({
      passengerCount,
      selectedPassengerIndex,
      selectedPassengerLabel: getSelectedPassengerLabel(this.data.passengerPickerOptions, selectedPassengerIndex)
    })
  },

  chooseLuggageMode(e) {
    const luggageMode = e.currentTarget.dataset.key
    const current = (this.data.luggageOptions || []).find((item) => item.key === luggageMode)
    this.setData({
      luggageMode,
      luggageLabel: (current && current.label) || '无行李'
    })
  },

  chooseTollMode(e) {
    const tollMode = e.currentTarget.dataset.key
    const current = (this.data.tollOptions || []).find((item) => item.key === tollMode)
    this.setData({
      tollMode,
      tollLabel: (current && current.label) || '高速费协商'
    })
  },

  updateNote(e) {
    const noteDraft = e.detail.value || ''
    this.setData({
      noteDraft,
      noteDraftCount: noteDraft.length
    })
  },

  openNoteModal() {
    const noteDraft = this.data.note || ''
    this.setData({
      noteDraft,
      noteDraftCount: noteDraft.length,
      noteModalVisible: true
    })
  },

  closeNoteModal() {
    const noteDraft = this.data.note || ''
    this.setData({
      noteDraft,
      noteDraftCount: noteDraft.length,
      noteModalVisible: false
    })
  },

  saveNote() {
    this.setData({
      note: (this.data.noteDraft || '').trim(),
      noteModalVisible: false
    })
  },

  noop() {},

  openAddressSearch(e) {
    const type = e.currentTarget.dataset.type
    const draft = {
      ...this.data.draft,
      serviceType: SERVICE_TYPE.CARPOOL
    }
    getApp().updateDraft(draft)
    navigateToSilky(this, {
      url: `/pages/address-search/index?type=${type}`
    })
  },

  openMapPicker(e) {
    const type = e.currentTarget.dataset.type
    const draft = {
      ...this.data.draft,
      serviceType: SERVICE_TYPE.CARPOOL
    }
    getApp().updateDraft(draft)
    navigateToSilky(this, {
      url: `/pages/map-picker/index?type=${type}&source=carpool`
    })
  },

  swapAddress() {
    const draft = {
      ...this.data.draft,
      start: this.data.draft.end,
      end: this.data.draft.start,
      serviceType: SERVICE_TYPE.CARPOOL
    }
    getApp().updateDraft(draft)
    this.setData({ draft })
  },

  async confirmOrder() {
    if (this.data.navigating) return
    if (!this.data.draft.start || !this.data.draft.end) {
      wx.showToast({
        title: '\u8bf7\u5148\u9009\u62e9\u8d77\u7ec8\u70b9',
        icon: 'none'
      })
      return
    }
    this.setData({ navigating: true })
    try {
      const ongoingOrder = await this.findOngoingCarpoolOrder()
      if (ongoingOrder) {
        this.setData({ navigating: false, ongoingOrder })
        wx.showToast({
          title: '您有正在进行的顺风车行程',
          icon: 'none'
        })
        return
      }
    } catch (error) {
      // 查询失败不阻塞下单流程
    }
    const context = {
      draft: this.data.draft,
      departDate: this.data.departDate,
      selectedTimeRange: this.data.selectedTimeRange,
      selectedTimeRangeLabel: this.data.selectedTimeRangeLabel,
      passengerCount: this.data.passengerCount,
      selectedPassengerLabel: this.data.selectedPassengerLabel,
      luggageMode: this.data.luggageMode,
      luggageLabel: this.data.luggageLabel,
      tollMode: this.data.tollMode,
      tollLabel: this.data.tollLabel,
      note: this.data.note
    }
    getApp().globalData.carpoolConfirmContext = context
    wx.setStorageSync('sunshine-carpool-confirm', context)
    navigateToSilky(this, {
      url: '/pages/carpool-confirm/index',
      complete: () => {
        this.setData({ navigating: false })
      }
    })
  }
})
