const { fetchOrders } = require('../../utils/api')
const { SERVICE_TYPE } = require('../../utils/constants')
const { formatOrderItem, getCarTypeMap, syncOrdersToCache } = require('../../utils/user-store')
const { navigateToSilky, runExclusive } = require('../../utils/page')

function buildInternationalList(orders = []) {
  const carTypeMap = getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
  return orders
    .filter((item) => item.serviceType === SERVICE_TYPE.INTERNATIONAL)
    .map((item) => formatOrderItem(item, carTypeMap))
}

Page({
  data: {
    list: []
  },

  async onShow() {
    this.renderCachedList()
    await this.refreshList()
  },

  renderCachedList() {
    this.setData({
      list: buildInternationalList(getApp().globalData.userStore.orders || [])
    })
  },

  async refreshList() {
    return runExclusive(this, '__refreshInternationalPromise', async () => {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
      this.renderCachedList()
    })
  },

  goInternational() {
    navigateToSilky(this, { url: '/pages/international/index' })
  }
})
