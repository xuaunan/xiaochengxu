const { AUTH_STATUS, COUPON_TYPE, SERVICE_TYPE } = require('./constants')

const POI_LIBRARY = [
  { id: 'poi101', name: '燕京理工学院-南门', address: '河北省廊坊市三河市燕郊经济技术开发区迎宾北路45号', latitude: 39.9825, longitude: 117.0782, tags: ['高校', '校园', '燕京理工学院'] },
  { id: 'poi102', name: '天洋广场', address: '河北省廊坊市三河市燕郊开发区迎宾路东侧天洋广场', latitude: 39.9848, longitude: 117.0831, tags: ['商场', '商圈', '天洋广场'] },
  { id: 'poi103', name: '海底捞火锅(天洋广场店)', address: '河北省廊坊市三河市燕郊开发区天洋广场4层', latitude: 39.9844, longitude: 117.0836, tags: ['美食', '火锅', '天洋广场'] },
  { id: 'poi104', name: '三河市政府', address: '河北省廊坊市三河市府东路5号', latitude: 39.981, longitude: 117.0786, tags: ['政务', '地标', '三河市政府'] },
  { id: 'poi001', name: '上海虹桥机场T2', address: '闵行区申贵路1500号', latitude: 31.20066, longitude: 121.32756, tags: ['交通枢纽', '机场'] },
  { id: 'poi002', name: '上海迪士尼度假区', address: '浦东新区川沙新镇黄赵路310号', latitude: 31.14337, longitude: 121.65717, tags: ['景点', '度假区'] },
  { id: 'poi003', name: '人民广场', address: '黄浦区人民大道185号', latitude: 31.23037, longitude: 121.4737, tags: ['地标', '商圈'] },
  { id: 'poi004', name: '陆家嘴中心', address: '浦东新区世纪大道88号', latitude: 31.23969, longitude: 121.49981, tags: ['金融区', '商务'] },
  { id: 'poi005', name: '上海浦东国际机场', address: '浦东新区迎宾大道6000号', latitude: 31.14434, longitude: 121.8083, tags: ['机场', '国际'] },
  { id: 'poi006', name: '静安寺', address: '静安区南京西路1686号', latitude: 31.22392, longitude: 121.4451, tags: ['热门', '商圈'] },
  { id: 'poi007', name: '深圳湾口岸，中国深圳', address: '广东省深圳市南山区东滨路', latitude: 22.50269, longitude: 113.94598, tags: ['国际', '口岸'] },
  { id: 'poi008', name: '香港国际机场，中国香港', address: '中国香港大屿山', latitude: 22.308, longitude: 113.9185, tags: ['机场', '国际'] },
  { id: 'poi009', name: '澳门渔人码头，中国澳门', address: '中国澳门外港新填海区', latitude: 22.1959, longitude: 113.5582, tags: ['国际', '景点'] },
  { id: 'poi010', name: '上海交通大学闵行校区', address: '闵行区东川路800号', latitude: 31.02355, longitude: 121.43308, tags: ['高校', '校园'] },
  { id: 'poi011', name: '苏州工业园区', address: '江苏省苏州市工业园区', latitude: 31.324, longitude: 120.7219, tags: ['跨城', '商务'] },
  { id: 'poi111', name: '燕京理工学院', address: '河北省廊坊市三河市燕郊经济技术开发区迎宾北路45号', latitude: 39.98115, longitude: 117.07878, tags: ['高校', '校园', '燕京理工学院'] },
  { id: 'poi112', name: '燕京理工学院-图书馆', address: '河北省廊坊市三河市燕郊经济技术开发区燕京理工学院校内', latitude: 39.98162, longitude: 117.07932, tags: ['高校', '图书馆', '燕京理工学院'] },
  { id: 'poi113', name: '燕京理工学院-体育馆', address: '河北省廊坊市三河市燕郊经济技术开发区燕京理工学院校内', latitude: 39.98062, longitude: 117.07812, tags: ['高校', '体育馆', '燕京理工学院'] },
  { id: 'poi114', name: '燕京理工学院-东门', address: '河北省廊坊市三河市燕郊经济技术开发区迎宾北路', latitude: 39.98142, longitude: 117.08018, tags: ['高校', '校门', '燕京理工学院'] },
  { id: 'poi115', name: '燕京理工学院-生活服务中心', address: '河北省廊坊市三河市燕郊经济技术开发区燕京理工学院校内', latitude: 39.98096, longitude: 117.07956, tags: ['高校', '生活服务', '燕京理工学院'] }
]

const CAR_TYPE_META = {
  1: {
    name: '经济型',
    image: '/images/car-economy.svg',
    description: '适合日常通勤与短途出行',
    seatText: '最多 4 人'
  },
  2: {
    name: '舒适型',
    image: '/images/car-comfort.svg',
    description: '空间更舒适，适合家庭与商务接送',
    seatText: '最多 4 人'
  },
  3: {
    name: '商务型',
    image: '/images/car-business.svg',
    description: '适合跨境接送机与重要商务场景',
    seatText: '最多 6 人'
  }
}

const COUPON_TEMPLATE_FALLBACK_MAP = {
  1: {
    id: 1,
    couponName: '新人立减18元券',
    couponType: COUPON_TYPE.CASH,
    serviceScope: 'ALL',
    thresholdAmount: 40,
    discountAmount: 18,
    discountRate: null,
    ruleDesc: '首单满40元可减18元',
    validEndTime: '2026-12-31 23:59:59'
  },
  2: {
    id: 2,
    couponName: '打车立减12元券',
    couponType: COUPON_TYPE.CASH,
    serviceScope: SERVICE_TYPE.TAXI,
    thresholdAmount: 50,
    discountAmount: 12,
    discountRate: null,
    ruleDesc: '即时打车满50元减12元',
    validEndTime: '2026-12-31 23:59:59'
  },
  3: {
    id: 3,
    couponName: '顺风车八折券',
    couponType: COUPON_TYPE.DISCOUNT,
    serviceScope: SERVICE_TYPE.CARPOOL,
    thresholdAmount: 20,
    discountAmount: null,
    discountRate: 0.8,
    ruleDesc: '顺风车订单享受8折优惠',
    validEndTime: '2026-12-31 23:59:59'
  },
  4: {
    id: 4,
    couponName: '国际出行20美元券',
    couponType: COUPON_TYPE.CASH,
    serviceScope: SERVICE_TYPE.INTERNATIONAL,
    thresholdAmount: 50,
    discountAmount: 20,
    discountRate: null,
    ruleDesc: '国际出行满50美元减20美元',
    validEndTime: '2026-12-31 23:59:59'
  },
  5: {
    id: 5,
    couponName: '通勤补贴10元券',
    couponType: COUPON_TYPE.CASH,
    serviceScope: SERVICE_TYPE.TAXI,
    thresholdAmount: 30,
    discountAmount: 10,
    discountRate: null,
    ruleDesc: '工作日通勤满30元减10元',
    validEndTime: '2026-12-31 23:59:59'
  }
}

const INTERNATIONAL_OPTIONS = [
  {
    id: 'int001',
    titleZh: '香港机场接送',
    titleEn: 'Hong Kong Airport Transfer',
    routeCode: 'SZX-HKG',
    countryText: '中国香港',
    startName: '深圳湾口岸，中国深圳',
    endName: '香港国际机场，中国香港',
    basePrice: 88,
    currency: '美元',
    vehicle: '跨境商务七座',
    durationText: '约 90 分钟',
    distanceText: '58 km',
    badge: '热门接送机',
    inclusions: ['中文司机', '行李协助', '航班延误等待', '跨境路线备案'],
    documents: ['港澳通行证/护照', '航班号或落地时间'],
    notice: '支持港澳跨境接送、优惠券抵扣与中文下单'
  },
  {
    id: 'int002',
    titleZh: '澳门商务包车',
    titleEn: 'Macau Business Charter',
    routeCode: 'SZX-MFM',
    countryText: '中国澳门',
    startName: '深圳湾口岸，中国深圳',
    endName: '澳门渔人码头，中国澳门',
    basePrice: 128,
    currency: '美元',
    vehicle: '豪华商务七座',
    durationText: '约 96 分钟',
    distanceText: '65 km',
    badge: '商务包车',
    inclusions: ['专属车辆', '多点等待', '商务发票资料', '中英双语沟通'],
    documents: ['港澳通行证/护照', '企业或联系人信息'],
    notice: '适合跨境商务接待、会议用车与多点等待'
  },
  {
    id: 'int003',
    titleZh: '沪港商务接驳',
    titleEn: 'Shanghai-HK Business Link',
    routeCode: 'PVG-HKG',
    countryText: '跨境商务',
    startName: '上海浦东国际机场，中国上海',
    endName: '香港国际机场，中国香港',
    basePrice: 168,
    currency: '美元',
    vehicle: '高端商务车',
    durationText: '按预约航班衔接',
    distanceText: '跨城联运',
    badge: '企业预约',
    inclusions: ['航班接续提醒', '企业账单', '专属客服', '行程资料归档'],
    documents: ['联系人电话', '航班/会议信息'],
    notice: '面向企业客户的预约接驳，支持行程资料归档'
  }
]

const HELP_LIST = [
  { id: 'faq001', title: '如何完成支付？', content: '行程结束后进入结算页，点击“确认支付”即可完成订单支付。' },
  { id: 'faq002', title: '定位权限被拒绝怎么办？', content: '首页会自动切换到手动输入模式，也可以点击“重新授权”重新获取定位。' },
  { id: 'faq003', title: '国际出行为何要带城市信息？', content: '国际订单地址需包含城市或地区信息，建议使用“地点，中国城市/地区”的格式。' }
]

const DEFAULT_MESSAGES = [
  { id: 'local-msg-001', title: '行程提醒', content: '接单、支付、评价后会自动在这里展示最近消息。', time: '刚刚', unread: false },
  { id: 'local-msg-002', title: '账号提示', content: '默认乘客账号：13800000001 / 123456。', time: '今天', unread: false }
]

function createDefaultUserStore() {
  return {
    hasSeenWelcome: false,
    loggedIn: false,
    loginInfo: null,
    profile: {
      id: '',
      nickname: '阳光旅客',
      avatar: '/images/avatar-user.svg',
      phone: '',
      authStatus: AUTH_STATUS.UNVERIFIED,
      memberLevel: '普通用户',
      walletBalance: 0,
      emergencyContact: '未设置',
      emergencyPhone: ''
    },
    settings: {
      pushEnabled: true,
      autoUseCoupon: true,
      language: 'zh-CN'
    },
    home: {
      banners: [],
      notices: [],
      carTypes: [],
      couponCenter: []
    },
    coupons: [],
    couponCenter: [],
    memberCoupons: [],
    membership: {
      active: false,
      level: '普通用户',
      openedAt: '',
      expireDate: '',
      packageMonth: ''
    },
    orders: [],
    currentRideOrder: null,
    rideReviews: [],
    complaints: [],
    messages: DEFAULT_MESSAGES,
    carpoolSearchList: [],
    myCarpool: [],
    internationalOptions: INTERNATIONAL_OPTIONS
  }
}

module.exports = {
  CAR_TYPE_META,
  COUPON_TEMPLATE_FALLBACK_MAP,
  DEFAULT_MESSAGES,
  HELP_LIST,
  INTERNATIONAL_OPTIONS,
  POI_LIBRARY,
  createDefaultUserStore
}
