const { cancelOrder, fetchCouponCenter, fetchMyCoupons, fetchOrderDetail, fetchOrderRuntime, fetchOrders, pickupOrder, respondCarpoolToll } = require('../../utils/api')
const { formatPrice, parseDateValue } = require('../../utils/format')
const { COUPON_STATUS, ORDER_STATUS, PAY_STATUS, getPayStatusLabel, getServiceLabel } = require('../../utils/constants')
const { navigateToSilky, redirectToSilky, runExclusive, runGuarded } = require('../../utils/page')
const { buildOrderFlowUrl } = require('../../utils/order-flow')
const {
  buildOrderTimelineSteps,
  buildRideOrderModel,
  findCachedOrder,
  getCarTypeMap,
  mergeCoupons,
  syncOrdersToCache,
  syncOrderToCache
} = require('../../utils/user-store')

const PRICE_ANIMATION_FRAME_TOTAL = 12
const PRICE_ANIMATION_FRAME_DELAY = 18
const DETAIL_SYNC_INTERVAL = 5000
const ORDER_STAGE_MAP = {
  [ORDER_STATUS.CREATED]: 0,
  [ORDER_STATUS.DISPATCHING]: 1,
  [ORDER_STATUS.ACCEPTED]: 2,
  [ORDER_STATUS.PICKING_UP]: 3,
  [ORDER_STATUS.IN_TRIP]: 4,
  [ORDER_STATUS.FINISHED]: 5,
  [ORDER_STATUS.CANCELLED]: -1
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function firstText(...values) {
  const matched = values.find((value) => `${value || ''}`.trim())
  return matched === undefined ? '' : `${matched}`.trim()
}

function normalizeOrderStatusValue(value) {
  const raw = `${value || ''}`.trim()
  const upper = raw.toUpperCase()
  if (ORDER_STAGE_MAP[upper] !== undefined || upper === ORDER_STATUS.CANCELLED) return upper
  if (['completed', 'finished', 'waiting-pay', 'refunded'].includes(raw)) return ORDER_STATUS.FINISHED
  if (raw === 'cancelled') return ORDER_STATUS.CANCELLED
  if (raw === 'dispatching' || raw === 'waiting') return ORDER_STATUS.DISPATCHING
  return raw
}

function normalizeOrderStatusFields(order = null) {
  if (!order) return null
  return {
    ...order,
    orderStatus: normalizeOrderStatusValue(order.orderStatus || order.order_status || order.rawStatus || order.status),
    payStatus: order.payStatus || order.pay_status || PAY_STATUS.UNPAID
  }
}

function getOrderStage(order = {}) {
  if (!order || !order.orderStatus) return -1
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID) {
    return 6
  }
  return ORDER_STAGE_MAP[order.orderStatus] !== undefined ? ORDER_STAGE_MAP[order.orderStatus] : -1
}

function mergeOrderFields(base = {}, patch = {}) {
  const next = {
    ...base
  }

  Object.keys(patch || {}).forEach((key) => {
    if (hasMeaningfulValue(patch[key])) {
      next[key] = patch[key]
    }
  })

  return next
}

function mergeMissingOrderFields(base = {}, patch = {}) {
  const next = {
    ...base
  }

  Object.keys(patch || {}).forEach((key) => {
    if (!hasMeaningfulValue(next[key]) && hasMeaningfulValue(patch[key])) {
      next[key] = patch[key]
    }
  })

  return next
}

function shouldPreferCandidate(base = {}, candidate = {}) {
  if (!candidate || !candidate.orderStatus) return false
  if (!base || !base.orderStatus) return true

  if (candidate.payStatus === PAY_STATUS.PAID && base.payStatus !== PAY_STATUS.PAID) {
    return true
  }

  const baseStage = getOrderStage(base)
  const candidateStage = getOrderStage(candidate)

  if (base.orderStatus === ORDER_STATUS.CANCELLED && candidate.orderStatus !== ORDER_STATUS.CANCELLED) {
    return candidateStage >= 0
  }

  if (base.orderStatus === ORDER_STATUS.FINISHED && candidateStage >= ORDER_STAGE_MAP[ORDER_STATUS.ACCEPTED] && candidateStage < ORDER_STAGE_MAP[ORDER_STATUS.FINISHED]) {
    return true
  }

  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(base.orderStatus) && candidateStage > baseStage) {
    return true
  }

  if (candidate.orderStatus === ORDER_STATUS.IN_TRIP && base.orderStatus !== ORDER_STATUS.IN_TRIP) {
    return true
  }

  if (candidateStage > baseStage && candidateStage <= ORDER_STAGE_MAP[ORDER_STATUS.FINISHED]) {
    return true
  }

  return false
}

function findMatchingOrderSnapshot(orderId, orderNo, orders = []) {
  return (orders || []).find((item) => {
    if (!item) return false
    return `${item.id || ''}` === `${orderId || ''}` || `${item.orderNo || ''}` === `${orderNo || ''}`
  }) || null
}

function buildRuntimeOrderPatch(runtime = {}, currentOrder = {}) {
  if (currentOrder.serviceType === 'CARPOOL') {
    // 顺风车状态只由订单接口推进，轨迹缓存不能把待接单订单升级成接驾中。
    return null
  }
  const phase = `${runtime.phase || ''}`.toLowerCase()
  if (!phase) return null

  if (currentOrder.orderStatus === ORDER_STATUS.FINISHED) {
    return {
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (currentOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return {
      orderStatus: ORDER_STATUS.CANCELLED,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (phase === 'trip') {
    return {
      orderStatus: ORDER_STATUS.IN_TRIP,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  if (phase === 'approach') {
    return {
      orderStatus: currentOrder.orderStatus === ORDER_STATUS.ACCEPTED ? ORDER_STATUS.ACCEPTED : ORDER_STATUS.PICKING_UP,
      payStatus: currentOrder.payStatus || PAY_STATUS.UNPAID
    }
  }

  return null
}

function reconcileLiveOrder(detailOrder, listOrder, cachedOrder, runtime) {
  let effectiveOrder = normalizeOrderStatusFields(detailOrder || listOrder || cachedOrder || null)
  if (!effectiveOrder) return null

  const isCarpool = effectiveOrder.serviceType === 'CARPOOL'

  ;[listOrder, cachedOrder].forEach((candidate) => {
    if (!candidate) return
    const normalizedCandidate = normalizeOrderStatusFields(candidate)
    effectiveOrder = !isCarpool && shouldPreferCandidate(effectiveOrder, normalizedCandidate)
      ? mergeOrderFields(effectiveOrder, normalizedCandidate)
      : mergeMissingOrderFields(effectiveOrder, normalizedCandidate)
  })

  const runtimePatch = buildRuntimeOrderPatch(runtime, effectiveOrder)
  if (runtimePatch) {
    effectiveOrder = shouldPreferCandidate(effectiveOrder, runtimePatch)
      ? mergeOrderFields(effectiveOrder, runtimePatch)
      : mergeMissingOrderFields(effectiveOrder, runtimePatch)
  }

  return syncOrderToCache(normalizeOrderStatusFields(effectiveOrder))
}

function getCarTypeMapFromStore() {
  return getCarTypeMap(getApp().globalData.userStore.home.carTypes || [])
}

function ensurePendingCouponStore() {
  const app = getApp()
  if (!app.globalData.pendingPaymentCouponMap) {
    app.globalData.pendingPaymentCouponMap = {}
  }
  return app.globalData.pendingPaymentCouponMap
}

function getOrderKeys(orderId, orderNo) {
  return [orderId, orderNo].filter((value, index, list) => {
    return value && list.findIndex((item) => `${item}` === `${value}`) === index
  }).map((value) => `${value}`)
}

function getPendingCouponContext(orderId, orderNo) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return null
  const store = ensurePendingCouponStore()
  const current = keys.map((key) => store[key]).find(Boolean)
  return current ? { ...current } : null
}

function setPendingCouponContext(orderId, orderNo, context) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return
  const store = ensurePendingCouponStore()
  if (!context) {
    keys.forEach((key) => {
      delete store[key]
    })
    return
  }
  keys.forEach((key) => {
    store[key] = { ...context }
  })
}

function clearPendingCouponContext(orderId, orderNo) {
  const keys = getOrderKeys(orderId, orderNo)
  if (!keys.length) return
  const store = ensurePendingCouponStore()
  keys.forEach((key) => {
    delete store[key]
  })
}

function getOrderOriginalAmount(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return Math.max(0, toNumber(rawOrder.cancelFee, toNumber(rawOrder.payableAmount, 0)))
  }
  return toNumber(rawOrder.actualAmount, toNumber(rawOrder.estimatedAmount, toNumber(rawOrder.payableAmount)))
}

function getOrderPayableAmount(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return Math.max(0, toNumber(rawOrder.cancelFee, toNumber(rawOrder.payableAmount, 0)))
  }
  return Math.max(0, toNumber(rawOrder.payableAmount, getOrderOriginalAmount(rawOrder)))
}

function getWebExclusiveDiscountAmount(rawOrder = {}) {
  const directAmount = toNumber(rawOrder.webExclusiveDiscountAmount)
  if (directAmount > 0) return directAmount
  const metaAmount = toNumber(rawOrder.webExclusiveMeta && rawOrder.webExclusiveMeta.amount)
  return metaAmount > 0 ? metaAmount : 0
}

function canPayOrder(rawOrder = {}) {
  return rawOrder.orderStatus === ORDER_STATUS.FINISHED &&
    rawOrder.payStatus === PAY_STATUS.UNPAID &&
    getOrderPayableAmount(rawOrder) > 0
}

function hasPendingPayment(rawOrder = {}) {
  return canPayOrder(rawOrder)
}

function canUseCouponForOrder(rawOrder = {}) {
  return canPayOrder(rawOrder)
}

function getAmountCaption(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return hasPendingPayment(rawOrder) ? '取消费用待支付' : '取消费用'
  }
  return '订单总金额'
}

function getCouponDiscountAmount(coupon, amount) {
  const totalAmount = Math.max(0, toNumber(amount))
  if (!coupon) return 0
  if (coupon.discount) {
    return Number((totalAmount * (1 - toNumber(coupon.amount, 1))).toFixed(2))
  }
  return Number(Math.min(toNumber(coupon.amount), totalAmount).toFixed(2))
}

function buildCouponRuleText(coupon, currencyCode) {
  if (coupon.ruleDesc) return coupon.ruleDesc
  const thresholdText = toNumber(coupon.minAmount) > 0
    ? `满${formatPrice(coupon.minAmount, currencyCode)}可用`
    : '无门槛可用'
  const validityText = coupon.validDate ? `${coupon.validDate}前有效` : ''
  return [thresholdText, validityText].filter(Boolean).join(' · ')
}

function getCouponUnavailableReason(coupon, rawOrder, originalAmount) {
  const rawStatus = `${coupon.rawStatus || ''}`.toUpperCase()
  const status = `${coupon.status || ''}`.toLowerCase()
  if (rawStatus === COUPON_STATUS.USED || status === 'used') {
    return '已使用'
  }
  if (rawStatus === COUPON_STATUS.EXPIRED || status === 'expired') {
    return '已过期'
  }

  const validDate = parseDateValue(coupon.validDate)
  if (validDate && validDate.getTime() < Date.now()) {
    return '已过期'
  }

  const scopeCode = coupon.scopeCode || 'ALL'
  if (scopeCode !== 'ALL' && scopeCode !== rawOrder.serviceType) {
    return '不支持该业务类型'
  }

  if (originalAmount < toNumber(coupon.minAmount)) {
    return '未满足满减门槛'
  }

  return ''
}

function buildCouponOption(coupon, rawOrder) {
  const currencyCode = rawOrder.currencyCode || 'CNY'
  const originalAmount = getOrderOriginalAmount(rawOrder)
  const discountAmount = getCouponDiscountAmount(coupon, originalAmount)

  return {
    ...coupon,
    userCouponIdText: `${coupon.userCouponId || coupon.id || ''}`,
    discountAmount,
    discountAmountText: formatPrice(discountAmount, currencyCode),
    faceValueText: coupon.discount
      ? `${Math.round(toNumber(coupon.amount, 1) * 10)}折`
      : formatPrice(toNumber(coupon.amount), currencyCode),
    ruleText: buildCouponRuleText(coupon, currencyCode),
    validText: coupon.validDate ? `${coupon.validDate} 前有效` : ''
  }
}

function buildCouponGroups(rawOrder, coupons = []) {
  const originalAmount = getOrderOriginalAmount(rawOrder)
  const result = {
    available: [],
    unavailable: []
  }

  ;(coupons || []).forEach((item) => {
    const coupon = buildCouponOption(item, rawOrder)
    const unavailableReason = getCouponUnavailableReason(coupon, rawOrder, originalAmount)
    if (unavailableReason) {
      result.unavailable.push({
        ...coupon,
        unavailableReason
      })
      return
    }
    result.available.push(coupon)
  })

  result.available.sort((left, right) => right.discountAmount - left.discountAmount)
  return result
}

function formatDistanceValue(rawOrder = {}) {
  const actual = toNumber(rawOrder.actualDistanceKm)
  const estimated = toNumber(rawOrder.estimatedDistanceKm)
  const value = actual > 0 ? actual : estimated
  return value > 0 ? `${Number(value.toFixed(1))} 公里` : '待同步'
}

function formatDurationValue(rawOrder = {}) {
  const actual = toNumber(rawOrder.actualDurationMin)
  const estimated = toNumber(rawOrder.estimatedDurationMin)
  const value = Math.max(0, Math.round(actual > 0 ? actual : estimated))
  return value > 0 ? `${value} 分钟` : '待同步'
}

function getProgressValue(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) return 0
  if (rawOrder.orderStatus === ORDER_STATUS.FINISHED) return 100
  const stage = Math.max(0, getOrderStage(rawOrder))
  const divisor = rawOrder.serviceType === 'CARPOOL' ? 5 : 6
  return Math.min(100, Math.round((stage / divisor) * 100))
}

function getTimelineSummary(steps = []) {
  const current = (steps || []).find((item) => item.state === 'current')
  return current || (steps || []).filter((item) => item.state !== 'upcoming').slice(-1)[0] || (steps || [])[0] || null
}

function buildCarpoolTimelineSteps(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return [{
      key: 'cancelled',
      title: '订单已取消',
      description: order.cancelReason || '本次顺风车订单已关闭。',
      state: 'current',
      pulse: false
    }]
  }

  const paid = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID
  const stage = order.orderStatus === ORDER_STATUS.CREATED || order.orderStatus === ORDER_STATUS.DISPATCHING
    ? 1
    : order.orderStatus === ORDER_STATUS.ACCEPTED
      ? 2
      : order.orderStatus === ORDER_STATUS.PICKING_UP
        ? 3
        : order.orderStatus === ORDER_STATUS.IN_TRIP
          ? 4
          : 5
  const finalTitle = order.orderStatus === ORDER_STATUS.FINISHED
    ? (paid ? '订单已完成' : '待支付')
    : '行程完成'
  const items = [
    { key: 'submitted', title: '已提交', description: '乘客需求已提交，订单正在进入匹配流程。' },
    { key: 'matching', title: '匹配车主', description: '等待符合路线的车主接单。' },
    { key: 'accepted', title: '车主已接单', description: '车主已确认同行，等待开始接驾。' },
    { key: 'pickup', title: '接驾出发', description: '车主正在前往上车点。' },
    { key: 'trip', title: '行程进行中', description: '顺风车正在按约定路线行驶。' },
    { key: 'finished', title: finalTitle, description: paid ? '本次顺风车订单已完成。' : '行程结束，请完成支付。' }
  ]
  return items.map((item, index) => ({
    ...item,
    state: paid || index < stage ? 'completed' : index === stage ? 'current' : 'upcoming',
    pulse: index === stage && index === 4 && !paid
  }))
}

function clampProgress(value, fallback = 0) {
  const numeric = Number(value)
  const next = Number.isNaN(numeric) ? fallback : numeric
  return Math.max(0, Math.min(100, Math.round(next)))
}

function formatRuntimeDistance(value, fallback = '--') {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric <= 0) return fallback
  return `${Number(numeric.toFixed(1))} 公里`
}

function formatRuntimeMinutes(seconds, fallback = '--') {
  const numeric = Number(seconds)
  if (Number.isNaN(numeric) || numeric <= 0) return fallback
  return `${Math.max(1, Math.round(numeric / 60))} 分钟`
}

function compactFacts(items = []) {
  return items
    .filter((item) => item && `${item.value || ''}`.trim())
    .slice(0, 3)
}

function buildDriveStatusView(rawOrder = {}, runtime = {}, timelineSummary = {}) {
  const isCarpool = rawOrder.serviceType === 'CARPOOL'
  const runtimeText = firstText(runtime.displayText, runtime.stateText, runtime.phaseText, runtime.waitingText, runtime.trafficText)
  const progress = clampProgress(runtime.percent, getProgressValue(rawOrder))
  const remainingDistanceText = formatRuntimeDistance(runtime.remainDistanceKm, '')
  const traveledDistanceText = formatRuntimeDistance(runtime.traveledDistanceKm, formatDistanceValue(rawOrder))
  const elapsedText = formatRuntimeMinutes(runtime.elapsedSeconds, formatDurationValue(rawOrder))
  const amountText = formatPrice(getOrderPayableAmount(rawOrder), rawOrder.currencyCode || 'CNY')

  if (rawOrder.orderStatus === ORDER_STATUS.CANCELLED) {
    return {
      sectionTitle: '行程结果',
      subtitle: '订单已取消',
      description: firstText(rawOrder.cancelReason, '本单已取消，行程状态已同步。'),
      badge: '已关闭',
      visualType: 'cancelled',
      visualTitle: '服务已停止',
      visualHint: '不会继续派单或接驾',
      progress: 0,
      state: 'cancelled',
      facts: compactFacts([
        { label: '取消原因', value: rawOrder.cancelReason || '订单已关闭' },
        { label: '支付状态', value: getPayStatusLabel(rawOrder.payStatus) },
        { label: '订单费用', value: amountText }
      ])
    }
  }

  if (rawOrder.orderStatus === ORDER_STATUS.FINISHED) {
    const unpaid = rawOrder.payStatus === PAY_STATUS.UNPAID
    return {
      sectionTitle: '行程结果',
      subtitle: unpaid ? '行程已结束，待支付' : '行程已完成',
      description: unpaid
        ? `${isCarpool ? '车主' : '司机'}已完成行程，请完成本单支付。`
        : '已到达目的地，订单状态已完成。',
      badge: unpaid ? '待支付' : '已送达',
      visualType: 'finished',
      visualTitle: unpaid ? '费用待确认' : '本次行程完成',
      visualHint: unpaid ? '支付后可申请发票或评价' : '可查看发票、评价与售后',
      progress: 100,
      state: unpaid ? 'paying' : 'finished',
      facts: compactFacts([{ label: unpaid ? '待支付' : '实付金额', value: amountText, tone: 'strong' }])
    }
  }

  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(rawOrder.orderStatus)) {
    return {
      sectionTitle: isCarpool ? '订单状态' : '派单状态',
      subtitle: isCarpool ? '等待车主接单' : '正在为你派单',
      description: runtimeText || firstText(timelineSummary.description, isCarpool ? '需求已发布，车主会在大厅查看路线和时间后自主接单。' : '平台正在匹配合适司机。'),
      badge: '匹配中',
      visualType: 'dispatch',
      visualTitle: '附近司机筛选中',
      visualHint: '系统会优先匹配距离近、评分稳定的司机',
      progress: Math.max(12, progress),
      state: 'dispatching',
      facts: compactFacts([
        { label: isCarpool ? '匹配状态' : '派单状态', value: runtimeText || (isCarpool ? '等待车主接单' : '等待司机响应') },
        { label: '预计里程', value: formatDistanceValue(rawOrder) },
        { label: '预计时长', value: formatDurationValue(rawOrder) }
      ])
    }
  }

  if (rawOrder.orderStatus === ORDER_STATUS.ACCEPTED) {
    return {
      sectionTitle: isCarpool ? '车主状态' : '司机状态',
      subtitle: isCarpool ? '车主已接单' : '司机已接单',
      description: isCarpool ? '车主已确认同行，等待开始接驾。' : '司机已确认接单，准备前往上车点。',
      badge: '已接单',
      visualType: 'accepted',
      visualTitle: isCarpool ? '等待车主出发' : '等待司机出发',
      visualHint: isCarpool ? '车主开始接驾后会同步实时位置' : '司机开始接驾后会同步实时位置',
      progress: Math.max(36, progress),
      state: 'accepted',
      facts: compactFacts([
        { label: '接单状态', value: isCarpool ? '车主已确认' : '司机已确认' },
        { label: '上车点', value: firstText(rawOrder.startName, '待同步') },
        { label: '下一步', value: '等待开始接驾' }
      ])
    }
  }

  if (rawOrder.orderStatus === ORDER_STATUS.PICKING_UP) {
    return {
      sectionTitle: isCarpool ? '车主接驾' : '接驾状态',
      subtitle: isCarpool ? '车主正在前往上车点' : '司机接驾中',
      description: runtimeText || firstText(timelineSummary.description, isCarpool ? '车主正在前往上车点。' : '司机正在前往上车点。'),
      badge: '接驾',
      visualType: 'approach',
      visualTitle: '司机 → 上车点',
      visualHint: isCarpool ? '车主到达上车点后等待你确认上车' : (remainingDistanceText ? `距上车点约 ${remainingDistanceText}` : '请留意司机位置变化'),
      progress: Math.max(24, progress),
      state: 'approach',
      facts: compactFacts([
        { label: '接驾进度', value: runtimeText || (isCarpool ? '车主已接单' : '司机已接单') },
        { label: '剩余距离', value: remainingDistanceText || '同步中' },
        { label: '等待信息', value: firstText(runtime.waitingText, '暂无等待') }
      ])
    }
  }

  return {
    sectionTitle: isCarpool ? '顺风车行程' : '行驶状态',
    subtitle: isCarpool ? '顺风车行程进行中' : '行程进行中',
    description: runtimeText || firstText(timelineSummary.description, '车辆正在前往目的地。'),
    badge: '行程中',
    visualType: isCarpool ? 'carpool-trip' : 'trip',
    visualTitle: '起点 → 目的地',
    visualHint: isCarpool ? '按约定路线同行，抵达后完成结算' : (remainingDistanceText ? `剩余约 ${remainingDistanceText}` : '实时轨迹持续更新'),
    progress: Math.max(42, progress),
    state: 'trip',
    facts: isCarpool ? [] : compactFacts([
      { label: '行程进度', value: `${Math.max(42, progress)}%`, tone: 'strong' },
      { label: '已行驶', value: traveledDistanceText },
      { label: '已用时', value: elapsedText }
    ])
  }
}

function buildDetailMetrics(rawOrder = {}) {
  if (rawOrder.serviceType === 'CARPOOL') return []
  return [
    {
      key: 'distance',
      icon: 'route',
      value: formatDistanceValue(rawOrder),
      label: rawOrder.orderStatus === ORDER_STATUS.FINISHED ? '已行驶里程' : '预计里程'
    },
    {
      key: 'duration',
      icon: 'clock',
      value: formatDurationValue(rawOrder),
      label: rawOrder.orderStatus === ORDER_STATUS.FINISHED ? '已行驶时长' : '预计时长'
    },
    {
      key: 'progress',
      icon: 'progress',
      value: `${getProgressValue(rawOrder)}%`,
      label: '当前进度'
    }
  ]
}

function buildAppliedCoupon(rawOrder, coupons = []) {
  const webExclusiveDiscountAmount = getWebExclusiveDiscountAmount(rawOrder)
  const discountAmount = Math.max(0, Number((toNumber(rawOrder.couponDiscount) - webExclusiveDiscountAmount).toFixed(2)))
  if (discountAmount <= 0) return null

  const matchedCoupon = (coupons || []).find((item) => {
    return `${item.userCouponId || item.id || ''}` === `${rawOrder.userCouponId || ''}`
  })
  const currencyCode = rawOrder.currencyCode || 'CNY'

  return {
    userCouponIdText: `${rawOrder.userCouponId || ''}`,
    name: rawOrder.couponName || (matchedCoupon && matchedCoupon.name) || '优惠券',
    discountAmount,
    discountAmountText: formatPrice(discountAmount, currencyCode),
    ruleText: rawOrder.couponRuleDesc || (matchedCoupon && buildCouponRuleText(matchedCoupon, currencyCode)) || ''
  }
}

function isOrderReviewed(rawOrder = {}) {
  return `${rawOrder.evaluationStatus || ''}`.startsWith('DONE:')
}

function canShowReviewAction(rawOrder = {}) {
  return rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.PAID
}

function canCancelOrder(rawOrder = {}) {
  return [
    ORDER_STATUS.CREATED,
    ORDER_STATUS.DISPATCHING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.PICKING_UP
  ].includes(rawOrder.orderStatus)
}

function getNextStepText(rawOrder = {}) {
  if (rawOrder.orderStatus === ORDER_STATUS.CREATED || rawOrder.orderStatus === ORDER_STATUS.DISPATCHING) {
    return '等待车主接单，匹配成功后会同步司机信息'
  }
  if (rawOrder.orderStatus === ORDER_STATUS.ACCEPTED) {
    return '车主已接单，等待车主开始接驾'
  }
  if (rawOrder.orderStatus === ORDER_STATUS.PICKING_UP) {
    return '车主正在前往上车点，请保持电话畅通'
  }
  if (rawOrder.orderStatus === ORDER_STATUS.IN_TRIP) {
    return '行程进行中，请按约定路线前往目的地'
  }
  if (rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID) {
    return '请完成支付，支付后可评价并申请发票'
  }
  if (rawOrder.orderStatus === ORDER_STATUS.FINISHED) {
    return '订单已完成，可查看评价、发票或售后记录'
  }
  return '订单已关闭，可查看取消原因和费用记录'
}

function getCarpoolStatusLabel(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CREATED || order.orderStatus === ORDER_STATUS.DISPATCHING) return '等待车主接单'
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return '车主已接单'
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return '车主接驾中'
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) return '行程进行中'
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID) return '待支付'
  if (order.orderStatus === ORDER_STATUS.FINISHED) return '已完成'
  return '已取消'
}

function buildDetailViewState(rawOrder, coupons = [], runtime = {}) {
  const detail = buildRideOrderModel(rawOrder, {
    carType: getCarTypeMapFromStore()[rawOrder.carTypeId]
  })
  const detailDistance = toNumber(detail.fee && detail.fee.route && detail.fee.route.distanceKm)
  const detailDuration = toNumber(detail.fee && detail.fee.route && detail.fee.route.durationMin)
  const effectiveOrder = {
    ...rawOrder,
    estimatedDistanceKm: toNumber(rawOrder.actualDistanceKm) > 0 || toNumber(rawOrder.estimatedDistanceKm) > 0
      ? (toNumber(rawOrder.actualDistanceKm) > 0 ? rawOrder.actualDistanceKm : rawOrder.estimatedDistanceKm)
      : detailDistance,
    estimatedDurationMin: toNumber(rawOrder.actualDurationMin) > 0 || toNumber(rawOrder.estimatedDurationMin) > 0
      ? (toNumber(rawOrder.actualDurationMin) > 0 ? rawOrder.actualDurationMin : rawOrder.estimatedDurationMin)
      : detailDuration
  }
  const currencyCode = rawOrder.currencyCode || 'CNY'
  const originalAmountValue = getOrderOriginalAmount(effectiveOrder)
  const showPayBar = hasPendingPayment(effectiveOrder)
  const allowCoupon = canUseCouponForOrder(effectiveOrder)
  const couponGroups = allowCoupon ? buildCouponGroups(effectiveOrder, coupons) : { available: [], unavailable: [] }

  let selectedCoupon = null
  if (showPayBar) {
    const pendingCoupon = getPendingCouponContext(effectiveOrder.id, effectiveOrder.orderNo)
    if (pendingCoupon) {
      selectedCoupon = couponGroups.available.find((item) => item.userCouponIdText === `${pendingCoupon.userCouponId || ''}`) || null
      if (!selectedCoupon) {
      clearPendingCouponContext(effectiveOrder.id, effectiveOrder.orderNo)
      }
    }
  } else {
    clearPendingCouponContext(effectiveOrder.id, effectiveOrder.orderNo)
  }

  const paidCoupon = effectiveOrder.payStatus === PAY_STATUS.PAID ? buildAppliedCoupon(effectiveOrder, coupons) : null
  const effectiveCoupon = selectedCoupon || paidCoupon
  const webExclusiveDiscountAmount = getWebExclusiveDiscountAmount(effectiveOrder)
  const selectedCouponDiscount = toNumber(selectedCoupon && selectedCoupon.discountAmount)
  const paidDiscountAmount = toNumber(effectiveOrder.couponDiscount)
  const discountAmount = effectiveOrder.payStatus === PAY_STATUS.PAID
    ? paidDiscountAmount
    : Number((selectedCouponDiscount + webExclusiveDiscountAmount).toFixed(2))
  const payableAmountValue = effectiveOrder.orderStatus === ORDER_STATUS.CANCELLED
    ? getOrderPayableAmount(effectiveOrder)
    : effectiveOrder.payStatus === PAY_STATUS.PAID
    ? getOrderPayableAmount(effectiveOrder)
    : Math.max(0, Number((originalAmountValue - discountAmount).toFixed(2)))
  const showDiscountPrice = discountAmount > 0 && payableAmountValue < originalAmountValue
  const payableAmountText = formatPrice(payableAmountValue, currencyCode)
  const originalAmountText = formatPrice(originalAmountValue, currencyCode)
  const couponSummaryText = !couponGroups.available.length
    ? '暂无可用优惠券'
    : selectedCoupon
      ? `已选${selectedCoupon.name}`
      : `可用${couponGroups.available.length}张`
  const timelineSteps = effectiveOrder.serviceType === 'CARPOOL'
    ? buildCarpoolTimelineSteps(effectiveOrder)
    : buildOrderTimelineSteps(effectiveOrder)
  const timelineSummary = getTimelineSummary(timelineSteps)
  const driveStatus = buildDriveStatusView(effectiveOrder, runtime, timelineSummary)
  const showServiceFlow = !['finished', 'cancelled'].includes(driveStatus.visualType)

  const detailState = {
    ...detail,
    amountText: payableAmountText,
    amountCaption: getAmountCaption(rawOrder),
    originalAmountText,
    payableAmountText,
    couponDiscountText: formatPrice(discountAmount, currencyCode),
    showDiscountPrice,
    showPaidCouponInfo: effectiveOrder.payStatus === PAY_STATUS.PAID && Boolean(effectiveCoupon),
    appliedCouponName: effectiveOrder.payStatus === PAY_STATUS.PAID && effectiveCoupon ? effectiveCoupon.name : '',
    appliedCouponDiscountText: effectiveOrder.payStatus === PAY_STATUS.PAID && effectiveCoupon ? effectiveCoupon.discountAmountText : '',
    showWebExclusiveDiscountInfo: webExclusiveDiscountAmount > 0,
    webExclusiveDiscountName: rawOrder.webExclusiveDiscountLabel || (rawOrder.webExclusiveMeta && rawOrder.webExclusiveMeta.label) || '网页专属优惠',
    webExclusiveDiscountText: formatPrice(webExclusiveDiscountAmount, currencyCode),
    webExclusiveDiscountNote: '网页版打车专属，小程序仅同步展示',
    serviceTypeText: getServiceLabel(rawOrder.serviceType),
    payStatusText: getPayStatusLabel(rawOrder.payStatus),
    startDisplay: detail.startName || (detail.start && detail.start.name) || '',
    endDisplay: detail.endName || (detail.end && detail.end.name) || '',
    remarkText: detail.remarkText || '',
    showReviewAction: canShowReviewAction(effectiveOrder),
    showInvoiceAction: effectiveOrder.payStatus === PAY_STATUS.PAID,
    reviewActionText: isOrderReviewed(effectiveOrder) ? '查看评价' : '行程评价',
    reviewed: isOrderReviewed(effectiveOrder),
    carpoolMeta: detail.carpoolMeta || null,
    isCarpool: effectiveOrder.serviceType === 'CARPOOL',
    uiStatus: effectiveOrder.serviceType === 'CARPOOL'
      ? { ...detail.uiStatus, label: getCarpoolStatusLabel(effectiveOrder) }
      : detail.uiStatus,
    nextStepText: getNextStepText(effectiveOrder),
    showCancelAction: canCancelOrder(effectiveOrder),
    showCarpoolTollConfirm: effectiveOrder.serviceType === 'CARPOOL' && effectiveOrder.orderStatus === ORDER_STATUS.ACCEPTED && effectiveOrder.carpoolTollStatus === 'PENDING',
    showCarpoolBoardingConfirm: effectiveOrder.serviceType === 'CARPOOL' && effectiveOrder.orderStatus === ORDER_STATUS.PICKING_UP,
    carpoolTollAmount: formatPrice(effectiveOrder.carpoolTollAmount, currencyCode)
  }

  return {
    detail: detailState,
    detailMetrics: buildDetailMetrics(effectiveOrder),
    timelineSteps,
    timelineSummary,
    driveStatus,
    showServiceFlow,
    showPayBar,
    payButtonText: `立即支付 ${payableAmountText}`,
    paymentSceneText: rawOrder.orderStatus === ORDER_STATUS.CANCELLED ? '取消费待支付' : '行程费待支付',
    availableCoupons: couponGroups.available,
    unavailableCoupons: couponGroups.unavailable,
    availableCouponCount: couponGroups.available.length,
    couponSummaryText: allowCoupon ? couponSummaryText : '取消费不使用优惠券',
    couponActionDisabled: !allowCoupon || !couponGroups.available.length,
    allowCoupon,
    selectedCouponId: selectedCoupon ? selectedCoupon.userCouponIdText : '',
    payableAmountValue,
    payableAmountText,
    currencyCode,
    loading: false
  }
}

Page({
  data: {
    detail: null,
    detailMetrics: [],
    timelineSteps: [],
    driveStatus: null,
    showServiceFlow: true,
    showPayBar: false,
    payButtonText: '',
    paymentSceneText: '',
    loading: true,
    displayedPayableAmountValue: 0,
    displayedPayableAmountText: '',
    availableCoupons: [],
    unavailableCoupons: [],
    availableCouponCount: 0,
    couponSummaryText: '',
    couponActionDisabled: true,
    allowCoupon: false,
    selectedCouponId: '',
    couponModalVisible: false,
    activeCouponTab: 'available',
    timelineExpanded: false,
    timelineSummary: null,
    canceling: false,
    carpoolActionBusy: false
  },

  onLoad(options) {
    this.orderId = options.id || ''
    this.hasShownAfterLoad = false
    this.priceAnimationTimer = null
    this.timer = null
    this.rawOrder = null
    this.couponList = getApp().globalData.userStore.coupons || []

    const cachedOrder = findCachedOrder(this.orderId)
    if (cachedOrder) {
      this.applyRawOrder(cachedOrder, {
        immediate: true
      })
    }

    this.refreshDetail().catch(() => {})
  },

  onShow() {
    if (!this.orderId) return

    if (!this.hasShownAfterLoad) {
      this.hasShownAfterLoad = true
      this.startPolling()
      return
    }

    this.refreshDetail(true).catch(() => {})
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
    this.clearPriceAnimationTimer()
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  startPolling() {
    this.stopPolling()

    this.timer = setInterval(() => {
      runGuarded(this, '__detailPolling', async () => {
        await this.refreshDetail(true)
      }).catch(() => {})
    }, DETAIL_SYNC_INTERVAL)
  },

  clearPriceAnimationTimer() {
    if (this.priceAnimationTimer) {
      clearInterval(this.priceAnimationTimer)
      this.priceAnimationTimer = null
    }
  },

  updateDisplayedPayAmount(targetValue, currencyCode, immediate = false) {
    const finalValue = Math.max(0, toNumber(targetValue))
    const finalText = formatPrice(finalValue, currencyCode)

    this.clearPriceAnimationTimer()

    if (immediate) {
      this.setData({
        displayedPayableAmountValue: finalValue,
        displayedPayableAmountText: finalText,
        payButtonText: `立即支付 ${finalText}`
      })
      return
    }

    const startValue = toNumber(this.data.displayedPayableAmountValue, finalValue)
    if (Math.abs(startValue - finalValue) < 0.01) {
      this.setData({
        displayedPayableAmountValue: finalValue,
        displayedPayableAmountText: finalText,
        payButtonText: `立即支付 ${finalText}`
      })
      return
    }

    let frame = 0
    this.priceAnimationTimer = setInterval(() => {
      frame += 1
      const progress = frame / PRICE_ANIMATION_FRAME_TOTAL
      const currentValue = startValue + (finalValue - startValue) * progress
      const currentText = formatPrice(currentValue, currencyCode)
      this.setData({
        displayedPayableAmountValue: Number(currentValue.toFixed(2)),
        displayedPayableAmountText: currentText,
        payButtonText: `立即支付 ${currentText}`
      })

      if (frame >= PRICE_ANIMATION_FRAME_TOTAL) {
        this.clearPriceAnimationTimer()
        this.setData({
          displayedPayableAmountValue: finalValue,
          displayedPayableAmountText: finalText,
          payButtonText: `立即支付 ${finalText}`
        })
      }
    }, PRICE_ANIMATION_FRAME_DELAY)
  },

  async refreshCoupons() {
    const [mineResponse, centerResponse] = await Promise.all([
      fetchMyCoupons(),
      fetchCouponCenter()
    ])
    const coupons = mergeCoupons(mineResponse.data || [], centerResponse.data || [])
    const app = getApp()
    app.globalData.userStore.coupons = coupons
    app.globalData.userStore.couponCenter = centerResponse.data || []
    app.saveUserStore()
    this.couponList = coupons
    return coupons
  },

  async refreshDetail(silent = false) {
    return runExclusive(this, '__refreshDetailPromise', async () => {
      const cachedOrder = findCachedOrder(this.orderId)
      let rawOrder = null

      const [detailResult, runtimeResult, ordersResult] = await Promise.allSettled([
        fetchOrderDetail(this.orderId, {
          skipToast: true
        }),
        fetchOrderRuntime(this.orderId, {
          skipToast: true
        }),
        fetchOrders()
      ])

      const detailOrder = detailResult.status === 'fulfilled'
        ? detailResult.value.data
        : null
      const runtime = runtimeResult.status === 'fulfilled'
        ? (runtimeResult.value.data || runtimeResult.value)
        : null
      const syncedOrders = ordersResult.status === 'fulfilled'
        ? syncOrdersToCache(ordersResult.value.data || [])
        : []
      const listOrder = findMatchingOrderSnapshot(
        this.orderId,
        (detailOrder && detailOrder.orderNo) || (cachedOrder && cachedOrder.orderNo),
        syncedOrders
      )

      rawOrder = reconcileLiveOrder(detailOrder, listOrder, cachedOrder, runtime)
      if (!rawOrder) {
        const failure = detailResult.status === 'rejected'
          ? detailResult.reason
          : runtimeResult.status === 'rejected'
            ? runtimeResult.reason
            : ordersResult.status === 'rejected'
              ? ordersResult.reason
              : null
        if (failure) {
          throw failure
        }
        throw new Error('ORDER_DETAIL_SYNC_FAILED')
      }

      if (!detailOrder && !listOrder && !silent) {
        wx.showToast({
          title: '宸插垏鎹负鏈湴璁㈠崟婕旂ず鏁版嵁',
          icon: 'none'
        })
      }

      if (false && rawOrder.orderStatus === ORDER_STATUS.FINISHED && rawOrder.payStatus === PAY_STATUS.UNPAID) {

        if (!silent) {
          wx.showToast({
            title: '订单信息已恢复显示',
            icon: 'none'
          })
        }
      }

      if (canUseCouponForOrder(rawOrder)) {
        try {
          await this.refreshCoupons()
        } catch (error) {
          this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
        }
      }

      this.applyRawOrder(rawOrder, {
        immediate: !this.data.detail,
        runtime
      })
    })
  },

  applyRawOrder(rawOrder, options = {}) {
    if (!rawOrder) return

    const targetUrl = buildOrderFlowUrl(rawOrder)
    if (targetUrl && targetUrl !== `/pages/order-detail/index?id=${rawOrder.id}`) {
      redirectToSilky(this, {
        url: targetUrl
      })
      return
    }

    this.rawOrder = rawOrder
    const viewState = buildDetailViewState(rawOrder, this.couponList || [], options.runtime || {})

    this.setData({
      detail: viewState.detail,
      showCarpoolTollConfirm: viewState.detail.showCarpoolTollConfirm,
      showCarpoolBoardingConfirm: viewState.detail.showCarpoolBoardingConfirm,
      detailMetrics: viewState.detailMetrics,
      timelineSteps: viewState.timelineSteps,
      timelineSummary: viewState.timelineSummary,
      driveStatus: viewState.driveStatus,
      showServiceFlow: viewState.showServiceFlow,
      showPayBar: viewState.showPayBar,
      availableCoupons: viewState.availableCoupons,
      unavailableCoupons: viewState.unavailableCoupons,
      availableCouponCount: viewState.availableCouponCount,
      couponSummaryText: viewState.couponSummaryText,
      couponActionDisabled: viewState.couponActionDisabled,
      allowCoupon: viewState.allowCoupon,
      paymentSceneText: viewState.paymentSceneText,
      selectedCouponId: viewState.selectedCouponId,
      couponModalVisible: viewState.showPayBar ? this.data.couponModalVisible : false,
      activeCouponTab: this.data.activeCouponTab || 'available',
      loading: false
    })

    this.updateDisplayedPayAmount(viewState.payableAmountValue, viewState.currencyCode, Boolean(options.immediate))
    getApp().setCurrentRideOrder(viewState.detail, {
      persist: false
    })
  },

  cancelCurrentOrder() {
    if (!this.rawOrder || !this.data.detail || !this.data.detail.showCancelAction || this.data.canceling) return

    wx.showModal({
      title: '取消顺风车订单',
      content: this.rawOrder.cancelRule || '确认取消当前顺风车订单吗？',
      confirmText: '确认取消',
      cancelText: '再等等',
      success: async ({ confirm }) => {
        if (!confirm || !this.rawOrder || this.data.canceling) return
        const cancelReason = '乘客主动取消顺风车订单'
        this.setData({ canceling: true })
        wx.showLoading({ title: '取消中' })
        try {
          await cancelOrder(this.rawOrder.id, cancelReason)
          let latestOrder = null
          try {
            const response = await fetchOrderDetail(this.rawOrder.id, { skipToast: true })
            latestOrder = response.data || null
          } catch (error) {
            latestOrder = null
          }
          const cancelledOrder = syncOrderToCache({
            ...this.rawOrder,
            ...(latestOrder || {}),
            orderStatus: ORDER_STATUS.CANCELLED,
            cancelReason: (latestOrder && latestOrder.cancelReason) || cancelReason,
            updatedAt: new Date().toISOString()
          })
          this.rawOrder = cancelledOrder || latestOrder || this.rawOrder
          this.stopPolling()
          this.applyRawOrder(this.rawOrder, { immediate: true })
          getApp().setCurrentRideOrder(null, { persist: false })
          wx.hideLoading()
          wx.showToast({ title: '订单已取消', icon: 'success' })
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: error && error.message ? error.message : '取消失败，请稍后重试', icon: 'none' })
        } finally {
          this.setData({ canceling: false })
        }
      }
    })
  },

  toggleTimeline() {
    this.setData({
      timelineExpanded: !this.data.timelineExpanded
    })
  },

  async respondToCarpoolToll(e) {
    if (this.data.carpoolActionBusy || !this.rawOrder) return
    const confirm = e.currentTarget.dataset.confirm === 'true'
    this.setData({ carpoolActionBusy: true })
    try {
      await respondCarpoolToll(this.rawOrder.id, confirm)
      wx.showToast({ title: confirm ? '已确认高速费' : '订单已取消', icon: 'success' })
      await this.refreshDetail(true)
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '操作失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ carpoolActionBusy: false })
    }
  },

  async confirmCarpoolBoarding() {
    if (this.data.carpoolActionBusy || !this.rawOrder) return
    this.setData({ carpoolActionBusy: true })
    try {
      await pickupOrder(this.rawOrder.id)
      wx.showToast({ title: '已确认上车，行程开始', icon: 'success' })
      await this.refreshDetail(true)
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '确认失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ carpoolActionBusy: false })
    }
  },

  gotoComplaint() {
    if (!this.data.detail) return
    navigateToSilky(this, { url: `/pages/complaint/index?id=${this.data.detail.id}` })
  },

  gotoInvoice() {
    navigateToSilky(this, { url: '/pages/invoice/index' })
  },

  gotoReview() {
    if (!this.data.detail) return
    if (this.data.detail.reviewed) {
      navigateToSilky(this, { url: '/pages/reviews/index' })
      return
    }
    navigateToSilky(this, { url: `/pages/ride-review/index?id=${this.data.detail.id}` })
  },

  applyRefund() {
    wx.showModal({
      title: '退款说明',
      content: '退款需提交投诉或联系客服处理，当前订单状态不会被直接修改。',
      showCancel: false
    })
  },

  async openCouponPicker() {
    if (!this.rawOrder || !this.data.allowCoupon || this.data.couponActionDisabled || !this.data.showPayBar) return

    try {
      await this.refreshCoupons()
      this.applyRawOrder(this.rawOrder, {
        immediate: true
      })
    } catch (error) {
      this.couponList = getApp().globalData.userStore.coupons || this.couponList || []
      this.applyRawOrder(this.rawOrder, {
        immediate: true
      })
    }

    if (this.data.couponActionDisabled) {
      return
    }

    this.setData({
      couponModalVisible: true,
      activeCouponTab: 'available'
    })
  },

  closeCouponPicker() {
    this.setData({
      couponModalVisible: false
    })
  },

  switchCouponTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.activeCouponTab) return
    this.setData({
      activeCouponTab: tab
    })
  },

  chooseCoupon(e) {
    if (!this.rawOrder) return

    const couponId = `${e.currentTarget.dataset.id || ''}`
    const selectedCoupon = (this.data.availableCoupons || []).find((item) => item.userCouponIdText === couponId)
    if (!selectedCoupon) return

    setPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo, {
      userCouponId: selectedCoupon.userCouponIdText,
      couponDiscount: selectedCoupon.discountAmount,
      payableAmount: Math.max(0, Number((getOrderOriginalAmount(this.rawOrder) - selectedCoupon.discountAmount - getWebExclusiveDiscountAmount(this.rawOrder)).toFixed(2))),
      originalAmount: getOrderOriginalAmount(this.rawOrder),
      couponName: selectedCoupon.name,
      couponRuleDesc: selectedCoupon.ruleText
    })

    this.setData({
      couponModalVisible: false
    })
    this.applyRawOrder(this.rawOrder)
  },

  clearCouponSelection() {
    if (!this.rawOrder) return
    clearPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo)
    this.setData({
      couponModalVisible: false
    })
    this.applyRawOrder(this.rawOrder)
  },

  goToPay() {
    if (!this.data.detail || !canPayOrder(this.rawOrder)) {
      if (this.rawOrder) {
        clearPendingCouponContext(this.rawOrder.id, this.rawOrder.orderNo)
      }
      wx.showToast({
        title: '订单完成后才可支付',
        icon: 'none'
      })
      return
    }
    navigateToSilky(this, {
      url: `/pages/payment-confirm/index?id=${this.data.detail.id}`
    })
  }
})
