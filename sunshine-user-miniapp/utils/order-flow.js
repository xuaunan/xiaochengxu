const { ORDER_STATUS, PAY_STATUS, SERVICE_TYPE } = require('./constants')
const { redirectToSilky } = require('./page')

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

function getActivePageContext() {
  if (typeof getCurrentPages !== 'function') return null
  const pages = getCurrentPages()
  return pages[pages.length - 1] || null
}

function getOrderFlowTransitionSelector(currentRoute = '') {
  return /driver-arrival|trip-progress/.test(currentRoute)
    ? '.home-page'
    : '.page-shell'
}

function redirectToOrderFlow(currentRoute, order = {}, context = null) {
  const targetUrl = buildOrderFlowUrl(order)
  if (!targetUrl || !shouldRedirectToOrderFlow(currentRoute, order)) {
    return false
  }

  const pageContext = context || getActivePageContext()
  if (pageContext && typeof pageContext.setData === 'function') {
    redirectToSilky(pageContext, {
      url: targetUrl
    }, {
      selector: getOrderFlowTransitionSelector(currentRoute)
    })
    return true
  }

  wx.redirectTo({ url: targetUrl })
  return true
}

module.exports = {
  buildOrderFlowUrl,
  getOrderFlowRoute,
  redirectToOrderFlow,
  shouldRedirectToOrderFlow
}
