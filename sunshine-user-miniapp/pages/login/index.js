const { fetchProfile, login, register } = require('../../utils/api')
const { ROLE_CODE } = require('../../utils/constants')

Page({
  data: {
    mode: 'login',
    phone: '13800000001',
    password: '123456',
    nickname: '',
    agreed: true,
    showPassword: false,
    loading: false,
    loginTip: '默认乘客测试账号：13800000001 / 123456。'
  },

  onShow() {
    const app = getApp()
    if (app.globalData.userStore.loggedIn) {
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  chooseMode(e) {
    this.setData({
      mode: e.currentTarget.dataset.mode
    })
  },

  updatePhone(e) {
    this.setData({
      phone: e.detail.value
    })
  },

  updatePassword(e) {
    this.setData({
      password: e.detail.value
    })
  },

  updateNickname(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  clearPhone() {
    this.setData({
      phone: ''
    })
  },

  togglePasswordVisible() {
    this.setData({
      showPassword: !this.data.showPassword
    })
  },

  handleForgotPassword() {
    wx.showToast({
      title: '请使用默认密码 123456',
      icon: 'none'
    })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({
      url: '/pages/welcome/index'
    })
  },

  toggleAgree() {
    this.setData({
      agreed: !this.data.agreed
    })
  },

  fillDemoAccount() {
    this.setData({
      phone: '13800000001',
      password: '123456',
      loginTip: '已填入默认账号，可以直接登录体验。'
    })
  },

  validateForm() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选服务协议', icon: 'none' })
      return false
    }
    if (!/^1\d{10}$/.test(this.data.phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return false
    }
    if (!/^.{6,20}$/.test(this.data.password)) {
      wx.showToast({ title: '密码长度需为 6 到 20 位', icon: 'none' })
      return false
    }
    if (this.data.mode === 'register' && !this.data.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return false
    }
    return true
  },

  async submit() {
    if (!this.validateForm()) return

    this.setData({ loading: true })
    wx.showLoading({ title: this.data.mode === 'login' ? '登录中' : '注册中' })
    try {
      if (this.data.mode === 'register') {
        await register({
          phone: this.data.phone,
          password: this.data.password,
          nickname: this.data.nickname.trim(),
          roleCode: ROLE_CODE.USER
        })
      }

      const result = await login({
        phone: this.data.phone,
        password: this.data.password,
        roleCode: ROLE_CODE.USER
      })
      const app = getApp()
      app.setAuthAccount({
        phone: this.data.phone,
        password: this.data.password,
        roleCode: ROLE_CODE.USER
      })
      app.setLoginInfo(result.data)
      const profileResult = await fetchProfile()
      app.applyProfile(profileResult.data || {})
      wx.showToast({
        title: this.data.mode === 'login' ? '登录成功' : '注册并登录成功',
        icon: 'success'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index'
        })
      }, 300)
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  }
})
