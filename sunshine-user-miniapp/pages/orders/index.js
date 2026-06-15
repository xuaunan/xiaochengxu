const { fetchOrders } = require('../../utils/api')
const { formatOrderItem, getCarTypeMap, syncOrdersToCache } = require('../../utils/user-store')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const { navigateToSilky, runExclusive, runGuarded, switchTabSilky } = require('../../utils/page')

const SERVICE_ICON_PATHS = {
  taxi: '/images/service-icons/taxi.png',
  carpool: '/images/service-icons/carpool.png',
  international: '/images/service-icons/international.png'
}

function buildOrderList(source = [], activeType, activeStatus) {
  const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
  return source
    .map((item) => {
      const formatted = formatOrderItem(item, carTypeMap)
      return {
        ...formatted,
        iconPath: SERVICE_ICON_PATHS[formatted.type] || SERVICE_ICON_PATHS.taxi
      }
    })
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
      await navigateToSilky(this, {
        url: targetUrl || `/pages/order-detail/index?id=${orderId}`
      })
    })
  },

  goHome() {
    switchTabSilky(this, { url: '/pages/home/index' }, { selector: '.orders-hero' })
  }
})
