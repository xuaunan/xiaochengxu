const { fetchDashboard, fetchWithdraws } = require('../../utils/api')
const { buildWallet, getDriverIncomeAmount } = require('../../utils/driver-store')
const { ORDER_STATUS, SERVICE_TYPE } = require('../../utils/constants')

function pad(value) {
  return `${value}`.padStart(2, '0')
}

function getOrderTime(order = {}) {
  return order.finishedAt ||
    order.finishTime ||
    order.finished_at ||
    order.finish_time ||
    order.updatedAt ||
    order.updated_at ||
    order.createdAt ||
    order.created_at ||
    ''
}

function getOrderStatus(order = {}) {
  const rawStatus = `${order.orderStatus || order.order_status || order.rawStatus || order.status || ''}`.trim()
  const statusMap = {
    completed: ORDER_STATUS.FINISHED,
    finished: ORDER_STATUS.FINISHED,
    cancelled: ORDER_STATUS.CANCELLED
  }
  return statusMap[rawStatus] || rawStatus.toUpperCase()
}

function formatDateTime(value) {
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    if (!year || !month || !day) return ''
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }

  const text = `${value || ''}`.trim()
  if (!text) return ''
  const arrayLike = text.match(/^(\d{4}),(\d{1,2}),(\d{1,2}),?(\d{1,2})?,?(\d{1,2})?,?(\d{1,2})?/)
  if (arrayLike) {
    const [, year, month, day, hour = 0, minute = 0, second = 0] = arrayLike
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }
  return text.replace(/\//g, '-')
}

function getDateKey(value) {
  if (Array.isArray(value)) {
    const [year, month, day] = value
    if (!year || !month || !day) return ''
    return `${year}-${pad(month)}-${pad(day)}`
  }

  const text = `${value || ''}`.trim()
  const arrayLike = text.match(/^(\d{4}),(\d{1,2}),(\d{1,2})/)
  if (arrayLike) {
    return `${arrayLike[1]}-${pad(arrayLike[2])}-${pad(arrayLike[3])}`
  }
  return text.slice(0, 10).replace(/\//g, '-')
}

function getTimeValue(order = {}) {
  const value = getOrderTime(order)
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, month - 1, day, hour, minute, second).getTime()
  }
  const normalized = `${value || ''}`.replace(/^(\d{4}),(\d{1,2}),(\d{1,2}),?(\d{1,2})?,?(\d{1,2})?,?(\d{1,2})?/, (_, year, month, day, hour = 0, minute = 0, second = 0) => {
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  }).replace(/-/g, '/')
  const time = new Date(normalized).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isFinishedIncomeOrder(order = {}) {
  return getOrderStatus(order) === ORDER_STATUS.FINISHED && getDriverIncomeAmount(order) > 0
}

function buildLocalDateParts() {
  const current = new Date()
  const day = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
  return {
    day,
    month: day.slice(0, 7)
  }
}

function getOrderMonthKey(order = {}) {
  return getDateKey(getOrderTime(order)).slice(0, 7)
}

function formatMonthLabel(monthKey) {
  const match = `${monthKey || ''}`.match(/^(\d{4})-(\d{2})$/)
  if (!match) return '本月'
  return `${match[1]}年${match[2]}月`
}

function formatMonthIncomeLabel(monthKey, currentMonth) {
  if (monthKey === currentMonth) return '本月收入'
  const match = `${monthKey || ''}`.match(/^(\d{4})-(\d{2})$/)
  if (!match) return '所选月收入'
  return `${match[1]}.${match[2]}收入`
}

function buildMonthOptions(incomeOrders = [], currentMonth) {
  const months = new Set()
  if (currentMonth) months.add(currentMonth)
  incomeOrders.forEach((order) => {
    const monthKey = getOrderMonthKey(order)
    if (monthKey) months.add(monthKey)
  })
  return Array.from(months)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({
      value,
      label: value === currentMonth ? `本月 ${formatMonthLabel(value)}` : formatMonthLabel(value)
    }))
}

function buildBillRows(monthBills = []) {
  return monthBills.slice(0, 10).map((item) => ({
    id: item.id || getOrderNo(item),
    title: getBillTitle(item),
    amount: `+¥${getDriverIncomeAmount(item).toFixed(2)}`,
    time: formatDateTime(getOrderTime(item))
  }))
}

function buildMonthViewState(incomeOrders = [], walletBase = {}, selectedMonth, dateParts, monthOptions = []) {
  const { day, month: currentMonth } = dateParts || buildLocalDateParts()
  const options = monthOptions.length ? monthOptions : buildMonthOptions(incomeOrders, currentMonth)
  const selectedIndex = Math.max(0, options.findIndex((item) => item.value === selectedMonth))
  const activeMonth = (options[selectedIndex] && options[selectedIndex].value) || currentMonth
  const selectedMonthLabel = formatMonthLabel(activeMonth)
  const monthBills = incomeOrders.filter((item) => getOrderMonthKey(item) === activeMonth)
  const todayBills = incomeOrders.filter((item) => getDateKey(getOrderTime(item)) === day)
  const monthIncome = monthBills.reduce((sum, item) => sum + getDriverIncomeAmount(item), 0)
  const currentMonthSuffix = activeMonth === currentMonth ? ` · 今日 ${todayBills.length} 笔` : ''

  return {
    wallet: {
      ...walletBase,
      monthIncome: Number(monthIncome.toFixed(2))
    },
    bills: buildBillRows(monthBills),
    billTitle: activeMonth === currentMonth ? '本月流水' : `${selectedMonthLabel}流水`,
    billSummary: `${selectedMonthLabel} ${monthBills.length} 笔${currentMonthSuffix}`,
    billEmptyTitle: `${activeMonth === currentMonth ? '本月' : selectedMonthLabel}暂无流水`,
    billEmptyDesc: `完成行程并结算后，${activeMonth === currentMonth ? '本月' : selectedMonthLabel}收入会和流水一起增加。`,
    monthIncomeLabel: formatMonthIncomeLabel(activeMonth, currentMonth),
    selectedMonth: activeMonth,
    selectedMonthIndex: selectedIndex,
    selectedMonthLabel
  }
}

function getOrderNo(order = {}) {
  return order.orderNo || order.order_no || order.id || ''
}

function getOrderName(order = {}) {
  const serviceType = order.serviceType || order.service_type
  if (serviceType === SERVICE_TYPE.CARPOOL) return '顺风车'
  if (serviceType === SERVICE_TYPE.INTERNATIONAL) return '跨境出行'
  return '即时打车'
}

function getShortOrderNo(order = {}) {
  const orderNo = `${getOrderNo(order)}`
  return orderNo.length > 6 ? orderNo.slice(-6) : orderNo
}

function getBillTitle(order = {}) {
  const startName = order.startName || order.start_name || ''
  const endName = order.endName || order.end_name || ''
  const serviceName = getOrderName(order)
  if (startName && endName) {
    return `${serviceName} ${startName} → ${endName}`
  }
  return `${serviceName} #${getShortOrderNo(order)}`
}

function getWithdrawTime(record = {}) {
  return record.createdAt || record.created_at || record.auditedAt || record.audited_at || ''
}

function getWithdrawStatusClass(status) {
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  return 'pending'
}

function formatWithdrawRecord(record = {}) {
  const amount = Number(record.applyAmount || record.apply_amount || 0)
  const status = record.status || 'PENDING'
  return {
    id: record.id || `${status}-${getWithdrawTime(record)}`,
    amountText: amount.toFixed(2),
    bankName: record.bankName || record.bank_name || '',
    bankAccountMasked: record.bankAccountMasked || record.bank_account_masked || '',
    status,
    statusClass: getWithdrawStatusClass(status),
    statusText: record.statusText || record.status_text || (status === 'APPROVED' ? '已打款' : status === 'REJECTED' ? '已驳回' : '待审核'),
    createdAtText: formatDateTime(getWithdrawTime(record)) || '提交时间待确认'
  }
}

Page({
  data: {
    wallet: {
      todayIncome: 0,
      monthIncome: 0,
      withdrawable: 0
    },
    bills: [],
    billTitle: '本月流水',
    billSummary: '',
    billEmptyTitle: '本月暂无流水',
    billEmptyDesc: '完成行程并结算后，本月收入会和流水一起增加。',
    monthOptions: [],
    selectedMonth: '',
    selectedMonthIndex: 0,
    selectedMonthLabel: '',
    monthIncomeLabel: '本月收入',
    withdrawRecords: [],
    loading: false,
    errorText: ''
  },

  async onShow() {
    await this.refreshWallet().catch(() => {})
  },

  async refreshWallet() {
    this.setData({
      loading: !this.data.bills.length,
      errorText: ''
    })
    try {
      const response = await fetchDashboard()
      const dashboard = response.data || {}
      let withdrawSource = dashboard.withdraws || dashboard.pendingWithdraw || []
      if (!withdrawSource.length) {
        try {
          const withdrawResponse = await fetchWithdraws({ skipToast: true })
          withdrawSource = withdrawResponse.data || withdrawSource
        } catch (error) {
          withdrawSource = []
        }
      }
      if (!Array.isArray(withdrawSource)) {
        withdrawSource = withdrawSource.records || []
      }
      const incomeOrders = (dashboard.orders || [])
        .filter(isFinishedIncomeOrder)
        .sort((left, right) => getTimeValue(right) - getTimeValue(left))
      const dateParts = buildLocalDateParts()
      const wallet = buildWallet(dashboard.profile || {}, incomeOrders)
      const monthOptions = buildMonthOptions(incomeOrders, dateParts.month)
      this.incomeOrders = incomeOrders
      this.walletBase = wallet
      this.dateParts = dateParts
      getApp().globalData.driverStore.wallet = wallet
      getApp().saveStore()
      this.setData({
        monthOptions,
        ...buildMonthViewState(incomeOrders, wallet, dateParts.month, dateParts, monthOptions),
        withdrawRecords: withdrawSource.slice(0, 3).map(formatWithdrawRecord),
        loading: false,
        errorText: ''
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorText: (error && error.message) || '收益数据加载失败，请稍后重试'
      })
      wx.showToast({
        title: '收益数据加载失败，请稍后重试',
        icon: 'none'
      })
      throw error
    }
  },

  changeIncomeMonth(e) {
    const index = Number(e.detail.value || 0)
    const option = this.data.monthOptions[index]
    if (!option) return
    this.setData(buildMonthViewState(
      this.incomeOrders || [],
      this.walletBase || this.data.wallet || {},
      option.value,
      this.dateParts || buildLocalDateParts(),
      this.data.monthOptions || []
    ))
  },

  showIncomeTip(e) {
    const type = e.currentTarget.dataset.type
    const tips = {
      today: {
        title: '今日收入',
        content: '只统计今天已完成并产生司机收入的订单流水；没有今日流水时显示 0。'
      },
      month: {
        title: this.data.monthIncomeLabel || '本月收入',
        content: '这里会跟随流水月份选择变化，只统计所选月份已完成并产生司机收入的订单。'
      },
      cash: {
        title: '可提现',
        content: '当前可提现余额来自已结算收入。提交提现申请后会先扣减，驳回时返还。'
      }
    }
    const tip = tips[type] || tips.month
    wx.showModal({
      title: tip.title,
      content: tip.content,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showBillTip() {
    const monthLabel = this.data.selectedMonthLabel || '本月'
    wx.showModal({
      title: '收益明细',
      content: `当前展示${monthLabel}最近 10 笔已完成订单流水；可通过月份下拉切换查看历史月份。`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  openWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/index' })
  },

  retryRefresh() {
    this.refreshWallet().catch(() => {})
  }
})
