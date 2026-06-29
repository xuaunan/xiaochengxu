const { fetchProfile, submitRealName: submitRealNameRequest } = require('../../utils/api')
const { getAuthStatusLabel } = require('../../utils/constants')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    auth: {},
    form: {
      realName: '',
      idCard: ''
    },
    submitting: false
  },

  async onShow() {
    this.renderCachedProfile()
    await this.refreshProfile()
  },

  renderCachedProfile() {
    const profile = getApp().globalData.userStore.profile || {}
    this.setData({
      auth: {
        realName: profile.realName || '',
        idNo: profile.idCard || '',
        status: getAuthStatusLabel(profile.authStatus)
      },
      form: {
        realName: profile.realName || '',
        idCard: profile.idCard || ''
      }
    })
  },

  async refreshProfile() {
    return runExclusive(this, '__refreshAuthPromise', async () => {
      const response = await fetchProfile()
      const profile = response.data || {}
      getApp().applyProfile(profile)
      this.renderCachedProfile()
    })
  },

  updateField(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  async submitRealName() {
    if (this.data.submitting) return
    const realName = `${this.data.form.realName || ''}`.trim()
    const idCard = `${this.data.form.idCard || ''}`.trim()

    if (!realName) {
      wx.showToast({ title: '真实姓名不能为空', icon: 'none' })
      return
    }

    if (!/^[0-9Xx]{15,18}$/.test(idCard)) {
      wx.showToast({ title: '身份证号格式不正确', icon: 'none' })
      return
    }

    const payload = {
      realName,
      idCard
    }

    this.setData({ submitting: true })
    try {
      await submitRealNameRequest(payload)

      wx.showToast({
        title: '实名认证已提交',
        icon: 'success'
      })
      await this.refreshProfile()
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '提交失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
