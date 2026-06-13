const { fetchMessages, fetchOrders, markMessageRead } = require('../../utils/api')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const { navigateToSilky, runGuarded, switchTabSilky } = require('../../utils/page')
const { syncOrdersToCache } = require('../../utils/user-store')

const TAB_ROUTES = new Set([
  '/pages/home/index',
  '/pages/orders/index',
  '/pages/carpool/index',
  '/pages/coupon/index',
  '/pages/profile/index'
])

function formatMessageTime(value = '') {
  const text = `${value || ''}`.trim()
  const match = text.match(/(\d{2})-(\d{2})[ T](\d{2}:\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]} ${match[3]}`
  }
  return text
}

function inferIconClass(message = {}) {
  const text = `${message.title || ''} ${message.content || ''} ${message.type || ''}`
  if (/取消/.test(text)) return 'cancel'
  if (/创建|提交/.test(text)) return 'order'
  if (/支付|付款/.test(text)) return 'paid'
  if (/结束|完成/.test(text)) return 'finish'
  if (/开始|上车/.test(text)) return 'start'
  if (/接驾|前往/.test(text)) return 'car'
  if (/司机|接单/.test(text)) return 'driver'
  return 'notice'
}

function getMessageText(message = {}) {
  return `${message.title || ''} ${message.content || ''} ${message.type || ''} ${message.templateCode || ''}`
}

function normalizeUrl(url = '') {
  const text = `${url || ''}`.trim()
  if (!text || !text.startsWith('/pages/')) return ''
  return text
}

function extractOrderToken(message = {}) {
  const direct = message.orderId || message.orderNo || message.bizId || message.targetId
  if (direct) return `${direct}`
  const text = getMessageText(message)
  const matched = text.match(/订单\s*([A-Za-z0-9_-]{6,})/) ||
    text.match(/\b(ORD[0-9A-Za-z_-]{8,}|SX[0-9A-Za-z_-]{8,}|ride-[0-9A-Za-z_-]+)\b/)
  return matched ? matched[1] : ''
}

function getCachedOrders() {
  const store = getApp().globalData.userStore || {}
  const orders = Array.isArray(store.orders) ? store.orders : []
  return store.currentRideOrder ? orders.concat(store.currentRideOrder) : orders
}

function findOrderByMessage(message = {}) {
  const token = extractOrderToken(message)
  if (!token) return null
  return getCachedOrders().find((order) => {
    return `${order.id || ''}` === token || `${order.orderNo || ''}` === token
  }) || null
}

function isInvoiceMessage(message = {}) {
  return /INVOICE|发票/.test(getMessageText(message))
}

function isCouponMessage(message = {}) {
  return /COUPON|优惠券|券|会员/.test(getMessageText(message))
}

function isOrderMessage(message = {}) {
  return /ORDER|订单|支付|行程|司机|接单|取消/.test(getMessageText(message))
}

function buildInvoiceUrl(message = {}, order = null) {
  const text = getMessageText(message)
  const tab = /ISSUED|开具|开票|查看发票/.test(text) ? 'issued' : 'apply'
  const query = order && order.id ? `&orderId=${encodeURIComponent(order.id)}` : ''
  return `/pages/invoice/index?tab=${tab}${query}`
}

function resolveMessageTarget(message = {}) {
  const explicitUrl = normalizeUrl(message.url || message.linkUrl || message.targetUrl || message.path)
  if (explicitUrl) return explicitUrl

  const order = findOrderByMessage(message)
  if (isInvoiceMessage(message)) {
    return buildInvoiceUrl(message, order)
  }
  if (isCouponMessage(message)) {
    return '/pages/coupon/index'
  }
  if (order) {
    return buildOrderFlowUrl(order) || `/pages/order-detail/index?id=${order.id}`
  }
  if (isOrderMessage(message)) {
    return '/pages/orders/index'
  }
  return ''
}

function mapMessageView(message = {}) {
  return {
    ...message,
    iconClass: inferIconClass(message),
    displayTime: formatMessageTime(message.time || message.createdAt)
  }
}

Page({
  data: {
    list: []
  },

  async onShow() {
    const cachedMessages = getApp().globalData.userStore.messages || []
    this.setData({
      list: cachedMessages.map(mapMessageView)
    })
    try {
      const response = await fetchMessages()
      const remoteMessages = response.data || []
      getApp().globalData.userStore.messages = remoteMessages
      getApp().saveUserStore()
      this.setData({
        list: remoteMessages.map(mapMessageView)
      })
    } catch (error) {
      wx.showToast({
        title: '消息刷新失败，请稍后重试',
        icon: 'none'
      })
    }
  },

  openMessage(e) {
    runGuarded(this, '__openingMessage', async () => {
      const messageId = `${e.currentTarget.dataset.id || ''}`
      const message = (this.data.list || []).find((item) => `${item.id || ''}` === messageId)
      if (!message) return

      this.markLocalMessageRead(messageId)
      this.markRemoteMessageRead(messageId)

      await this.ensureOrdersForMessage(message)
      const targetUrl = resolveMessageTarget(message)
      if (!targetUrl) {
        wx.showToast({ title: '当前消息暂无详情页', icon: 'none' })
        return
      }
      await this.navigateToMessageTarget(targetUrl)
    })
  },

  markLocalMessageRead(messageId) {
    const list = (this.data.list || []).map((item) => {
      if (`${item.id || ''}` !== `${messageId}`) return item
      return {
        ...item,
        unread: false,
        read: true,
        isRead: true,
        readStatus: 'READ'
      }
    })
    const app = getApp()
    const store = app.globalData.userStore || {}
    store.messages = (store.messages || []).map((item) => {
      if (`${item.id || ''}` !== `${messageId}`) return item
      return {
        ...item,
        unread: false,
        read: true,
        isRead: true,
        readStatus: 'READ'
      }
    })
    app.globalData.userStore = store
    app.saveUserStore()
    this.setData({ list })
  },

  markRemoteMessageRead(messageId) {
    if (!/^\d+$/.test(`${messageId}`)) return
    markMessageRead(messageId).catch(() => {})
  },

  async ensureOrdersForMessage(message = {}) {
    if (!isOrderMessage(message) && !isInvoiceMessage(message)) return
    if (findOrderByMessage(message)) return
    try {
      const response = await fetchOrders()
      syncOrdersToCache(response.data || [])
    } catch (error) {
      console.warn('Failed to refresh orders for message navigation', error)
    }
  },

  navigateToMessageTarget(url) {
    const route = `${url || ''}`.split('?')[0]
    if (TAB_ROUTES.has(route)) {
      return switchTabSilky(this, { url: route })
    }
    return navigateToSilky(this, {
      url,
      fail: () => {
        wx.showToast({ title: '页面打开失败', icon: 'none' })
      }
    })
  }
})
