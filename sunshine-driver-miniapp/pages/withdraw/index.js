const { fetchDashboard, fetchWithdraws, withdraw } = require('../../utils/api')
const { buildWallet } = require('../../utils/driver-store')

function pad(value) {
  return `${value}`.padStart(2, '0')
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
    rejectReason: record.rejectReason || record.reject_reason || '',
    createdAtText: formatDateTime(getWithdrawTime(record)) || '提交时间待确认'
  }
}

Page({
  data: {
    form: {
      amount: '',
      bankAccount: '',
      bankName: ''
    },
    availableAmount: 0,
    availableAmountText: '0.00',
    amountPlaceholder: '请输入提现金额',
    withdrawRecords: [],
    submitting: false
  },

  onShow() {
    this.loadWithdrawData()
  },

  async loadWithdrawData() {
    const [dashboardResponse, withdrawResponse] = await Promise.all([
      fetchDashboard(),
      fetchWithdraws({ skipToast: true }).catch(() => ({ data: [] }))
    ])
    const dashboard = dashboardResponse.data || {}
    const wallet = buildWallet(dashboard.profile || {}, dashboard.orders || [])
    let withdrawRecords = withdrawResponse.data || dashboard.withdraws || dashboard.pendingWithdraw || []
    if (!Array.isArray(withdrawRecords)) {
      withdrawRecords = withdrawRecords.records || []
    }
    getApp().globalData.driverStore.wallet = wallet
    getApp().saveStore()
    this.setData({
      availableAmount: wallet.withdrawable,
      availableAmountText: Number(wallet.withdrawable || 0).toFixed(2),
      amountPlaceholder: wallet.withdrawable > 0 ? `最多可提 ¥${Number(wallet.withdrawable).toFixed(2)}` : '当前暂无可提现余额',
      withdrawRecords: withdrawRecords.map(formatWithdrawRecord)
    })
  },

  updateField(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  showToast(title) {
    wx.showToast({
      title,
      icon: 'none'
    })
  },

  validateForm() {
    const amount = Number(this.data.form.amount)
    const availableAmount = Number(this.data.availableAmount || 0)
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      this.showToast('请输入正确的提现金额')
      return null
    }
    if (amount > availableAmount) {
      this.showToast('提现金额不能超过可提现余额')
      return null
    }
    const bankAccount = `${this.data.form.bankAccount || ''}`.trim()
    const bankName = `${this.data.form.bankName || ''}`.trim()
    if (!bankAccount) {
      this.showToast('请输入银行卡号')
      return null
    }
    if (!bankName) {
      this.showToast('请输入开户行')
      return null
    }
    return {
      applyAmount: amount,
      bankAccount,
      bankName
    }
  },

  async submit() {
    if (this.data.submitting) return
    const payload = this.validateForm()
    if (!payload) return
    this.setData({ submitting: true })
    try {
      await withdraw(payload)
      wx.showToast({ title: '提现申请已提交', icon: 'success' })
      this.setData({
        form: {
          amount: '',
          bankAccount: '',
          bankName: ''
        }
      })
      await this.loadWithdrawData()
    } finally {
      this.setData({ submitting: false })
    }
  }
})
