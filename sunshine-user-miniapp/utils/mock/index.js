const { deepClone } = require('../format')
const {
  buildRideOrder,
  createUserStore,
  estimateRide,
  getCouponsByStatus,
  getHomePayload,
  getInvoiceList,
  helpList,
  internationalOptions,
  searchPois
} = require('./user')

function parseQuery(url) {
  const query = {}
  if (!url.includes('?')) return query
  url.split('?')[1].split('&').forEach((pair) => {
    const [key, value] = pair.split('=')
    query[key] = decodeURIComponent(value)
  })
  return query
}

function getStore() {
  const app = getApp()
  if (!app.globalData.userStore) {
    app.globalData.userStore = createUserStore()
  }
  return app.globalData.userStore
}

function mockRequest({ url, method = 'GET', data = {} }) {
  const store = getStore()
  const query = parseQuery(url)
  const pureUrl = url.split('?')[0]

  return new Promise((resolve) => {
    setTimeout(() => {
      let payload = null

      if (pureUrl === '/auth/login' && method === 'POST') {
        store.loggedIn = true
        payload = {
          token: 'mock-user-token',
          profile: deepClone(store.userProfile)
        }
      }

      if (pureUrl === '/home/bootstrap') {
        payload = getHomePayload(store)
      }

      if (pureUrl === '/geo/search') {
        payload = searchPois(query.keyword || data.keyword || '')
      }

      if (pureUrl === '/ride/estimate' && method === 'POST') {
        const coupon = store.coupons.find((item) => item.id === data.useCouponId)
        payload = estimateRide(data, data.selectedCarTypeId, coupon)
      }

      if (pureUrl === '/ride/order' && method === 'POST') {
        payload = buildRideOrder(store, data)
      }

      if (pureUrl === '/orders') {
        payload = deepClone(store.orders)
      }

      if (pureUrl === '/coupons') {
        payload = getCouponsByStatus(store, query.status || 'all')
      }

      if (pureUrl === '/messages') {
        payload = deepClone(store.messages)
      }

      if (pureUrl === '/help/faqs') {
        payload = deepClone(helpList)
      }

      if (pureUrl === '/international/options') {
        payload = deepClone(internationalOptions)
      }

      if (pureUrl === '/invoice/list') {
        payload = getInvoiceList(store)
      }

      resolve({
        code: 0,
        message: 'ok',
        data: payload
      })
    }, 260)
  })
}

module.exports = {
  mockRequest
}
