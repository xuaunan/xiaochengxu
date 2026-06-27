const { fetchMessages, fetchOrders } = require('../../utils/api')
const { mapTripOrder } = require('../../utils/driver-store')
const { runGuarded } = require('../../utils/page')

const SERVICE_ICON_PATHS = {
  taxi: '/images/service-icons/taxi.png',
  carpool: '/images/service-icons/carpool.png',
  international: '/images/service-icons/international.png'
}

const TAB_ROUTES = new Set([
  '/pages/dashboard/index',
  '/pages/orders/index',
  '/pages/wallet/index',
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
  if (/支付|付款|收入/.test(text)) return 'paid'
  if (/结束|完成/.test(text)) return 'finish'
  if (/开始|上车/.test(text)) return 'start'
  if (/接驾|前往/.test(text)) return 'car'
  if (/司机|接单|审核/.test(text)) return 'driver'
  return 'notice'
}

function getMessageText(message = {}) {
  return `${message.title || ''} ${message.content || ''} ${message.type || ''} ${message.templateCode || ''} ${message.bizType || ''}`
}

function normalizeUrl(url = '') {
  const text = `${url || ''}`.trim()
  if (!text || !text.startsWith('/pages/')) return ''
  return text
}

function extractOrderToken(message = {}) {
  const direct = message.orderId || message.orderNo || message.bizId || message.targetId
  if (direct) return `${direct}`
  const matched = getMessageText(message).match(/(?:订单|行程|order)[^\dA-Za-z]*([A-Za-z0-9_-]{4,})/i)
  return matched ? matched[1] : ''
}

function getOrderId(order = {}) {
  return order.id || order.orderId || order.order_id || order.orderNo || order.order_no || ''
}

function getOrderTypeKey(order = {}) {
  const serviceType = `${order.serviceType || order.service_type || ''}`.toUpperCase()
  if (serviceType === 'CARPOOL') return 'carpool'
  if (serviceType === 'INTERNATIONAL') return 'international'
  return 'taxi'
}

function mapDriverOrderCache(order = {}) {
  const mapped = mapTripOrder(order)
  const serviceTypeKey = getOrderTypeKey(mapped)
  return {
    ...mapped,
    serviceTypeKey,
    serviceIconPath: SERVICE_ICON_PATHS[serviceTypeKey] || SERVICE_ICON_PATHS.taxi
  }
}

function findOrderByMessage(message = {}) {
  const token = extractOrderToken(message)
  if (!token) return null
  const orders = getApp().globalData.driverStore.tripOrders || []
  return orders.find((order) => {
    return [order.id, order.orderId, order.order_id, order.orderNo, order.order_no]
      .some((value) => value !== undefined && value !== null && `${value}` === `${token}`)
  }) || null
}

function isOrderMessage(message = {}) {
  return /ORDER|订单|行程|乘客|接单|接驾|上车|取消|支付|付款|完成|结束/.test(getMessageText(message))
}

function isWalletMessage(message = {}) {
  return /WALLET|WITHDRAW|钱包|收入|收益|提现|结算|打款/.test(getMessageText(message))
}

function isVehicleMessage(message = {}) {
  return /CERT|车辆|认证|审核|证照|接单权限/.test(getMessageText(message))
}

function isProcessingOrder(order = {}) {
  const status = `${order.status || order.orderStatus || order.order_status || order.rawStatus || ''}`.toUpperCase()
  return ['PROCESSING', 'ACCEPTED', 'PICKING_UP', 'IN_TRIP'].includes(status)
}

function resolveMessageTarget(message = {}) {
  const explicitUrl = normalizeUrl(message.url || message.linkUrl || message.targetUrl || message.path)
  if (explicitUrl) return explicitUrl

  const order = findOrderByMessage(message)
  if (order) {
    const orderId = getOrderId(order)
    if (!orderId) return '/pages/orders/index'
    return isProcessingOrder(order)
      ? `/pages/trip-progress/index?id=${orderId}`
      : `/pages/trip-detail/index?id=${orderId}`
  }

  if (isOrderMessage(message)) return '/pages/orders/index'
  if (isWalletMessage(message)) return '/pages/wallet/index'
  if (isVehicleMessage(message)) return '/pages/onboarding/index'
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
    const localMessages = getApp().globalData.driverStore.messages || []
    this.setData({
      list: localMessages.map(mapMessageView)
    })
    try {
      const response = await fetchMessages()
      const remoteMessages = response.data || []
      const remoteIds = new Set(remoteMessages.map((item) => `${item.id}`))
      this.setData({
        list: remoteMessages.concat(localMessages.filter((item) => !remoteIds.has(`${item.id}`))).map(mapMessageView)
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
      await this.ensureOrdersForMessage(message)
      const targetUrl = resolveMessageTarget(message)
      if (!targetUrl) {
        wx.showToast({
          title: '当前消息暂无可跳转页面',
          icon: 'none'
        })
        return
      }
      this.navigateToMessageTarget(targetUrl)
    })
  },

  markLocalMessageRead(messageId) {
    const list = (this.data.list || []).map((item) => {
      if (`${item.id || ''}` !== `${messageId}`) return item
      return {
        ...item,
        unread: false,
        read: true
      }
    })
    this.setData({ list })

    const store = getApp().globalData.driverStore || {}
    store.messages = (store.messages || []).map((item) => {
      if (`${item.id || ''}` !== `${messageId}`) return item
      return {
        ...item,
        unread: false,
        read: true
      }
    })
    getApp().saveStore()
  },

  async ensureOrdersForMessage(message = {}) {
    if (!isOrderMessage(message) || findOrderByMessage(message)) return
    try {
      const response = await fetchOrders()
      getApp().globalData.driverStore.tripOrders = (response.data || []).map(mapDriverOrderCache)
      getApp().saveStore()
    } catch (error) {
      console.warn('Failed to refresh driver orders for message navigation', error)
    }
  },

  navigateToMessageTarget(url) {
    const route = url.split('?')[0]
    if (TAB_ROUTES.has(route)) {
      wx.switchTab({ url: route })
      return
    }
    wx.navigateTo({ url })
  }
})
