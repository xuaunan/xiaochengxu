Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    subtitle: {
      type: String,
      value: ''
    },
    backable: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 20
  },

  lifetimes: {
    attached() {
      this.setData({
        statusBarHeight: wx.getWindowInfo ? wx.getWindowInfo().statusBarHeight : 20
      })
    }
  },

  methods: {
    back() {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/dashboard/index' })
      })
    }
  }
})
