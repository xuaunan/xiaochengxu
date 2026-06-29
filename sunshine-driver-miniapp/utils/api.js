const { request, uploadFile } = require('./request')

function getDocumentResponseFileKeys(documentType) {
  if (documentType === 'VEHICLE_LICENSE') {
    return [
      'vehicleLicenseImageUrl',
      'vehicleLicenseUrl',
      'vehicleImageUrl'
    ]
  }

  return [
    'driverLicenseImageUrl',
    'driverLicenseUrl',
    'licenseImageUrl'
  ]
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
    ...options
  })
}

function updateDriverProfile(data, options = {}) {
  return request({
    url: '/driver/profile',
    method: 'PUT',
    data,
    ...options
  })
}

function fetchDashboard() {
  return request({
    url: '/driver/dashboard'
  })
}

function fetchWithdraws(options = {}) {
  return request({
    url: '/driver/withdraws',
    ...options
  })
}

function fetchHome(options = {}) {
  return request({
    url: '/app/home',
    data: {
      role: options.role || 'DRIVER'
    },
    skipToast: Boolean(options.skipToast)
  })
}

function updateServiceStatus(data, options = {}) {
  return request({
    url: '/driver/service-status',
    method: 'POST',
    data,
    ...options
  })
}

function submitCertification(data) {
  return request({
    url: '/driver/certification',
    method: 'POST',
    data
  })
}

function uploadDriverDocument(filePath, documentType) {
  return uploadFile({
    filePath,
    name: 'file',
    skipToast: true,
    responseFileKeys: getDocumentResponseFileKeys(documentType),
    formData: {
      bizType: 'driver-certification',
      documentType
    }
  })
}

function fetchWaitingOrders(options = {}) {
  return request({
    url: '/orders/waiting',
    skipToast: Boolean(options.skipToast)
  })
}

function fetchOrders() {
  return request({
    url: '/orders/mine'
  })
}

function fetchOrderDetail(orderId) {
  return request({
    url: `/orders/${orderId}`
  })
}

function fetchOrderRuntime(orderId) {
  return request({
    url: `/orders/${orderId}/runtime`
  })
}

function fetchTrackHistory(orderId) {
  return request({
    url: `/orders/${orderId}/track/history`
  })
}

function reportTrack(orderId, data) {
  return request({
    url: `/orders/${orderId}/track/report`,
    method: 'POST',
    data,
    skipToast: true
  })
}

function acceptOrder(orderId) {
  return request({
    url: `/orders/${orderId}/accept`,
    method: 'POST'
  })
}

function rejectOrder(orderId, reason) {
  return request({
    url: `/orders/${orderId}/reject`,
    method: 'POST',
    data: { reason }
  })
}

function startOrder(orderId) {
  return request({
    url: `/orders/${orderId}/start`,
    method: 'POST'
  })
}

function pickupOrder(orderId) {
  return request({
    url: `/orders/${orderId}/pickup`,
    method: 'POST'
  })
}

function finishOrder(orderId, data) {
  return request({
    url: `/orders/${orderId}/finish`,
    method: 'POST',
    data
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

function withdraw(data) {
  return request({
    url: '/driver/withdraw',
    method: 'POST',
    data
  })
}

module.exports = {
  acceptOrder,
  fetchDashboard,
  fetchHome,
  fetchOrderDetail,
  fetchOrderRuntime,
  fetchOrders,
  fetchProfile,
  fetchMessages,
  fetchSupportConversation,
  fetchSupportMessages,
  fetchTrackHistory,
  fetchWaitingOrders,
  fetchWithdraws,
  finishOrder,
  login,
  register,
  pickupOrder,
  reportTrack,
  rejectOrder,
  sendSupportMessage,
  startOrder,
  submitCertification,
  uploadDriverDocument,
  updateDriverProfile,
  updateProfile,
  updateServiceStatus,
  withdraw
}
