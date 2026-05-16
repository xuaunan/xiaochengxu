const { fetchDashboard, updateDriverProfile } = require('../../utils/api')
const { buildVehicleView, buildWallet, getReceiveOrderPermission, mapDriverProfile } = require('../../utils/driver-store')
const { runGuarded } = require('../../utils/page')

function pickForm(profile = {}, vehicle = {}) {
  return {
    nickname: profile.name || profile.nickname || '',
    cityCode: profile.cityCode || '310100',
    licenseNo: profile.licenseNo || '',
    emergencyContact: profile.emergencyContact || '',
    emergencyPhone: profile.emergencyPhone || '',
    plateNo: vehicle.plateNo || '',
    carModel: profile.carModel || ''
  }
}

function applyLocalDriverProfile(profilePayload = {}, driverPayload = {}) {
  const app = getApp()
  const store = app.globalData.driverStore || {}
  const previous = store.profile || {}
  store.profile = {
    ...previous,
    name: profilePayload.nickname || previous.name || previous.nickname || '',
    nickname: profilePayload.nickname || previous.nickname || previous.name || '',
    avatar: '/images/avatar-driver-main.svg',
    emergencyContact: profilePayload.emergencyContact || '',
    emergencyPhone: profilePayload.emergencyPhone || '',
    cityCode: driverPayload.cityCode || previous.cityCode || '',
    licenseNo: driverPayload.licenseNo || previous.licenseNo || ''
  }
  app.globalData.driverStore = store
  if (app.saveStore) {
    app.saveStore()
  }
  return store.profile
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function isValidContactPhone(value = '') {
  const phone = `${value || ''}`.trim()
  return !phone || /^\d{8,16}$/.test(phone)
}

Page({
  data: {
    form: pickForm(),
    phone: '',
    phoneText: '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7',
    vehicleText: '\u672a\u7ed1\u5b9a\u8f66\u8f86',
    modelText: '\u7b49\u5f85\u540e\u53f0\u540c\u6b65',
    saving: false,
    copy: {
      title: '\u53f8\u673a\u8d44\u6599',
      subtitle: '\u4fdd\u5b58\u540e\u540c\u6b65\u5230\u540e\u53f0\u53f8\u673a\u7ba1\u7406',
      account: '\u53f8\u673a\u8d26\u53f7',
      archive: '\u53f8\u673a\u6863\u6848',
      contact: '\u7d27\u6025\u8054\u7cfb',
      readonly: '\u8f66\u8f86\u4fe1\u606f',
      nickname: '\u53f8\u673a\u6635\u79f0',
      cityCode: '\u57ce\u5e02\u7f16\u7801',
      licenseNo: '\u9a7e\u9a76\u8bc1\u53f7',
      emergencyContact: '\u7d27\u6025\u8054\u7cfb\u4eba',
      emergencyPhone: '\u7d27\u6025\u7535\u8bdd',
      vehicle: '\u5f53\u524d\u8f66\u8f86',
      model: '\u8f66\u578b\u4fe1\u606f',
      optional: '\u53ef\u9009',
      save: '\u4fdd\u5b58\u8d44\u6599',
      saving: '\u4fdd\u5b58\u4e2d',
      nicknamePlaceholder: '\u8bf7\u8f93\u5165\u53f8\u673a\u6635\u79f0',
      licensePlaceholder: '\u8bf7\u8f93\u5165\u9a7e\u9a76\u8bc1\u53f7'
    }
  },

  async onShow() {
    const store = getApp().globalData.driverStore || {}
    if (!this.__formDirty && !this.data.saving) {
      this.setData({
        form: pickForm(store.profile || {}, store.vehicle || {}),
        phone: (store.profile || {}).phone || '',
        phoneText: (store.profile || {}).phone || '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7',
        vehicleText: (store.vehicle || {}).plateNo || '\u672a\u7ed1\u5b9a\u8f66\u8f86',
        modelText: (store.profile || {}).carModel || '\u7b49\u5f85\u540e\u53f0\u540c\u6b65'
      })
    }

    try {
      await this.refreshDashboard()
    } catch (error) {
    }
  },

  async refreshDashboard() {
    const response = await fetchDashboard()
    const dashboard = response.data || {}
    const permission = getReceiveOrderPermission(dashboard)
    const profile = mapDriverProfile(
      dashboard.user || {},
      dashboard.profile || {},
      dashboard.vehicle || {},
      permission
    )
    const vehicleView = buildVehicleView(dashboard.vehicle || {}, dashboard.user || {}, permission)
    const wallet = buildWallet(dashboard.profile || {}, dashboard.orders || [])
    const app = getApp()
    app.globalData.driverStore.profile = {
      ...profile,
      avatar: '/images/avatar-driver-main.svg',
      emergencyContact: firstDefined((dashboard.user || {}).emergencyContact, (dashboard.user || {}).emergency_contact, profile.emergencyContact, ''),
      emergencyPhone: firstDefined((dashboard.user || {}).emergencyPhone, (dashboard.user || {}).emergency_phone, profile.emergencyPhone, '')
    }
    app.globalData.driverStore.vehicle = dashboard.vehicle || {}
    app.globalData.driverStore.permission = permission
    app.globalData.driverStore.wallet = wallet
    app.saveStore()

    const nextData = {
      phone: profile.phone || '',
      phoneText: profile.phone || '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7',
      vehicleText: (dashboard.vehicle || {}).plateNo || '\u672a\u7ed1\u5b9a\u8f66\u8f86',
      modelText: profile.carModel || '\u7b49\u5f85\u540e\u53f0\u540c\u6b65',
      vehicleView
    }
    if (!this.__formDirty && !this.data.saving) {
      nextData.form = pickForm(app.globalData.driverStore.profile, app.globalData.driverStore.vehicle)
    }
    this.setData(nextData)
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
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u53f8\u673a\u6635\u79f0', icon: 'none' })
      return false
    }
    if (!`${form.cityCode || ''}`.trim()) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u57ce\u5e02\u7f16\u7801', icon: 'none' })
      return false
    }
    if (!`${form.licenseNo || ''}`.trim()) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u9a7e\u9a76\u8bc1\u53f7', icon: 'none' })
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

    await runGuarded(this, '__savingDriverProfile', async () => {
      this.setData({ saving: true })
      try {
        const form = this.data.form
        const emergencyContact = form.emergencyContact.trim()
        const emergencyPhone = form.emergencyPhone.trim()
        const cityCode = form.cityCode.trim()
        const licenseNo = form.licenseNo.trim()
        const profilePayload = {
          nickname: form.nickname.trim(),
          emergencyContact,
          emergencyPhone
        }
        const driverPayload = {
          nickname: profilePayload.nickname,
          cityCode,
          licenseNo,
          emergencyContact,
          emergencyPhone
        }
        try {
          await updateDriverProfile(driverPayload, { skipToast: true })
          applyLocalDriverProfile(profilePayload, driverPayload)
          await this.refreshDashboard()
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '\u4fdd\u5b58\u5931\u8d25',
            icon: 'none'
          })
          return
        }
        wx.showToast({ title: '\u5df2\u4fdd\u5b58', icon: 'success' })
        this.__formDirty = false
        setTimeout(() => wx.navigateBack(), 450)
      } finally {
        this.setData({ saving: false })
      }
    })
  }
})
