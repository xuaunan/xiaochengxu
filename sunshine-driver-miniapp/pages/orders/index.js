const { fetchOrders } = require('../../utils/api')
const { mapTripOrder } = require('../../utils/driver-store')

const SERVICE_ICON_PATHS = {
  taxi: '/images/service-icons/taxi.png',
  carpool: '/images/service-icons/carpool.png',
  international: '/images/service-icons/international.png'
}

function getOrderTypeKey(item = {}) {
  const serviceType = `${item.serviceType || item.service_type || ''}`.toUpperCase()
  if (serviceType === 'CARPOOL') return 'carpool'
  if (serviceType === 'INTERNATIONAL') return 'international'
  return 'taxi'
}

Page({
  data: {
    typeTabs: [
      { key: 'all', label: '全部' },
      { key: 'taxi', label: '打车', iconPath: SERVICE_ICON_PATHS.taxi },
      { key: 'carpool', label: '顺风车', iconPath: SERVICE_ICON_PATHS.carpool },
      { key: 'international', label: '国际出行', iconPath: SERVICE_ICON_PATHS.international }
    ],
    statusTabs: [
      { key: 'all', label: '全部状态' },
      { key: 'processing', label: '进行中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    activeType: 'all',
    activeStatus: 'all',
    list: [],
    allList: []
  },

  async onShow() {
    const response = await fetchOrders()
    const list = (response.data || []).map((item) => {
      const mapped = mapTripOrder(item)
      const serviceTypeKey = getOrderTypeKey(mapped)
      return {
        ...mapped,
        serviceTypeKey,
        serviceIconPath: SERVICE_ICON_PATHS[serviceTypeKey] || SERVICE_ICON_PATHS.taxi
      }
    })
    getApp().globalData.driverStore.tripOrders = list
    getApp().saveStore()
    this.setData({
      allList: list
    })
    this.refreshList()
  },

  chooseType(e) {
    this.setData({ activeType: e.currentTarget.dataset.key })
    this.refreshList()
  },

  chooseStatus(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.key })
    this.refreshList()
  },

  refreshList() {
    const list = (this.data.allList || []).filter((item) => {
      const passType = this.data.activeType === 'all' || item.serviceTypeKey === this.data.activeType
      const passStatus = this.data.activeStatus === 'all' || item.status === this.data.activeStatus
      return passType && passStatus
    })
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
