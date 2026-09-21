const TERMINAL_STATUSES = new Set(['FINISHED', 'CANCELLED'])

function finiteNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizePoint(value) {
  if (!value || typeof value !== 'object') return null
  const latitude = finiteNumber(value.latitude ?? value.lat)
  const longitude = finiteNumber(value.longitude ?? value.lng)
  if (latitude === null || longitude === null) return null
  return { latitude, longitude }
}

function normalizeRoutePoints(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizePoint).filter(Boolean)
}

export function normalizeRideRuntime(source = null) {
  if (!source || typeof source !== 'object') return null

  const driverLocation = normalizePoint(source.currentPoint || source.driverLocation || source.location)
  const remainingSeconds = finiteNumber(source.remainingSeconds)
  const remainDistanceKm = finiteNumber(source.remainDistanceKm)
  const rawPercent = finiteNumber(source.percent)
  const normalizedProgress = finiteNumber(source.progress)
  const percent = rawPercent !== null
    ? clamp(rawPercent, 0, 100)
    : normalizedProgress !== null
      ? clamp(normalizedProgress <= 1 ? normalizedProgress * 100 : normalizedProgress, 0, 100)
      : null
  const route = normalizeRoutePoints(
    source.route || source.remainPoints || source.tripRoutePoints || source.approachRoutePoints
  )

  return {
    ...source,
    driverLocation,
    route,
    percent: percent === null ? null : Math.round(percent),
    remainingSeconds,
    etaMinutes: remainingSeconds !== null
      ? Math.max(0, Math.ceil(remainingSeconds / 60))
      : finiteNumber(source.etaMinutes),
    remainDistanceKm,
    distanceKm: remainDistanceKm ?? finiteNumber(source.distanceKm),
    traveledDistanceKm: finiteNumber(source.traveledDistanceKm),
    elapsedSeconds: finiteNumber(source.elapsedSeconds ?? source.usedSeconds),
    speedKmh: finiteNumber(source.speedKmh),
    heading: finiteNumber(source.heading),
    traceCount: finiteNumber(source.traceCount) ?? 0,
    live: Boolean(driverLocation || source.lastReportedAt || Number(source.traceCount) > 0),
    terminal: Boolean(source.terminal)
  }
}

export function getRideProgressPercent(order = {}, runtime = null) {
  const status = String(order.orderStatus || '')
  if (status === 'CANCELLED') return 0
  if (status === 'FINISHED') return 100
  const normalized = normalizeRideRuntime(runtime)
  return normalized?.percent ?? null
}

export function getRideStage(order = {}, runtime = null) {
  const status = String(order.orderStatus || '')
  const normalized = normalizeRideRuntime(runtime)
  const backendText = String(normalized?.displayText || normalized?.phaseText || normalized?.stateText || '').trim()
  const stages = {
    CREATED: ['订单已提交', '正在把行程同步到调度系统'],
    DISPATCHING: ['正在寻找司机', '附近司机接单后将立即显示车辆与接驾信息'],
    ACCEPTED: ['司机已接单', '正在自动进入接驾流程'],
    PICKING_UP: ['司机正在接驾', '车辆正沿规划路线前往上车点'],
    IN_TRIP: ['行程进行中', '车辆正沿规划路线驶向目的地'],
    FINISHED: ['行程已结束', order.payStatus === 'PAID' ? '费用已结清，可查看订单或提交评价' : '请核对费用并完成支付'],
    CANCELLED: ['订单已取消', '本次行程已结束']
  }
  const [title, description] = stages[status] || ['行程状态同步中', '正在读取最新订单状态']
  return {
    title,
    description: backendText || description,
    status,
    terminal: TERMINAL_STATUSES.has(status),
    live: Boolean(normalized?.live)
  }
}

export function formatRideDuration(seconds, fallback = '待同步') {
  const value = finiteNumber(seconds)
  if (value === null) return fallback
  if (value < 60) return value <= 0 ? '即将到达' : '< 1 分钟'
  const minutes = Math.ceil(value / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export function formatRideDistance(distanceKm, fallback = '待同步') {
  const value = finiteNumber(distanceKm)
  if (value === null) return fallback
  if (value < 1) return `${Math.max(0, Math.round(value * 1000))} 米`
  return `${value.toFixed(value >= 10 ? 1 : 2)} 公里`
}

export function hasUsableDriverLocation(runtime = null) {
  return Boolean(normalizeRideRuntime(runtime)?.driverLocation)
}
