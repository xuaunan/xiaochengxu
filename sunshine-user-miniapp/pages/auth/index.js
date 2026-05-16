const { fetchProfile, submitRealName: submitRealNameRequest, updateProfileByAdmin } = require('../../utils/api')
const { getAuthStatusLabel } = require('../../utils/constants')
const { runExclusive } = require('../../utils/page')

Page({
  data: {
    auth: {},
    form: {
      realName: '',
      idCard: ''
    }
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

    await submitRealNameRequest(payload)
    try {
      const profile = getApp().globalData.userStore.profile || {}
      await updateProfileByAdmin(profile.id, payload, {
        ...profile,
        authStatus: 1,
        authRemark: '用户已提交实名认证，等待管理员审核'
      })
    } catch (error) {
    }

    wx.showToast({
      title: '实名认证已提交',
      icon: 'success'
    })
    await this.refreshProfile()
  }
})
