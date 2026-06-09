import { computed, reactive, readonly, shallowRef } from 'vue'
import { buildOrderTimeline, cloneDataset, defaultHealth, defaultViews, orderStatusLabel } from '@/data/mockData'
import { checkHealth, getBaseUrl, login, request, setBaseUrl } from '@/services/api'
import type {
  ActiveView,
  AppMode,
  ConfirmationState,
  DesktopDataset,
  HealthStatus,
  OrderStatus,
  RideOrder,
  ServiceType
} from '@/types'

const statusAdvance: Record<OrderStatus, OrderStatus> = {
  CREATED: 'DISPATCHING',
  DISPATCHING: 'ACCEPTED',
  ACCEPTED: 'PICKING_UP',
  PICKING_UP: 'IN_TRIP',
  IN_TRIP: 'FINISHED',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
}

const modeActor: Record<AppMode, string> = {
  passenger: '乘客端',
  driver: '司机端',
  admin: '运营管理员'
}

const terminalOrderStatuses: OrderStatus[] = ['FINISHED', 'CANCELLED', 'REFUNDED']
const orderProgressionStatuses: OrderStatus[] = ['CREATED', 'DISPATCHING', 'ACCEPTED', 'PICKING_UP', 'IN_TRIP', 'FINISHED']

function formatCurrency(value: number, currencyCode: 'CNY' | 'USD' = 'CNY') {
  return `${currencyCode === 'USD' ? '$' : '¥'}${value.toFixed(2)}`
}

function orderStatusLabelSafe(status: OrderStatus) {
  return orderStatusLabel[status] || status
}

function includesQuery(fields: Array<unknown>, query: string) {
  const value = query.trim().toLowerCase()
  if (!value) return true
  return fields
    .filter((item) => item != null)
    .some((item) => String(item).toLowerCase().includes(value))
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export function useDesktopState() {
  const mode = shallowRef<AppMode>('passenger')
  const activeView = shallowRef<ActiveView>(defaultViews.passenger)
  const query = shallowRef('')
  const backendBaseUrl = shallowRef(getBaseUrl())
  const busy = shallowRef(false)
  const toast = shallowRef('')
  const selectedOrderId = shallowRef(9001)
  const modeViews = reactive<Record<AppMode, ActiveView>>({ ...defaultViews })
  const health = reactive<HealthStatus>({ ...defaultHealth })
  const dataset = reactive<DesktopDataset>(cloneDataset())
  const confirmation = reactive<ConfirmationState>({
    open: false,
    title: '',
    body: '',
    confirmText: '确认',
    tone: 'default'
  })

  let confirmationRunner: (() => void) | undefined

  const unreadMessageCount = computed(() => dataset.messages.filter((item) => !item.read).length)
  const pendingReviewCount = computed(() => dataset.users.filter((item) => item.authStatus === 1).length)
  const pendingPaymentCount = computed(() =>
    dataset.orders.filter((item) => item.payStatus === 'UNPAID' && !['CANCELLED', 'REFUNDED'].includes(item.status)).length
  )
  const selectedOrder = computed(() => dataset.orders.find((item) => item.id === selectedOrderId.value) || dataset.orders[0])
  const selectedTimeline = computed(() => buildOrderTimeline(selectedOrder.value))

  const visibleOrders = computed(() =>
    dataset.orders.filter((order) =>
      includesQuery(
        [order.orderNo, order.passengerName, order.driverName, order.startName, order.endName, order.status, order.serviceType],
        query.value
      )
    )
  )

  const visibleUsers = computed(() =>
    dataset.users.filter((user) => includesQuery([user.name, user.phone, user.roleCode, user.authStatus], query.value))
  )

  const visibleCoupons = computed(() =>
    dataset.coupons.filter((coupon) => includesQuery([coupon.name, coupon.scope, coupon.status], query.value))
  )

  const visibleInternationalOrders = computed(() =>
    dataset.internationalOrders.filter((order) =>
      includesQuery([order.route, order.passengerName, order.flightNo, order.materialStatus, order.status], query.value)
    )
  )

  const passengerTransactions = computed(() =>
    dataset.transactions.filter((item) => item.owner === 'PASSENGER' && includesQuery([item.title, item.type, item.status], query.value))
  )

  const passengerInvoices = computed(() =>
    dataset.invoices.filter((item) => includesQuery([item.orderNo, item.title, item.kind, item.status], query.value))
  )

  const passengerReviews = computed(() =>
    dataset.reviews.filter((item) => includesQuery([item.orderNo, item.targetName, item.tags.join(' '), item.content], query.value))
  )

  const passengerHelpTickets = computed(() =>
    dataset.helpTickets.filter((item) => item.owner === 'PASSENGER' && includesQuery([item.category, item.title, item.status], query.value))
  )

  const driverTransactions = computed(() =>
    dataset.transactions.filter((item) => item.owner === 'DRIVER' && includesQuery([item.title, item.type, item.status], query.value))
  )

  const driverHelpTickets = computed(() =>
    dataset.helpTickets.filter((item) => item.owner === 'DRIVER' && includesQuery([item.category, item.title, item.status], query.value))
  )

  const visibleWithdraws = computed(() =>
    dataset.withdraws.filter((item) => includesQuery([item.driverName, item.channel, item.status], query.value))
  )

  const visibleComplaints = computed(() =>
    dataset.complaints.filter((item) => includesQuery([item.orderNo, item.passengerName, item.level, item.status, item.content], query.value))
  )

  const importantMessages = computed(() =>
    dataset.messages.filter((item) => !item.read && includesQuery([item.title, item.source, item.content], query.value))
  )

  const pendingWithdrawCount = computed(() => dataset.withdraws.filter((item) => item.status === 'PENDING').length)
  const openComplaintCount = computed(() => dataset.complaints.filter((item) => item.status !== 'CLOSED').length)
  const riskChecklistCount = computed(() => dataset.operationChecklist.filter((item) => item.status === 'RISK').length)
  const passengerOrders = computed(() => dataset.orders.filter((order) => order.passengerPhone === dataset.passenger.phone))
  const passengerBalance = computed(() => formatCurrency(dataset.passenger.balance))
  const activePassengerWallet = computed(() => passengerTransactions.value.slice(0, 6))
  const passengerRideStats = computed(() => {
    const finishedOrders = passengerOrders.value.filter((order) => order.status === 'FINISHED')
    const unpaidOrders = passengerOrders.value.filter((order) => order.payStatus === 'UNPAID')
    const savedAmount = dataset.coupons.reduce((sum, coupon) => sum + coupon.amount * coupon.used, 0)
    return [
      { label: '累计行程', value: String(passengerOrders.value.length), detail: `已完成 ${finishedOrders.length} 单` },
      { label: '待支付订单', value: String(unpaidOrders.length), detail: unpaidOrders[0]?.orderNo || '暂无欠款' },
      { label: '可用优惠券', value: String(dataset.coupons.filter((coupon) => coupon.status === 'ACTIVE').length), detail: `已节省 ${formatCurrency(savedAmount)}` },
      { label: '钱包余额', value: passengerBalance.value, detail: '支持充值与原路退款' }
    ]
  })

  const driverAvailableOrders = computed(() =>
    dataset.orders.filter(
      (order) =>
        ['CREATED', 'DISPATCHING'].includes(order.status) &&
        !order.driverName &&
        includesQuery([order.orderNo, order.passengerName, order.startName, order.endName, order.serviceType], query.value)
    )
  )

  const driverCurrentOrders = computed(() =>
    dataset.orders.filter(
      (order) =>
        (order.driverName === dataset.driver.name || order.driverPhone === dataset.driver.phone) &&
        !['FINISHED', 'CANCELLED', 'REFUNDED'].includes(order.status) &&
        includesQuery([order.orderNo, order.passengerName, order.startName, order.endName, order.status], query.value)
    )
  )

  const driverEarningStats = computed(() => {
    const finishedOrders = dataset.orders.filter(
      (order) => (order.driverName === dataset.driver.name || order.driverPhone === dataset.driver.phone) && order.status === 'FINISHED'
    )
    const finishedFare = finishedOrders.reduce((sum, order) => sum + order.amount, 0)
    return [
      { label: '今日流水', value: formatCurrency(dataset.driver.todayIncome), detail: `${dataset.driver.todayOrders} 单已入账` },
      {
        label: '账户余额',
        value: formatCurrency(dataset.driver.balance),
        detail: `提现审核中 ${dataset.withdraws.filter((item) => item.driverName === dataset.driver.name && item.status === 'PENDING').length} 笔`
      },
      { label: '服务评分', value: dataset.driver.rating.toFixed(2), detail: dataset.driver.serviceStatus === 'ONLINE' ? '正在接单' : '暂停接单' },
      { label: '完成行程', value: String(finishedOrders.length), detail: `样例流水 ${formatCurrency(finishedFare)}` }
    ]
  })

  function recordAudit(action: string, target: string, result = '完成', actor = modeActor[mode.value]) {
    dataset.auditEvents.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      actor,
      action,
      target,
      result,
      createdAt: nowTime()
    })
    if (dataset.auditEvents.length > 40) dataset.auditEvents.length = 40
  }

  function notify(message: string) {
    toast.value = message
    window.setTimeout(() => {
      if (toast.value === message) toast.value = ''
    }, 2600)
  }

  function pushFinanceLog(message: string) {
    dataset.financeLogs.unshift(`${nowTime()} ${message}`)
    if (dataset.financeLogs.length > 40) dataset.financeLogs.length = 40
  }

  function syncSelectedOrder(order: RideOrder) {
    selectedOrderId.value = order.id
  }

  function settleOrderPayment(order: RideOrder, source = '乘客支付') {
    if (order.payStatus === 'PAID') return false
    if (order.payStatus === 'REFUNDED' || ['CANCELLED', 'REFUNDED'].includes(order.status)) return false

    order.payStatus = 'PAID'
    if (order.status === 'CREATED') order.status = 'DISPATCHING'

    if (order.currencyCode === 'CNY') {
      dataset.passenger.balance = Number(Math.max(dataset.passenger.balance - order.amount, 0).toFixed(2))
    }

    dataset.transactions.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      owner: 'PASSENGER',
      title: `订单 ${order.orderNo} 支付`,
      type: '支付',
      amount: -order.amount,
      status: '成功',
      createdAt: nowTime()
    })
    pushFinanceLog(`${order.orderNo} ${source} ${formatCurrency(order.amount, order.currencyCode)} 已入账`)
    return true
  }

  function settleDriverIncome(order: RideOrder) {
    if (!order.driverName || order.driverName !== dataset.driver.name) return false
    if (dataset.transactions.some((item) => item.owner === 'DRIVER' && item.title === `订单 ${order.orderNo} 收入`)) return false

    const income = Number((order.amount * 0.82).toFixed(2))
    dataset.driver.balance = Number((dataset.driver.balance + income).toFixed(2))
    dataset.driver.todayIncome = Number((dataset.driver.todayIncome + income).toFixed(2))
    dataset.driver.todayOrders += 1
    dataset.transactions.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      owner: 'DRIVER',
      title: `订单 ${order.orderNo} 收入`,
      type: '收入',
      amount: income,
      status: '成功',
      createdAt: nowTime()
    })
    pushFinanceLog(`${order.orderNo} 司机收入 ${formatCurrency(income)} 已结算`)
    return true
  }

  function refundPaidOrder(order: RideOrder, reason = '订单退款') {
    if (order.payStatus !== 'PAID') return false

    if (order.currencyCode === 'CNY') {
      dataset.passenger.balance = Number((dataset.passenger.balance + order.amount).toFixed(2))
    }
    order.payStatus = 'REFUNDED'
    order.status = 'REFUNDED'
    order.pickupEta = '已退款'
    order.invoiceStatus = order.invoiceStatus === '已开票' ? order.invoiceStatus : '已驳回'

    dataset.transactions.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      owner: 'PASSENGER',
      title: `订单 ${order.orderNo} 退款`,
      type: '退款',
      amount: order.amount,
      status: '成功',
      createdAt: nowTime()
    })
    pushFinanceLog(`${order.orderNo} ${reason} ${formatCurrency(order.amount, order.currencyCode)} 已退回`)
    return true
  }

  function askConfirmation(options: {
    title: string
    body: string
    confirmText?: string
    tone?: 'default' | 'danger'
    run: () => void
  }) {
    confirmation.open = true
    confirmation.title = options.title
    confirmation.body = options.body
    confirmation.confirmText = options.confirmText || '确认'
    confirmation.tone = options.tone || 'default'
    confirmationRunner = options.run
  }

  function cancelConfirmation() {
    confirmation.open = false
    confirmationRunner = undefined
  }

  function runConfirmation() {
    const run = confirmationRunner
    cancelConfirmation()
    run?.()
  }

  function setMode(nextMode: AppMode) {
    mode.value = nextMode
    activeView.value = modeViews[nextMode]
  }

  function setView(view: ActiveView) {
    modeViews[mode.value] = view
    activeView.value = view
  }

  function updateBaseUrl(value: string) {
    backendBaseUrl.value = value.replace(/\/$/, '')
    setBaseUrl(backendBaseUrl.value)
    recordAudit('更新接口地址', backendBaseUrl.value, '已保存')
    notify('接口地址已更新')
  }

  async function refreshHealth() {
    busy.value = true
    try {
      const next = await checkHealth()
      Object.assign(health, next)
      recordAudit('健康检查', '业务服务', '在线')
      notify('已连接业务服务')
    } catch {
      Object.assign(health, {
        ...defaultHealth,
        checkedAt: new Date().toLocaleString()
      })
      recordAudit('健康检查', '业务服务', '离线')
      notify('业务服务未连接，已切换为离线数据')
    } finally {
      busy.value = false
    }
  }

  async function loginRole(role: AppMode) {
    busy.value = true
    try {
      await login(role)
      recordAudit('角色登录', modeActor[role], '成功')
      notify(`${role === 'admin' ? '运营' : role === 'driver' ? '司机' : '乘客'}账号登录成功`)
      await refreshHealth()
    } catch (error) {
      notify(error instanceof Error ? error.message : '登录失败，继续使用离线数据')
    } finally {
      busy.value = false
    }
  }

  async function refreshAdminDashboard() {
    busy.value = true
    try {
      const liveMetrics = await request<{ todayOrderCount?: number; todayRevenue?: number; onlineDriverCount?: number }>(
        'admin',
        '/admin/dashboard'
      )
      if (liveMetrics?.todayOrderCount != null) dataset.metrics[0].value = String(liveMetrics.todayOrderCount)
      if (liveMetrics?.todayRevenue != null) dataset.metrics[1].value = formatCurrency(Number(liveMetrics.todayRevenue))
      if (liveMetrics?.onlineDriverCount != null) dataset.metrics[2].value = String(liveMetrics.onlineDriverCount)
      recordAudit('刷新大盘', '运营数据', '实时接口')
      notify('运营大盘已刷新')
    } catch {
      recordAudit('刷新大盘', '运营数据', '离线数据')
      notify('运营大盘保持离线数据')
    } finally {
      busy.value = false
    }
  }

  function selectOrder(orderId: number) {
    selectedOrderId.value = orderId
  }

  function createPassengerOrder(payload: { serviceType: ServiceType; startName: string; endName: string }) {
    const id = Math.max(...dataset.orders.map((item) => item.id)) + 1
    const amount = payload.serviceType === 'INTERNATIONAL' ? 88 : payload.serviceType === 'CARPOOL' ? 42 : 56
    const order: RideOrder = {
      id,
      orderNo: `ST${Date.now().toString().slice(-10)}`,
      serviceType: payload.serviceType,
      passengerName: dataset.passenger.name,
      passengerPhone: dataset.passenger.phone,
      startName: payload.startName || '当前位置',
      endName: payload.endName || '目的地',
      distanceKm: payload.serviceType === 'INTERNATIONAL' ? 52.8 : 16.4,
      durationMin: payload.serviceType === 'INTERNATIONAL' ? 70 : 31,
      amount,
      currencyCode: payload.serviceType === 'INTERNATIONAL' ? 'USD' : 'CNY',
      status: 'DISPATCHING',
      payStatus: 'UNPAID',
      createdAt: new Date().toLocaleString(),
      pickupEta: '匹配中',
      invoiceStatus: '待申请'
    }
    dataset.orders.unshift(order)
    selectedOrderId.value = id
    setView('passenger-trip')
    recordAudit('创建订单', order.orderNo, orderStatusLabelSafe(order.status))
    notify('订单已创建，进入派单流程')
  }

  function advanceOrder(orderId: number, forcedStatus?: OrderStatus) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (['CANCELLED', 'REFUNDED'].includes(order.status)) {
      notify('已取消或已退款订单不能继续推进')
      return
    }
    if (forcedStatus && terminalOrderStatuses.includes(order.status) && forcedStatus !== order.status) {
      notify('终态订单不能继续变更履约状态')
      return
    }
    const nextStatus = forcedStatus || statusAdvance[order.status]
    if (
      forcedStatus &&
      orderProgressionStatuses.includes(forcedStatus) &&
      orderProgressionStatuses.includes(order.status) &&
      orderProgressionStatuses.indexOf(forcedStatus) < orderProgressionStatuses.indexOf(order.status)
    ) {
      notify('订单不能回退到更早的履约节点')
      return
    }
    order.status = nextStatus
    if (order.status === 'ACCEPTED') {
      order.driverName = order.driverName || dataset.driver.name
      order.driverPhone = order.driverPhone || dataset.driver.phone
      order.pickupEta = '8 分钟'
    }
    if (order.status === 'PICKING_UP') order.pickupEta = '3 分钟'
    if (order.status === 'IN_TRIP') order.pickupEta = '行程中'
    if (order.status === 'FINISHED') {
      order.pickupEta = '已完成'
      settleOrderPayment(order, '完单自动支付')
      settleDriverIncome(order)
    }
    syncSelectedOrder(order)
    recordAudit('推进订单', order.orderNo, orderStatusLabelSafe(order.status))
    notify(`订单已更新为：${buildOrderTimeline(order).find((item) => item.current)?.label || order.status}`)
  }

  function refundOrder(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (order.payStatus !== 'PAID') {
      notify(order.payStatus === 'REFUNDED' ? '订单已退款，无需重复处理' : '未支付订单无需退款')
      return
    }
    askConfirmation({
      title: '确认退款',
      body: `订单 ${order.orderNo} 将变更为已退款，支付状态也会同步更新。`,
      confirmText: '确认退款',
      tone: 'danger',
      run: () => {
        refundPaidOrder(order)
        recordAudit('订单退款', order.orderNo, '已退款')
        notify('退款状态已更新')
      }
    })
  }

  function cancelOrder(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (terminalOrderStatuses.includes(order.status)) {
      notify('终态订单无需取消')
      return
    }
    askConfirmation({
      title: '确认取消订单',
      body: `订单 ${order.orderNo} 将进入取消状态，派单和支付流程会同步终止。`,
      confirmText: '取消订单',
      tone: 'danger',
      run: () => {
        if (order.payStatus === 'PAID') {
          refundPaidOrder(order, '取消订单退款')
        } else {
          order.status = 'CANCELLED'
          order.pickupEta = '已取消'
        }
        recordAudit('取消订单', order.orderNo, '已取消')
        notify(order.payStatus === 'REFUNDED' ? '订单已取消，支付金额已退款' : '订单已取消')
      }
    })
  }

  function payOrder(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (order.payStatus === 'PAID') {
      notify('订单已支付，无需重复操作')
      return
    }
    if (order.payStatus === 'REFUNDED' || ['CANCELLED', 'REFUNDED'].includes(order.status)) {
      notify('已取消或已退款订单不能支付')
      return
    }
    settleOrderPayment(order)
    recordAudit('乘客支付', order.orderNo, formatCurrency(order.amount, order.currencyCode))
    notify('支付成功，账单已更新')
  }

  function applyInvoice(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (order.payStatus !== 'PAID') {
      notify('支付完成后才能申请发票')
      return
    }
    if (['CANCELLED', 'REFUNDED'].includes(order.status)) {
      notify('已取消或已退款订单不能申请发票')
      return
    }
    order.invoiceStatus = '开票中'
    const existing = dataset.invoices.find((item) => item.orderNo === order.orderNo)
    if (existing) {
      existing.status = '开票中'
      existing.appliedAt = nowTime()
    } else {
      dataset.invoices.unshift({
        id: Date.now(),
        orderNo: order.orderNo,
        title: dataset.passenger.name,
        kind: '个人',
        taxNo: '-',
        amount: order.amount,
        status: '开票中',
        appliedAt: nowTime()
      })
    }
    recordAudit('申请发票', order.orderNo, '开票中')
    notify('电子发票申请已提交')
  }

  function submitReview(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (order.status !== 'FINISHED') {
      notify('行程完成后才能评价')
      return
    }
    order.rating = 5
    if (!dataset.reviews.some((item) => item.orderNo === order.orderNo)) {
      dataset.reviews.unshift({
        id: Date.now(),
        orderNo: order.orderNo,
        targetName: order.driverName || '待分配司机',
        rating: 5,
        tags: ['准时', '服务好'],
        content: '行程体验良好，感谢服务。',
        createdAt: nowTime()
      })
    }
    recordAudit('提交评价', order.orderNo, '五星')
    notify('五星评价已提交')
  }

  function submitComplaint(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (order.complaintStatus === '待处理') {
      notify('投诉已进入运营待办，请勿重复提交')
      return
    }
    order.complaintStatus = '待处理'
    if (!dataset.complaints.some((item) => item.orderNo === order.orderNo && item.status !== 'CLOSED')) {
      dataset.complaints.unshift({
        id: Date.now() + 2,
        orderNo: order.orderNo,
        passengerName: order.passengerName,
        level: '一般',
        status: 'PENDING',
        content: '乘客提交售后投诉，等待运营跟进。',
        createdAt: nowTime()
      })
    }
    dataset.messages.unshift({
      id: Date.now(),
      title: '新增乘客投诉',
      content: `${order.orderNo} 已提交投诉，需要运营处理。`,
      source: '投诉建议',
      level: 'danger',
      read: false,
      createdAt: nowTime()
    })
    dataset.helpTickets.unshift({
      id: Date.now() + 1,
      owner: 'PASSENGER',
      category: '订单',
      title: `投诉处理 ${order.orderNo}`,
      status: 'OPEN',
      createdAt: nowTime()
    })
    recordAudit('提交投诉', order.orderNo, '待处理')
    notify('投诉已进入运营待办')
  }

  function rechargeWallet(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('请输入有效充值金额')
      return
    }
    dataset.passenger.balance = Number((dataset.passenger.balance + amount).toFixed(2))
    dataset.transactions.unshift({
      id: Date.now(),
      owner: 'PASSENGER',
      title: '余额充值',
      type: '充值',
      amount,
      status: '成功',
      createdAt: nowTime()
    })
    recordAudit('乘客充值', dataset.passenger.name, formatCurrency(amount))
    notify('充值成功，余额已更新')
  }

  function submitHelpTicket(owner: 'PASSENGER' | 'DRIVER', category: '订单' | '钱包' | '安全' | '发票' | '认证', title: string) {
    dataset.helpTickets.unshift({
      id: Date.now(),
      owner,
      category,
      title,
      status: 'OPEN',
      createdAt: nowTime()
    })
    recordAudit('新增客服单', title, owner === 'DRIVER' ? '司机端' : '乘客端')
    notify('客服工单已提交')
  }

  function resolveHelpTicket(ticketId: number) {
    const ticket = dataset.helpTickets.find((item) => item.id === ticketId)
    if (!ticket) return
    if (ticket.status === 'RESOLVED') {
      notify('客服单已解决')
      return
    }
    ticket.status = 'RESOLVED'
    recordAudit('处理客服单', ticket.title, '已解决')
    notify('客服单已标记解决')
  }

  function receiveCoupon(couponId: number) {
    const coupon = dataset.coupons.find((item) => item.id === couponId)
    if (!coupon) return
    if (coupon.status !== 'ACTIVE') {
      notify('当前优惠券不可领取')
      return
    }
    coupon.received += 1
    recordAudit('领取优惠券', coupon.name, '已领取')
    notify(`已领取：${coupon.name}`)
  }

  function publishCarpool() {
    const id = Math.max(...dataset.carpoolTrips.map((item) => item.id)) + 1
    dataset.carpoolTrips.unshift({
      id,
      ownerName: dataset.passenger.name,
      startName: '深圳北站',
      endName: '广州南站',
      departTime: '今天 19:30',
      seats: 2,
      price: 118,
      status: 'OPEN',
      applications: 0
    })
    notify('顺风车行程已发布')
  }

  function applyCarpool(tripId: number) {
    const trip = dataset.carpoolTrips.find((item) => item.id === tripId)
    if (!trip) return
    if (trip.ownerName === dataset.passenger.name) {
      notify('不能申请自己发布的顺风车')
      return
    }
    if (trip.status !== 'OPEN') {
      notify('该顺风车行程暂不可申请')
      return
    }
    trip.applications += 1
    trip.status = 'CONFIRMING'
    recordAudit('申请顺风车', `${trip.startName} -> ${trip.endName}`, '待确认')
    notify('顺风车申请已提交，等待车主确认')
  }

  function toggleDriverService() {
    dataset.driver.serviceStatus = dataset.driver.serviceStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE'
    recordAudit('司机听单状态', dataset.driver.name, dataset.driver.serviceStatus === 'ONLINE' ? '在线' : '离线')
    notify(dataset.driver.serviceStatus === 'ONLINE' ? '司机已开始听单' : '司机已暂停听单')
  }

  function driverAccept(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (dataset.driver.serviceStatus !== 'ONLINE') {
      notify('司机在线后才能接单')
      return
    }
    if (!['CREATED', 'DISPATCHING'].includes(order.status) || order.driverName) {
      notify('该订单当前不可接单')
      return
    }
    order.status = 'ACCEPTED'
    order.driverName = dataset.driver.name
    order.driverPhone = dataset.driver.phone
    order.pickupEta = '8 分钟'
    selectedOrderId.value = orderId
    setView('driver-trip')
    recordAudit('司机接单', order.orderNo, dataset.driver.name)
    notify('已接单，行程进入接驾流程')
  }

  function driverReject(orderId: number) {
    const order = dataset.orders.find((item) => item.id === orderId)
    if (!order) return
    if (terminalOrderStatuses.includes(order.status)) {
      notify('终态订单不能拒单')
      return
    }
    if (order.driverName && order.driverName !== dataset.driver.name) {
      notify('只能拒绝当前司机自己的订单')
      return
    }
    order.status = 'DISPATCHING'
    order.driverName = undefined
    order.driverPhone = undefined
    recordAudit('司机拒单', order.orderNo, '回到派单池')
    notify('已拒单，订单回到派单池')
  }

  function submitWithdraw(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('请输入有效提现金额')
      return
    }
    if (amount > dataset.driver.balance) {
      notify('提现金额不能超过可用余额')
      return
    }
    dataset.driver.balance = Number((dataset.driver.balance - amount).toFixed(2))
    dataset.messages.unshift({
      id: Date.now(),
      title: '司机提现待审核',
      content: `${dataset.driver.name} 提现 ${formatCurrency(amount)}，等待运营审核。`,
      source: '提现审核',
      level: 'warning',
      read: false,
      createdAt: nowTime()
    })
    dataset.transactions.unshift({
      id: Date.now() + 1,
      owner: 'DRIVER',
      title: '提现到默认账户',
      type: '提现',
      amount: -amount,
      status: '处理中',
      createdAt: nowTime()
    })
    dataset.withdraws.unshift({
      id: Date.now() + 2,
      driverName: dataset.driver.name,
      amount,
      channel: '默认收款账户',
      status: 'PENDING',
      createdAt: nowTime()
    })
    recordAudit('司机提现', dataset.driver.name, formatCurrency(amount))
    notify('提现申请已提交')
  }

  function toggleDriverSetting(key: string) {
    const setting = dataset.driverSettings.find((item) => item.key === key)
    if (!setting) return
    setting.enabled = !setting.enabled
    recordAudit('司机设置', setting.label, setting.enabled ? '已开启' : '已关闭')
    notify(`${setting.label}已${setting.enabled ? '开启' : '关闭'}`)
  }

  function addEmergencyContact() {
    const fallback = '李女士 13600000008'
    dataset.passenger.emergencyContact = dataset.passenger.emergencyContact === fallback ? '陈先生 13900000002' : fallback
    recordAudit('乘客安全设置', dataset.passenger.name, '更新紧急联系人')
    notify('紧急联系人已更新')
  }

  function submitDriverDocument(documentId: number) {
    const document = dataset.driverDocuments.find((item) => item.id === documentId)
    if (!document) return
    if (document.status === '待审核') {
      notify('证件已在审核中')
      return
    }
    document.status = '待审核'
    document.updatedAt = nowTime()
    document.remark = '已提交，等待运营审核'
    dataset.messages.unshift({
      id: Date.now() + 1,
      title: `司机${document.documentType}待审核`,
      content: `${dataset.driver.name} 已提交${document.documentType}，需要运营确认。`,
      source: '司机审核',
      level: 'warning',
      read: false,
      createdAt: nowTime()
    })
    dataset.operationChecklist.unshift({
      id: Date.now(),
      title: `审核${dataset.driver.name}${document.documentType}`,
      owner: '运营',
      due: '今日',
      status: 'PENDING'
    })
    recordAudit('司机证件提交', document.documentType, '待审核')
    notify('证件资料已提交审核')
  }

  function reportDriverLocation() {
    const nextLongitude = Number((dataset.driver.longitude + 0.0032).toFixed(6))
    const nextLatitude = Number((dataset.driver.latitude + 0.0021).toFixed(6))
    dataset.driver.longitude = nextLongitude
    dataset.driver.latitude = nextLatitude
    dataset.driver.currentLocation = `深圳市福田区 ${nextLongitude.toFixed(4)}, ${nextLatitude.toFixed(4)}`
    recordAudit('司机位置上报', dataset.driver.name, dataset.driver.currentLocation)
    notify('当前位置已上报')
  }

  function auditUser(userId: number, pass: boolean) {
    const user = dataset.users.find((item) => item.id === userId)
    if (!user) return
    if (user.authStatus !== 1) {
      notify(`${user.name} 当前没有待审核认证`)
      return
    }
    user.authStatus = pass ? 2 : 3
    const driver = dataset.drivers.find((item) => item.userId === userId)
    if (driver) driver.authStatus = user.authStatus
    if (dataset.passenger.id === userId) dataset.passenger.authStatus = user.authStatus
    if (dataset.driver.userId === userId) dataset.driver.authStatus = user.authStatus
    recordAudit('用户认证审核', user.name, pass ? '通过' : '驳回')
    notify(`${user.name} 已${pass ? '通过' : '驳回'}认证`)
  }

  function resetUserPassword(userId: number) {
    const user = dataset.users.find((item) => item.id === userId)
    if (!user) return
    recordAudit('重置登录密码', user.name, '临时密码已生成')
    notify(`${user.name} 的临时密码已生成`)
  }

  function toggleUserEnabled(userId: number) {
    const user = dataset.users.find((item) => item.id === userId)
    if (!user) return
    if (user.enabled) {
      askConfirmation({
        title: '确认禁用账号',
        body: `${user.name} 禁用后将无法继续登录对应客户端。`,
        confirmText: '禁用',
        tone: 'danger',
        run: () => {
          user.enabled = false
          recordAudit('禁用账号', user.name, '已禁用')
          notify(`${user.name} 已禁用`)
        }
      })
      return
    }
    user.enabled = true
    recordAudit('启用账号', user.name, '已启用')
    notify(`${user.name} 已启用`)
  }

  function auditWithdraw(withdrawId: number, approve: boolean) {
    const withdraw = dataset.withdraws.find((item) => item.id === withdrawId)
    if (!withdraw) return
    if (withdraw.status !== 'PENDING') {
      notify('该提现单已处理')
      return
    }
    withdraw.status = approve ? 'APPROVED' : 'REJECTED'
    if (!approve && withdraw.driverName === dataset.driver.name) {
      dataset.driver.balance = Number((dataset.driver.balance + withdraw.amount).toFixed(2))
    }
    pushFinanceLog(`${withdraw.driverName} 提现 ${formatCurrency(withdraw.amount)} ${approve ? '已通过' : '已驳回'}`)
    recordAudit('提现审核', withdraw.driverName, approve ? '通过' : '驳回')
    notify(`提现申请已${approve ? '通过' : '驳回'}`)
  }

  function handleComplaintCase(caseId: number, close = false) {
    const complaint = dataset.complaints.find((item) => item.id === caseId)
    if (!complaint) return
    complaint.status = close ? 'CLOSED' : 'HANDLING'
    const order = dataset.orders.find((item) => item.orderNo === complaint.orderNo)
    if (order) order.complaintStatus = close ? '已关闭' : '处理中'
    dataset.helpTickets
      .filter((item) => item.title.includes(complaint.orderNo))
      .forEach((item) => {
        item.status = close ? 'RESOLVED' : 'WAITING'
      })
    dataset.messages.unshift({
      id: Date.now(),
      title: close ? '投诉已关闭' : '投诉处理中',
      content: `${complaint.orderNo} ${close ? '已完成回访并关闭。' : '已分配客服跟进。'}`,
      source: '投诉处理',
      level: close ? 'info' : 'warning',
      read: false,
      createdAt: nowTime()
    })
    recordAudit('投诉处理', complaint.orderNo, close ? '已关闭' : '处理中')
    notify(`投诉已标记为${close ? '已关闭' : '处理中'}`)
  }

  function processInvoice(invoiceId: number, approve = true) {
    const invoice = dataset.invoices.find((item) => item.id === invoiceId)
    if (!invoice) return
    invoice.status = approve ? '已开具' : '已驳回'
    const order = dataset.orders.find((item) => item.orderNo === invoice.orderNo)
    if (order) order.invoiceStatus = approve ? '已开具' : '已驳回'
    recordAudit('发票审核', invoice.orderNo, approve ? '已开具' : '已驳回')
    notify(`发票已${approve ? '开具' : '驳回'}`)
  }

  function reviewDriverDocument(documentId: number, approve: boolean) {
    const document = dataset.driverDocuments.find((item) => item.id === documentId)
    if (!document) return
    document.status = approve ? '已通过' : '已驳回'
    document.updatedAt = nowTime()
    document.remark = approve ? '资料有效，审核通过' : '图片不清晰，请重新上传'
    recordAudit('司机证件审核', document.documentType, approve ? '通过' : '驳回')
    notify(`${document.documentType}已${approve ? '通过' : '驳回'}`)
  }

  function toggleCoupon(couponId: number) {
    const coupon = dataset.coupons.find((item) => item.id === couponId)
    if (!coupon) return
    coupon.status = coupon.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    recordAudit('优惠券状态', coupon.name, coupon.status === 'ACTIVE' ? '启用' : '暂停')
    notify(`${coupon.name} 已${coupon.status === 'ACTIVE' ? '启用' : '暂停'}`)
  }

  function grantCoupon(couponId: number) {
    const coupon = dataset.coupons.find((item) => item.id === couponId)
    if (!coupon) return
    coupon.received += 25
    recordAudit('批量发券', coupon.name, '25 张')
    notify('优惠券已批量发放给目标用户')
  }

  function createCouponTemplate() {
    const id = Math.max(...dataset.coupons.map((item) => item.id)) + 1
    dataset.coupons.unshift({
      id,
      name: '新客早高峰券',
      type: 'CASH',
      amount: 12,
      threshold: 45,
      scope: 'TAXI',
      status: 'PAUSED',
      received: 0,
      used: 0,
      expiresAt: '2026-06-30'
    })
    recordAudit('创建优惠券模板', '新客早高峰券', '草稿')
    notify('优惠券模板已创建')
  }

  function handleImportantMessage(messageId: number) {
    const message = dataset.messages.find((item) => item.id === messageId)
    if (!message) return
    message.read = true
    recordAudit('处理待办消息', message.title, '已处理')
    notify('待办已标记处理')
  }

  function markAllMessagesRead() {
    dataset.messages.forEach((item) => {
      item.read = true
    })
    recordAudit('处理全部消息', '重要消息', '已处理')
    notify('所有消息已处理')
  }

  function broadcastMessage() {
    dataset.messages.unshift({
      id: Date.now(),
      title: '平台运营广播',
      content: '高峰期运力调度策略已同步，请各端关注订单与服务提醒。',
      source: '运营中心',
      level: 'info',
      read: false,
      createdAt: nowTime()
    })
    recordAudit('平台广播', '全端消息', '已发送')
    notify('运营广播已发送')
  }

  function saveSystemNotice(noticeId: number) {
    const notice = dataset.notices.find((item) => item.id === noticeId)
    if (!notice) return
    notice.enabled = !notice.enabled
    recordAudit('系统公告', notice.title, notice.enabled ? '启用' : '停用')
    notify(`公告已${notice.enabled ? '启用' : '停用'}`)
  }

  function createVersionPlan() {
    const id = Math.max(...dataset.versions.map((item) => item.id)) + 1
    dataset.versions.unshift({
      id,
      clientType: 'USER_MINIAPP',
      version: `1.4.${id}`,
      forceUpdate: false,
      publishedAt: '待发布'
    })
    recordAudit('版本计划', `USER_MINIAPP 1.4.${id}`, '已创建')
    notify('版本计划已创建')
  }

  function publishVersion(versionId: number) {
    const version = dataset.versions.find((item) => item.id === versionId)
    if (!version) return
    version.publishedAt = new Date().toLocaleDateString()
    recordAudit('发布版本', `${version.clientType} ${version.version}`, '已发布')
    notify(`${version.clientType} ${version.version} 已重新发布`)
  }

  function toggleSystemConfig(key: string) {
    const config = dataset.configs.find((item) => item.key === key)
    if (!config) return
    config.enabled = !config.enabled
    recordAudit('系统参数', config.label, config.enabled ? '启用' : '停用')
    notify(`${config.label}已${config.enabled ? '启用' : '停用'}`)
  }

  function toggleDispatchRule(ruleId: number) {
    const rule = dataset.dispatchRules.find((item) => item.id === ruleId)
    if (!rule) return
    rule.enabled = !rule.enabled
    recordAudit('派单规则', rule.label, rule.enabled ? '启用' : '停用')
    notify(`${rule.label}已${rule.enabled ? '启用' : '停用'}`)
  }

  function tuneDispatchWeight(ruleId: number, delta: number) {
    const rule = dataset.dispatchRules.find((item) => item.id === ruleId)
    if (!rule) return
    rule.weight = Math.min(100, Math.max(0, rule.weight + delta))
    recordAudit('派单权重调整', rule.label, String(rule.weight))
    notify(`${rule.label}权重已调整为 ${rule.weight}`)
  }

  function toggleCurrencyRate(code: string) {
    const rate = dataset.currencyRates.find((item) => item.code === code)
    if (!rate) return
    rate.enabled = !rate.enabled
    rate.updatedAt = nowTime()
    recordAudit('跨境汇率', rate.code, rate.enabled ? '启用' : '停用')
    notify(`${rate.code} 汇率已${rate.enabled ? '启用' : '停用'}`)
  }

  function completeChecklist(itemId: number) {
    const item = dataset.operationChecklist.find((entry) => entry.id === itemId)
    if (!item) return
    item.status = 'DONE'
    recordAudit('运营清单', item.title, '已完成')
    notify('运营待办已完成')
  }

  function syncInternationalOrder(orderId: number) {
    const order = dataset.internationalOrders.find((item) => item.id === orderId)
    if (!order) return
    order.materialStatus = '已齐全'
    order.status = statusAdvance[order.status]
    recordAudit('跨境订单同步', order.route, order.materialStatus)
    notify('跨境订单资料与履约状态已更新')
  }

  return {
    mode,
    activeView,
    query,
    backendBaseUrl,
    busy,
    toast,
    health: readonly(health),
    dataset,
    confirmation,
    unreadMessageCount,
    pendingReviewCount,
    pendingPaymentCount,
    passengerBalance,
    passengerRideStats,
    driverEarningStats,
    activePassengerWallet,
    driverAvailableOrders,
    driverCurrentOrders,
    selectedOrder,
    selectedTimeline,
    visibleOrders,
    visibleUsers,
    visibleCoupons,
    visibleInternationalOrders,
    passengerTransactions,
    passengerInvoices,
    passengerReviews,
    passengerHelpTickets,
    driverTransactions,
    driverHelpTickets,
    visibleWithdraws,
    visibleComplaints,
    pendingWithdrawCount,
    openComplaintCount,
    riskChecklistCount,
    importantMessages,
    setMode,
    setView,
    updateBaseUrl,
    refreshHealth,
    loginRole,
    refreshAdminDashboard,
    selectOrder,
    createPassengerOrder,
    advanceOrder,
    cancelOrder,
    refundOrder,
    payOrder,
    applyInvoice,
    submitReview,
    submitComplaint,
    rechargeWallet,
    submitHelpTicket,
    resolveHelpTicket,
    receiveCoupon,
    publishCarpool,
    applyCarpool,
    toggleDriverService,
    driverAccept,
    driverReject,
    submitWithdraw,
    toggleDriverSetting,
    addEmergencyContact,
    submitDriverDocument,
    reportDriverLocation,
    auditUser,
    resetUserPassword,
    toggleUserEnabled,
    createCoupon: createCouponTemplate,
    toggleCoupon,
    grantCoupon,
    handleImportantMessage,
    markAllMessagesRead,
    broadcastMessage,
    saveSystemNotice,
    createVersionPlan,
    publishVersion,
    resolveWithdraw: auditWithdraw,
    handleComplaintCase,
    processInvoice,
    reviewDriverDocument,
    toggleSystemConfig,
    toggleDispatchRule,
    tuneDispatchWeight,
    toggleCurrencyRate,
    completeChecklist,
    syncInternationalOrder,
    cancelConfirmation,
    runConfirmation
  }
}

export type DesktopStore = ReturnType<typeof useDesktopState>
