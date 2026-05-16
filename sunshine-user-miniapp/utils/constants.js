const ROLE_CODE = {
  USER: 'USER',
  DRIVER: 'DRIVER',
  ADMIN: 'ADMIN'
}

const SERVICE_TYPE = {
  TAXI: 'TAXI',
  CARPOOL: 'CARPOOL',
  INTERNATIONAL: 'INTERNATIONAL'
}

const ORDER_STATUS = {
  CREATED: 'CREATED',
  DISPATCHING: 'DISPATCHING',
  ACCEPTED: 'ACCEPTED',
  PICKING_UP: 'PICKING_UP',
  IN_TRIP: 'IN_TRIP',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED'
}

const PAY_STATUS = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
}

const COUPON_TYPE = {
  CASH: 'CASH',
  DISCOUNT: 'DISCOUNT'
}

const COUPON_STATUS = {
  UNUSED: 'UNUSED',
  USED: 'USED',
  EXPIRED: 'EXPIRED'
}

const AUTH_STATUS = {
  UNVERIFIED: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3
}

const DRIVER_SERVICE_STATUS = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  BUSY: 'BUSY'
}

const ERROR_CODE = {
  SUCCESS: 0,
  BUSINESS_ERROR: 4000,
  PARAM_ERROR: 4001,
  UNAUTHORIZED: 4002,
  FORBIDDEN: 4003,
  DATA_NOT_FOUND: 4004,
  STATUS_ERROR: 4005,
  DUPLICATE_REQUEST: 4006,
  COUPON_INVALID: 4007,
  ORDER_INVALID: 4008,
  DRIVER_INVALID: 4009,
  SYSTEM_ERROR: 5000
}

const SERVICE_LABEL_MAP = {
  [SERVICE_TYPE.TAXI]: '即时打车',
  [SERVICE_TYPE.CARPOOL]: '顺风车',
  [SERVICE_TYPE.INTERNATIONAL]: '国际出行'
}

const ORDER_STATUS_LABEL_MAP = {
  [ORDER_STATUS.CREATED]: '已创建',
  [ORDER_STATUS.DISPATCHING]: '等待接单',
  [ORDER_STATUS.ACCEPTED]: '司机已接单',
  [ORDER_STATUS.PICKING_UP]: '司机接驾中',
  [ORDER_STATUS.IN_TRIP]: '行程中',
  [ORDER_STATUS.FINISHED]: '已结束',
  [ORDER_STATUS.CANCELLED]: '已取消'
}

const PAY_STATUS_LABEL_MAP = {
  [PAY_STATUS.UNPAID]: '待支付',
  [PAY_STATUS.PAID]: '已支付',
  [PAY_STATUS.REFUNDED]: '已退款'
}

const COUPON_SCOPE_LABEL_MAP = {
  ALL: '全场通用',
  [SERVICE_TYPE.TAXI]: '即时打车',
  [SERVICE_TYPE.CARPOOL]: '顺风车',
  [SERVICE_TYPE.INTERNATIONAL]: '国际出行'
}

const AUTH_STATUS_LABEL_MAP = {
  [AUTH_STATUS.UNVERIFIED]: '未实名',
  [AUTH_STATUS.PENDING]: '审核中',
  [AUTH_STATUS.APPROVED]: '已认证',
  [AUTH_STATUS.REJECTED]: '已驳回'
}

function getServiceLabel(serviceType) {
  return SERVICE_LABEL_MAP[serviceType] || serviceType || '-'
}

function getPayStatusLabel(payStatus) {
  return PAY_STATUS_LABEL_MAP[payStatus] || payStatus || '-'
}

function getCouponScopeLabel(scope) {
  return COUPON_SCOPE_LABEL_MAP[scope] || scope || '通用'
}

function getAuthStatusLabel(status) {
  return AUTH_STATUS_LABEL_MAP[status] || '未实名'
}

function getOrderStatusMeta(orderStatus, payStatus) {
  if (orderStatus === ORDER_STATUS.CANCELLED) {
    return {
      key: 'cancelled',
      label: '已取消',
      tagType: 'danger'
    }
  }

  if (orderStatus === ORDER_STATUS.FINISHED) {
    if (payStatus === PAY_STATUS.UNPAID) {
      return {
        key: 'waiting-pay',
        label: '待支付',
        tagType: 'waiting'
      }
    }

    if (payStatus === PAY_STATUS.REFUNDED) {
      return {
        key: 'refunded',
        label: '已退款',
        tagType: 'danger'
      }
    }

    return {
      key: 'completed',
      label: '已完成',
      tagType: 'success'
    }
  }

  if ([ORDER_STATUS.DISPATCHING, ORDER_STATUS.CREATED].includes(orderStatus)) {
    return {
      key: 'dispatching',
      label: ORDER_STATUS_LABEL_MAP[orderStatus],
      tagType: 'waiting'
    }
  }

  return {
    key: 'processing',
    label: ORDER_STATUS_LABEL_MAP[orderStatus] || '进行中',
    tagType: 'processing'
  }
}

module.exports = {
  AUTH_STATUS,
  COUPON_SCOPE_LABEL_MAP,
  COUPON_STATUS,
  COUPON_TYPE,
  DRIVER_SERVICE_STATUS,
  ERROR_CODE,
  ORDER_STATUS,
  ORDER_STATUS_LABEL_MAP,
  PAY_STATUS,
  PAY_STATUS_LABEL_MAP,
  ROLE_CODE,
  SERVICE_LABEL_MAP,
  SERVICE_TYPE,
  getAuthStatusLabel,
  getCouponScopeLabel,
  getOrderStatusMeta,
  getPayStatusLabel,
  getServiceLabel
}
