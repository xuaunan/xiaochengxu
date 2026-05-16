const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
process.chdir(projectRoot)

const { createDefaultUserStore, POI_LIBRARY } = require('../utils/catalog')
const { AUTH_STATUS, ORDER_STATUS, PAY_STATUS, SERVICE_TYPE } = require('../utils/constants')

const storage = {}
const timerRegistry = new Map()
let timerSeed = 1
let registeredApp = null
let registeredPage = null
let app = null
let activePages = []

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

function setByPath(target, key, value) {
  const segments = `${key}`.split('.')
  let current = target

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }

    if (!current[segment] || typeof current[segment] !== 'object') {
      current[segment] = {}
    }
    current = current[segment]
  })
}

function makeCarTypes() {
  return [
    {
      id: 1,
      startPrice: 14,
      startDistanceKm: 3,
      distancePrice: 2.8,
      durationPrice: 0.6,
      longDistancePrice: 1.8,
      nightSurcharge: 8
    },
    {
      id: 2,
      startPrice: 18,
      startDistanceKm: 3,
      distancePrice: 3.4,
      durationPrice: 0.7,
      longDistancePrice: 2.1,
      nightSurcharge: 10
    },
    {
      id: 3,
      startPrice: 28,
      crossBorderBasePrice: 260,
      startDistanceKm: 3,
      distancePrice: 4.2,
      durationPrice: 0.75,
      longDistancePrice: 2.5,
      nightSurcharge: 12
    }
  ]
}

function makeOrders() {
  return [
    {
      id: 'ord-dispatching',
      orderNo: 'ORD202604190001',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 1,
      startName: '上海虹桥机场 T2',
      startLat: 31.20066,
      startLng: 121.32756,
      endName: '人民广场',
      endLat: 31.23037,
      endLng: 121.4737,
      orderStatus: ORDER_STATUS.DISPATCHING,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 34.39,
      payableAmount: 34.39,
      estimatedDistanceKm: 18.4,
      estimatedDurationMin: 36,
      currencyCode: 'CNY',
      createdAt: '2026-04-19 10:00:00',
      driverId: 'driver-01'
    },
    {
      id: 'ord-unpaid',
      orderNo: 'ORD202604190002',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 1,
      startName: '上海大学',
      startLat: 31.321,
      startLng: 121.3903,
      endName: '人民广场',
      endLat: 31.23037,
      endLng: 121.4737,
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 37.4,
      payableAmount: 37.4,
      actualAmount: 37.4,
      estimatedDistanceKm: 16.2,
      actualDistanceKm: 16.2,
      estimatedDurationMin: 32,
      actualDurationMin: 32,
      currencyCode: 'CNY',
      createdAt: '2026-04-18 16:00:00',
      finishedAt: '2026-04-18 17:02:00',
      driverId: 'driver-02'
    },
    {
      id: 'ord-paid',
      orderNo: 'ORD202604190003',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 2,
      startName: '石家庄裕华万达广场',
      startLat: 38.0185,
      startLng: 114.5302,
      endName: '石家庄学院(南校区)尚德楼',
      endLat: 38.0435,
      endLng: 114.5456,
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: PAY_STATUS.PAID,
      estimatedAmount: 34.39,
      payableAmount: 34.39,
      actualAmount: 34.39,
      estimatedDistanceKm: 8.6,
      actualDistanceKm: 8.6,
      estimatedDurationMin: 24,
      actualDurationMin: 24,
      currencyCode: 'CNY',
      createdAt: '2026-04-17 10:00:00',
      finishedAt: '2026-04-17 10:28:00',
      updatedAt: '2026-04-17 10:29:00',
      driverId: 'driver-03',
      evaluationStatus: 'DONE:5:服务很好'
    },
    {
      id: 'ord-cancelled',
      orderNo: 'ORD202604190004',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 1,
      startName: '上海大学',
      startLat: 31.321,
      startLng: 121.3903,
      endName: '人民广场',
      endLat: 31.23037,
      endLng: 121.4737,
      orderStatus: ORDER_STATUS.CANCELLED,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 28.5,
      payableAmount: 28.5,
      estimatedDistanceKm: 12.5,
      estimatedDurationMin: 28,
      currencyCode: 'CNY',
      createdAt: '2026-04-16 10:00:00'
    },
    {
      id: 'ord-international',
      orderNo: 'ORD202604190005',
      serviceType: SERVICE_TYPE.INTERNATIONAL,
      carTypeId: 3,
      startName: '深圳湾口岸',
      startLat: 22.50269,
      startLng: 113.94598,
      endName: '香港国际机场',
      endLat: 22.308,
      endLng: 113.9185,
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: PAY_STATUS.PAID,
      estimatedAmount: 78.18,
      payableAmount: 78.18,
      actualAmount: 78.18,
      estimatedDistanceKm: 45.2,
      actualDistanceKm: 45.2,
      estimatedDurationMin: 62,
      actualDurationMin: 62,
      currencyCode: 'USD',
      createdAt: '2026-04-15 08:00:00',
      finishedAt: '2026-04-15 09:05:00',
      driverId: 'driver-04'
    },
    {
      id: 'ord-carpool',
      orderNo: 'ORD202604190006',
      serviceType: SERVICE_TYPE.CARPOOL,
      carTypeId: 1,
      startName: '上海交通大学闵行校区',
      startLat: 31.02355,
      startLng: 121.43308,
      endName: '苏州工业园区',
      endLat: 31.324,
      endLng: 120.7219,
      orderStatus: ORDER_STATUS.FINISHED,
      payStatus: PAY_STATUS.PAID,
      estimatedAmount: 80.16,
      payableAmount: 80.16,
      actualAmount: 80.16,
      estimatedDistanceKm: 96.4,
      actualDistanceKm: 96.4,
      estimatedDurationMin: 90,
      actualDurationMin: 90,
      currencyCode: 'CNY',
      createdAt: '2026-04-14 08:00:00',
      finishedAt: '2026-04-14 10:00:00'
    },
    {
      id: 'ord-picking',
      orderNo: 'ORD202604190007',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 1,
      startName: '人民广场',
      startLat: 31.23037,
      startLng: 121.4737,
      endName: '静安寺',
      endLat: 31.22392,
      endLng: 121.4451,
      orderStatus: ORDER_STATUS.PICKING_UP,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 26.2,
      payableAmount: 26.2,
      estimatedDistanceKm: 6.1,
      estimatedDurationMin: 18,
      currencyCode: 'CNY',
      driverId: 'driver-05'
    },
    {
      id: 'ord-intrip',
      orderNo: 'ORD202604190008',
      serviceType: SERVICE_TYPE.TAXI,
      carTypeId: 2,
      startName: '人民广场',
      startLat: 31.23037,
      startLng: 121.4737,
      endName: '上海浦东国际机场',
      endLat: 31.14434,
      endLng: 121.8083,
      orderStatus: ORDER_STATUS.IN_TRIP,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 88.5,
      payableAmount: 88.5,
      estimatedDistanceKm: 42.3,
      actualDistanceKm: 38.2,
      estimatedDurationMin: 58,
      actualDurationMin: 49,
      currencyCode: 'CNY',
      driverId: 'driver-06'
    }
  ]
}

function makeCoupons() {
  return [
    {
      id: 101,
      couponId: 1,
      couponStatus: 'UNUSED',
      serviceScope: 'ALL',
      validEndTime: '2026-12-31 23:59:59'
    },
    {
      id: 102,
      couponId: 2,
      couponStatus: 'USED',
      serviceScope: SERVICE_TYPE.TAXI,
      validEndTime: '2026-12-31 23:59:59'
    },
    {
      id: 103,
      couponId: 4,
      couponStatus: 'EXPIRED',
      serviceScope: SERVICE_TYPE.INTERNATIONAL,
      validEndTime: '2026-01-01 00:00:00'
    }
  ]
}

function makeCouponCenter() {
  return [
    {
      id: 1,
      couponName: '新人立减18元券',
      couponType: 'CASH',
      serviceScope: 'ALL',
      thresholdAmount: 40,
      discountAmount: 18,
      ruleDesc: '首单满40元可减18元',
      validEndTime: '2026-12-31 23:59:59'
    },
    {
      id: 2,
      couponName: '打车立减12元券',
      couponType: 'CASH',
      serviceScope: SERVICE_TYPE.TAXI,
      thresholdAmount: 50,
      discountAmount: 12,
      ruleDesc: '即时打车满50元减12元',
      validEndTime: '2026-12-31 23:59:59'
    },
    {
      id: 4,
      couponName: '国际出行20美元券',
      couponType: 'CASH',
      serviceScope: SERVICE_TYPE.INTERNATIONAL,
      thresholdAmount: 50,
      discountAmount: 20,
      ruleDesc: '国际出行满50美元减20美元',
      validEndTime: '2026-12-31 23:59:59'
    }
  ]
}

function makeCarpoolSearchList() {
  return [
    {
      id: 'cp-001',
      startName: '上海虹桥机场 T2',
      endName: '上海迪士尼度假区',
      departTime: '2026-04-20 07:40:00',
      remainSeatCount: 2,
      sharedAmount: 38,
      ownerUserId: 'owner-01',
      driverName: '车主小王',
      baggageRule: '可放两件行李',
      status: 'CONFIRMED'
    }
  ]
}

function makeMyCarpool() {
  return [
    {
      type: 'OWNER',
      records: [
        {
          trip: {
            id: 'trip-001',
            startName: '上海虹桥机场 T2',
            endName: '上海迪士尼度假区',
            departTime: '2026-04-20 07:40:00',
            sharedAmount: 38,
            remainSeatCount: 2,
            status: 'CONFIRMED'
          }
        }
      ]
    },
    {
      type: 'PASSENGER',
      records: [
        {
          application: {
            id: 'app-001',
            applicationStatus: 'CONFIRMED',
            sharedAmount: 28,
            companionCount: 1
          },
          trip: {
            id: 'trip-002',
            startName: '上海交通大学闵行校区',
            endName: '苏州工业园区',
            departTime: '2026-04-21 09:00:00'
          }
        }
      ]
    }
  ]
}

function buildHomeData(carTypes, couponCenter) {
  return {
    banners: [{ id: 'banner-1', title: '春季出行' }],
    notices: [{ id: 'notice-1', title: '欢迎使用演示环境' }],
    carTypes,
    couponCenter
  }
}

function buildProfile() {
  return {
    id: 'user-001',
    nickname: '测试乘客',
    avatar: '/images/avatar-user.svg',
    phone: '13800000001',
    authStatus: AUTH_STATUS.APPROVED,
    realName: '测试用户',
    idCard: '110101199001011234',
    walletBalance: 286.5,
    emergencyContact: '家人',
    emergencyPhone: '13900000002',
  }
}

function getDataset() {
  const carTypes = makeCarTypes()
  const orders = makeOrders()
  const couponCenter = makeCouponCenter()
  const profile = buildProfile()
  const carpoolSearchList = makeCarpoolSearchList()

  return {
    carTypes,
    orders,
    couponCenter,
    coupons: makeCoupons(),
    profile,
    carpoolSearchList,
    myCarpool: makeMyCarpool(),
    homeData: buildHomeData(carTypes, couponCenter),
    trackHistoryByOrderId: {
      'ord-picking': [
        { latitude: 31.228, longitude: 121.462 },
        { latitude: 31.229, longitude: 121.468 }
      ],
      'ord-intrip': [
        { latitude: 31.225, longitude: 121.49 },
        { latitude: 31.214, longitude: 121.58 },
        { latitude: 31.192, longitude: 121.67 }
      ]
    }
  }
}

function getSamplePoi(id) {
  return clone(POI_LIBRARY.find((item) => item.id === id) || POI_LIBRARY[0])
}

function parsePureUrl(fullUrl = '') {
  return fullUrl.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
}

function buildRequestData(dataset, url, method, data) {
  const pureUrl = parsePureUrl(url)

  if (url.startsWith('https://nominatim.openstreetmap.org/search')) {
    return [
      {
        display_name: '人民广场, 上海市',
        lat: '31.23037',
        lon: '121.4737',
        address: {
          city: '上海市',
          suburb: '黄浦区'
        }
      }
    ]
  }

  if (url.startsWith('https://nominatim.openstreetmap.org/reverse')) {
    return {
      display_name: '人民广场, 上海市',
      lat: '31.23037',
      lon: '121.4737',
      address: {
        city: '上海市',
        suburb: '黄浦区'
      }
    }
  }

  if (pureUrl === '/auth/profile' && method === 'PUT') {
    dataset.profile = {
      ...dataset.profile,
      ...data
    }
    return dataset.profile
  }

  if (pureUrl === '/auth/profile') {
    return dataset.profile
  }

  if (pureUrl === '/auth/login' || pureUrl === '/auth/register' || pureUrl === '/auth/refresh') {
    return {
      token: 'mock-token',
    }
  }

  if (pureUrl === '/auth/real-name') {
    dataset.profile.realName = data.realName
    dataset.profile.idCard = data.idCard
    dataset.profile.authStatus = AUTH_STATUS.PENDING
    return dataset.profile
  }

  if (pureUrl === '/app/home') {
    return dataset.homeData
  }

  if (pureUrl.startsWith('/app/estimate')) {
    return {
      amount: 36.8,
      currencyCode: 'CNY',
      exchangeRate: 1
    }
  }

  if (pureUrl === '/orders/mine') {
    return dataset.orders
  }

  if (pureUrl === '/orders' && method === 'POST') {
    return {
      id: 'ord-created',
      orderNo: 'ORD202604199999',
      serviceType: data.serviceType,
      carTypeId: data.carTypeId,
      startName: data.startName,
      startLat: Number(data.startLat),
      startLng: Number(data.startLng),
      endName: data.endName,
      endLat: Number(data.endLat),
      endLng: Number(data.endLng),
      orderStatus: ORDER_STATUS.DISPATCHING,
      payStatus: PAY_STATUS.UNPAID,
      estimatedAmount: 36.8,
      payableAmount: 36.8,
      estimatedDistanceKm: Number(data.estimatedDistanceKm || 10),
      estimatedDurationMin: Number(data.estimatedDurationMin || 20),
      currencyCode: data.currencyCode || 'CNY'
    }
  }

  if (/^\/orders\/[^/]+$/.test(pureUrl)) {
    const orderId = pureUrl.split('/').pop()
    return dataset.orders.find((item) => `${item.id}` === `${orderId}`) || dataset.orders[0]
  }

  if (/^\/orders\/[^/]+\/cancel$/.test(pureUrl)) {
    return {
      success: true
    }
  }

  if (/^\/orders\/[^/]+\/track\/history$/.test(pureUrl)) {
    const orderId = pureUrl.split('/')[2]
    return dataset.trackHistoryByOrderId[orderId] || []
  }

  if (/^\/orders\/[^/]+\/track\/report$/.test(pureUrl)) {
    return {
      success: true
    }
  }

  if (pureUrl === '/orders/mock-pay') {
    return {
      paid: true
    }
  }

  if (pureUrl === '/orders/evaluation' || pureUrl === '/orders/complaint') {
    return {
      success: true
    }
  }

  if (pureUrl === '/coupons/mine') {
    return dataset.coupons
  }

  if (pureUrl === '/coupons/center') {
    return dataset.couponCenter
  }

  if (/^\/coupons\/[^/]+\/receive$/.test(pureUrl)) {
    return {
      success: true
    }
  }

  if (pureUrl.startsWith('/carpool/search')) {
    return dataset.carpoolSearchList
  }

  if (pureUrl === '/carpool/mine') {
    return dataset.myCarpool
  }

  if (pureUrl === '/carpool/publish' || pureUrl === '/carpool/apply') {
    return {
      success: true
    }
  }

  return {}
}

function buildWx(dataset) {
  return {
    request(options = {}) {
      const response = {
        statusCode: 200,
        data: {
          code: 0,
          data: buildRequestData(dataset, options.url, options.method || 'GET', options.data || {}),
          message: 'ok'
        }
      }

      if (typeof options.success === 'function') {
        options.success(response)
      }
      return {
        abort() {}
      }
    },
    getStorageSync(key) {
      return clone(storage[key])
    },
    setStorageSync(key, value) {
      storage[key] = clone(value)
    },
    setStorage({ key, data, success, fail }) {
      try {
        storage[key] = clone(data)
        if (typeof success === 'function') success()
      } catch (error) {
        if (typeof fail === 'function') fail(error)
      }
    },
    removeStorageSync(key) {
      delete storage[key]
    },
    getSystemInfo({ success }) {
      if (typeof success === 'function') {
        success({
          theme: 'light',
          statusBarHeight: 20,
          windowWidth: 375,
          windowHeight: 812
        })
      }
    },
    getSystemInfoSync() {
      return {
        theme: 'light',
        statusBarHeight: 20,
        windowWidth: 375,
        windowHeight: 812
      }
    },
    getWindowInfo() {
      return {
        statusBarHeight: 20,
        windowWidth: 375,
        windowHeight: 812
      }
    },
    getMenuButtonBoundingClientRect() {
      return {
        bottom: 52
      }
    },
    getLocation({ success, fail }) {
      if (typeof success === 'function') {
        success({
          latitude: 31.23037,
          longitude: 121.4737
        })
        return
      }
      if (typeof fail === 'function') fail(new Error('location fail'))
    },
    startLocationUpdate({ success }) {
      if (typeof success === 'function') success({})
    },
    stopLocationUpdate({ fail }) {
      if (typeof fail === 'function') fail()
    },
    onLocationChange() {},
    offLocationChange() {},
    createMapContext() {
      return {
        getCenterLocation({ success }) {
          if (typeof success === 'function') {
            success({
              latitude: 31.23037,
              longitude: 121.4737
            })
          }
        }
      }
    },
    navigateTo() {},
    redirectTo() {},
    switchTab() {},
    reLaunch() {},
    navigateBack() {},
    showToast() {},
    showLoading() {},
    hideLoading() {},
    hideKeyboard() {},
    showModal({ success }) {
      if (typeof success === 'function') {
        success({ confirm: true, cancel: false })
      }
    },
    openSetting({ success }) {
      if (typeof success === 'function') {
        success({})
      }
    }
  }
}

function installRuntime(dataset) {
  global.wx = buildWx(dataset)
  global.getApp = () => app
  global.getCurrentPages = () => activePages.map((page) => ({ route: page.route }))
  global.App = (config) => {
    registeredApp = config
  }
  global.Page = (config) => {
    registeredPage = config
  }
  global.setTimeout = (fn) => {
    const id = timerSeed++
    timerRegistry.set(id, fn)
    return id
  }
  global.clearTimeout = (id) => {
    timerRegistry.delete(id)
  }
  global.setInterval = (fn) => {
    const id = timerSeed++
    timerRegistry.set(id, fn)
    return id
  }
  global.clearInterval = (id) => {
    timerRegistry.delete(id)
  }
}

function createAppInstance(config) {
  const instance = {
    globalData: clone(config.globalData || {})
  }

  Object.keys(config).forEach((key) => {
    if (key === 'globalData') return
    instance[key] = config[key]
  })

  return instance
}

function createPageInstance(config, route) {
  const instance = {
    route,
    data: clone(config.data || {})
  }

  Object.keys(config).forEach((key) => {
    if (key === 'data') return
    instance[key] = config[key]
  })

  instance.setData = function setData(patch, callback) {
    Object.keys(patch || {}).forEach((key) => {
      setByPath(instance.data, key, patch[key])
    })
    if (typeof callback === 'function') {
      callback()
    }
  }

  return instance
}

function createInitialStore(dataset) {
  const store = createDefaultUserStore()
  store.hasSeenWelcome = true
  store.loggedIn = true
  store.loginInfo = {
    token: 'mock-token',
  }
  store.profile = {
    ...store.profile,
    ...dataset.profile
  }
  store.home = {
    banners: dataset.homeData.banners,
    notices: dataset.homeData.notices,
    carTypes: dataset.carTypes,
    couponCenter: dataset.couponCenter
  }
  store.couponCenter = dataset.couponCenter
  store.orders = dataset.orders
  store.coupons = []
  store.messages = [
    { id: 'msg-1', title: '订单提醒', content: '你有一笔待支付订单', time: '刚刚', unread: true }
  ]
  store.complaints = [
    { id: 'complaint-1', title: '司机绕路', status: '处理中', createdAt: '2026-04-18 12:00:00', orderNo: 'ORD202604190002' }
  ]
  store.carpoolSearchList = dataset.carpoolSearchList
  store.myCarpool = dataset.myCarpool
  store.currentRideOrder = dataset.orders.find((item) => item.id === 'ord-unpaid') || dataset.orders[0]
  return store
}

function getPageOptions(pagePath) {
  const base = {
    'pages/address-search/index': { type: 'start' },
    'pages/map-picker/index': { type: 'start' },
    'pages/taxi-waiting/index': { id: 'ord-dispatching' },
    'pages/driver-arrival/index': { id: 'ord-picking' },
    'pages/trip-progress/index': { id: 'ord-intrip' },
    'pages/fare-settlement/index': { id: 'ord-unpaid' },
    'pages/ride-review/index': { id: 'ord-paid' },
    'pages/order-detail/index': { id: 'ord-unpaid' },
    'pages/payment-confirm/index': { id: 'ord-unpaid' },
    'pages/carpool-publish/index': {
      startName: encodeURIComponent('上海虹桥机场 T2'),
      endName: encodeURIComponent('上海迪士尼度假区'),
      departTime: encodeURIComponent('2026-04-20 07:40:00')
    },
    'pages/carpool-detail/index': { id: 'cp-001' },
    'pages/carpool-apply/index': { id: 'cp-001' },
    'pages/international-order/index': { id: 'int001' },
    'pages/complaint/index': { id: 'ord-paid' }
  }

  return base[pagePath] || {}
}

async function runPage(pagePath) {
  registeredPage = null
  const pageFile = path.join(projectRoot, `${pagePath}.js`)
  delete require.cache[require.resolve(pageFile)]
  require(pageFile)

  if (!registeredPage) {
    throw new Error('Page() was not registered')
  }

  const page = createPageInstance(registeredPage, pagePath)
  activePages = [page]

  const options = getPageOptions(pagePath)
  if (typeof page.onLoad === 'function') {
    await page.onLoad(options)
  }
  if (typeof page.onReady === 'function') {
    await page.onReady()
  }
  if (typeof page.onShow === 'function') {
    await page.onShow()
  }
  if (typeof page.onUnload === 'function') {
    await page.onUnload()
  }
}

async function main() {
  const dataset = getDataset()
  const initialStore = createInitialStore(dataset)
  storage['sunshine-user-token'] = 'mock-token'
  storage['sunshine-user-login-info'] = {
    token: 'mock-token',
  }
  storage['sunshine-user-locale'] = 'zh-CN'
  storage['sunshine-user-store'] = initialStore
  storage['sunshine-user-draft'] = {
    start: getSamplePoi('poi001'),
    end: getSamplePoi('poi003'),
    serviceType: SERVICE_TYPE.TAXI,
    selectedCarTypeId: 1,
    selectedCouponId: ''
  }

  installRuntime(dataset)

  const appFile = path.join(projectRoot, 'app.js')
  delete require.cache[require.resolve(appFile)]
  require(appFile)
  if (!registeredApp) {
    throw new Error('App() was not registered')
  }

  app = createAppInstance(registeredApp)
  if (typeof app.onLaunch === 'function') {
    app.onLaunch()
  }

  const appJson = require(path.join(projectRoot, 'app.json'))
  const failures = []

  for (const pagePath of appJson.pages) {
    try {
      await runPage(pagePath)
      console.log(`PASS ${pagePath}`)
    } catch (error) {
      failures.push({
        pagePath,
        error
      })
      console.log(`FAIL ${pagePath}: ${error.message}`)
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} page(s) failed smoke test.`)
    failures.forEach(({ pagePath, error }) => {
      console.error(`${pagePath}: ${error.stack || error.message}`)
    })
    process.exitCode = 1
    return
  }

  console.log(`\nAll ${appJson.pages.length} pages passed smoke test.`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
