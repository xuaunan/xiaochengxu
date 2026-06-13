const { fetchOrders, fetchProfile } = require('../../utils/api')
const { buildWalletView, syncOrdersToCache } = require('../../utils/user-store')
const { navigateToSilky, runExclusive } = require('../../utils/page')
const { PAY_STATUS, getServiceLabel } = require('../../utils/constants')
const { formatDateTime, formatPrice, parseDateValue } = require('../../utils/format')

const RECORD_LIMIT = 20

const EMPTY_SUMMARY = {
  spendText: '¥0.00',
  refundText: '¥0.00',
  countText: '0笔',
  filterLabel: '全部类型',
  syncText: '完成支付或退款后自动同步'
}

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

function splitWalletTime(value) {
  const text = formatWalletTime(value)
  if (text === '时间待同步') {
    return {
      date: '待同步',
      clock: '--:--',
      text
    }
  }

  const [date, clock = ''] = text.split(' ')
  return {
    date,
    clock,
    text
  }
}

function buildOrderRecords(orders = []) {
  return orders
    .filter((item) => item.payStatus === PAY_STATUS.PAID || item.payStatus === PAY_STATUS.REFUNDED)
    .sort((left, right) => getOrderTimeValue(right) - getOrderTimeValue(left))
    .slice(0, RECORD_LIMIT)
    .map((order, index) => {
      const refunded = order.payStatus === PAY_STATUS.REFUNDED
      const tone = refunded ? 'refund' : 'spend'
      const time = splitWalletTime(firstPresent(order.paidAt, order.finishedAt, order.updatedAt, order.createdAt))
      const serviceLabel = getServiceLabel(order.serviceType)
      return {
        key: `order-${order.id || order.orderNo || index}`,
        type: 'order',
        orderId: order.id || order.orderNo,
        marker: refunded ? '退' : '支',
        markerClass: `wallet-record__marker--${tone}`,
        amountClass: `wallet-record__amount--${tone}`,
        statusClass: `wallet-record__status--${tone}`,
        statusText: refunded ? '已退款' : '已支付',
        tone,
        serviceLabel,
        title: getOrderRouteText(order),
        desc: refunded ? '退款入账' : '账户扣款',
        date: time.date,
        clock: time.clock,
        time: time.text,
        amount: getOrderAmount(order),
        amountText: `${refunded ? '+' : '-'}${formatPrice(getOrderAmount(order), order.currencyCode)}`
      }
    })
}

function buildSummary(records = []) {
  if (!records.length) return { ...EMPTY_SUMMARY }

  const spendTotal = records
    .filter((item) => item.tone === 'spend')
    .reduce((sum, item) => sum + toNumber(item.amount), 0)
  const refundTotal = records
    .filter((item) => item.tone === 'refund')
    .reduce((sum, item) => sum + toNumber(item.amount), 0)
  const latestTimeText = records[0].time === '时间待同步'
    ? '最近交易时间待同步'
    : `最近交易 ${records[0].date} ${records[0].clock}`

  return {
    spendText: formatPrice(spendTotal),
    refundText: formatPrice(refundTotal),
    countText: `${records.length}笔`,
    filterLabel: '全部类型',
    syncText: latestTimeText
  }
}

function buildWalletPageState(baseWallet = {}, orders = []) {
  const wallet = {
    balance: toNumber(baseWallet.balance),
    balanceText: formatPlainAmount(baseWallet.balance)
  }
  const records = buildOrderRecords(orders)
  return {
    wallet,
    summary: buildSummary(records),
    records,
    hasRecords: records.length > 0
  }
}

Page({
  data: {
    wallet: {},
    summary: EMPTY_SUMMARY,
    records: [],
    hasRecords: false,
    balanceVisible: true
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
      navigateToSilky(this, { url: `/pages/order-detail/index?id=${id}` }, { selector: '.wallet-page' })
    }
  },

  toggleBalanceVisible() {
    this.setData({
      balanceVisible: !this.data.balanceVisible
    })
  }
})
