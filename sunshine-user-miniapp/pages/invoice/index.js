const { applyInvoice, downloadInvoiceImage, fetchOrders } = require('../../utils/api')
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

function buildInvoiceViewRows(detail = {}) {
  return {
    baseRows: [
      { label: '发票代码', value: detail.invoiceCode || '--' },
      { label: '发票号码', value: detail.invoiceNo || '--' },
      { label: '开票日期', value: formatInvoiceTime(detail.issueAt || detail.invoiceDate) || '--' },
      { label: '订单编号', value: detail.orderNo || '--' },
      { label: '发票类型', value: detail.invoiceType || '电子普通发票' }
    ],
    buyerRows: [
      { label: '名称', value: detail.buyerName || '个人' },
      { label: '纳税人识别号', value: detail.buyerTaxNo || '个人无需填写' },
      { label: '联系电话', value: detail.buyerPhone || '13800000000' }
    ],
    sellerRows: [
      { label: '名称', value: detail.sellerName || '北京阳光出行有限公司' },
      { label: '纳税人识别号', value: detail.sellerTaxNo || '91110105MA01SUN8X9' },
      { label: '联系电话', value: detail.sellerPhone || '400-100-0101' }
    ],
    tripRows: [
      { label: '乘车人', value: detail.passengerName || '阳光乘客' },
      { label: '用车时间', value: formatInvoiceTime(detail.tripTime) || '--' },
      { label: '上车地点', value: detail.startName || '--' },
      { label: '下车地点', value: detail.endName || '--' },
      { label: '车型', value: detail.carTypeName || detail.serviceName || '--' },
      { label: '行程里程', value: detail.distanceText || '--' },
      { label: '行程时长', value: detail.durationText || '--' },
      { label: '支付方式', value: detail.payChannel || '模拟支付' }
    ],
    feeRows: [
      { label: '项目', value: detail.itemName || '出行服务费' },
      { label: '单位', value: detail.itemUnit || '次' },
      { label: '数量', value: detail.itemQuantity || '1' },
      { label: '单价', value: detail.itemUnitPrice || detail.itemAmount || '0.00' },
      { label: '金额', value: detail.itemAmount || detail.totalAmount || '0.00' }
    ]
  }
}

function mapInvoiceView(invoice = {}) {
  const meta = inferInvoiceMeta(invoice)
  const rows = buildInvoiceViewRows(invoice.detail || {})
  return {
    ...invoice,
    ...meta,
    ...rows,
    displayTime: formatInvoiceTime(invoice.createdAt),
    issueTime: formatInvoiceTime(invoice.issuedAt || invoice.detail?.issueAt || invoice.detail?.invoiceDate)
  }
}

Page({
  data: {
    activeTab: 'apply',
    list: [],
    applyList: [],
    issuedList: [],
    selectedInvoiceId: '',
    selectedInvoice: null,
    invoiceViewerVisible: false,
    invoiceImageLoading: false,
    invoiceImagePath: '',
    viewerInvoice: null
  },

  async onShow() {
    this.renderCachedInvoices()
    await this.refreshInvoices()
  },

  noop() {},

  renderCachedInvoices() {
    const list = buildInvoiceList(getApp().globalData.userStore.orders || []).map(mapInvoiceView)
    const applyList = list.filter((item) => !item.isIssued)
    const issuedList = list.filter((item) => item.isIssued)
    this.setData({
      list,
      applyList,
      issuedList,
      selectedInvoiceId: this.data.selectedInvoiceId,
      selectedInvoice: this.data.selectedInvoice
    })
  },

  async refreshInvoices() {
    return runExclusive(this, '__refreshInvoicePromise', async () => {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
      this.renderCachedInvoices()
    })
  },

  switchInvoiceTab(e) {
    const activeTab = e.currentTarget.dataset.tab || 'apply'
    this.setData({
      activeTab,
      selectedInvoice: null,
      selectedInvoiceId: ''
    })
  },

  async viewInvoice(e) {
    const invoiceId = e.currentTarget.dataset.id
    const selectedInvoice = (this.data.issuedList || []).find((item) => `${item.id}` === `${invoiceId}`) || null
    if (!selectedInvoice) return
    this.setData({
      selectedInvoice,
      selectedInvoiceId: `${selectedInvoice.id}`,
      viewerInvoice: selectedInvoice,
      invoiceViewerVisible: true,
      invoiceImageLoading: true,
      invoiceImagePath: ''
    })
    try {
      const invoiceImagePath = await downloadInvoiceImage(selectedInvoice.id)
      this.setData({
        invoiceImagePath,
        invoiceImageLoading: false
      })
    } catch (error) {
      this.setData({ invoiceImageLoading: false })
      wx.showToast({
        title: error.message || '发票图片加载失败',
        icon: 'none'
      })
    }
  },

  closeInvoiceViewer() {
    this.setData({
      invoiceViewerVisible: false,
      invoiceImageLoading: false
    })
  },

  previewInvoiceImage() {
    if (!this.data.invoiceImagePath) return
    wx.previewImage({
      urls: [this.data.invoiceImagePath],
      current: this.data.invoiceImagePath
    })
  },

  saveInvoiceImage() {
    if (!this.data.invoiceImagePath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.invoiceImagePath,
      success: () => {
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showModal({
          title: '保存失败',
          content: '请在微信设置中允许保存到相册后重试。',
          confirmText: '知道了',
          showCancel: false
        })
      }
    })
  },

  async applyInvoice(e) {
    const orderId = e.currentTarget.dataset.id
    const invoice = (this.data.applyList || this.data.list || []).find((item) => `${item.id}` === `${orderId}`)
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
      buyerPhone: getApp().globalData.userStore.profile?.phone || '13800000000',
      remark: '乘客端提交电子发票申请'
    })
    wx.showToast({
      title: '发票申请已提交',
      icon: 'success'
    })
    await this.refreshInvoices()
  }
})
