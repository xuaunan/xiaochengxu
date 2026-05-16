const { withdraw } = require('../../utils/api')

Page({
  data: {
    form: {
      amount: '500',
      bankAccount: '6222020202020202',
      bankName: '中国工商银行'
    }
  },

  updateField(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  async submit() {
    await withdraw({
      applyAmount: Number(this.data.form.amount),
      bankAccount: this.data.form.bankAccount,
      bankName: this.data.form.bankName
    })
    wx.showToast({ title: '提现申请已提交', icon: 'success' })
  }
})
