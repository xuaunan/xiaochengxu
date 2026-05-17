const { applyInvoice, fetchOrders } = require('../../utils/api')
const { buildInvoiceList, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')

function inferInvoiceMeta(invoice = {}) {
  const title = invoice.title || ''
  if (title.includes('顺风车')) {
    return {
      iconClass: 'carpool',
      serviceTag: '顺风车'
    }
  }
  if (title.includes('国际')) {
    return {
      iconClass: 'international',
      serviceTag: '国际出行'
    }
  }
  return {
    iconClass: 'taxi',
    serviceTag: '即时打车'
  }
}

function formatInvoiceTime(value = '') {
  const text = `${value || ''}`.trim()
  const matched = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return matched ? `${matched[1]} ${matched[2]}` : text
}

function mapInvoiceView(invoice = {}) {
  const meta = inferInvoiceMeta(invoice)
  return {
    ...invoice,
    ...meta,
    displayTime: formatInvoiceTime(invoice.createdAt)
  }
}

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
      list: buildInvoiceList(getApp().globalData.userStore.orders || []).map(mapInvoiceView)
    })
  },

  async refreshInvoices() {
    return runExclusive(this, '__refreshInvoicePromise', async () => {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
      this.renderCachedInvoices()
    })
  },

  async applyInvoice(e) {
    const orderId = e.currentTarget.dataset.id
    const invoice = (this.data.list || []).find((item) => `${item.id}` === `${orderId}`)
    if (!invoice || !invoice.canApply) {
      wx.showToast({
        title: invoice?.status || '当前不可申请',
        icon: 'none'
      })
      return
    }
    const modal = await new Promise((resolve) => {
      wx.showModal({
        title: '申请电子发票',
        content: `订单 ${invoice.orderNo || invoice.id}`,
        editable: true,
        placeholderText: '请输入发票抬头，默认个人',
        confirmText: '提交',
        success: resolve,
        fail: () => resolve({ confirm: false })
      })
    })
    if (!modal.confirm) return
    await applyInvoice(orderId, {
      invoiceTitle: modal.content || '个人',
      remark: '乘客端提交电子发票申请'
    })
    wx.showToast({
      title: '发票申请已提交',
      icon: 'success'
    })
    await this.refreshInvoices()
  }
})
