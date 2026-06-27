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
    list: [],
    loading: false,
    errorText: ''
  },

  async onShow() {
    this.renderCachedList()
    await this.refreshList().catch(() => {})
  },

  renderCachedList() {
    this.setData({
      list: buildInternationalList(getApp().globalData.userStore.orders || [])
    })
  },

  async refreshList() {
    return runExclusive(this, '__refreshInternationalPromise', async () => {
      this.setData({
        loading: !this.data.list.length,
        errorText: ''
      })
      try {
        const response = await fetchOrders()
        syncOrdersToCache(response.data || [])
        this.renderCachedList()
        this.setData({
          loading: false,
          errorText: ''
        })
      } catch (error) {
        this.setData({
          loading: false,
          errorText: (error && error.message) || '国际行程加载失败，请稍后重试'
        })
        wx.showToast({
          title: '国际行程加载失败，请稍后重试',
          icon: 'none'
        })
        throw error
      }
    })
  },

  goInternational() {
    navigateToSilky(this, { url: '/pages/international/index' })
  },

  retryRefresh() {
    this.refreshList().catch(() => {})
  }
})
