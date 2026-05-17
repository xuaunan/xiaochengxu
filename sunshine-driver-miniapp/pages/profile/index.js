const { fetchDashboard, updateServiceStatus } = require('../../utils/api')
const { DRIVER_SERVICE_STATUS } = require('../../utils/constants')
const { buildVehicleView, buildWallet, getReceiveOrderPermission, mapDriverProfile } = require('../../utils/driver-store')

Page({
  data: {
    profile: {},
    logoutText: '\u9000\u51fa\u767b\u5f55',
    vehicleView: {
      auditText: '未提交',
      auditClassName: 'neutral'
    },
    permission: {
      canReceiveOrders: false,
      message: '请先提交车辆信息并通过管理员审核'
    },
    wallet: {},
    menuGroups: []
  },

  logoutPending: false,

  async onShow() {
    if (!getApp().globalData.driverStore.loggedIn) {
      wx.redirectTo({ url: '/pages/onboarding/index' })
      return
    }
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

    getApp().globalData.driverStore.profile = profile
    getApp().globalData.driverStore.vehicle = dashboard.vehicle || {}
    getApp().globalData.driverStore.permission = permission
    getApp().globalData.driverStore.wallet = wallet
    getApp().saveStore()

    this.setData({
      profile,
      vehicleView,
      permission,
      wallet,
      menuGroups: this.buildMenuGroups(vehicleView, permission, wallet)
    })
  },

  buildMenuGroups(vehicleView, permission, wallet) {
    return [
      {
        title: '核心功能',
        items: [
          {
            icon: '车',
            title: '我的车辆',
            url: '/pages/onboarding/index',
            mode: 'navigate',
            badge: vehicleView.auditText,
            desc: vehicleView.hasVehicle ? '查看当前绑定车辆、审核状态和更换入口' : '先添加车辆信息，审核通过后才能开始接单'
          },
          {
            icon: '单',
            title: '我的订单',
            url: '/pages/orders/index',
            mode: 'tab',
            badge: `${wallet.completedTrips || 0} 单`,
            desc: '查看接单记录、进行中订单和历史行程'
          }
        ]
      },
      {
        title: '经营数据',
        items: [
          {
            icon: '￥',
            title: '我的收入',
            url: '/pages/wallet/index',
            mode: 'tab',
            badge: `￥${Number(wallet.withdrawable || 0).toFixed(2)}`,
            desc: '查看今日收入、月度收入和可提现金额'
          },
          {
            icon: '设',
            title: '接单设置',
            url: '/pages/settings/index',
            mode: 'navigate',
            badge: permission.canReceiveOrders ? '已解锁' : '待解锁',
            desc: '调整语音播报、自动接单和听单偏好'
          }
        ]
      },
      {
        title: '账号与消息',
        items: [
          {
            icon: '资',
            title: '司机资料',
            url: '/pages/profile-edit/index',
            mode: 'navigate',
            badge: '编辑',
            desc: '修改昵称、城市编码和紧急联系人并同步后台'
          },
          {
            icon: '铃',
            title: '消息通知',
            url: '/pages/messages/index',
            mode: 'navigate',
            badge: '查看',
            desc: '查看平台通知、审核结果和活动消息'
          }
        ]
      }
    ]
  },

  openMenu(e) {
    const { url, mode } = e.currentTarget.dataset
    if (mode === 'tab') {
      wx.switchTab({ url })
      return
    }
    wx.navigateTo({ url })
  },

  safeGetLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: () => resolve(null)
      })
    })
  },

  async syncOfflineBeforeLogout() {
    const serviceStatus = (this.data.profile || {}).serviceStatus
    if (serviceStatus !== DRIVER_SERVICE_STATUS.ONLINE) {
      return
    }

    const location = await this.safeGetLocation()
    await updateServiceStatus({
      serviceStatus: DRIVER_SERVICE_STATUS.OFFLINE,
      longitude: `${location ? location.longitude : ''}`,
      latitude: `${location ? location.latitude : ''}`
    })
  },

  handleLogout() {
    wx.showModal({
      title: '\u6e29\u99a8\u63d0\u793a',
      content: '\u786e\u5b9a\u8981\u9000\u51fa\u5f53\u524d\u53f8\u673a\u8d26\u53f7\u5417\uff1f\u9000\u51fa\u540e\u5c06\u505c\u6b62\u542c\u5355\uff0c\u65e0\u6cd5\u63a5\u6536\u65b0\u8ba2\u5355',
      cancelText: '\u53d6\u6d88',
      confirmText: '\u786e\u5b9a\u9000\u51fa',
      confirmColor: '#ff5b57',
      success: async (res) => {
        if (!res.confirm || this.logoutPending) {
          return
        }

        this.logoutPending = true

        try {
          await this.syncOfflineBeforeLogout()
        } catch (error) {
        }

        const app = getApp()
        if (app.globalData.driverStore) {
          app.globalData.driverStore.settings = {
            ...(app.globalData.driverStore.settings || {}),
            listenMode: false
          }
          app.globalData.driverStore.profile = {
            ...(app.globalData.driverStore.profile || {}),
            serviceStatus: DRIVER_SERVICE_STATUS.OFFLINE
          }
        }
        if (app.clearSession) {
          app.clearSession()
        }
        wx.reLaunch({
          url: '/pages/onboarding/index'
        })
      }
    })
  }
})
