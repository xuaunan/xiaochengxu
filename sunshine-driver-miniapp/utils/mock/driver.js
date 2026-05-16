function createDriverStore() {
  return {
    onboarded: false,
    profile: {
      name: '刘师傅',
      phone: '139****8899',
      avatar: '/images/avatar-driver-main.svg',
      rating: 4.9,
      serviceScore: 98,
      carModel: '比亚迪 汉DM',
      plateNo: '沪B·2K91D'
    },
    wallet: {
      todayIncome: 368.5,
      monthIncome: 8420.8,
      withdrawable: 2680.3,
      completedTrips: 26
    },
    settings: {
      listenMode: true,
      autoAccept: false,
      voiceBroadcast: true,
      voiceStyle: 'default'
    },
    messages: [
      { id: 'dmsg001', title: '平台奖励到账', content: '本周完成 20 单，已获得 60 元奖励。', time: '今天 09:20' },
      { id: 'dmsg002', title: '车辆年检提醒', content: '你的车辆年检将在 20 天后到期，请及时处理。', time: '昨天 16:10' }
    ],
    availableOrders: [
      {
        id: 'task001',
        passengerName: '张女士',
        startName: '上海虹桥站',
        endName: '静安寺',
        distanceText: '4.2km 上车距离',
        fareText: '预估 ¥52.00',
        latitude: 31.216,
        longitude: 121.362,
        status: 'waiting'
      },
      {
        id: 'task002',
        passengerName: '李先生',
        startName: '陆家嘴中心',
        endName: '上海迪士尼度假区',
        distanceText: '3.1km 上车距离',
        fareText: '预估 ¥88.00',
        latitude: 31.239,
        longitude: 121.502,
        status: 'waiting'
      }
    ],
    tripOrders: [
      {
        id: 'trip001',
        passengerName: '王女士',
        startName: '上海虹桥站',
        endName: '静安寺',
        status: 'processing',
        statusText: '待到达起点',
        fareText: '¥52.00',
        createdAt: '2026-04-18 09:15'
      },
      {
        id: 'trip002',
        passengerName: '陈先生',
        startName: '上海外滩观景平台',
        endName: '上海浦东国际机场',
        status: 'completed',
        statusText: '已完成',
        fareText: '¥126.00',
        createdAt: '2026-04-17 21:30'
      }
    ]
  }
}

module.exports = {
  createDriverStore
}
