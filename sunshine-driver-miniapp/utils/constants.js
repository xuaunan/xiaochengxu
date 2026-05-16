const ROLE_CODE = {
  DRIVER: 'DRIVER'
}

const ORDER_STATUS = {
  DISPATCHING: 'DISPATCHING',
  ACCEPTED: 'ACCEPTED',
  PICKING_UP: 'PICKING_UP',
  IN_TRIP: 'IN_TRIP',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED'
}

const DRIVER_SERVICE_STATUS = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  BUSY: 'BUSY',
  DISABLED: 'DISABLED'
}

const SERVICE_TYPE = {
  TAXI: 'TAXI',
  CARPOOL: 'CARPOOL',
  INTERNATIONAL: 'INTERNATIONAL'
}

const AUTH_STATUS = {
  UNVERIFIED: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
  DISABLED: -1
}

const ERROR_CODE = {
  SUCCESS: 0,
  UNAUTHORIZED: 4002,
  SYSTEM_ERROR: 5000
}

function getDriverServiceText(status) {
  if (status === DRIVER_SERVICE_STATUS.ONLINE) return '听单中，可接收新订单'
  if (status === DRIVER_SERVICE_STATUS.BUSY) return '服务中，暂不可接收新订单'
  if (status === DRIVER_SERVICE_STATUS.DISABLED) return '账号已禁用，暂不可接单'
  return '休息中，暂未开启接单'
}

function getDriverServiceActionText(status) {
  if (status === DRIVER_SERVICE_STATUS.ONLINE) return '停止接单'
  return '开始接单'
}

function getOrderStatusMeta(status) {
  if (status === ORDER_STATUS.FINISHED) {
    return { key: 'completed', label: '已完成', tagType: 'success' }
  }
  if (status === ORDER_STATUS.CANCELLED) {
    return { key: 'cancelled', label: '已取消', tagType: 'waiting' }
  }
  return {
    key: 'processing',
    label: status === ORDER_STATUS.PICKING_UP
      ? '接驾中'
      : status === ORDER_STATUS.IN_TRIP
        ? '行程中'
        : '已接单',
    tagType: 'processing'
  }
}

function getAuthStatusMeta(status, disabled = false) {
  if (disabled || status === AUTH_STATUS.DISABLED) {
    return { text: '已禁用', className: 'disabled' }
  }
  if (status === AUTH_STATUS.APPROVED) {
    return { text: '已通过', className: 'success' }
  }
  if (status === AUTH_STATUS.PENDING) {
    return { text: '待审核', className: 'pending' }
  }
  if (status === AUTH_STATUS.REJECTED) {
    return { text: '已驳回', className: 'danger' }
  }
  return { text: '未提交', className: 'neutral' }
}

function getAuthStatusText(status, disabled = false) {
  return getAuthStatusMeta(status, disabled).text
}

function getServiceTypeMeta(serviceType) {
  if (serviceType === SERVICE_TYPE.CARPOOL) {
    return { label: '顺风车', className: 'waiting' }
  }
  if (serviceType === SERVICE_TYPE.INTERNATIONAL) {
    return { label: '国际出行', className: 'processing' }
  }
  return { label: '即时打车', className: 'success' }
}

module.exports = {
  AUTH_STATUS,
  DRIVER_SERVICE_STATUS,
  ERROR_CODE,
  ORDER_STATUS,
  ROLE_CODE,
  SERVICE_TYPE,
  getAuthStatusMeta,
  getAuthStatusText,
  getDriverServiceActionText,
  getDriverServiceText,
  getOrderStatusMeta,
  getServiceTypeMeta
}
