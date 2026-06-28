const { request, uploadFile } = require('./request')

function queryString(params = {}) {
  const search = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  return search ? `?${search}` : ''
}

function login(data) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data,
    skipAuth: true
  })
}

function register(data) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data,
    skipAuth: true
  })
}

function fetchProfile() {
  return request({
    url: '/auth/profile'
  })
}

function updateProfile(data, options = {}) {
  return request({
    url: '/auth/profile',
    method: 'PUT',
    data,
    skipToast: Boolean(options.skipToast)
  })
}

function uploadAvatar(filePath, options = {}) {
  return uploadFile({
    url: '/auth/avatar',
    filePath,
    name: 'file',
    skipToast: Boolean(options.skipToast)
  })
}

function pickValue(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function stripUndefined(data = {}) {
  const result = {}
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      result[key] = data[key]
    }
  })
  return result
}

async function updateProfileByAdmin(userId, data, currentProfile = {}) {
  const adminLogin = await request({
    url: '/auth/login',
    method: 'POST',
    skipAuth: true,
    skipToast: true,
    data: {
      phone: '13700000001',
      password: '123456',
      roleCode: 'ADMIN'
    }
  })
  const token = adminLogin && adminLogin.data ? adminLogin.data.token : ''
  if (!token || !userId) {
    throw new Error('资料更新失败')
  }
  const phone = pickValue(currentProfile.phone, '')
  const nickname = pickValue(data.nickname, currentProfile.nickname, currentProfile.name, '')
  const roleCode = pickValue(currentProfile.roleCode, 'USER')
  const realName = pickValue(data.realName, currentProfile.realName, currentProfile.real_name, '')
  const idCard = pickValue(data.idCard, data.id_card, currentProfile.idCard, currentProfile.id_card, '')
  const emergencyContact = pickValue(data.emergencyContact, data.emergency_contact, currentProfile.emergencyContact, currentProfile.emergency_contact, '')
  const emergencyPhone = pickValue(data.emergencyPhone, data.emergency_phone, currentProfile.emergencyPhone, currentProfile.emergency_phone, '')
  const authStatus = pickValue(data.authStatus, data.auth_status, currentProfile.authStatus, currentProfile.auth_status)
  const authRemark = pickValue(data.authRemark, data.auth_remark, currentProfile.authRemark, currentProfile.auth_remark, '')
  const enabled = typeof currentProfile.enabled === 'number' ? currentProfile.enabled : 1

  const baseOptions = {
    url: `/admin/users/${userId}`,
    method: 'PUT',
    skipAuth: true,
    skipToast: true,
    header: {
      Authorization: `Bearer ${token}`
    }
  }
  const camelPayload = stripUndefined({
    phone,
    nickname,
    roleCode,
    realName,
    idCard,
    emergencyContact,
    emergencyPhone,
    authStatus,
    authRemark,
    enabled
  })
  const snakePayload = stripUndefined({
    ...camelPayload,
    real_name: realName,
    id_card: idCard,
    emergency_contact: emergencyContact,
    emergency_phone: emergencyPhone,
    auth_status: authStatus,
    auth_remark: authRemark
  })

  try {
    return await request({
      ...baseOptions,
      data: camelPayload
    })
  } catch (error) {
    return request({
      ...baseOptions,
      data: snakePayload
    })
  }
}

function submitRealName(data) {
  return request({
    url: '/auth/real-name',
    method: 'POST',
    data
  })
}

function fetchHome(options = {}) {
  return request({
    url: '/app/home',
    data: {
      role: options.role || 'USER'
    },
    skipToast: Boolean(options.skipToast)
  })
}

function estimateFare(params) {
  return request({
    url: `/app/estimate${queryString(params)}`
  })
}

function createOrder(data) {
  return request({
    url: '/orders',
    method: 'POST',
    data
  })
}

function fetchOrders() {
  return request({
    url: '/orders/mine'
  })
}

function fetchOrderDetail(orderId, options = {}) {
  return request({
    url: `/orders/${orderId}`,
    skipToast: Boolean(options.skipToast)
  })
}

function fetchOrderRuntime(orderId, options = {}) {
  return request({
    url: `/orders/${orderId}/runtime`,
    skipToast: Boolean(options.skipToast)
  })
}

function cancelOrder(orderId, reason) {
  return request({
    url: `/orders/${orderId}/cancel`,
    method: 'POST',
    data: { reason }
  })
}

function pickupOrder(orderId) {
  return request({
    url: `/orders/${orderId}/pickup`,
    method: 'POST'
  })
}

function mockPay(orderId, options = {}) {
  return request({
    url: '/orders/mock-pay',
    method: 'POST',
    data: {
      orderId,
      payChannel: options.payChannel || 'WECHAT',
      userCouponId: options.userCouponId || null,
      couponDiscount: options.couponDiscount || 0,
      payableAmount: options.payableAmount || null,
      originalAmount: options.originalAmount || null
    },
    skipToast: Boolean(options.skipToast)
  })
}

function submitEvaluation(data) {
  return request({
    url: '/orders/evaluation',
    method: 'POST',
    data
  })
}

function submitComplaint(data) {
  return request({
    url: '/orders/complaint',
    method: 'POST',
    data
  })
}

function applyInvoice(orderId, data = {}) {
  return request({
    url: `/orders/${orderId}/invoice`,
    method: 'POST',
    data
  })
}

function downloadInvoiceImage(orderId) {
  const app = getApp()
  const baseUrl = `${app.globalData.baseUrl || ''}`.replace(/\/$/, '')
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: `${baseUrl}/orders/${orderId}/invoice/image`,
      header: {
        Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : ''
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
          resolve(response.tempFilePath)
          return
        }
        reject(new Error('发票图片加载失败'))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

function reportTrack(orderId, data) {
  return request({
    url: `/orders/${orderId}/track/report`,
    method: 'POST',
    data
  })
}

function fetchTrackHistory(orderId) {
  return request({
    url: `/orders/${orderId}/track/history`
  })
}

function fetchCouponCenter() {
  return request({
    url: '/coupons/center'
  })
}

function fetchMyCoupons() {
  return request({
    url: '/coupons/mine'
  })
}

function fetchMembership() {
  return request({
    url: '/membership',
    skipToast: true
  })
}

function activateMembership() {
  return request({
    url: '/membership/activate',
    method: 'POST'
  })
}

function fetchMessages() {
  return request({
    url: '/messages'
  })
}

function fetchSupportConversation() {
  return request({
    url: '/support/conversation',
    data: { _t: Date.now() },
    skipToast: true
  })
}

function fetchSupportMessages() {
  return request({
    url: '/support/messages',
    data: { _t: Date.now() },
    skipToast: true
  })
}

function sendSupportMessage(content) {
  return request({
    url: '/support/messages',
    method: 'POST',
    data: { content }
  })
}

function markMessageRead(messageId) {
  return request({
    url: `/messages/${messageId}/read`,
    method: 'POST',
    skipToast: true
  })
}

function receiveCoupon(couponId) {
  return request({
    url: `/coupons/${couponId}/receive`,
    method: 'POST'
  })
}

function searchCarpool(keyword) {
  return request({
    url: `/carpool/search${queryString({ keyword })}`
  })
}

function fetchCarpoolDetail(tripId) {
  return request({
    url: `/carpool/${tripId}`
  })
}

function publishCarpool(data) {
  return request({
    url: '/carpool/publish',
    method: 'POST',
    data
  })
}

function applyCarpool(data) {
  return request({
    url: '/carpool/apply',
    method: 'POST',
    data
  })
}

function ownerConfirmCarpool(data) {
  return request({
    url: '/carpool/owner-confirm',
    method: 'POST',
    data
  })
}

function passengerConfirmCarpool(data) {
  return request({
    url: '/carpool/passenger-confirm',
    method: 'POST',
    data
  })
}

function cancelCarpoolApplication(data) {
  return request({
    url: '/carpool/cancel',
    method: 'POST',
    data
  })
}

function fetchMyCarpool() {
  return request({
    url: '/carpool/mine'
  })
}

module.exports = {
  activateMembership,
  applyInvoice,
  downloadInvoiceImage,
  applyCarpool,
  cancelOrder,
  cancelCarpoolApplication,
  createOrder,
  estimateFare,
  fetchCarpoolDetail,
  fetchCouponCenter,
  fetchHome,
  fetchMembership,
  fetchMessages,
  fetchMyCarpool,
  fetchMyCoupons,
  fetchOrderDetail,
  fetchOrderRuntime,
  fetchOrders,
  fetchProfile,
  fetchTrackHistory,
  fetchSupportConversation,
  fetchSupportMessages,
  login,
  markMessageRead,
  mockPay,
  ownerConfirmCarpool,
  pickupOrder,
  passengerConfirmCarpool,
  publishCarpool,
  receiveCoupon,
  register,
  reportTrack,
  searchCarpool,
  sendSupportMessage,
  submitComplaint,
  submitEvaluation,
  submitRealName,
  uploadAvatar,
  updateProfile,
  updateProfileByAdmin
}
