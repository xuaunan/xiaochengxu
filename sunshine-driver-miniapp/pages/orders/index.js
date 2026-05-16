const { fetchOrders } = require('../../utils/api')
const { mapTripOrder } = require('../../utils/driver-store')

Page({
  data: {
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'processing', label: '进行中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    active: 'all',
    list: [],
    allList: []
  },

  async onShow() {
    const response = await fetchOrders()
    const list = (response.data || []).map(mapTripOrder)
    getApp().globalData.driverStore.tripOrders = list
    getApp().saveStore()
    this.setData({
      allList: list
    })
    this.refreshList()
  },

  chooseTab(e) {
    this.setData({ active: e.currentTarget.dataset.key })
    this.refreshList()
  },

  refreshList() {
    const list = (this.data.allList || []).filter((item) => this.data.active === 'all' || item.status === this.data.active)
    this.setData({ list })
  },

  openDetail(e) {
    const current = (this.data.list || []).find((item) => `${item.id}` === `${e.currentTarget.dataset.id}`)
    wx.navigateTo({
      url: current && current.status === 'processing'
        ? `/pages/trip-progress/index?id=${e.currentTarget.dataset.id}`
        : `/pages/trip-detail/index?id=${e.currentTarget.dataset.id}`
    })
  }
})
