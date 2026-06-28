const { fetchProfile, updateProfile, uploadAvatar } = require('../../utils/api')
const { buildMediaUrl } = require('../../utils/media')
const { runGuarded } = require('../../utils/page')

const DEFAULT_AVATAR = '/images/avatar-user.svg'

function pickProfileForm(profile = {}) {
  return {
    nickname: profile.nickname || profile.name || '',
    avatar: profile.avatar || DEFAULT_AVATAR,
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
    avatar: form.avatar || DEFAULT_AVATAR,
    realName,
    emergencyContact,
    emergencyPhone
  }
}

function pickAvatarUrl(response = {}) {
  const data = response.data || {}
  return data.fileUrl || data.avatar || data.url || ''
}

function buildAvatarSrc(avatar = '') {
  const app = getApp()
  return buildMediaUrl(avatar || DEFAULT_AVATAR, app.globalData.baseUrl) || DEFAULT_AVATAR
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
    avatarSrc: DEFAULT_AVATAR,
    phoneText: '\u672a\u7ed1\u5b9a\u624b\u673a\u53f7',
    localAvatarPath: '',
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
      changeAvatar: '\u66f4\u6362',
      nicknamePlaceholder: '\u8bf7\u8f93\u5165\u6635\u79f0'
    }
  },

  async onShow() {
    const profile = getApp().globalData.userStore.profile || {}
    if (!this.__formDirty && !this.data.saving) {
      this.setData({
        form: pickProfileForm(profile),
        avatarSrc: buildAvatarSrc(profile.avatar),
        localAvatarPath: '',
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
        nextData.avatarSrc = buildAvatarSrc(nextProfile.avatar)
        nextData.localAvatarPath = ''
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

  chooseAvatarSource() {
    return new Promise((resolve, reject) => {
      wx.showActionSheet({
        itemList: ['\u4ece\u76f8\u518c\u9009\u62e9', '\u62cd\u7167'],
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

  pickAvatarFile(source) {
    return new Promise((resolve, reject) => {
      const sourceType = [source === 'camera' ? 'camera' : 'album']
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType,
          sizeType: ['compressed'],
          success: (res) => {
            const file = (res.tempFiles || [])[0] || {}
            resolve(file.tempFilePath || file.path || '')
          },
          fail: reject
        })
        return
      }

      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
        success: (res) => {
          resolve((res.tempFilePaths || [])[0] || '')
        },
        fail: reject
      })
    })
  },

  async chooseAvatar() {
    if (this.data.saving) return

    try {
      const source = await this.chooseAvatarSource()
      if (!source) return

      const filePath = await this.pickAvatarFile(source)
      if (!filePath) {
        wx.showToast({ title: '\u672a\u83b7\u53d6\u5230\u56fe\u7247\uff0c\u8bf7\u91cd\u8bd5', icon: 'none' })
        return
      }

      this.__formDirty = true
      this.setData({
        'form.avatar': filePath,
        avatarSrc: filePath,
        localAvatarPath: filePath
      })
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return
      }
      wx.showToast({ title: '\u9009\u62e9\u5934\u50cf\u5931\u8d25', icon: 'none' })
    }
  },

  async buildSubmitPayload() {
    const payload = buildProfilePayload(this.data.form)
    const localAvatarPath = this.data.localAvatarPath
    if (!localAvatarPath || payload.avatar !== localAvatarPath) {
      return payload
    }

    const uploadResponse = await uploadAvatar(localAvatarPath, { skipToast: true })
    const avatarUrl = pickAvatarUrl(uploadResponse)
    if (!avatarUrl) {
      throw new Error('\u5934\u50cf\u4e0a\u4f20\u5931\u8d25')
    }

    this.setData({
      'form.avatar': avatarUrl,
      avatarSrc: buildAvatarSrc(avatarUrl),
      localAvatarPath: ''
    })
    return {
      ...payload,
      avatar: avatarUrl
    }
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
        let payload
        try {
          payload = await this.buildSubmitPayload()
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '\u5934\u50cf\u4e0a\u4f20\u5931\u8d25',
            icon: 'none'
          })
          return
        }
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
        this.setData({ localAvatarPath: '' })
      } finally {
        this.setData({ saving: false })
      }
    })
  }
})
