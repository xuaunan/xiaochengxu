function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseDateValue(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (Array.isArray(value)) {
    const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = value
    const current = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
    return Number.isNaN(current.getTime()) ? null : current
  }

  if (typeof value === 'number') {
    const current = new Date(value)
    return Number.isNaN(current.getTime()) ? null : current
  }

  const text = `${value || ''}`.trim()
  if (!text) return null

  const normalized = text
    .replace(/[.]/g, '-')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/T/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
  if (match) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
    const current = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
    return Number.isNaN(current.getTime()) ? null : current
  }

  const fallback = new Date(normalized.replace(/-/g, '/'))
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatPrice(value, currency = 'CNY') {
  const amount = Number(value || 0).toFixed(2)
  if (currency === 'USD') return `$${amount}`
  if (currency === 'HKD') return `HK$${amount}`
  return `¥${amount}`
}

function formatDistance(value) {
  return `${Number(value || 0).toFixed(1)} 公里`
}

function formatDuration(value) {
  const minute = Math.max(0, Math.round(value || 0))
  if (minute < 60) return `${minute} 分钟`
  const hour = Math.floor(minute / 60)
  const rest = minute % 60
  return `${hour} 小时 ${rest} 分钟`
}

function createId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 900 + 100)}`
}

function padNumber(value) {
  return `${value}`.padStart(2, '0')
}

function formatDateTime(date, options = {}) {
  const current = parseDateValue(date)
  if (!current) return options.fallback || '--'

  const text = `${current.getFullYear()}-${padNumber(current.getMonth() + 1)}-${padNumber(current.getDate())} ${padNumber(current.getHours())}:${padNumber(current.getMinutes())}`
  if (options.includeSeconds) {
    return `${text}:${padNumber(current.getSeconds())}`
  }
  return text
}

function formatDate(date) {
  const current = parseDateValue(date)
  if (!current) return '--'
  return `${current.getFullYear()}-${padNumber(current.getMonth() + 1)}-${padNumber(current.getDate())}`
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

function splitDateTime(value) {
  const current = parseDateValue(value) || new Date()
  return {
    date: formatDate(current),
    time: `${padNumber(current.getHours())}:${padNumber(current.getMinutes())}`
  }
}

function joinDateTime(dateText, timeText = '00:00') {
  const normalizedTime = `${timeText || '00:00'}:00`.slice(0, 8)
  return formatDateTime(`${dateText} ${normalizedTime}`, { includeSeconds: true, fallback: '' })
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)]
}

module.exports = {
  createId,
  deepClone,
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatPercent,
  formatPrice,
  joinDateTime,
  padNumber,
  parseDateValue,
  pickRandom,
  splitDateTime
}
