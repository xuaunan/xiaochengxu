import type {
  ActiveView,
  AppMode,
  DesktopDataset,
  HealthStatus,
  OrderStatus,
  RideOrder,
  TimelineStep
} from '@/types'

export const defaultHealth: HealthStatus = {
  frontend: true,
  backend: false,
  database: false,
  admin: true,
  web: false,
  mode: 'demo',
  checkedAt: new Date().toLocaleString()
}

export const defaultViews: Record<AppMode, ActiveView> = {
  passenger: 'passenger-booking',
  driver: 'driver-dashboard',
  admin: 'admin-dashboard'
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  CREATED: '已创建',
  DISPATCHING: '派单中',
  ACCEPTED: '已接单',
  PICKING_UP: '接驾中',
  IN_TRIP: '行程中',
  FINISHED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
}

export const serviceTypeLabel = {
  TAXI: '即时打车',
  CARPOOL: '顺风车',
  INTERNATIONAL: '国际出行'
} as const

export const authStatusLabel = {
  0: '未认证',
  1: '待审核',
  2: '已通过',
  3: '已驳回'
} as const

export const payStatusLabel = {
  UNPAID: '待支付',
  PAID: '已支付',
  REFUNDED: '已退款'
} as const

export const statusSequence: OrderStatus[] = ['CREATED', 'DISPATCHING', 'ACCEPTED', 'PICKING_UP', 'IN_TRIP', 'FINISHED']

export const mockDataset: DesktopDataset = {
  metrics: [
    { label: '今日订单', value: '1,268', delta: '+12.4%', tone: 'orange' },
    { label: '实时流水', value: '¥86,420', delta: '+8.7%', tone: 'green' },
    { label: '在线司机', value: '342', delta: '+26', tone: 'blue' },
    { label: '待处理事项', value: '18', delta: '-5', tone: 'red' }
  ],
  passenger: {
    id: 10001,
    name: '林夏',
    phone: '13800000001',
    authStatus: 2,
    emergencyContact: '陈先生 13900000002',
    balance: 268.5,
    points: 4260
  },
  favorites: [
    {
      id: 6101,
      name: '深圳北站',
      address: '深圳市龙华区民治街道致远中路 28 号',
      tag: '常用',
      lastUsedAt: '今天 09:12'
    },
    {
      id: 6102,
      name: '腾讯滨海大厦',
      address: '深圳市南山区海天二路 33 号',
      tag: '公司',
      lastUsedAt: '昨天 18:40'
    },
    {
      id: 6103,
      name: '深圳湾口岸',
      address: '深圳市南山区东滨路 1 号',
      tag: '机场',
      lastUsedAt: '2026-06-03'
    }
  ],
  driver: {
    userId: 20001,
    name: '周师傅',
    phone: '13700000009',
    avatarText: '周',
    vehicleNo: '粤B·8S218',
    vehicleModel: '比亚迪 汉 EV',
    serviceStatus: 'ONLINE',
    authStatus: 2,
    enabled: true,
    rating: 4.96,
    todayIncome: 468.8,
    todayOrders: 12,
    balance: 3268.2,
    longitude: 114.0579,
    latitude: 22.5431,
    currentLocation: '深圳北站东广场'
  },
  orders: [
    {
      id: 9001,
      orderNo: 'ST202606050001',
      serviceType: 'TAXI',
      passengerName: '林夏',
      passengerPhone: '13800000001',
      driverName: '周师傅',
      driverPhone: '13700000009',
      startName: '深圳北站',
      endName: '腾讯滨海大厦',
      distanceKm: 18.6,
      durationMin: 34,
      amount: 68.5,
      currencyCode: 'CNY',
      status: 'PICKING_UP',
      payStatus: 'UNPAID',
      createdAt: '2026-06-05 09:12',
      pickupEta: '5 分钟',
      invoiceStatus: '待申请'
    },
    {
      id: 9002,
      orderNo: 'ST202606050002',
      serviceType: 'CARPOOL',
      passengerName: '许南',
      passengerPhone: '13800000018',
      startName: '南山科技园',
      endName: '广州南站',
      distanceKm: 103.2,
      durationMin: 96,
      amount: 128,
      currencyCode: 'CNY',
      status: 'DISPATCHING',
      payStatus: 'PAID',
      createdAt: '2026-06-05 08:40',
      pickupEta: '12 分钟'
    },
    {
      id: 9003,
      orderNo: 'ST202606040098',
      serviceType: 'INTERNATIONAL',
      passengerName: 'Mia Chen',
      passengerPhone: '13800000031',
      driverName: '跨境专车 A12',
      driverPhone: '13700000021',
      startName: '深圳湾口岸',
      endName: '香港国际机场 T1',
      distanceKm: 52.4,
      durationMin: 72,
      amount: 86,
      currencyCode: 'USD',
      status: 'FINISHED',
      payStatus: 'PAID',
      createdAt: '2026-06-04 19:32',
      pickupEta: '已完成',
      rating: 5,
      invoiceStatus: '已开具'
    }
  ],
  users: [
    { id: 10001, name: '林夏', phone: '13800000001', roleCode: 'USER', authStatus: 2, enabled: true, lastLoginAt: '2026-06-05 09:20' },
    { id: 10002, name: '许南', phone: '13800000018', roleCode: 'USER', authStatus: 1, enabled: true, lastLoginAt: '2026-06-04 21:16' },
    { id: 20001, name: '周师傅', phone: '13700000009', roleCode: 'DRIVER', authStatus: 2, enabled: true, lastLoginAt: '2026-06-05 09:18' },
    { id: 20002, name: '李师傅', phone: '13700000011', roleCode: 'DRIVER', authStatus: 1, enabled: true, lastLoginAt: '2026-06-05 08:02' }
  ],
  drivers: [
    {
      userId: 20001,
      name: '周师傅',
      phone: '13700000009',
      avatarText: '周',
      vehicleNo: '粤B·8S218',
      vehicleModel: '比亚迪 汉 EV',
      serviceStatus: 'ONLINE',
      authStatus: 2,
      enabled: true,
      rating: 4.96,
      todayIncome: 468.8,
      todayOrders: 12,
      balance: 3268.2,
      longitude: 114.0579,
      latitude: 22.5431,
      currentLocation: '深圳北站东广场'
    },
    {
      userId: 20002,
      name: '李师傅',
      phone: '13700000011',
      avatarText: '李',
      vehicleNo: '粤B·D7A52',
      vehicleModel: '广汽埃安 LX',
      serviceStatus: 'BUSY',
      authStatus: 1,
      enabled: true,
      rating: 4.88,
      todayIncome: 326.3,
      todayOrders: 8,
      balance: 1960,
      longitude: 114.0646,
      latitude: 22.5458,
      currentLocation: '福田中心区'
    }
  ],
  coupons: [
    { id: 501, name: '通勤满 50 减 8', type: 'CASH', scope: 'TAXI', threshold: 50, amount: 8, status: 'ACTIVE', received: 1630, used: 820, expiresAt: '2026-06-30' },
    { id: 502, name: '国际出行 9 折', type: 'DISCOUNT', scope: 'INTERNATIONAL', threshold: 0, amount: 9, status: 'ACTIVE', received: 286, used: 91, expiresAt: '2026-07-15' },
    { id: 503, name: '顺风车新客券', type: 'CASH', scope: 'CARPOOL', threshold: 30, amount: 12, status: 'PAUSED', received: 412, used: 206, expiresAt: '2026-06-20' }
  ],
  messages: [
    { id: 1, title: '司机认证待审核', content: '李师傅提交了驾驶证与车辆信息，等待运营确认。', source: '司机审核', level: 'warning', read: false, createdAt: '09:24' },
    { id: 2, title: '乘客投诉待处理', content: '订单 ST202606050001 反馈接驾点沟通不清晰。', source: '投诉建议', level: 'danger', read: false, createdAt: '09:16' },
    { id: 3, title: '夜间公告已生效', content: '23:00-06:00 安全提醒公告已投放到乘客端。', source: '系统公告', level: 'success', read: true, createdAt: '08:55' }
  ],
  transactions: [
    { id: 11001, owner: 'PASSENGER', title: '订单 ST202606050001 支付', type: '支付', amount: -68.5, status: '处理中', createdAt: '09:24' },
    { id: 11002, owner: 'PASSENGER', title: '通勤满减券抵扣', type: '优惠', amount: 8, status: '成功', createdAt: '09:24' },
    { id: 11003, owner: 'PASSENGER', title: '余额充值', type: '充值', amount: 200, status: '成功', createdAt: '昨天 20:18' },
    { id: 12001, owner: 'DRIVER', title: '订单 ST202606040098 收入', type: '收入', amount: 62.8, status: '成功', createdAt: '08:52' },
    { id: 12002, owner: 'DRIVER', title: '提现到招商银行卡', type: '提现', amount: -500, status: '处理中', createdAt: '08:57' }
  ],
  invoices: [
    { id: 61001, orderNo: 'ST202606040098', title: 'Mia Chen', kind: '个人', taxNo: '-', amount: 86, status: '已开具', appliedAt: '昨天 20:11' },
    { id: 61002, orderNo: 'ST202606050001', title: '深圳阳光科技有限公司', kind: '企业', taxNo: '91440300MA5SUN001', amount: 68.5, status: '开票中', appliedAt: '09:26' }
  ],
  reviews: [
    { id: 62001, orderNo: 'ST202606040098', targetName: '跨境专车 A12', rating: 5, tags: ['准时', '沟通清晰'], content: '过关时间提醒及时，行程很稳。', createdAt: '昨天 21:02' },
    { id: 62002, orderNo: 'ST202606030071', targetName: '周师傅', rating: 4.9, tags: ['车辆整洁'], content: '车内干净，路线选择合理。', createdAt: '2026-06-03' }
  ],
  helpTickets: [
    { id: 63001, owner: 'PASSENGER', category: '发票', title: '企业抬头信息校验', status: 'WAITING', createdAt: '09:28' },
    { id: 63002, owner: 'DRIVER', category: '认证', title: '行驶证照片补传', status: 'OPEN', createdAt: '08:43' },
    { id: 63003, owner: 'PASSENGER', category: '安全', title: '夜间行程安全提醒', status: 'RESOLVED', createdAt: '昨天 23:40' }
  ],
  withdraws: [
    { id: 801, driverName: '周师傅', amount: 500, channel: '招商银行 6236', status: 'PENDING', createdAt: '08:57' },
    { id: 802, driverName: '李师傅', amount: 300, channel: '微信零钱', status: 'APPROVED', createdAt: '昨天 18:22' }
  ],
  complaints: [
    { id: 901, orderNo: 'ST202606050001', passengerName: '林夏', level: '紧急', status: 'PENDING', content: '接驾点沟通不清晰，需要运营回访。', createdAt: '09:16' },
    { id: 902, orderNo: 'ST202606040098', passengerName: 'Mia Chen', level: '一般', status: 'CLOSED', content: '跨境发票抬头补充完成。', createdAt: '昨天 22:05' }
  ],
  carpoolTrips: [
    { id: 7001, ownerName: '许南', startName: '南山科技园', endName: '广州南站', departTime: '今天 18:40', seats: 2, price: 128, status: 'OPEN', applications: 4 },
    { id: 7002, ownerName: '林夏', startName: '深圳北站', endName: '惠州南站', departTime: '明天 09:20', seats: 1, price: 86, status: 'CONFIRMING', applications: 2 }
  ],
  internationalOrders: [
    { id: 8101, route: '深圳湾口岸 -> 香港国际机场', passengerName: 'Mia Chen', country: '中国香港', flightNo: 'CX391', currencyCode: 'USD', amount: 86, status: 'FINISHED', materialStatus: '已齐全' },
    { id: 8102, route: '蛇口邮轮中心 -> 澳门外港码头', passengerName: '陈先生', country: '中国澳门', flightNo: 'FERRY-18:20', currencyCode: 'USD', amount: 62, status: 'DISPATCHING', materialStatus: '需人工确认' }
  ],
  driverDocuments: [
    { id: 91001, documentType: '驾驶证', status: '已通过', updatedAt: '2026-06-01', remark: '有效期至 2031-05-31' },
    { id: 91002, documentType: '行驶证', status: '待审核', updatedAt: '今天 08:43', remark: '照片已补传，等待运营确认' },
    { id: 91003, documentType: '车辆照片', status: '已通过', updatedAt: '2026-05-30', remark: '外观与车牌一致' },
    { id: 91004, documentType: '人车合影', status: '待提交', updatedAt: '-', remark: '建议拍摄正面清晰照片' }
  ],
  driverSettings: [
    { key: 'autoAccept', label: '顺路自动接单', enabled: true, desc: '评分、距离和路线相近时自动确认。' },
    { key: 'voicePrompt', label: '语音播报', enabled: true, desc: '新订单、乘客取消和到达提醒。' },
    { key: 'nightSafety', label: '夜间安全模式', enabled: true, desc: '夜间行程增加位置同步频率。' },
    { key: 'crossCity', label: '跨城订单', enabled: false, desc: '打开后可收到城际顺风车订单。' }
  ],
  notices: [
    { id: 3001, title: '夜间出行安全提醒', clientType: 'USER_MINIAPP', displayTimeRange: '23:00-06:00', enabled: true },
    { id: 3002, title: '司机端提现到账说明', clientType: 'DRIVER_MINIAPP', displayTimeRange: '00:00-23:59', enabled: true }
  ],
  versions: [
    { id: 4001, clientType: 'USER_MINIAPP', version: '1.9.0', forceUpdate: false, publishedAt: '2026-06-01' },
    { id: 4002, clientType: 'DRIVER_MINIAPP', version: '1.7.2', forceUpdate: false, publishedAt: '2026-06-02' },
    { id: 4003, clientType: 'ADMIN', version: '1.4.8', forceUpdate: true, publishedAt: '2026-06-03' }
  ],
  configs: [
    { key: 'dispatch.autoAssign', label: '自动派单', value: '开启后按距离、评分、服务状态综合分配。', enabled: true, group: '订单' },
    { key: 'payment.mockPay', label: '模拟支付', value: '演示环境允许一键完成支付。', enabled: true, group: '订单' },
    { key: 'coupon.riskGuard', label: '领券风控', value: '同设备、同手机号、同支付账户联合校验。', enabled: true, group: '营销' },
    { key: 'safety.nightNotice', label: '夜间安全提醒', value: '23:00-06:00 自动投放安全公告。', enabled: true, group: '安全' },
    { key: 'desktop.offlineQueue', label: '离线队列', value: '服务不可用时保留操作并等待同步。', enabled: true, group: '桌面端' }
  ],
  operationChecklist: [
    { id: 71001, title: '回访紧急投诉 ST202606050001', owner: '客服', due: '10:00 前', status: 'RISK' },
    { id: 71002, title: '审核李师傅行驶证补传', owner: '运营', due: '今日', status: 'PENDING' },
    { id: 71003, title: '核对跨境订单外币账单', owner: '财务', due: '今日', status: 'PENDING' },
    { id: 71004, title: '桌面端离线队列巡检', owner: '技术', due: '每日', status: 'DONE' }
  ],
  dispatchRules: [
    { id: 72001, label: '距离优先', weight: 40, enabled: true, desc: '优先匹配 3 公里内在线司机。' },
    { id: 72002, label: '评分优先', weight: 30, enabled: true, desc: '高评分司机在同距离内获得更高权重。' },
    { id: 72003, label: '顺路拼车', weight: 20, enabled: true, desc: '顺风车按路线重合度推荐。' },
    { id: 72004, label: '跨境资质', weight: 10, enabled: true, desc: '国际出行只派给具备跨境资质的车辆。' }
  ],
  currencyRates: [
    { code: 'USD', rate: 7.18, updatedAt: '09:00', enabled: true },
    { code: 'HKD', rate: 0.92, updatedAt: '09:00', enabled: true },
    { code: 'MOP', rate: 0.89, updatedAt: '09:00', enabled: true }
  ],
  auditEvents: [
    { id: 13001, actor: '运营管理员', action: '刷新大盘', target: '运营数据', result: '完成', createdAt: '09:25:12' },
    { id: 13002, actor: '司机端', action: '提交提现', target: '提现单 801', result: '待审核', createdAt: '08:57:40' },
    { id: 13003, actor: '乘客端', action: '申请发票', target: 'ST202606040098', result: '已开具', createdAt: '昨天 20:11' }
  ],
  financeLogs: [
    '09:21 订单 ST202606050001 生成待支付账单 ¥68.50',
    '09:18 优惠券 501 发放给用户 10001',
    '08:57 司机 20001 提现申请 ¥500.00 待审核'
  ]
}

export function cloneDataset(): DesktopDataset {
  return JSON.parse(JSON.stringify(mockDataset)) as DesktopDataset
}

export function buildOrderTimeline(order?: RideOrder): TimelineStep[] {
  const status = order?.status || 'CREATED'
  const currentIndex = statusSequence.indexOf(status)
  return statusSequence.map((key, index) => ({
    key,
    label: orderStatusLabel[key],
    desc:
      key === 'CREATED'
        ? '乘客提交路线'
        : key === 'DISPATCHING'
          ? '平台匹配司机'
          : key === 'ACCEPTED'
            ? '司机确认接单'
            : key === 'PICKING_UP'
              ? '前往上车点'
              : key === 'IN_TRIP'
                ? '安全行程中'
                : '支付、开票与评价',
    done: status === 'FINISHED' || status === 'REFUNDED' || currentIndex >= index,
    current: currentIndex === index
  }))
}
