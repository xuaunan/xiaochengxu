const { fetchOrders } = require('../../utils/api')
const { buildInvoiceList, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    list: []
  },

  async onShow() {
    this.renderCachedInvoices()
    await this.refreshInvoices()
  },

  renderCachedInvoices() {
    this.setData({
      list: buildInvoiceList(getApp().globalData.userStore.orders || [])
    })
  },

  async refreshInvoices() {
    return runExclusive(this, '__refreshInvoicePromise', async () => {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
      this.renderCachedInvoices()
    })
  },

  applyInvoice(e) {
    wx.showToast({
      title: `已登记发票申请 ${e.currentTarget.dataset.id}`,
      icon: 'none'
    })
  }
})
