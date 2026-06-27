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

function getStatusTag(status) {
  const statusMap = {
    completed: 'success',
    finished: 'success',
    processing: 'processing',
    waiting: 'waiting',
    dispatching: 'waiting',
    cancelled: 'danger',
    canceled: 'danger'
  }
  return statusMap[status] || 'waiting'
}

function getOrderNo(item = {}) {
  return item.orderNo || item.order_no || item.orderId || item.order_id || item.id || ''
}

function decorateOrder(item = {}) {
  const mapped = item.serviceTypeKey ? item : mapTripOrder(item)
  const serviceTypeKey = mapped.serviceTypeKey || getOrderTypeKey(mapped)
  return {
    ...mapped,
    serviceTypeKey,
    orderNo: getOrderNo(mapped),
    iconPath: mapped.iconPath || mapped.serviceIconPath || SERVICE_ICON_PATHS[serviceTypeKey] || SERVICE_ICON_PATHS.taxi,
    typeText: mapped.typeText || mapped.serviceTypeLabel,
    statusTag: mapped.statusTag || getStatusTag(mapped.status),
    createdAtText: mapped.createdAtText || mapped.createdAt,
    amountText: mapped.amountText || mapped.fareText
  }
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
      { key: 'completed', label: '已完成' },
      { key: 'waiting-pay', label: '待支付' },
      { key: 'processing', label: '进行中' },
      { key: 'dispatching', label: '待接单' },
      { key: 'cancelled', label: '已取消' }
    ],
    activeType: 'all',
    activeStatus: 'all',
    list: [],
    allList: [],
    loading: false,
    errorText: ''
  },

  async onShow() {
    const cachedOrders = getApp().globalData.driverStore.tripOrders || []
    if (cachedOrders.length) {
      this.setData({ allList: cachedOrders.map(decorateOrder) })
      this.refreshList()
    }
    await this.refreshRemoteOrders().catch(() => {})
  },

  async refreshRemoteOrders() {
    this.setData({
      loading: !this.data.allList.length,
      errorText: ''
    })
    try {
      const response = await fetchOrders()
      const list = (response.data || []).map(decorateOrder)
      getApp().globalData.driverStore.tripOrders = list
      getApp().saveStore()
      this.setData({
        allList: list,
        loading: false,
        errorText: ''
      })
      this.refreshList()
    } catch (error) {
      this.setData({
        loading: false,
        errorText: (error && error.message) || '行程订单加载失败，请稍后重试'
      })
      wx.showToast({
        title: '行程订单加载失败，请稍后重试',
        icon: 'none'
      })
      throw error
    }
  },

  retryRefresh() {
    this.refreshRemoteOrders().catch(() => {})
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
      const targetStatus = this.data.activeStatus === 'dispatching' ? 'waiting' : this.data.activeStatus
      const passStatus = targetStatus === 'all' || item.status === targetStatus
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
  },

  goHome() {
    wx.switchTab({ url: '/pages/dashboard/index' })
  }
})
