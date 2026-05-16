export const roleMap = {
  ADMIN: '管理员',
  USER: '乘客',
  DRIVER: '司机'
}

export const serviceTypeMap = {
  TAXI: '即时打车',
  CARPOOL: '顺风车',
  INTERNATIONAL: '国际出行'
}

export const orderStatusMap = {
  CREATED: '已创建',
  DISPATCHING: '待派单',
  ACCEPTED: '已接单',
  PICKING_UP: '接驾中',
  IN_TRIP: '行程中',
  FINISHED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
}

export const payStatusMap = {
  UNPAID: '待支付',
  PAID: '已支付',
  REFUNDED: '已退款'
}

export const couponTypeMap = {
  CASH: '满减券',
  DISCOUNT: '折扣券'
}

export const couponScopeMap = {
  ALL: '全场通用',
  TAXI: '即时打车',
  CARPOOL: '顺风车',
  INTERNATIONAL: '国际出行'
}

export const authStatusMap = {
  0: '未认证',
  1: '待审核',
  2: '已通过',
  3: '已驳回'
}

export const clientTypeMap = {
  ADMIN: '管理后台',
  USER_MINIAPP: '乘客端小程序',
  DRIVER_MINIAPP: '司机端小程序'
}

export function formatMoney(value, currencyCode = 'CNY') {
  const amount = Number(value || 0)
  const symbol = currencyCode === 'USD' ? '$' : '¥'
  return `${symbol}${amount.toFixed(2)}`
}

export function formatNumber(value, digits = 0) {
  return Number(value || 0).toFixed(digits)
}

export function formatDateTime(value) {
  if (!value) return '暂无数据'
  if (Array.isArray(value)) {
    const [year, month, day, hours = 0, minutes = 0, seconds = 0] = value
    if (year && month && day) {
      return [
        `${year}`.padStart(4, '0'),
        `${month}`.padStart(2, '0'),
        `${day}`.padStart(2, '0')
      ].join('-') + ` ${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
    }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ')
  }
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function formatPercent(value, digits = 2) {
  return `${Number(value || 0).toFixed(digits)}%`
}

export function getOrderStatusLabel(row = {}) {
  const status = row.displayStatus || row.orderStatus || row.status
  return orderStatusMap[status] || status || '未知状态'
}

export function getOrderStatusType(row = {}) {
  const status = row.displayStatus || row.orderStatus || row.status
  if (status === 'REFUNDED') return 'danger'
  if (status === 'FINISHED') return 'success'
  if (status === 'IN_TRIP' || status === 'PICKING_UP' || status === 'ACCEPTED') return 'warning'
  if (status === 'CANCELLED') return 'info'
  return ''
}

export function getPayStatusType(status) {
  if (status === 'PAID') return 'success'
  if (status === 'REFUNDED') return 'danger'
  if (status === 'UNPAID') return 'warning'
  return 'info'
}

export function textOf(map, key, fallback = '未知') {
  return map[key] || key || fallback
}
