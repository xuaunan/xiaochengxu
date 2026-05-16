const { ORDER_STATUS, PAY_STATUS, SERVICE_TYPE } = require('./constants')

function getOrderFlowRoute(order = {}) {
  if (!order || !order.id) return ''

  if (order.serviceType === SERVICE_TYPE.CARPOOL) {
    return 'pages/order-detail/index'
  }

  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return 'pages/order-detail/index'
  }

  if (order.orderStatus === ORDER_STATUS.FINISHED) {
    return order.payStatus === PAY_STATUS.UNPAID
      ? 'pages/fare-settlement/index'
      : 'pages/order-detail/index'
  }

  if (order.orderStatus === ORDER_STATUS.IN_TRIP) {
    return 'pages/trip-progress/index'
  }

  if ([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus)) {
    return 'pages/driver-arrival/index'
  }

  return 'pages/taxi-waiting/index'
}

function buildOrderFlowUrl(order = {}) {
  const route = getOrderFlowRoute(order)
  if (!route) return ''
  return `/${route}?id=${order.id}`
}

function shouldRedirectToOrderFlow(currentRoute, order = {}) {
  const targetRoute = getOrderFlowRoute(order)
  if (!targetRoute) return false
  return `${currentRoute || ''}` !== targetRoute
}

function redirectToOrderFlow(currentRoute, order = {}) {
  const targetUrl = buildOrderFlowUrl(order)
  if (!targetUrl || !shouldRedirectToOrderFlow(currentRoute, order)) {
    return false
  }

  wx.redirectTo({
    url: targetUrl
  })
  return true
}

module.exports = {
  buildOrderFlowUrl,
  getOrderFlowRoute,
  redirectToOrderFlow,
  shouldRedirectToOrderFlow
}
