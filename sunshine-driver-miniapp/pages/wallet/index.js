const { fetchDashboard } = require('../../utils/api')
const { buildWallet, getDriverIncomeAmount } = require('../../utils/driver-store')
const { ORDER_STATUS, SERVICE_TYPE } = require('../../utils/constants')

function pad(value) {
  return `${value}`.padStart(2, '0')
}

function getOrderTime(order = {}) {
  return order.finishedAt ||
    order.finishTime ||
    order.finished_at ||
    order.finish_time ||
    order.updatedAt ||
    order.updated_at ||
    order.createdAt ||
    order.created_at ||
    ''
}

function getOrderStatus(order = {}) {
  return order.orderStatus || order.order_status || order.status || ''
}

function formatDateTime(value) {
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    if (!year || !month || !day) return ''
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }

  const text = `${value || ''}`.trim()
  if (!text) return ''
  const arrayLike = text.match(/^(\d{4}),(\d{1,2}),(\d{1,2}),?(\d{1,2})?,?(\d{1,2})?,?(\d{1,2})?/)
  if (arrayLike) {
    const [, year, month, day, hour = 0, minute = 0, second = 0] = arrayLike
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }
  return text.replace(/\//g, '-')
}

function getDateKey(value) {
  if (Array.isArray(value)) {
    const [year, month, day] = value
    if (!year || !month || !day) return ''
    return `${year}-${pad(month)}-${pad(day)}`
  }

  const text = `${value || ''}`.trim()
  const arrayLike = text.match(/^(\d{4}),(\d{1,2}),(\d{1,2})/)
  if (arrayLike) {
    return `${arrayLike[1]}-${pad(arrayLike[2])}-${pad(arrayLike[3])}`
  }
  return text.slice(0, 10).replace(/\//g, '-')
}

function getTimeValue(order = {}) {
  const value = getOrderTime(order)
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, month - 1, day, hour, minute, second).getTime()
  }
  const normalized = `${value || ''}`.replace(/^(\d{4}),(\d{1,2}),(\d{1,2}),?(\d{1,2})?,?(\d{1,2})?,?(\d{1,2})?/, (_, year, month, day, hour = 0, minute = 0, second = 0) => {
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }).replace(/-/g, '/')
  const time = new Date(normalized).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isFinishedIncomeOrder(order = {}) {
  return getOrderStatus(order) === ORDER_STATUS.FINISHED && getDriverIncomeAmount(order) > 0
}

function buildLocalDateParts() {
  const current = new Date()
  const day = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
  return {
    day,
    month: day.slice(0, 7)
  }
}

function getOrderNo(order = {}) {
  return order.orderNo || order.order_no || order.id || ''
}

function getOrderName(order = {}) {
  const serviceType = order.serviceType || order.service_type
  if (serviceType === SERVICE_TYPE.CARPOOL) return '顺风车'
  if (serviceType === SERVICE_TYPE.INTERNATIONAL) return '跨境出行'
  return '即时打车'
}

function getShortOrderNo(order = {}) {
  const orderNo = `${getOrderNo(order)}`
  return orderNo.length > 6 ? orderNo.slice(-6) : orderNo
}

function getBillTitle(order = {}) {
  const startName = order.startName || order.start_name || ''
  const endName = order.endName || order.end_name || ''
  const serviceName = getOrderName(order)
  if (startName && endName) {
    return `${serviceName} ${startName} → ${endName}`
  }
  return `${serviceName} #${getShortOrderNo(order)}`
}

Page({
  data: {
    wallet: {},
    bills: []
  },

  async onShow() {
    const response = await fetchDashboard()
    const dashboard = response.data || {}
    const incomeOrders = (dashboard.orders || [])
      .filter(isFinishedIncomeOrder)
      .sort((left, right) => getTimeValue(right) - getTimeValue(left))
    const { day, month } = buildLocalDateParts()
    const monthBills = incomeOrders.filter((item) => getDateKey(getOrderTime(item)).startsWith(month))
    const todayBills = monthBills.filter((item) => getDateKey(getOrderTime(item)) === day)
    const wallet = buildWallet(dashboard.profile || {}, incomeOrders)
    const bills = monthBills.slice(0, 10).map((item) => ({
      id: item.id || getOrderNo(item),
      title: getBillTitle(item),
      amount: `+¥${getDriverIncomeAmount(item).toFixed(2)}`,
      time: formatDateTime(getOrderTime(item))
    }))
    getApp().globalData.driverStore.wallet = wallet
    getApp().saveStore()
    this.setData({
      wallet,
      billSummary: `本月 ${monthBills.length} 笔 · 今日 ${todayBills.length} 笔`,
      bills
    })
  },

  openWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/index' })
  }
})
