export type AppMode = 'passenger' | 'driver' | 'admin'

export type ActiveView =
  | 'passenger-booking'
  | 'passenger-trip'
  | 'passenger-services'
  | 'passenger-profile'
  | 'driver-dashboard'
  | 'driver-trip'
  | 'driver-wallet'
  | 'driver-profile'
  | 'admin-dashboard'
  | 'admin-workbench'
  | 'admin-orders'
  | 'admin-system'

export type ServiceType = 'TAXI' | 'CARPOOL' | 'INTERNATIONAL'

export type OrderStatus =
  | 'CREATED'
  | 'DISPATCHING'
  | 'ACCEPTED'
  | 'PICKING_UP'
  | 'IN_TRIP'
  | 'FINISHED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PayStatus = 'UNPAID' | 'PAID' | 'REFUNDED'
export type AuthStatus = 0 | 1 | 2 | 3

export interface HealthStatus {
  frontend: boolean
  backend: boolean
  database: boolean
  admin: boolean
  web: boolean
  mode: 'live' | 'demo'
  checkedAt: string
}

export interface Metric {
  label: string
  value: string
  delta: string
  tone: 'orange' | 'blue' | 'green' | 'red' | 'neutral'
}

export interface TimelineStep {
  key: string
  label: string
  desc: string
  done: boolean
  current: boolean
}

export interface RideOrder {
  id: number
  orderNo: string
  serviceType: ServiceType
  passengerName: string
  passengerPhone: string
  driverName?: string
  driverPhone?: string
  startName: string
  endName: string
  distanceKm: number
  durationMin: number
  amount: number
  currencyCode: 'CNY' | 'USD'
  status: OrderStatus
  payStatus: PayStatus
  createdAt: string
  pickupEta: string
  rating?: number
  complaintStatus?: string
  invoiceStatus?: string
}

export interface AddressFavorite {
  id: number
  name: string
  address: string
  tag: '家' | '公司' | '机场' | '学校' | '常用'
  lastUsedAt: string
}

export interface DriverProfile {
  userId: number
  name: string
  phone: string
  avatarText: string
  vehicleNo: string
  vehicleModel: string
  serviceStatus: 'ONLINE' | 'OFFLINE' | 'BUSY'
  authStatus: AuthStatus
  enabled: boolean
  rating: number
  todayIncome: number
  todayOrders: number
  balance: number
  longitude: number
  latitude: number
  currentLocation: string
}

export interface DriverDocument {
  id: number
  documentType: '驾驶证' | '行驶证' | '车辆照片' | '人车合影'
  status: '待提交' | '待审核' | '已通过' | '已驳回'
  updatedAt: string
  remark: string
}

export interface DriverSetting {
  key: string
  label: string
  enabled: boolean
  desc: string
}

export interface PassengerProfile {
  id: number
  name: string
  phone: string
  authStatus: AuthStatus
  emergencyContact: string
  balance: number
  points: number
}

export interface WalletTransaction {
  id: number
  owner: 'PASSENGER' | 'DRIVER'
  title: string
  type: '充值' | '支付' | '收入' | '提现' | '退款' | '优惠'
  amount: number
  status: '成功' | '处理中' | '失败'
  createdAt: string
}

export interface InvoiceRecord {
  id: number
  orderNo: string
  title: string
  kind: '个人' | '企业'
  taxNo: string
  amount: number
  status: '未申请' | '开票中' | '已开具' | '已驳回'
  appliedAt: string
}

export interface ReviewRecord {
  id: number
  orderNo: string
  targetName: string
  rating: number
  tags: string[]
  content: string
  createdAt: string
}

export interface HelpTicket {
  id: number
  owner: 'PASSENGER' | 'DRIVER'
  category: '订单' | '钱包' | '安全' | '发票' | '认证'
  title: string
  status: 'OPEN' | 'WAITING' | 'RESOLVED'
  createdAt: string
}

export interface Coupon {
  id: number
  name: string
  type: 'CASH' | 'DISCOUNT'
  scope: 'ALL' | ServiceType
  threshold: number
  amount: number
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED'
  received: number
  used: number
  expiresAt: string
}

export interface MessageItem {
  id: number
  title: string
  content: string
  source: string
  level: 'info' | 'warning' | 'danger' | 'success'
  read: boolean
  createdAt: string
}

export interface WithdrawTicket {
  id: number
  driverName: string
  amount: number
  channel: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export interface ComplaintCase {
  id: number
  orderNo: string
  passengerName: string
  level: '一般' | '紧急'
  status: 'PENDING' | 'HANDLING' | 'CLOSED'
  content: string
  createdAt: string
}

export interface AuditEvent {
  id: number
  actor: string
  action: string
  target: string
  result: string
  createdAt: string
}

export interface CarpoolTrip {
  id: number
  ownerName: string
  startName: string
  endName: string
  departTime: string
  seats: number
  price: number
  status: 'OPEN' | 'CONFIRMING' | 'LOCKED' | 'FINISHED' | 'CANCELLED'
  applications: number
}

export interface InternationalOrder {
  id: number
  route: string
  passengerName: string
  country: string
  flightNo: string
  currencyCode: 'USD' | 'CNY'
  amount: number
  status: OrderStatus
  materialStatus: '待补全' | '已齐全' | '需人工确认'
}

export interface UserAccount {
  id: number
  name: string
  phone: string
  roleCode: 'USER' | 'DRIVER' | 'ADMIN'
  authStatus: AuthStatus
  enabled: boolean
  lastLoginAt: string
}

export interface SystemNotice {
  id: number
  title: string
  clientType: 'ADMIN' | 'USER_MINIAPP' | 'DRIVER_MINIAPP'
  displayTimeRange: string
  enabled: boolean
}

export interface SystemVersion {
  id: number
  clientType: 'ADMIN' | 'USER_MINIAPP' | 'DRIVER_MINIAPP'
  version: string
  forceUpdate: boolean
  publishedAt: string
}

export interface SystemConfig {
  key: string
  label: string
  value: string
  enabled: boolean
  group: '订单' | '营销' | '安全' | '桌面端'
}

export interface OperationChecklist {
  id: number
  title: string
  owner: '客服' | '运营' | '财务' | '技术'
  due: string
  status: 'PENDING' | 'RISK' | 'DONE'
}

export interface DispatchRule {
  id: number
  label: string
  weight: number
  enabled: boolean
  desc: string
}

export interface CurrencyRate {
  code: 'USD' | 'HKD' | 'MOP'
  rate: number
  updatedAt: string
  enabled: boolean
}

export interface ConfirmationState {
  open: boolean
  title: string
  body: string
  confirmText: string
  tone: 'default' | 'danger'
}

export interface DesktopDataset {
  metrics: Metric[]
  passenger: PassengerProfile
  favorites: AddressFavorite[]
  driver: DriverProfile
  orders: RideOrder[]
  users: UserAccount[]
  drivers: DriverProfile[]
  coupons: Coupon[]
  messages: MessageItem[]
  transactions: WalletTransaction[]
  invoices: InvoiceRecord[]
  reviews: ReviewRecord[]
  helpTickets: HelpTicket[]
  withdraws: WithdrawTicket[]
  complaints: ComplaintCase[]
  carpoolTrips: CarpoolTrip[]
  internationalOrders: InternationalOrder[]
  driverDocuments: DriverDocument[]
  driverSettings: DriverSetting[]
  notices: SystemNotice[]
  versions: SystemVersion[]
  configs: SystemConfig[]
  operationChecklist: OperationChecklist[]
  dispatchRules: DispatchRule[]
  currencyRates: CurrencyRate[]
  auditEvents: AuditEvent[]
  financeLogs: string[]
}
