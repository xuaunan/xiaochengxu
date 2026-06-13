const { formatDate } = require('../../utils/format')
const { SERVICE_TYPE } = require('../../utils/constants')
const { navigateToSilky } = require('../../utils/page')

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

Page({
  data: {
    minDate: getToday(),
    departDate: getToday(),
    timeRangeOptions: [
      { key: '07:00-09:00', label: '07:00 - 09:00' },
      { key: '09:00-12:00', label: '09:00 - 12:00' },
      { key: '12:00-15:00', label: '12:00 - 15:00' },
      { key: '15:00-18:00', label: '15:00 - 18:00' },
      { key: '18:00-21:00', label: '18:00 - 21:00' }
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
    selectedTimeRange: '07:00-09:00',
    selectedTimeRangeIndex: 0,
    selectedTimeRangeLabel: '07:00 - 09:00',
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
    navigating: false
  },

  onShow() {
    this.syncDraft()
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

  confirmOrder() {
    if (this.data.navigating) return
    if (!this.data.draft.start || !this.data.draft.end) {
      wx.showToast({
        title: '\u8bf7\u5148\u9009\u62e9\u8d77\u7ec8\u70b9',
        icon: 'none'
      })
      return
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
    this.setData({ navigating: true })
    navigateToSilky(this, {
      url: '/pages/carpool-confirm/index',
      complete: () => {
        this.setData({ navigating: false })
      }
    })
  }
})
