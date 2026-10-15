export function orderAmount(order = {}) {
  const value = order.payableAmount ?? order.actualAmount ?? order.estimatedAmount ?? 0
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

const ORDER_STAGE = {
  CREATED: 0,
  DISPATCHING: 1,
  ACCEPTED: 2,
  PICKING_UP: 3,
  IN_TRIP: 4,
  FINISHED: 5,
  CANCELLED: -1
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

function normalizedOrder(order = {}) {
  if (!order || typeof order !== 'object') return null
  const rawStatus = order.orderStatus || order.order_status || order.rawStatus || order.status
  const orderStatus = String(rawStatus || '').trim().toUpperCase()
  return orderStatus ? { ...order, orderStatus } : { ...order }
}

function orderStage(order = {}) {
  return ORDER_STAGE[order.orderStatus] ?? -1
}

function mergeMissingFields(base = {}, patch = {}) {
  const result = { ...base }
  Object.entries(patch || {}).forEach(([key, value]) => {
    if ((result[key] === undefined || result[key] === null || result[key] === '') && value !== undefined && value !== null && value !== '') {
      result[key] = value
    }
  })
  return result
}

function runtimeStatusPatch(runtime = {}, order = {}) {
  const phase = String(runtime?.phase || '').toLowerCase()
  if (!phase || [ORDER_STATUS.FINISHED, ORDER_STATUS.CANCELLED].includes(order.orderStatus)) return null
  // 后端 runtime 对 CREATED/DISPATCHING/ACCEPTED/PICKING_UP 统一返回 phase=approach（兜底值），
  // 不能据此把「等待接单」升级成「接驾中」——否则乘客刚下单就会看到“司机正在接驾”的假状态。
  // 只有订单本身已进入接单后阶段（ACCEPTED/PICKING_UP/IN_TRIP）时才允许 runtime 参与推进。
  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(order.orderStatus)) return null
  if (phase === 'trip') return { orderStatus: ORDER_STATUS.IN_TRIP }
  if (phase === 'approach') {
    return {
      orderStatus: order.orderStatus === ORDER_STATUS.ACCEPTED
        ? ORDER_STATUS.ACCEPTED
        : ORDER_STATUS.PICKING_UP
    }
  }
  return null
}

/** Keep the most advanced known order stage while accepting newer terminal/pay fields. */
export function reconcileOrderSnapshot(previous = null, candidate = null, runtime = null) {
  const base = normalizedOrder(previous)
  const incoming = normalizedOrder(candidate)
  if (!base && !incoming) return null
  if (!base) return mergeMissingFields(incoming, runtimeStatusPatch(runtime, incoming) || {})
  if (!incoming) return mergeMissingFields(base, runtimeStatusPatch(runtime, base) || {})

  const baseStage = orderStage(base)
  const incomingStage = orderStage(incoming)
  let effective = incoming

  // Cancellation and payment are server facts; do not hide them behind an old stage.
  if (incoming.orderStatus !== ORDER_STATUS.CANCELLED && base.orderStatus === ORDER_STATUS.CANCELLED) {
    effective = base
  } else if (incoming.orderStatus !== ORDER_STATUS.CANCELLED && base.orderStatus === ORDER_STATUS.FINISHED && incomingStage < ORDER_STAGE.FINISHED) {
    effective = base
  } else if (incomingStage < baseStage) {
    effective = base
  }

  if (base.payStatus === 'PAID' && effective.payStatus !== 'PAID') {
    effective = { ...effective, payStatus: base.payStatus }
  }

  const runtimePatch = runtimeStatusPatch(runtime, effective)
  if (runtimePatch && orderStage(runtimePatch) > orderStage(effective)) {
    effective = { ...effective, ...runtimePatch }
  }
  return mergeMissingFields(effective, mergeMissingFields(base, incoming))
}

export function reconcileOrderList(previous = [], candidate = [], runtimeById = {}) {
  const previousList = Array.isArray(previous) ? previous : []
  const incomingList = Array.isArray(candidate) ? candidate : []
  const incomingByKey = new Map(incomingList.map((order) => [String(order?.id || order?.orderNo || ''), order]))
  const result = incomingList.map((order) => {
    const key = String(order?.id || order?.orderNo || '')
    return reconcileOrderSnapshot(previousList.find((item) => String(item?.id || item?.orderNo || '') === key), order, runtimeById[key])
  })

  // Keep a locally newer active record until the backend returns its next snapshot.
  previousList.forEach((order) => {
    const key = String(order?.id || order?.orderNo || '')
    if (!key || incomingByKey.has(key)) return
    if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order?.orderStatus)) {
      result.push(order)
    }
  })
  return result
}

export function bookingEstimateKey(booking = {}) {
  return JSON.stringify([
    booking.serviceType, booking.carTypeId, booking.startId, booking.endId,
    booking.startPoint?.latitude, booking.startPoint?.longitude,
    booking.endPoint?.latitude, booking.endPoint?.longitude
  ])
}

export function getRouteMapViewport(points = [], width = 760, height = 700) {
  const projected = points.map((point) => {
    const latitude = Number(point?.latitude)
    const longitude = Number(point?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    const radians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180
    return {
      x: (longitude + 180) / 360,
      y: (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2
    }
  }).filter(Boolean)
  if (!projected.length) return { latitude: 39.9, longitude: 116.4, zoom: 12 }

  const xs = projected.map((point) => point.x)
  const ys = projected.map((point) => point.y)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
  const availableWidth = Math.max(200, Number(width) - 120)
  const availableHeight = Math.max(200, Number(height) - 140)
  const xZoom = Math.log2(availableWidth / (256 * Math.max(0.000001, Math.max(...xs) - Math.min(...xs))))
  const yZoom = Math.log2(availableHeight / (256 * Math.max(0.000001, Math.max(...ys) - Math.min(...ys))))
  return {
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY))) * 180 / Math.PI,
    longitude: centerX * 360 - 180,
    zoom: Math.max(9, Math.min(16, Math.floor(Math.min(xZoom, yZoom))))
  }
}

// A slower poll must not replace a newer order snapshot after a mutation.
export function createSnapshotGate() {
  let revision = 0
  return {
    begin: () => ++revision,
    isCurrent: (ticket) => ticket === revision,
    invalidate: () => { revision += 1 }
  }
}
