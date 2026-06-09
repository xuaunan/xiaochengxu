const { buildPolyline, createDriverApproachPoints, getPointByProgress, interpolateRoute } = require('../map')
const { createId, deepClone, formatDateTime, formatPrice } = require('../format')

const poiLibrary = [
  { id: 'poi001', name: '上海虹桥站', address: '闵行区申贵路1500号', latitude: 31.20066, longitude: 121.32756, tags: ['交通枢纽', '高铁站'] },
  { id: 'poi002', name: '上海迪士尼度假区', address: '浦东新区川沙新镇黄赵路310号', latitude: 31.14337, longitude: 121.65717, tags: ['景点', '度假区'] },
  { id: 'poi003', name: '陆家嘴中心', address: '浦东新区陆家嘴环路', latitude: 31.23969, longitude: 121.49981, tags: ['商圈', '地标'] },
  { id: 'poi004', name: '上海浦东国际机场', address: '浦东新区迎宾大道6000号', latitude: 31.14434, longitude: 121.8083, tags: ['机场', '国际'] },
  { id: 'poi005', name: '静安寺', address: '静安区南京西路1686号', latitude: 31.22392, longitude: 121.4451, tags: ['热门', '商圈'] },
  { id: 'poi006', name: '上海外滩观景平台', address: '黄浦区中山东一路', latitude: 31.24044, longitude: 121.49032, tags: ['地标', '夜景'] },
  { id: 'poi007', name: '上海交通大学闵行校区', address: '闵行区东川路800号', latitude: 31.02355, longitude: 121.43308, tags: ['高校', '校园'] },
  { id: 'poi008', name: 'Hong Kong International Airport', address: 'Lantau Island, Hong Kong', latitude: 22.308, longitude: 113.9185, tags: ['airport', 'international'] },
  { id: 'poi009', name: 'Macau Fisherman Wharf', address: 'Outer Harbour, Macau', latitude: 22.1959, longitude: 113.5582, tags: ['international', 'scenic'] },
  { id: 'poi010', name: '深圳湾口岸', address: '南山区东滨路', latitude: 22.50269, longitude: 113.94598, tags: ['跨境', '口岸'] }
]

const carTypes = [
  {
    id: 1,
    code: 'economy',
    name: '经济型',
    description: '适合日常通勤，近距离出行更划算',
    seatText: '最多 4 人',
    image: '/images/car-economy.svg',
    pricing: { start: 12, distance: 2.6, duration: 0.7, night: 1.1, longDistance: 1.2 }
  },
  {
    id: 2,
    code: 'comfort',
    name: '舒适型',
    description: '空间更舒适，适合商务接送和家庭出行',
    seatText: '最多 4 人',
    image: '/images/car-comfort.svg',
    pricing: { start: 18, distance: 3.3, duration: 0.85, night: 1.15, longDistance: 1.25 }
  },
  {
    id: 3,
    code: 'business',
    name: '商务型',
    description: '高级商务座驾，支持机场与重要客人接送',
    seatText: '最多 6 人',
    image: '/images/car-business.svg',
    pricing: { start: 28, distance: 4.6, duration: 1.1, night: 1.2, longDistance: 1.35 }
  }
]

const driverPool = [
  {
    id: 'driver001',
    name: '王师傅',
    avatar: '/images/avatar-driver-1.svg',
    rating: 4.9,
    plateNo: '沪A·8Y22X',
    carModel: '丰田 凯美瑞',
    carColor: '曜石黑',
    completedTrips: 2689,
    phone: '13700008888'
  },
  {
    id: 'driver002',
    name: '李师傅',
    avatar: '/images/avatar-driver-2.svg',
    rating: 4.8,
    plateNo: '沪B·2K91D',
    carModel: '比亚迪 汉DM',
    carColor: '深海蓝',
    completedTrips: 1946,
    phone: '13600006666'
  }
]

const carpoolTrips = [
  {
    id: 'cp001',
    driverName: '陈晨',
    driverAvatar: '/images/avatar-driver-2.svg',
    startName: '上海虹桥站',
    endName: '上海迪士尼度假区',
    time: '今天 18:30',
    seats: 2,
    price: 45,
    tags: ['可带行李', '女性优先', '准点率 98%'],
    remark: '可在中春路地铁站顺路接人',
    rating: 4.9
  },
  {
    id: 'cp002',
    driverName: '周岩',
    driverAvatar: '/images/avatar-driver-1.svg',
    startName: '陆家嘴中心',
    endName: '上海交通大学闵行校区',
    time: '明天 07:40',
    seats: 3,
    price: 39,
    tags: ['通勤拼车', '可拼单', '支持校园门口送达'],
    remark: '希望大家准时上车',
    rating: 4.7
  }
]

const internationalOptions = [
  {
    id: 'int001',
    titleZh: '香港接送机',
    titleEn: 'Hong Kong Airport Transfer',
    type: 'airport',
    currency: 'HKD',
    basePrice: 420,
    serviceArea: '香港国际机场 <-> 尖沙咀 / 铜锣湾',
    vehicle: '跨境商务 7 座',
    notice: '包含关口协助通关与中文客服支持'
  },
  {
    id: 'int002',
    titleZh: '澳门一日包车',
    titleEn: 'Macau Charter 1 Day',
    type: 'charter',
    currency: 'HKD',
    basePrice: 980,
    serviceArea: '澳门市区 / 路环 / 氹仔',
    vehicle: '豪华商务 7 座',
    notice: '支持 8 小时包车与中英双语服务'
  }
]

const helpList = [
  { id: 'faq001', title: '如何完成支付？', content: '结算页点击“确认支付”后会进入支付确认流程，支付完成后可继续查看行程进度。' },
  { id: 'faq002', title: '定位权限被拒绝怎么办？', content: '首页会自动切换为手动输入地址模式，并提供重新授权入口。' },
  { id: 'faq003', title: '顺风车如何取消？', content: '出发前 30 分钟可免费取消，临近出发取消会提示违约规则。' }
]

function createDefaultCoupons() {
  return [
    { id: 'coupon001', name: '新人立减券', type: 'new-user', amount: 18, minAmount: 40, validDate: '2026-05-18', scope: '即时打车', status: 'unused', stackable: false, code: 'WELCOME18' },
    { id: 'coupon002', name: '顺风车 8 折券', type: 'carpool', amount: 0.8, discount: true, minAmount: 20, validDate: '2026-05-30', scope: '顺风车', status: 'unused', stackable: false, code: 'CARPOOL80' },
    { id: 'coupon003', name: '国际出行 ¥80 券', type: 'international', amount: 80, minAmount: 400, validDate: '2026-06-10', scope: '国际出行', status: 'unused', stackable: false, code: 'GLOBAL80' },
    { id: 'coupon004', name: '通勤补贴券', type: 'taxi', amount: 12, minAmount: 35, validDate: '2026-04-14', scope: '即时打车', status: 'expired', stackable: false, code: 'COMMUTE12' },
    { id: 'coupon005', name: '舒适型体验券', type: 'taxi', amount: 10, minAmount: 30, validDate: '2026-04-08', scope: '即时打车', status: 'used', stackable: false, code: 'COMFORT10' }
  ]
}

function buildInitialOrders() {
  return [
    {
      id: 'order001',
      orderNo: 'SX202604170001',
      type: 'taxi',
      status: 'completed',
      startName: '上海虹桥站',
      endName: '静安寺',
      createdAt: '2026-04-17 08:12',
      amount: 48.6,
      driverName: '王师傅',
      plateNo: '沪A·8Y22X'
    },
    {
      id: 'order002',
      orderNo: 'SX202604160023',
      type: 'international',
      status: 'waiting-pay',
      startName: '深圳湾口岸',
      endName: 'Hong Kong International Airport',
      createdAt: '2026-04-16 18:20',
      amount: 420,
      driverName: '跨境专员',
      plateNo: '粤Z·HK88'
    }
  ]
}

function createUserStore() {
  return {
    hasSeenWelcome: false,
    loggedIn: false,
    userProfile: {
      name: '阳光旅客',
      phone: '138****0001',
      avatar: '/images/avatar-user.svg',
      verified: true,
      memberLevel: '阳光金卡',
      emergencyContact: '张女士 139****8822'
    },
    auth: {
      realName: '张三',
      idNo: '310***********1022',
      status: 'verified'
    },
    wallet: {
      balance: 286.2,
      couponBalance: 108,
      invoices: 3
    },
    settings: {
      pushEnabled: true,
      autoUseCoupon: true,
      language: 'zh-CN'
    },
    currentDraft: {
      start: poiLibrary[0],
      end: poiLibrary[2],
      serviceType: 'taxi',
      selectedCarTypeId: 2,
      useCouponId: 'coupon001'
    },
    coupons: createDefaultCoupons(),
    orders: buildInitialOrders(),
    rideReviews: [
      { id: 'review001', score: 5, orderNo: 'SX202604170001', content: '司机准时，车内整洁，沟通也很顺畅。', anonymous: false }
    ],
    complaints: [
      { id: 'cpn001', title: '订单退款进度咨询', status: 'processing', createdAt: '2026-04-15 10:22' }
    ],
    messages: [
      { id: 'msg001', title: '新人券到账', content: '欢迎加入阳光出行，18 元立减券已发放到您的账户。', time: '刚刚', unread: true },
      { id: 'msg002', title: '安全提醒', content: '夜间行程已自动共享给紧急联系人，请放心出行。', time: '今天 18:10', unread: false }
    ],
    carpoolTrips,
    internationalOptions,
    currentRideOrder: null
  }
}

function getPoiLibrary() {
  return deepClone(poiLibrary)
}

function searchPois(keyword) {
  const target = (keyword || '').trim().toLowerCase()
  if (!target) return deepClone(poiLibrary.slice(0, 8))
  return deepClone(
    poiLibrary.filter((item) => {
      return item.name.toLowerCase().includes(target) ||
        item.address.toLowerCase().includes(target) ||
        item.tags.join(',').toLowerCase().includes(target)
    })
  )
}

function estimateRide(draft, carTypeId, coupon) {
  const carType = carTypes.find((item) => item.id === Number(carTypeId)) || carTypes[0]
  const route = interpolateRoute(draft.start, draft.end, 24)
  const isNight = new Date().getHours() >= 22
  const startFee = carType.pricing.start
  const distanceFee = route.distanceKm * carType.pricing.distance
  const durationFee = route.durationMin * carType.pricing.duration
  const longDistanceFee = route.distanceKm > 20 ? (route.distanceKm - 20) * carType.pricing.longDistance : 0
  const nightFee = isNight ? 6 * carType.pricing.night : 0
  const discount = getCouponDiscount(coupon, startFee + distanceFee + durationFee + longDistanceFee + nightFee)
  const total = startFee + distanceFee + durationFee + longDistanceFee + nightFee

  return {
    carType,
    route,
    breakdown: {
      startFee: Number(startFee.toFixed(2)),
      distanceFee: Number(distanceFee.toFixed(2)),
      durationFee: Number(durationFee.toFixed(2)),
      longDistanceFee: Number(longDistanceFee.toFixed(2)),
      nightFee: Number(nightFee.toFixed(2)),
      couponDiscount: Number(discount.toFixed(2))
    },
    payable: Number(Math.max(total - discount, 0).toFixed(2))
  }
}

function getCouponDiscount(coupon, total) {
  if (!coupon || coupon.status !== 'unused') return 0
  if (total < coupon.minAmount) return 0
  if (coupon.discount) return total * (1 - coupon.amount)
  return coupon.amount
}

function buildRideOrder(store, draft) {
  const coupon = store.coupons.find((item) => item.id === draft.useCouponId)
  const estimate = estimateRide(draft, draft.selectedCarTypeId, coupon)
  const orderId = createId('ride')
  const driver = deepClone(driverPool[0])
  const order = {
    id: orderId,
    orderNo: `SX${Date.now()}`,
    type: 'taxi',
    status: 'waiting',
    createdAt: formatDateTime(new Date()),
    start: draft.start,
    end: draft.end,
    carType: estimate.carType,
    fee: estimate,
    coupon,
    nearbyDrivers: 6,
    waitingMinutes: 2,
    cancelRule: '接单前 3 分钟内免费取消；接单后取消预计收取 5 元爽约金',
    driver,
    approachPoints: createDriverApproachPoints(draft.start),
    tripPoints: estimate.route.points,
    timeline: [
      '订单已提交',
      '系统正在智能匹配附近司机',
      '司机接驾中',
      '行程进行中',
      '待支付'
    ]
  }
  store.currentRideOrder = order
  return deepClone(order)
}

function confirmRideAssigned(store) {
  if (!store.currentRideOrder) return null
  store.currentRideOrder.status = 'assigned'
  return deepClone(store.currentRideOrder)
}

function startRide(store) {
  if (!store.currentRideOrder) return null
  store.currentRideOrder.status = 'in-progress'
  return deepClone(store.currentRideOrder)
}

function completeRide(store) {
  if (!store.currentRideOrder) return null
  store.currentRideOrder.status = 'waiting-pay'
  store.currentRideOrder.arrivedAt = formatDateTime(new Date())
  return deepClone(store.currentRideOrder)
}

function payRide(store, reviewScore = 5) {
  if (!store.currentRideOrder) return null
  const order = store.currentRideOrder
  order.status = 'completed'
  store.orders.unshift({
    id: order.id,
    orderNo: order.orderNo,
    type: 'taxi',
    status: 'completed',
    startName: order.start.name,
    endName: order.end.name,
    createdAt: order.createdAt,
    amount: order.fee.payable,
    driverName: order.driver.name,
    plateNo: order.driver.plateNo
  })
  if (order.coupon) {
    const coupon = store.coupons.find((item) => item.id === order.coupon.id)
    if (coupon) coupon.status = 'used'
  }
  store.rideReviews.unshift({
    id: createId('review'),
    score: reviewScore,
    orderNo: order.orderNo,
    content: '本次服务已完成，欢迎继续体验阳光出行。',
    anonymous: false
  })
  store.currentRideOrder = order
  return deepClone(order)
}

function getOrderDetail(store, id) {
  const matchHistory = store.orders.find((item) => item.id === id || item.orderNo === id)
  if (matchHistory) return deepClone(matchHistory)
  if (store.currentRideOrder && (store.currentRideOrder.id === id || store.currentRideOrder.orderNo === id)) {
    return deepClone(store.currentRideOrder)
  }
  return null
}

function getCouponsByStatus(store, status) {
  if (status === 'all') return deepClone(store.coupons)
  return deepClone(store.coupons.filter((item) => item.status === status))
}

function getCarTypes() {
  return deepClone(carTypes)
}

function getCurrentDriverPosition(order, progress) {
  if (!order) return null
  return getPointByProgress(order.approachPoints, progress)
}

function getTripPosition(order, progress) {
  if (!order) return null
  return getPointByProgress(order.tripPoints, progress)
}

function getHomePayload(store) {
  return {
    banners: [
      { id: 'banner001', title: '春日出游季：舒适型最高减 18 元', subtitle: '新人券、通勤券已自动发放' },
      { id: 'banner002', title: '国际出行已开通港澳服务', subtitle: '支持中英切换、汇率换算与接送机' }
    ],
    quickTips: [
      '定位关闭时支持手动输入地址',
      '支付确认后可查看司机轨迹',
      '首页长按地图即可快速设定起终点'
    ],
    carTypes: getCarTypes(),
    profile: deepClone(store.userProfile)
  }
}

function getInvoiceList(store) {
  return store.orders
    .filter((item) => item.status === 'completed')
    .map((item) => ({
      id: item.orderNo,
      title: `${item.type === 'taxi' ? '打车' : '行程'}电子发票`,
      amountText: formatPrice(item.amount),
      createdAt: item.createdAt,
      status: '可申请'
    }))
}

module.exports = {
  buildRideOrder,
  completeRide,
  confirmRideAssigned,
  createUserStore,
  estimateRide,
  getCarTypes,
  getCouponsByStatus,
  getCurrentDriverPosition,
  getHomePayload,
  getInvoiceList,
  getOrderDetail,
  getPoiLibrary,
  getTripPosition,
  helpList,
  internationalOptions,
  payRide,
  searchPois,
  startRide
}
