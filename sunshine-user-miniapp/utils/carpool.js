const { formatDateTime, formatPrice } = require('./format')

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isNaN(next) ? fallback : next
}

function normalizeText(value, fallback = '') {
  const text = `${value || ''}`.trim()
  return text || fallback
}

function getStatusTone(raw) {
  if (raw === 'success') return 'success'
  if (raw === 'danger') return 'danger'
  if (raw === 'warning') return 'waiting'
  return 'processing'
}

function formatTripCard(item = {}) {
  const seatCount = toNumber(item.seatCount, 0)
  const remainSeatCount = toNumber(item.remainSeatCount, 0)
  const bookedSeatCount = toNumber(item.bookedSeatCount, Math.max(seatCount - remainSeatCount, 0))
  return {
    ...item,
    startName: normalizeText(item.startName, '待补充出发地'),
    endName: normalizeText(item.endName, '待补充目的地'),
    ownerName: normalizeText(item.ownerName, `车主 #${String(item.ownerUserId || item.id || '').slice(-2) || '00'}`),
    departTimeText: normalizeText(item.departTimeText, formatDateTime(item.departTime)),
    seatCount,
    remainSeatCount,
    bookedSeatCount,
    price: toNumber(item.sharedAmount),
    priceText: formatPrice(item.sharedAmount),
    statusText: normalizeText(item.statusText, '可申请'),
    statusClassName: getStatusTone(item.statusTone),
    seatText: `余 ${remainSeatCount} / 共 ${seatCount} 座`,
    ownerText: item.ownerPhoneMask ? `${normalizeText(item.ownerName, '车主')} · ${item.ownerPhoneMask}` : normalizeText(item.ownerName, '车主'),
    routeText: `${normalizeText(item.startName, '待补充出发地')} → ${normalizeText(item.endName, '待补充目的地')}`,
    tags: [
      normalizeText(item.baggageRule),
      item.pendingApplicationCount > 0 ? `${item.pendingApplicationCount} 条待处理申请` : '',
      item.confirmedApplicationCount > 0 ? `${item.confirmedApplicationCount} 位已确认同行` : ''
    ].filter(Boolean)
  }
}

function formatApplication(item = {}, options = {}) {
  return {
    ...item,
    passengerName: normalizeText(item.passengerName, options.defaultPassengerName || '同行乘客'),
    statusText: normalizeText(item.applicationStatusText, '待处理'),
    statusClassName: getStatusTone(item.statusTone),
    totalSeatCount: toNumber(item.totalSeatCount, 1),
    seatText: `${toNumber(item.totalSeatCount, 1)} 人同行`,
    priceText: formatPrice(item.sharedAmount),
    noteText: normalizeText(item.note, '未填写备注'),
    cancelReasonText: normalizeText(item.cancelReason),
    passengerText: item.passengerPhoneMask ? `${normalizeText(item.passengerName, '同行乘客')} · ${item.passengerPhoneMask}` : normalizeText(item.passengerName, '同行乘客')
  }
}

function formatCarpoolDetail(payload = {}) {
  const trip = formatTripCard(payload.trip || {})
  const owner = payload.owner || {}
  const myApplication = payload.myApplication ? formatApplication(payload.myApplication) : null
  const applications = (payload.applications || []).map((item) => formatApplication(item))
  const summary = payload.summary || {}

  return {
    trip,
    owner: {
      ...owner,
      nickname: normalizeText(owner.nickname, trip.ownerName || '车主'),
      phoneMask: normalizeText(owner.phoneMask, trip.ownerPhoneMask || ''),
      subtitle: owner.phoneMask ? `${normalizeText(owner.nickname, trip.ownerName || '车主')} · ${normalizeText(owner.phoneMask, trip.ownerPhoneMask || '')}` : normalizeText(owner.nickname, trip.ownerName || '车主')
    },
    myApplication,
    applications,
    summary: {
      seatCount: toNumber(summary.seatCount, trip.seatCount),
      remainSeatCount: toNumber(summary.remainSeatCount, trip.remainSeatCount),
      bookedSeatCount: toNumber(summary.bookedSeatCount, trip.bookedSeatCount),
      applicationCount: toNumber(summary.applicationCount),
      pendingApplicationCount: toNumber(summary.pendingApplicationCount),
      confirmedApplicationCount: toNumber(summary.confirmedApplicationCount)
    },
    currentUserRole: payload.currentUserRole || 'GUEST'
  }
}

function buildRecordAction(record = {}) {
  if (record.role === 'passenger' && record.canPassengerConfirm) {
    return { type: 'confirm', text: '确认同行' }
  }
  if (record.role === 'passenger' && record.canPassengerCancel) {
    return { type: 'cancel', text: '取消申请' }
  }
  return { type: 'detail', text: '查看详情' }
}

function formatOwnerRecord(item = {}) {
  const trip = formatTripCard(item.trip || {})
  const applications = (item.applications || []).map((application) => formatApplication(application))
  const summary = item.summary || {}
  const record = {
    id: `owner-${trip.id}`,
    tripId: trip.id,
    role: 'owner',
    roleText: '车主',
    startName: trip.startName,
    endName: trip.endName,
    routeText: trip.routeText,
    departTimeText: trip.departTimeText,
    priceText: trip.priceText,
    statusText: item.statusBucketText || '待确认',
    statusClassName: item.statusBucket === 'completed' ? 'success' : item.statusBucket === 'upcoming' ? 'processing' : item.statusBucket === 'processing' ? 'processing' : 'waiting',
    statusBucket: item.statusBucket || 'pending',
    seatText: `已约 ${toNumber(summary.bookedSeatCount, trip.bookedSeatCount)} / 共 ${toNumber(summary.seatCount, trip.seatCount)} 座`,
    pendingApplicationCount: toNumber(summary.pendingApplicationCount),
    applications,
    trip,
    canPassengerConfirm: false,
    canPassengerCancel: false
  }
  record.action = buildRecordAction(record)
  return record
}

function formatPassengerRecord(item = {}) {
  const trip = formatTripCard(item.trip || {})
  const application = formatApplication(item.application || {})
  const record = {
    id: `passenger-${application.id || trip.id}`,
    tripId: trip.id,
    applicationId: application.id,
    role: 'passenger',
    roleText: '乘客',
    startName: trip.startName,
    endName: trip.endName,
    routeText: trip.routeText,
    departTimeText: trip.departTimeText,
    priceText: application.priceText || trip.priceText,
    statusText: application.statusText,
    statusClassName: application.statusClassName,
    statusBucket: item.statusBucket || 'pending',
    seatText: application.seatText,
    trip,
    application,
    canPassengerConfirm: Boolean(application.canPassengerConfirm),
    canPassengerCancel: Boolean(application.canPassengerCancel)
  }
  record.action = buildRecordAction(record)
  return record
}

function formatMyCarpool(payload = {}) {
  const ownerRecords = (payload.ownerRecords || []).map(formatOwnerRecord)
  const passengerRecords = (payload.passengerRecords || []).map(formatPassengerRecord)
  const allList = ownerRecords.concat(passengerRecords)
  return {
    summary: {
      ownerTripTotal: toNumber(payload.summary && payload.summary.ownerTripTotal),
      passengerTripTotal: toNumber(payload.summary && payload.summary.passengerTripTotal),
      pendingTotal: toNumber(payload.summary && payload.summary.pendingTotal),
      upcomingTotal: toNumber(payload.summary && payload.summary.upcomingTotal),
      processingTotal: toNumber(payload.summary && payload.summary.processingTotal),
      completedTotal: toNumber(payload.summary && payload.summary.completedTotal)
    },
    ownerRecords,
    passengerRecords,
    allList
  }
}

module.exports = {
  formatApplication,
  formatCarpoolDetail,
  formatMyCarpool,
  formatTripCard
}
