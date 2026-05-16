const { fetchOrders } = require('../../utils/api')
const { formatOrderItem, getCarTypeMap, syncOrdersToCache } = require('../../utils/user-store')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const { runExclusive, runGuarded } = require('../../utils/page')

function buildOrderList(source = [], activeType, activeStatus) {
  const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
  return source
    .map((item) => formatOrderItem(item, carTypeMap))
    .filter((item) => {
      const passType = activeType === 'all' || item.type === activeType
      const passStatus = activeStatus === 'all' || item.status === activeStatus
      return passType && passStatus
    })
}

function getCachedOrders() {
  return getApp().globalData.userStore.orders || []
}

Page({
  data: {
    typeTabs: [
      { key: 'all', label: '全部' },
      { key: 'taxi', label: '打车' },
      { key: 'carpool', label: '顺风车' },
      { key: 'international', label: '国际出行' }
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
    loading: true
  },

  async onShow() {
    this.renderCachedList()
    await this.refreshList().catch(() => {})
  },

  chooseType(e) {
    this.setData({ activeType: e.currentTarget.dataset.key })
    this.renderCachedList()
    this.refreshList().catch(() => {})
  },

  chooseStatus(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.key })
    this.renderCachedList()
    this.refreshList().catch(() => {})
  },

  renderCachedList() {
    this.setData({
      list: buildOrderList(getCachedOrders(), this.data.activeType, this.data.activeStatus),
      loading: false
    })
  },

  async refreshList() {
    return runExclusive(this, '__refreshListPromise', async () => {
      const response = await fetchOrders()
      const mergedOrders = syncOrdersToCache(response.data || [])

      this.setData({
        list: buildOrderList(mergedOrders, this.data.activeType, this.data.activeStatus),
        loading: false
      })
    })
  },

  openDetail(e) {
    runGuarded(this, '__openingDetail', async () => {
      const orderId = e.currentTarget.dataset.id
      if (!orderId) return
      const matchedOrder = getCachedOrders().find((item) => `${item.id || ''}` === `${orderId}`) || null
      const targetUrl = buildOrderFlowUrl(matchedOrder)
      wx.navigateTo({
        url: targetUrl || `/pages/order-detail/index?id=${orderId}`
      })
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
