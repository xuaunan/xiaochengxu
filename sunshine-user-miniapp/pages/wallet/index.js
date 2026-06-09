const { fetchOrders, fetchProfile } = require('../../utils/api')
const { buildWalletView, syncOrdersToCache } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')
const { PAY_STATUS, getServiceLabel } = require('../../utils/constants')
const { formatDateTime, formatPrice, parseDateValue } = require('../../utils/format')

const RECORD_LIMIT = 20

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function formatPlainAmount(value) {
  return toNumber(value).toFixed(2)
}

function getOrderAmount(order = {}) {
  return toNumber(firstPresent(order.actualAmount, order.payableAmount, order.estimatedAmount, order.cancelFee), 0)
}

function getOrderRouteText(order = {}) {
  const startName = `${order.startName || ''}`.trim()
  const endName = `${order.endName || ''}`.trim()
  if (startName && endName) return `${startName} 至 ${endName}`
  return startName || endName || `订单 ${order.orderNo || order.id || '--'}`
}

function getOrderTimeValue(order = {}) {
  const current = parseDateValue(firstPresent(order.paidAt, order.finishedAt, order.updatedAt, order.createdAt))
  return current ? current.getTime() : 0
}

function formatWalletTime(value) {
  const text = formatDateTime(value, { fallback: '时间待同步' })
  return text === '时间待同步' ? text : text.replace(/^\d{4}-/, '')
}

function buildOrderRecords(orders = []) {
  return orders
    .filter((item) => item.payStatus === PAY_STATUS.PAID || item.payStatus === PAY_STATUS.REFUNDED)
    .sort((left, right) => getOrderTimeValue(right) - getOrderTimeValue(left))
    .slice(0, RECORD_LIMIT)
    .map((order, index) => {
      const refunded = order.payStatus === PAY_STATUS.REFUNDED
      const tone = refunded ? 'refund' : 'spend'
      return {
        key: `order-${order.id || order.orderNo || index}`,
        type: 'order',
        orderId: order.id || order.orderNo,
        marker: refunded ? '退' : '支',
        markerClass: `wallet-record__marker--${tone}`,
        amountClass: `wallet-record__amount--${tone}`,
        title: getOrderRouteText(order),
        desc: `${getServiceLabel(order.serviceType)} · ${refunded ? '退款入账' : '已支付'}`,
        time: formatWalletTime(firstPresent(order.paidAt, order.finishedAt, order.updatedAt, order.createdAt)),
        amountText: `${refunded ? '+' : '-'}${formatPrice(getOrderAmount(order), order.currencyCode)}`
      }
    })
}

function buildWalletPageState(baseWallet = {}, orders = []) {
  const wallet = {
    balance: toNumber(baseWallet.balance),
    balanceText: formatPlainAmount(baseWallet.balance)
  }
  const records = buildOrderRecords(orders)
  return {
    wallet,
    records,
    hasRecords: records.length > 0
  }
}

Page({
  data: {
    wallet: {},
    records: [],
    hasRecords: false
  },

  async onShow() {
    this.renderCachedWallet()
    await this.refreshWallet()
  },

  renderCachedWallet() {
    const app = getApp()
    const store = app.globalData.userStore || {}
    const orders = store.orders || []
    const wallet = buildWalletView(store.profile || {}, [], orders)
    this.setData(buildWalletPageState(wallet, orders))
  },

  async refreshWallet() {
    return runExclusive(this, '__refreshWalletPromise', async () => {
      const [profileResponse, ordersResponse] = await Promise.all([
        fetchProfile(),
        fetchOrders()
      ])
      const app = getApp()
      app.applyProfile(profileResponse.data || {})
      syncOrdersToCache(ordersResponse.data || [])
      this.renderCachedWallet()
    })
  },

  openRecord(e) {
    const type = e.currentTarget.dataset.type
    const id = e.currentTarget.dataset.id
    if (type === 'order' && id) {
      wx.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
    }
  }
})
