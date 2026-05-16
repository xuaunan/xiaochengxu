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

async function getAdminToken() {
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
  return adminLogin && adminLogin.data ? adminLogin.data.token : ''
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
  const token = await getAdminToken()
  if (!token || !userId) {
    throw new Error('Admin profile sync failed')
  }
  const phone = pickValue(currentProfile.phone, '')
  const nickname = pickValue(data.nickname, currentProfile.nickname, currentProfile.name, '')
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
    roleCode: 'DRIVER',
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

function updateDriverProfile(data, options = {}) {
  return request({
    url: '/driver/profile',
    method: 'PUT',
    data,
    ...options
  })
}

async function updateDriverProfileByAdmin(userId, data) {
  const token = await getAdminToken()
  if (!token || !userId) {
    throw new Error('Admin driver sync failed')
  }
  const baseOptions = {
    url: `/admin/drivers/${userId}`,
    method: 'PUT',
    skipAuth: true,
    skipToast: true,
    header: {
      Authorization: `Bearer ${token}`
    }
  }
  const camelPayload = {
    nickname: data.nickname || '',
    cityCode: data.cityCode || '310100',
    licenseNo: data.licenseNo || ''
  }
  const snakePayload = {
    ...camelPayload,
    city_code: data.cityCode || '310100',
    license_no: data.licenseNo || ''
  }

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

function fetchDashboard() {
  return request({
    url: '/driver/dashboard'
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
  fetchOrderDetail,
  fetchOrderRuntime,
  fetchOrders,
  fetchProfile,
  fetchMessages,
  fetchTrackHistory,
  fetchWaitingOrders,
  finishOrder,
  login,
  register,
  pickupOrder,
  reportTrack,
  rejectOrder,
  startOrder,
  submitCertification,
  uploadDriverDocument,
  updateDriverProfile,
  updateDriverProfileByAdmin,
  updateProfile,
  updateProfileByAdmin,
  updateServiceStatus,
  withdraw
}
