const { fetchDashboard, login, register, submitCertification, uploadDriverDocument } = require('../../utils/api')
const { ROLE_CODE } = require('../../utils/constants')
const { buildVehicleView, getReceiveOrderPermission, mapDriverProfile } = require('../../utils/driver-store')
const { getVehicleDocumentPreviewUrl } = require('../../utils/media')

const DOCUMENT_KEYS = ['vehicleLicenseImageUrl', 'driverLicenseImageUrl']

function buildVehiclePreview(baseUrl, vehicleForm = {}) {
  return {
    vehicleLicenseImageUrl: getVehicleDocumentPreviewUrl(baseUrl, vehicleForm.vehicleLicenseImageUrl),
    driverLicenseImageUrl: getVehicleDocumentPreviewUrl(baseUrl, vehicleForm.driverLicenseImageUrl)
  }
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function buildCertificationPayload(vehicleForm = {}) {
  const seatCount = Number(vehicleForm.seatCount)
  return {
    licenseNo: `${vehicleForm.licenseNo || ''}`.trim(),
    plateNo: `${vehicleForm.plateNo || ''}`.trim(),
    brand: `${vehicleForm.brand || ''}`.trim(),
    modelName: `${vehicleForm.modelName || ''}`.trim(),
    color: `${vehicleForm.color || ''}`.trim(),
    seatCount: Number.isFinite(seatCount) ? seatCount : 0,
    insuranceExpireDate: `${vehicleForm.insuranceExpireDate || ''}`.trim(),
    annualInspectExpireDate: `${vehicleForm.annualInspectExpireDate || ''}`.trim(),
    vehicleLicenseImageUrl: `${vehicleForm.vehicleLicenseImageUrl || ''}`.trim(),
    driverLicenseImageUrl: `${vehicleForm.driverLicenseImageUrl || ''}`.trim()
  }
}

function buildPreviewFieldKey(key) {
  return `vehiclePreview.${key}`
}

function shouldKeepLocalDocument(localValue, localPreview, serverValue) {
  return Boolean(localValue) && Boolean(localPreview) && localValue !== serverValue
}

function isLocalImagePath(path = '') {
  return /^(wxfile:|data:)/.test(path)
}

function isRemoteDocumentPath(path = '') {
  return typeof path === 'string' && Boolean(path) && !isLocalImagePath(path)
}

function getDocumentTypeByKey(key) {
  return key === 'vehicleLicenseImageUrl' ? 'VEHICLE_LICENSE' : 'DRIVER_LICENSE'
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    })
  })
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: resolve,
      fail: reject
    })
  })
}

Page({
  data: {
    loggedIn: false,
    mode: 'login',
    loginForm: {
      phone: '13900000001',
      password: '123456',
      nickname: '演示司机'
    },
    vehicleForm: {
      licenseNo: '沪驾字2026001',
      plateNo: '沪A12345',
      brand: '比亚迪',
      modelName: '秦PLUS DM-i',
      color: '白色',
      seatCount: 5,
      insuranceExpireDate: '2026-12-31',
      annualInspectExpireDate: '2026-10-31',
      vehicleLicenseImageUrl: '',
      driverLicenseImageUrl: ''
    },
    profile: {},
    vehicleView: {
      hasVehicle: false,
      auditText: '未提交',
      auditClassName: 'neutral'
    },
    vehiclePreview: {
      vehicleLicenseImageUrl: '',
      driverLicenseImageUrl: ''
    },
    permission: {
      canReceiveOrders: false,
      message: '请先登录司机账号'
    },
    uploadingKey: ''
  },

  async onShow() {
    const loggedIn = getApp().globalData.driverStore.loggedIn
    this.setData({ loggedIn })
    if (this._skipNextOnShowSync) {
      this._skipNextOnShowSync = false
      return
    }
    if (loggedIn) {
      await this.loadDriverData()
    }
  },

  chooseMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },

  updateLoginField(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`loginForm.${key}`]: e.detail.value
    })
  },

  updateVehicleField(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`vehicleForm.${key}`]: e.detail.value
    })
  },

  chooseImageSource() {
    return new Promise((resolve, reject) => {
      wx.showActionSheet({
        itemList: ['本地选择图片', '拍照'],
        success: (res) => {
          if (res.tapIndex === 0) resolve('album')
          if (res.tapIndex === 1) resolve('camera')
        },
        fail: reject
      })
    }).catch((error) => {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return ''
      }
      throw error
    })
  },

  pickImageFile(source) {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: [source === 'camera' ? 'camera' : 'album'],
        success: (res) => {
          const filePath = (res.tempFilePaths || [])[0]
          resolve(filePath ? { path: filePath } : null)
        },
        fail: reject
      })
    })
  },

  async normalizePreviewPath(filePath) {
    const info = await getImageInfo(filePath)
    return info.path || filePath
  },

  async resolveImagePreview(url) {
    if (!url) return ''
    if (isLocalImagePath(url)) {
      return this.normalizePreviewPath(url)
    }
    const result = await downloadFile(url)
    if (!result.tempFilePath) {
      throw new Error('download failed')
    }
    return this.normalizePreviewPath(result.tempFilePath)
  },

  async buildPreviewState(vehicleForm = {}) {
    const baseUrl = getApp().globalData.baseUrl
    const remotePreview = buildVehiclePreview(baseUrl, vehicleForm)
    const preview = {
      vehicleLicenseImageUrl: '',
      driverLicenseImageUrl: ''
    }

    for (const key of DOCUMENT_KEYS) {
      const url = remotePreview[key]
      if (!url) continue
      try {
        preview[key] = await this.resolveImagePreview(url)
      } catch (error) {
        preview[key] = ''
      }
    }

    return preview
  },

  async chooseImage(e) {
    const { key } = e.currentTarget.dataset
    if (!key) return

    const previousValue = this.data.vehicleForm[key]
    const previousPreview = this.data.vehiclePreview[key]

    try {
      const source = await this.chooseImageSource()
      if (!source) return

      this._skipNextOnShowSync = true
      const file = await this.pickImageFile(source)
      if (!file || !file.path) {
        wx.showToast({
          title: '未获取到本地图片，请重试',
          icon: 'none'
        })
        return
      }

      const previewPath = await this.normalizePreviewPath(file.path)
      this.setData({
        uploadingKey: key,
        [`vehicleForm.${key}`]: file.path,
        [buildPreviewFieldKey(key)]: previewPath
      })

      const uploadRes = await uploadDriverDocument(file.path, getDocumentTypeByKey(key))
      const remoteUrl = uploadRes.fileUrl
      if (!remoteUrl) {
        throw new Error('上传成功但未返回图片地址')
      }

      this.setData({
        uploadingKey: '',
        [`vehicleForm.${key}`]: remoteUrl,
        [buildPreviewFieldKey(key)]: previewPath
      })
      wx.showToast({ title: '图片已上传', icon: 'success' })
    } catch (error) {
      this.setData({
        uploadingKey: '',
        [`vehicleForm.${key}`]: previousValue,
        [buildPreviewFieldKey(key)]: previousPreview
      })
      const errMsg = error && error.errMsg ? error.errMsg : ''
      if (errMsg.includes('cancel')) {
        return
      }
      wx.showToast({
        title: (error && error.message) || '图片上传失败，请重试',
        icon: 'none'
      })
    }
  },

  async handleImageTap(e) {
    const { key } = e.currentTarget.dataset
    if (!key) return

    const url = this.data.vehiclePreview[key] || this.data.vehicleForm[key]
    if (!url) {
      await this.chooseImage(e)
      return
    }

    try {
      const res = await new Promise((resolve, reject) => {
        wx.showActionSheet({
          itemList: ['查看图片', '重新选择'],
          success: resolve,
          fail: reject
        })
      })

      if (res.tapIndex === 0) {
        await this.previewImageByUrl(url)
        return
      }

      if (res.tapIndex === 1) {
        await this.chooseImage(e)
      }
    } catch (error) {
      if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
        wx.showToast({
          title: '操作失败，请稍后重试',
          icon: 'none'
        })
      }
    }
  },

  async previewImage(e) {
    const { url } = e.currentTarget.dataset
    await this.previewImageByUrl(url)
  },

  async previewImageByUrl(url) {
    if (!url) return

    wx.showLoading({ title: '加载中', mask: true })
    try {
      const previewPath = await this.resolveImagePreview(url)
      wx.previewImage({
        urls: [previewPath],
        current: previewPath
      })
    } catch (error) {
      wx.showToast({
        title: '图片预览失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async submitLogin() {
    const { phone, password, nickname } = this.data.loginForm
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '密码不少于 6 位', icon: 'none' })
      return
    }
    if (this.data.mode === 'register' && !nickname.trim()) {
      wx.showToast({ title: '请输入司机昵称', icon: 'none' })
      return
    }

    if (this.data.mode === 'register') {
      await register({
        phone,
        password,
        nickname: nickname.trim(),
        roleCode: ROLE_CODE.DRIVER
      })
    }

    const result = await login({
      phone,
      password,
      roleCode: ROLE_CODE.DRIVER
    })
    getApp().setLoginInfo(result.data)
    wx.showToast({
      title: this.data.mode === 'register' ? '注册并登录成功' : '登录成功',
      icon: 'success'
    })
    await this.loadDriverData()
  },

  async loadDriverData() {
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

    getApp().globalData.driverStore.profile = profile
    getApp().globalData.driverStore.vehicle = dashboard.vehicle || {}
    getApp().globalData.driverStore.permission = permission
    getApp().globalData.driverStore.loggedIn = true
    getApp().saveStore()

    const vehicleForm = {
      ...this.data.vehicleForm,
      licenseNo: firstDefined((dashboard.profile || {}).licenseNo, (dashboard.profile || {}).license_no, this.data.vehicleForm.licenseNo),
      plateNo: firstDefined((dashboard.vehicle || {}).plateNo, (dashboard.vehicle || {}).plate_no, ''),
      brand: (dashboard.vehicle || {}).brand || '',
      modelName: firstDefined((dashboard.vehicle || {}).modelName, (dashboard.vehicle || {}).model_name, ''),
      color: (dashboard.vehicle || {}).color || '',
      seatCount: firstDefined((dashboard.vehicle || {}).seatCount, (dashboard.vehicle || {}).seat_count, 5),
      insuranceExpireDate: firstDefined((dashboard.vehicle || {}).insuranceExpireDate, (dashboard.vehicle || {}).insurance_expire_date, ''),
      annualInspectExpireDate: firstDefined((dashboard.vehicle || {}).annualInspectExpireDate, (dashboard.vehicle || {}).annual_inspect_expire_date, ''),
      vehicleLicenseImageUrl: firstDefined((dashboard.vehicle || {}).vehicleLicenseImageUrl, (dashboard.vehicle || {}).vehicle_license_image_url, ''),
      driverLicenseImageUrl: firstDefined((dashboard.vehicle || {}).driverLicenseImageUrl, (dashboard.vehicle || {}).driver_license_image_url, '')
    }

    const preservedPreview = {}
    DOCUMENT_KEYS.forEach((key) => {
      const localValue = this.data.vehicleForm[key]
      const localPreview = this.data.vehiclePreview[key]
      const serverValue = vehicleForm[key]
      if (shouldKeepLocalDocument(localValue, localPreview, serverValue)) {
        vehicleForm[key] = localValue
        preservedPreview[key] = localPreview
      }
    })

    const vehiclePreview = {
      ...(await this.buildPreviewState(vehicleForm)),
      ...preservedPreview
    }

    this.setData({
      loggedIn: true,
      profile,
      permission,
      vehicleView,
      vehicleForm,
      vehiclePreview,
      uploadingKey: ''
    })
  },

  validateVehicleForm() {
    const form = this.data.vehicleForm
    if (!form.licenseNo.trim()) return '请填写驾驶证号'
    if (!form.plateNo.trim()) return '请填写车牌号'
    if (!form.brand.trim()) return '请填写车辆品牌'
    if (!form.modelName.trim()) return '请填写车型'
    if (!form.color.trim()) return '请填写车辆颜色'
    if (Number(form.seatCount) < 4) return '座位数不能少于 4 座'
    if (!form.insuranceExpireDate.trim()) return '请填写保险到期日'
    if (!form.annualInspectExpireDate.trim()) return '请填写年检到期日'
    if (!form.vehicleLicenseImageUrl) return '请上传行驶证照片'
    if (!form.driverLicenseImageUrl) return '请上传驾驶证照片'
    if (!isRemoteDocumentPath(form.vehicleLicenseImageUrl)) return '行驶证照片上传未完成，请重新上传'
    if (!isRemoteDocumentPath(form.driverLicenseImageUrl)) return '驾驶证照片上传未完成，请重新上传'
    return ''
  },

  async submitVehicle() {
    if (this.data.uploadingKey) {
      wx.showToast({
        title: '图片上传中，请稍后提交',
        icon: 'none'
      })
      return
    }

    const errorText = this.validateVehicleForm()
    if (errorText) {
      wx.showToast({ title: errorText, icon: 'none' })
      return
    }

    const hasVehicle = this.data.vehicleView.hasVehicle
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: hasVehicle ? '确认更换车辆' : '确认提交车辆',
        content: hasVehicle
          ? '提交更换后，车辆审核状态会回到待审核，接单权限会临时锁定，确认继续吗？'
          : '提交后需要等待管理员审核，审核通过后才能解锁接单功能，确认提交吗？',
        confirmText: '确认提交',
        success: (res) => resolve(res.confirm)
      })
    })
    if (!confirmed) return

    await submitCertification(buildCertificationPayload(this.data.vehicleForm))

    const nextVehicle = {
      ...this.data.vehicleForm,
      id: this.data.vehicleView.hasVehicle ? getApp().globalData.driverStore.vehicle.id : undefined,
      auditStatus: 1,
      auditRemark: '车辆资料已提交，等待审核'
    }
    const nextPermission = {
      canReceiveOrders: false,
      message: '已提交，等待管理员审核'
    }
    const nextProfile = {
      ...this.data.profile,
      canReceiveOrders: false,
      vehicleAuditStatus: 1,
      vehicleAuditRemark: '车辆资料已提交，等待审核',
      lockMessage: nextPermission.message
    }
    const nextVehicleView = {
      ...buildVehicleView(nextVehicle, { enabled: 1 }, nextPermission),
      hasVehicle: true
    }
    const vehiclePreview = await this.buildPreviewState(this.data.vehicleForm)

    getApp().globalData.driverStore.vehicle = nextVehicle
    getApp().globalData.driverStore.permission = nextPermission
    getApp().globalData.driverStore.profile = nextProfile
    getApp().saveStore()

    this.setData({
      profile: nextProfile,
      permission: nextPermission,
      vehicleView: nextVehicleView,
      vehiclePreview
    })
    wx.showToast({ title: '已提交，等待管理员审核', icon: 'success' })
  },

  goDashboard() {
    wx.switchTab({ url: '/pages/dashboard/index' })
  }
})
