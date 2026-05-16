const { fetchProfile, updateProfile } = require('../../utils/api')
const { runGuarded } = require('../../utils/page')

function pickProfileForm(profile = {}) {
  return {
    nickname: profile.nickname || profile.name || '',
    avatar: '/images/avatar-user.svg',
    realName: profile.realName || '',
    emergencyContact: profile.emergencyContact || '',
    emergencyPhone: profile.emergencyPhone || ''
  }
}

function buildProfilePayload(form = {}) {
  const realName = `${form.realName || ''}`.trim()
  const emergencyContact = `${form.emergencyContact || ''}`.trim()
  const emergencyPhone = `${form.emergencyPhone || ''}`.trim()
  return {
    nickname: `${form.nickname || ''}`.trim(),
    avatar: form.avatar || '/images/avatar-user.svg',
    realName,
    emergencyContact,
    emergencyPhone
  }
}

function isValidContactPhone(value = '') {
  const phone = `${value || ''}`.trim()
  return !phone || /^\d{8,16}$/.test(phone)
}

function applyLocalProfile(payload = {}) {
  const app = getApp()
  const store = app.globalData.userStore || {}
  const previous = store.profile || {}
  const profile = {
    ...previous,
    ...payload,
    name: payload.nickname || previous.name || previous.nickname || '',
    nickname: payload.nickname || previous.nickname || previous.name || ''
  }
  store.profile = profile
  app.globalData.userStore = store
  if (app.saveUserStore) {
    app.saveUserStore()
  }
  return profile
}

Page({
  data: {
    form: pickProfileForm(),
    phoneText: '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7',
    saving: false,
    copy: {
      title: '\u4e2a\u4eba\u8d44\u6599',
      subtitle: '\u4fdd\u5b58\u540e\u540c\u6b65\u5230\u540e\u53f0\u7528\u6237\u7ba1\u7406',
      account: '\u8d26\u53f7',
      basic: '\u57fa\u7840\u4fe1\u606f',
      contact: '\u7d27\u6025\u8054\u7cfb',
      avatar: '\u5934\u50cf',
      nickname: '\u6635\u79f0',
      realName: '\u771f\u5b9e\u59d3\u540d',
      emergencyContact: '\u7d27\u6025\u8054\u7cfb\u4eba',
      emergencyPhone: '\u7d27\u6025\u7535\u8bdd',
      optional: '\u53ef\u9009',
      save: '\u4fdd\u5b58\u8d44\u6599',
      nicknamePlaceholder: '\u8bf7\u8f93\u5165\u6635\u79f0'
    }
  },

  async onShow() {
    const profile = getApp().globalData.userStore.profile || {}
    if (!this.__formDirty && !this.data.saving) {
      this.setData({
        form: pickProfileForm(profile),
        phoneText: profile.phone || '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7'
      })
    }

    try {
      const response = await fetchProfile()
      getApp().applyProfile(response.data || {})
      const nextProfile = getApp().globalData.userStore.profile || {}
      const nextData = {
        phoneText: nextProfile.phone || '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7'
      }
      if (!this.__formDirty && !this.data.saving) {
        nextData.form = pickProfileForm(nextProfile)
      }
      this.setData(nextData)
    } catch (error) {
    }
  },

  updateField(e) {
    const { key } = e.currentTarget.dataset
    this.__formDirty = true
    this.setData({
      [`form.${key}`]: e.detail.value
    })
  },

  validateForm() {
    const form = this.data.form || {}
    if (!`${form.nickname || ''}`.trim()) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u6635\u79f0', icon: 'none' })
      return false
    }
    if (!isValidContactPhone(form.emergencyPhone)) {
      wx.showToast({ title: '\u8bf7\u586b\u5199 8-16 \u4f4d\u7eaf\u6570\u5b57\u7535\u8bdd', icon: 'none' })
      return false
    }
    return true
  },

  async submitForm() {
    if (!this.validateForm()) return

    await runGuarded(this, '__savingProfile', async () => {
      this.setData({ saving: true })
      try {
        const form = this.data.form
        const payload = buildProfilePayload(form)
        try {
          const response = await updateProfile(payload, { skipToast: true })
          applyLocalProfile({
            ...(response.data || {}),
            ...payload
          })
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '\u4fdd\u5b58\u5931\u8d25',
            icon: 'none'
          })
          return
        }
        wx.showToast({ title: '\u5df2\u4fdd\u5b58', icon: 'success' })
        this.__formDirty = false
      } finally {
        this.setData({ saving: false })
      }
    })
  }
})
