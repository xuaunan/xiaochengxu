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

// Keep the mini-program's display contract: a server/demo trace wins, while
// the local route projection only fills fields the trace does not provide.
export function mergeRideRuntimeForDisplay(serverRuntime = null, fallbackRuntime = null) {
  const server = normalizeRideRuntime(serverRuntime)
  const fallback = normalizeRideRuntime(fallbackRuntime)
  if (!server && !fallback) return null
  if (!fallback) return server
  if (!server) return fallback

  const serverPoint = server.driverLocation || normalizePoint(server.currentPoint)
  const fallbackPoint = fallback.driverLocation || normalizePoint(fallback.currentPoint)
  const serverProgress = finiteNumber(server.progress) ?? (
    finiteNumber(server.percent) === null ? null : Number(server.percent) / 100
  )
  const fallbackProgress = finiteNumber(fallback.progress) ?? (
    finiteNumber(fallback.percent) === null ? null : Number(fallback.percent) / 100
  )
  const serverRoute = server.route.length ? server.route : fallback.route
  return normalizeRideRuntime({
    ...fallback,
    ...server,
    currentPoint: serverPoint || fallbackPoint,
    driverLocation: serverPoint || fallbackPoint,
    heading: server.heading ?? fallback.heading,
    progress: serverProgress ?? fallbackProgress,
    percent: serverProgress === null ? fallback.percent : Math.round(serverProgress * 100),
    route: serverRoute,
    routePoints: serverRoute,
    traceMode: server.traceMode || fallback.traceMode
  })
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
    CREATED: ['订单已提交', '正在为你寻找附近司机'],
    DISPATCHING: ['等待司机接单', '订单已推送给附近司机，接单后将立即为你安排车辆'],
    ACCEPTED: ['司机已接单', '正在自动进入接驾流程'],
    PICKING_UP: ['司机正在接驾', '车辆正沿规划路线前往上车点'],
    IN_TRIP: ['行程进行中', '车辆正沿规划路线驶向目的地'],
    FINISHED: ['行程已结束', order.payStatus === 'PAID' ? '费用已结清，可查看订单或提交评价' : '请核对费用并完成支付'],
    CANCELLED: ['订单已取消', '本次行程已结束']
  }
  const [title, description] = stages[status] || ['行程状态同步中', '正在读取最新订单状态']
  return {
    title,
    // 等待阶段使用本地文案：后端兜底文案“等待派单”太生硬，且不是真实进度
    description: ['CREATED', 'DISPATCHING'].includes(status) ? description : (backendText || description),
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
