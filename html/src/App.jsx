import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Car,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Flag,
  HelpCircle,
  Locate,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  Power,
  Radio,
  RefreshCw,
  Route,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  CarTaxiFront,
  Ticket,
  User,
  Users,
  Wallet,
  XCircle,
  Zap
} from 'lucide-react'
import { api, getApiBase, normalizeList, setApiBase } from './api'
import { isAnyOrderActionPending, isOrderActionPending, orderActionPendingKey } from './interaction-state'
import sunshineLogo from './assets/sunshine-logo-transparent.png'
import {
  DRIVER_STATUS,
  ORDER_STATUS,
  PAY_STATUS,
  SERVICE_TYPE,
  calcRoute,
  createOrderPayload,
  defaultBooking,
  demoAccounts,
  estimateLocalFare,
  fallbackCarTypes,
  findPoi,
  formatMoney,
  poiLibrary,
  statusLabel,
  statusTone
} from './data'

const passengerSessionKey = 'sunshine-web-passenger-session'
const passengerSettingsKey = 'sunshine-web-passenger-settings-v1'
const driverSessionKey = 'sunshine-web-driver-session'
const driverSettingsKey = 'sunshine-web-driver-settings-v1'
const dailyCheckinStateKey = 'sunshine-web-daily-checkin-v1'
const portalRoleKey = 'sunshine-web-portal-role'
const addressBookKey = 'sunshine-web-address-book-v1'
const DEFAULT_TENCENT_MAP_KEY = 'NHNBZ-F5FW3-Z4C3Q-R4WUM-ODTPE-DRFDV'
const SERVICE_ICON_PATHS = {
  [SERVICE_TYPE.TAXI]: '/assets/service-icons/taxi.png',
  [SERVICE_TYPE.CARPOOL]: '/assets/service-icons/carpool.png',
  [SERVICE_TYPE.INTERNATIONAL]: '/assets/service-icons/international.png',
  taxi: '/assets/service-icons/taxi.png',
  carpool: '/assets/service-icons/carpool.png',
  international: '/assets/service-icons/international.png'
}
const serviceShortLabel = {
  [SERVICE_TYPE.TAXI]: '打车',
  [SERVICE_TYPE.CARPOOL]: '顺风车',
  [SERVICE_TYPE.INTERNATIONAL]: '国际出行'
}

const driverDefaultSettings = {
  listenMode: false,
  autoAccept: false,
  voiceBroadcast: true,
  voiceStyle: 'default',
  trackMode: 'DEMO',
  manualResting: false,
  listeningSince: 0,
  listeningBaselineReady: false,
  listeningBaselineOrderIds: []
}

const passengerDefaultSettings = {
  pushEnabled: true,
  autoUseCoupon: true,
  tripRemind: true,
  invoiceRemind: true,
  privacyMask: true,
  emergencyShare: false
}

const driverTrackModeOptions = [
  ['DEMO', '智能路线', '司机接单后显示在上车点附近，并按规划路线接驾。'],
  ['REAL', '真实轨迹', '使用司机真实定位作为接驾位置并更新轨迹。']
]

const driverVoiceStyleOptions = [
  ['default', '播音声音'],
  ['original-default', '默认声音'],
  ['gentle-female', '亲切自然女声'],
  ['sunny-energetic', '阳光活力男声'],
  ['mature-man', '稳重大叔声音'],
  ['playful', '儿童声音'],
  ['original-playful', '搞怪声音']
]

const passengerPaymentMethods = [
  ['WECHAT', '微信支付', '推荐，和小程序支付入口一致'],
  ['BALANCE', '钱包余额', '优先扣除账户余额'],
  ['ALIPAY', '支付宝', '适合企业或个人出行报销']
]

const passengerReviewTags = ['接驾及时', '车内整洁', '路线清晰', '服务礼貌']

const complaintTypeOptions = [
  ['SERVICE', '司机服务', '迟到、态度、沟通、路线等'],
  ['FEE', '费用争议', '金额、优惠券、发票等'],
  ['VEHICLE', '车辆问题', '车况、卫生、车牌不符等'],
  ['PRODUCT', '产品建议', '功能体验、页面问题等']
]

const passengerAuthStatusText = {
  0: '未实名',
  1: '审核中',
  2: '已认证',
  3: '已驳回'
}

const passengerHelpList = [
  { id: 'faq001', title: '如何完成支付？', content: '行程结束后进入结算页，点击“确认支付”即可完成订单支付。' },
  { id: 'faq002', title: '定位权限被拒绝怎么办？', content: '首页会自动切换到手动输入模式，也可以点击“重新授权”重新获取定位。' },
  { id: 'faq003', title: '国际出行为何要带城市信息？', content: '国际订单地址需包含城市或地区信息，建议使用“地点，中国城市/地区”的格式。' }
]

const orderTypeTabs = [
  ['ALL', '全部业务'],
  [SERVICE_TYPE.TAXI, '即时打车'],
  [SERVICE_TYPE.CARPOOL, '顺风车'],
  [SERVICE_TYPE.INTERNATIONAL, '国际出行']
]

const orderStatusTabs = [
  ['ALL', '全部状态'],
  ['COMPLETED', '已完成'],
  ['WAITING_PAY', '待支付'],
  ['PROCESSING', '进行中'],
  ['DISPATCHING', '待接单'],
  ['CANCELLED', '已取消']
]

const driverRejectReasonOptions = [
  '距离较远，暂不方便接驾',
  '车辆临时调整，暂不接单',
  '乘客上车点不便停车',
  '当前路况拥堵，无法准时到达'
]

const internationalOptions = [
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

const internationalRouteFallbacks = {
  'SZX-HKG': { startId: 'poi007', endId: 'poi008' },
  'SZX-MFM': { startId: 'poi007', endId: 'poi009' },
  'PVG-HKG': { startId: 'poi005', endId: 'poi008' }
}

const dailyCheckinRewardRange = { min: 0.5, max: 5 }
const dailyCheckinRewardRangeText = `${formatMoney(dailyCheckinRewardRange.min)} ~ ${formatMoney(dailyCheckinRewardRange.max)}`
const dailyCheckinRewardBands = [
  { minCents: 50, maxCents: 99, weight: 42 },
  { minCents: 100, maxCents: 149, weight: 26 },
  { minCents: 150, maxCents: 199, weight: 15 },
  { minCents: 200, maxCents: 299, weight: 10 },
  { minCents: 300, maxCents: 399, weight: 5 },
  { minCents: 400, maxCents: 500, weight: 2 }
]

const dailyCheckinConfig = {
  USER: {
    label: '乘客',
    title: '网页打车专属立减金',
    desc: '每日签到可领取',
    rangeText: dailyCheckinRewardRangeText,
    pendingText: '仅限网页版打车订单自动抵扣，小程序不可使用',
    usedText: '今日网页专属立减已使用'
  },
  DRIVER: {
    label: '司机',
    title: '网页接单专属奖励金',
    desc: '每日签到可领取',
    rangeText: dailyCheckinRewardRangeText,
    pendingText: '仅限网页版接单完成后入账，小程序不可使用',
    usedText: '今日网页接单奖励已入账'
  }
}

const roleMeta = {
  USER: {
    label: '乘客登录',
    icon: User,
    phone: demoAccounts.USER.phone,
    panel: 'passenger'
  },
  DRIVER: {
    label: '司机登录',
    icon: CarTaxiFront,
    phone: demoAccounts.DRIVER.phone,
    panel: 'driver'
  }
}

const passengerTabRoutes = {
  ride: '',
  orders: 'orders',
  coupons: 'coupons',
  member: 'member',
  carpool: 'carpool',
  international: 'international',
  wallet: 'wallet',
  invoice: 'invoice',
  feedback: 'feedback',
  support: 'support',
  messages: 'messages',
  profile: 'profile'
}

const driverTabRoutes = {
  listen: '',
  orders: 'orders',
  wallet: 'wallet',
  certification: 'certification',
  support: 'support',
  settings: 'settings',
  profile: 'profile',
  messages: 'messages'
}

function normalizePassengerTab(tab) {
  return Object.prototype.hasOwnProperty.call(passengerTabRoutes, tab) ? tab : 'ride'
}

function normalizeDriverTab(tab) {
  return Object.prototype.hasOwnProperty.call(driverTabRoutes, tab) ? tab : 'listen'
}

function parseAppRoute(pathname = '/') {
  const segments = String(pathname || '/').split('/').filter(Boolean)
  const [root, tab] = segments
  if (root === 'passenger') {
    return { view: 'passenger', tab: normalizePassengerTab(tab) }
  }
  if (root === 'driver') {
    return { view: 'driver', tab: normalizeDriverTab(tab) }
  }
  return { view: 'portal', tab: null }
}

function buildAppPath(view, tab) {
  if (view === 'passenger') {
    const normalizedTab = normalizePassengerTab(tab)
    return normalizedTab === 'ride' ? '/passenger' : `/passenger/${passengerTabRoutes[normalizedTab]}`
  }
  if (view === 'driver') {
    const normalizedTab = normalizeDriverTab(tab)
    return normalizedTab === 'listen' ? '/driver' : `/driver/${driverTabRoutes[normalizedTab]}`
  }
  return '/'
}

function useAppRoute() {
  const [route, setRoute] = useState(() => parseAppRoute(window.location.pathname))

  useEffect(() => {
    const syncFromLocation = () => setRoute(parseAppRoute(window.location.pathname))
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [])

  useEffect(() => {
    const canonicalPath = buildAppPath(route.view, route.tab)
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', `${canonicalPath}${window.location.search}${window.location.hash}`)
    }
  }, [route.tab, route.view])

  const navigate = useCallback((view, tab = null, { replace = false } = {}) => {
    const pathname = buildAppPath(view, tab)
    const nextUrl = `${pathname}${window.location.search}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextUrl === currentUrl) {
      setRoute(parseAppRoute(pathname))
      return
    }
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setRoute(parseAppRoute(pathname))
  }, [])

  return [route, navigate]
}

function normalizeDisplayText(value) {
  return String(value ?? '').trim()
}

function looksCorruptedText(value) {
  const text = normalizeDisplayText(value)
  if (!text) return false
  return text.includes('\uFFFD') || text.includes('?') || text.includes('？')
}

function pickFirstCleanText(...values) {
  for (const value of values) {
    const text = normalizeDisplayText(value)
    if (text && !looksCorruptedText(text)) return text
  }
  return ''
}

function safeEditableText(value) {
  return looksCorruptedText(value) ? '' : normalizeDisplayText(value)
}

function resolveAccountDisplayName(account, fallback = '') {
  return pickFirstCleanText(account?.nickname, account?.realName, account?.phone, fallback) || fallback
}

function resolveProfileAvatarText(account, fallback = '阳') {
  const source = resolveAccountDisplayName(account, '') || pickFirstCleanText(account?.phone, fallback) || fallback
  return source.slice(0, 1)
}

function profileHasCorruptedFields(profile) {
  return ['nickname', 'realName', 'emergencyContact'].some((key) => looksCorruptedText(profile?.[key]))
}

function mergeSessionProfile(session, profile, roleCode) {
  if (!session) return session
  return {
    ...session,
    roleCode: roleCode || session.roleCode || profile?.roleCode,
    userId: profile?.id ?? profile?.userId ?? session.userId,
    phone: pickFirstCleanText(profile?.phone, session.phone),
    nickname: pickFirstCleanText(profile?.nickname, profile?.realName, session.nickname, session.realName, session.phone),
    realName: pickFirstCleanText(profile?.realName, session.realName),
    emergencyContact: pickFirstCleanText(profile?.emergencyContact, session.emergencyContact),
    emergencyPhone: pickFirstCleanText(profile?.emergencyPhone, session.emergencyPhone),
    authStatus: profile?.authStatus ?? session.authStatus,
    defaultLanguage: pickFirstCleanText(profile?.defaultLanguage, session.defaultLanguage, 'zh-CN'),
    avatar: pickFirstCleanText(profile?.avatar, session.avatar),
    cityCode: pickFirstCleanText(profile?.cityCode, session.cityCode),
    authRemark: pickFirstCleanText(profile?.authRemark, session.authRemark)
  }
}

function isSameSessionSnapshot(current, next) {
  const keys = ['token', 'roleCode', 'userId', 'phone', 'nickname', 'realName', 'emergencyContact', 'emergencyPhone', 'authStatus', 'defaultLanguage', 'avatar', 'cityCode', 'authRemark']
  return keys.every((key) => String(current?.[key] ?? '') === String(next?.[key] ?? ''))
}

function buildDataWarnings({ profile, syncMeta = {}, apiMode }) {
  const warnings = []
  if (apiMode?.mode === 'demo') {
    warnings.push({
      key: 'backend',
      icon: AlertTriangle,
      text: '当前未连接后端，页面暂时无法保证显示真实资料，请先恢复业务服务后再刷新。'
    })
  } else if (syncMeta?.degradedCount > 0) {
    warnings.push({
      key: 'sync',
      icon: RefreshCw,
      text: `部分业务数据同步失败（${syncMeta.degradedCount}/${syncMeta.totalCount || 0}），请刷新页面或稍后重试。`
    })
  }
  if (profileHasCorruptedFields(profile)) {
    warnings.push({
      key: 'profile',
      icon: AlertTriangle,
      text: '账户资料存在异常字符，已优先展示可用信息，请在资料页重新保存或联系管理员处理。'
    })
  }
  return warnings
}

function NoticeStrip({ notices = [], className = '' }) {
  if (!notices.length) return null
  return (
    <div className={['status-notice-strip', className].filter(Boolean).join(' ')}>
      {notices.map((item) => (
        <div className="status-notice-item" key={item.key}>
          <span className="status-notice-icon">
            <IconSlot icon={item.icon} size={15} />
          </span>
          <strong>{item.text}</strong>
        </div>
      ))}
    </div>
  )
}


function App() {
  usePointerVars()
  const topLoader = useTopLoadBar()
  const [apiMode, setMode] = useState({ mode: 'checking', message: '正在连接业务服务' })
  const [baseUrl, setBaseUrlState] = useState(getApiBase())
  const [home, setHome] = useState({ carTypes: fallbackCarTypes, couponCenter: [], notices: [], fleet: defaultFleetStats() })
  const [route, navigate] = useAppRoute()
  const view = route.view
  const [loginRole, setLoginRole] = useState(null)
  const [passengerSession, setPassengerSession] = usePersistentState(passengerSessionKey, null)
  const [driverSession, setDriverSession] = usePersistentState(driverSessionKey, null)
  const [checkinState, setCheckinState] = usePersistentState(dailyCheckinStateKey, {})
  const [portalRole, setPortalRole] = usePersistentState(portalRoleKey, null)
  const [portalToast, setPortalToast] = useState('')

  useEffect(() => {
    const listener = (event) => setMode(event.detail)
    window.addEventListener('sunshine-api-mode', listener)
    return () => window.removeEventListener('sunshine-api-mode', listener)
  }, [])

  useEffect(() => {
    const handleSessionRefresh = (event) => {
      const session = event.detail?.session
      if (!session?.token) return
      if (session.roleCode === 'DRIVER') {
        setDriverSession((value) => ({ ...(value || {}), ...session }))
      } else {
        setPassengerSession((value) => ({ ...(value || {}), ...session, roleCode: 'USER' }))
      }
    }
    const handleSessionInvalid = (event) => {
      const roleCode = event.detail?.roleCode
      if (roleCode === 'DRIVER') {
        setDriverSession(null)
        if (view === 'driver') setLoginRole('DRIVER')
      } else {
        setPassengerSession(null)
        if (view === 'passenger') setLoginRole('USER')
      }
    }
    window.addEventListener('sunshine-auth-session-refresh', handleSessionRefresh)
    window.addEventListener('sunshine-auth-session-invalid', handleSessionInvalid)
    return () => {
      window.removeEventListener('sunshine-auth-session-refresh', handleSessionRefresh)
      window.removeEventListener('sunshine-auth-session-invalid', handleSessionInvalid)
    }
  }, [setDriverSession, setPassengerSession, view])

  useEffect(() => {
    let cancelled = false

    const syncSessionProfile = async (session, roleCode, setSession) => {
      if (!session?.token) return
      try {
        const profile = await api.profileStrict(session.token)
        if (cancelled) return
        setSession((current) => {
          if (!current?.token || current.token !== session.token) return current
          const merged = mergeSessionProfile(current, profile, roleCode)
          return isSameSessionSnapshot(current, merged) ? current : merged
        })
      } catch (error) {
        // NoticeStrip handles user-facing feedback when the backend is unavailable or data stays abnormal.
      }
    }

    syncSessionProfile(passengerSession, 'USER', setPassengerSession)
    syncSessionProfile(driverSession, 'DRIVER', setDriverSession)

    return () => {
      cancelled = true
    }
  }, [driverSession?.token, passengerSession?.token, setDriverSession, setPassengerSession])

  const refreshHome = useCallback(async () => {
    try {
      const data = await api.home()
      setHome({
        carTypes: normalizeCarTypes(data?.carTypes),
        couponCenter: normalizeList(data?.couponCenter || data?.coupons || data),
        notices: Array.isArray(data?.notices) ? data.notices : [],
        fleet: normalizeFleetStats(data)
      })
    } catch (error) {
      setHome({ carTypes: fallbackCarTypes, couponCenter: [], notices: [], fleet: defaultFleetStats() })
    }
  }, [])

  useEffect(() => {
    refreshHome()
  }, [refreshHome])

  const saveBaseUrl = () => {
    setApiBase(baseUrl)
    refreshHome()
  }

  const handleLogin = async ({ roleCode, phone, password }) => {
    const data = await api.login(roleCode, phone, password)
    const targetView = roleCode === 'DRIVER' ? 'driver' : 'passenger'
    setPortalRole(roleCode)
    if (roleCode === 'DRIVER') {
      setDriverSession(data)
    } else {
      setPassengerSession(data)
    }
    if (view !== 'portal') navigate(targetView, view === targetView ? route.tab : null, { replace: true })
    setLoginRole(null)
  }

  const handleRegister = async ({ roleCode, phone, password, nickname, defaultLanguage = 'zh-CN' }) => {
    await api.register({ roleCode, phone, password, nickname, defaultLanguage })
    await handleLogin({ roleCode, phone, password })
  }

  const logout = (role) => {
    if (role === 'DRIVER') setDriverSession(null)
    if (role === 'USER') setPassengerSession(null)
    if (portalRole === role) {
      const fallbackRole = role === 'DRIVER'
        ? (passengerSession ? 'USER' : null)
        : (driverSession ? 'DRIVER' : null)
      setPortalRole(fallbackRole)
    }
    navigate('portal', null, { replace: true })
  }

  const currentPortalAccount = resolvePortalAccount(passengerSession, driverSession, portalRole)
  const currentPortalRole = currentPortalAccount?.roleCode || portalRole || 'USER'
  const portalCheckinBenefit = getDailyCheckinBenefit(currentPortalRole, checkinState, currentPortalAccount)

  const showPortalToast = useCallback((text) => {
    setPortalToast(text)
    window.clearTimeout(showPortalToast.timer)
    showPortalToast.timer = window.setTimeout(() => setPortalToast(''), 2400)
  }, [])

  const claimDailyCheckin = useCallback((roleCode = currentPortalRole) => {
    const normalizedRole = roleCode === 'DRIVER' ? 'DRIVER' : 'USER'
    const session = normalizedRole === 'DRIVER' ? driverSession : passengerSession
    if (currentPortalRole !== normalizedRole) setPortalRole(normalizedRole)
    if (!session) {
      showPortalToast('请先登录')
      setLoginRole(normalizedRole)
      return false
    }

    const benefit = getDailyCheckinBenefit(normalizedRole, checkinState, session)
    if (benefit.signedToday) {
      showPortalToast(benefit.status === 'used' ? dailyCheckinConfig[normalizedRole].usedText : '今日已签到，权益等待首单使用')
      return false
    }

    const rewardAmount = drawDailyCheckinRewardAmount()
    setCheckinState((state) => claimDailyCheckinState(state, normalizedRole, rewardAmount, session))
    showPortalToast(`签到成功，已领取 ${formatMoney(rewardAmount)} ${dailyCheckinConfig[normalizedRole].title}`)
    return true
  }, [checkinState, currentPortalRole, driverSession, passengerSession, setCheckinState, setPortalRole, showPortalToast])

  return (
    <div className="app-shell">
      <TopLoadBar {...topLoader} />
      <SvgFilters />
      {view === 'portal' && <CityRoadBackdrop onlineCount={home.fleet?.serviceDriverCount || home.fleet?.busyDriverCount || home.fleet?.onlineDriverCount} />}
      {view === 'portal' && <CursorTaxi />}

      {view === 'portal' && (
        <PortalPage
          apiMode={apiMode}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrlState}
          saveBaseUrl={saveBaseUrl}
          home={home}
          onLogin={setLoginRole}
          onEnter={(target) => navigate(target)}
          hasPassenger={Boolean(passengerSession)}
          hasDriver={Boolean(driverSession)}
          currentAccount={currentPortalAccount}
          currentRoleCode={currentPortalRole}
          checkinBenefit={portalCheckinBenefit}
          onCheckIn={claimDailyCheckin}
          portalToast={portalToast}
        />
      )}

      {view === 'passenger' && (
        <PassengerDashboard
          session={passengerSession}
          home={home}
          apiMode={apiMode}
          onLogin={() => setLoginRole('USER')}
          onLogout={() => logout('USER')}
          onBack={() => navigate('portal', null, { replace: true })}
          onRefreshHome={refreshHome}
          checkinState={checkinState}
          setCheckinState={setCheckinState}
          initialTab={route.tab}
          onTabChange={(tab) => navigate('passenger', tab)}
        />
      )}

      {view === 'driver' && (
        <DriverDashboard
          session={driverSession}
          apiMode={apiMode}
          onLogin={() => setLoginRole('DRIVER')}
          onLogout={() => logout('DRIVER')}
          onBack={() => navigate('portal', null, { replace: true })}
          checkinState={checkinState}
          setCheckinState={setCheckinState}
          initialTab={route.tab}
          onTabChange={(tab) => navigate('driver', tab)}
        />
      )}

      {loginRole && (
        <LoginModal
          roleCode={loginRole}
          onClose={() => setLoginRole(null)}
          onSwitch={(role) => setLoginRole(role)}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}
    </div>
  )
}

function PortalPage({
  apiMode,
  baseUrl,
  setBaseUrl,
  saveBaseUrl,
  home,
  onLogin,
  onEnter,
  hasPassenger,
  hasDriver,
  currentAccount,
  currentRoleCode,
  checkinBenefit,
  onCheckIn,
  portalToast
}) {
  const [booking, setBooking] = useState(defaultBooking)
  const portalWarnings = useMemo(() => buildDataWarnings({ profile: currentAccount, apiMode }), [apiMode, currentAccount])
  const [estimate, setEstimate] = useState(() => {
    const route = calcRoute(defaultBooking.startId, defaultBooking.endId)
    return estimateLocalFare(defaultBooking.carTypeId, defaultBooking.serviceType, route.distanceKm, route.durationMin)
  })

  useEffect(() => {
    const route = calcRoute(booking.startId, booking.endId)
    api.estimate({
      carTypeId: booking.carTypeId,
      serviceType: booking.serviceType,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    }).then(setEstimate).catch(() => {
      setEstimate(estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin))
    })
  }, [booking.startId, booking.endId, booking.carTypeId, booking.serviceType])

  return (
    <main className="portal">
      <nav className="topbar glass-panel refract">
        <button className="brand-mark portal-brand-mark" aria-label="阳光出行" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <SunshineMotionLogo className="portal-brand-logo" />
        </button>
        <div className="topbar-actions">
          <ModeChip mode={apiMode.mode} message={apiMode.message} />
          {currentAccount ? (
            <PortalAccountChip
              account={currentAccount}
              onEnter={() => onEnter(currentRoleCode === 'DRIVER' ? 'driver' : 'passenger')}
            />
          ) : (
            <>
              <button className="ghost-button" onClick={() => onLogin('USER')}><User size={17} />乘客登录</button>
              <button className="solid-button" onClick={() => onLogin('DRIVER')}><CarTaxiFront size={17} />司机登录</button>
            </>
          )}
        </div>
      </nav>

      <NoticeStrip notices={portalWarnings} className="portal-notice-strip" />

      <section className="hero-grid">
        <div className="hero-copy">
          <AnimatedKicker icon={Sparkles} text="live taxi dispatch portal" />
          <AnimatedHeadline text="橙色城市调度舱。" />
          <p>
            打开就是叫车现场：3D 城市道路在背景中流动，车辆沿路线靠近。乘客下单、司机听单、接驾、完单、支付、评价、优惠券、顺风车、实名和提现全部优先对齐项目现有接口。
          </p>
          <div className="dispatch-rail glass-panel interactive-border">
            <span><Radio size={15} /> 智能派单</span>
            <span><Route size={15} /> 实时路线</span>
            <span><Ticket size={15} /> 优惠券抵扣</span>
            <span><ShieldCheck size={15} /> JWT 鉴权</span>
          </div>
          <div className="hero-actions">
            <MagneticButton className="mega-button" onClick={() => onLogin('USER')}>
              <Navigation size={20} /> 立即叫车 <ChevronRight size={18} />
            </MagneticButton>
            <MagneticButton className="line-button" onClick={() => onLogin('DRIVER')}>
              <Radio size={20} /> 进入听单
            </MagneticButton>
          </div>
          <div className="metric-row">
            <Metric value="3" label="端口角色" />
            <Metric value="15+" label="业务接口" />
            <Metric value="稳定" label="交互反馈" />
          </div>
        </div>

        <div className="hero-stage cinematic-stage portal-command">
          <div className="hero-map-column">
            <CityMap
              booking={booking}
              estimate={estimate}
              bookingPanel={(
                <BookingPanel
                  title="门户叫车"
                  booking={booking}
                  setBooking={setBooking}
                  estimate={estimate}
                  carTypes={home.carTypes}
                  onPrimary={() => (hasPassenger ? onEnter('passenger') : onLogin('USER'))}
                  primaryText={hasPassenger ? '进入乘客下单' : '登录乘客并下单'}
                  benefit={currentRoleCode === 'USER' ? checkinBenefit : null}
                  variant="embedded"
                />
              )}
            />
          </div>
          <div className="hero-side-column">
            <DailyCheckInCard
              account={currentAccount}
              roleCode={currentRoleCode}
              benefit={checkinBenefit}
              onCheckIn={onCheckIn}
              compact
            />
            <div className="fleet-feed glass-panel interactive-border">
              <span className="section-kicker">fleet pulse</span>
              <strong>{home.fleet?.serviceDriverCount ?? home.fleet?.busyDriverCount ?? 0} 辆车服务中</strong>
              <p>空闲 {home.fleet?.idleDriverCount ?? 0} 辆 · 在线合计 {home.fleet?.onlineDriverCount ?? 0} 辆</p>
            </div>
          </div>
          {portalToast && <Toast text={portalToast} />}
        </div>

        <section className="portal-strip hero-feature-strip">
          <FeatureCard icon={Zap} title="数据联动" text="网页端接入现有业务服务，与小程序共用登录态、订单、优惠券、司机状态和顺风车数据。" />
          <FeatureCard icon={ShieldCheck} title="业务覆盖" text="乘客端支持叫车、订单、支付、优惠券、消息、实名与客服；司机端支持听单、行程、提现、资质和资料管理。" />
          <FeatureCard icon={Sparkles} title="交互体验" text="重点场景保持轻量动效和清晰反馈，兼顾页面质感、操作效率与实际使用稳定性。" />
        </section>
      </section>
    </main>
  )
}

function PortalAccountChip({ account, onEnter }) {
  const isDriver = account?.roleCode === 'DRIVER'
  const Icon = isDriver ? CarTaxiFront : User
  const accountName = resolveAccountDisplayName(account, isDriver ? '司机账户' : '乘客账户')
  return (
    <button className="portal-account-chip" onClick={onEnter}>
      <span className="portal-account-avatar"><Icon size={17} /></span>
      <span className="portal-account-copy">
        <strong>{accountName}</strong>
        <small>{isDriver ? '司机账户' : '乘客账户'} · 进入工作台</small>
      </span>
      <ChevronRight size={16} />
    </button>
  )
}

function DailyCheckInCard({ account, roleCode = 'USER', benefit, onCheckIn, compact = false }) {
  const config = dailyCheckinConfig[roleCode] || dailyCheckinConfig.USER
  const isLoggedIn = Boolean(account)
  const signedToday = Boolean(benefit?.signedToday)
  const usedToday = benefit?.status === 'used'
  const amount = signedToday ? normalizeDailyCheckinAmount(benefit?.amount) : null
  const rewardText = signedToday ? formatMoney(amount) : config.rangeText
  const [isCelebrating, setIsCelebrating] = useState(false)
  const celebrationTimer = useRef(null)
  const celebrationFrame = useRef(null)
  const actionText = !isLoggedIn
    ? '登录后签到'
    : signedToday
      ? (usedToday ? '今日已使用' : '今日已签到')
      : '立即签到'
  const visualActionText = !isLoggedIn
    ? '登录后签到'
    : signedToday
      ? '查看今日签到权益'
      : '立即签到'
  const cardClassName = [
    'daily-checkin-card',
    compact ? 'is-compact' : '',
    signedToday ? 'is-signed' : '',
    isCelebrating ? 'is-celebrating' : ''
  ].filter(Boolean).join(' ')
  const renderCheckinCells = () => Array.from({ length: 8 }, (_, index) => (
    <span key={index} className={`checkin-day-cell ${index === 5 ? 'active' : ''}`}>
      {index === 5 && <span className="checkin-day-dot" />}
    </span>
  ))
  const triggerCheckIn = () => {
    if (isCelebrating) return false
    const didClaim = onCheckIn(roleCode)
    if (didClaim) {
      window.clearTimeout(celebrationTimer.current)
      window.cancelAnimationFrame(celebrationFrame.current)
      setIsCelebrating(true)
      celebrationTimer.current = window.setTimeout(() => setIsCelebrating(false), 340)
    }
    return didClaim
  }
  const handleVisualPointerMove = (event) => {
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    const px = rect.width ? (event.clientX - rect.left) / rect.width : 0.5
    const py = rect.height ? (event.clientY - rect.top) / rect.height : 0.5
    const rotateY = (px - 0.5) * 48
    const rotateX = (0.5 - py) * 38
    target.style.setProperty('--checkin-hover-rx', `${rotateX.toFixed(2)}deg`)
    target.style.setProperty('--checkin-hover-ry', `${rotateY.toFixed(2)}deg`)
    target.style.setProperty('--checkin-hover-z', '20px')
  }
  const handleVisualPointerLeave = (event) => {
    const target = event.currentTarget
    target.style.setProperty('--checkin-hover-rx', '13deg')
    target.style.setProperty('--checkin-hover-ry', '-22deg')
    target.style.setProperty('--checkin-hover-z', '16px')
  }

  useEffect(() => () => {
    window.clearTimeout(celebrationTimer.current)
    window.cancelAnimationFrame(celebrationFrame.current)
  }, [])

  return (
    <section className={cardClassName}>
      <button
        type="button"
        className="checkin-card-visual"
        aria-label={visualActionText}
        onClick={triggerCheckIn}
        onPointerMove={handleVisualPointerMove}
        onPointerLeave={handleVisualPointerLeave}
      >
        <span className="checkin-calendar-shadow" />
        <span className="checkin-sparkle is-big" aria-hidden="true" />
        <span className="checkin-sparkle is-small" aria-hidden="true" />
        <span className="checkin-calendar-press-wrap">
          <span className="checkin-calendar-3d">
            <span className="checkin-calendar-depth is-near" />
            <span className="checkin-calendar-depth is-far" />
            <span className="checkin-calendar-back">
              <span className="checkin-calendar-top">
                <span className="checkin-calendar-ring" />
                <span className="checkin-calendar-ring" />
              </span>
              <span className="checkin-calendar-grid">
                {renderCheckinCells()}
              </span>
            </span>
            <span className="checkin-calendar-front">
              <span className="checkin-calendar-top">
                <span className="checkin-calendar-ring" />
                <span className="checkin-calendar-ring" />
              </span>
              <span className="checkin-calendar-grid">
                {renderCheckinCells()}
              </span>
            </span>
          </span>
          <span className="checkin-badge"><BadgeCheck size={28} /></span>
        </span>
      </button>
      <div className="checkin-card-copy">
        <div className="checkin-card-headline">
          <h3>每日签到</h3>
        </div>
        <p>
          {config.desc}{' '}
          <strong>{rewardText}</strong>
          <span className="checkin-reward-title">{config.title}</span>
        </p>
      </div>
      <button
        className="sign-in-button"
        disabled={isLoggedIn && signedToday}
        onClick={triggerCheckIn}
      >
        <span>{actionText}</span>
        <span className="button-shimmer" aria-hidden="true" />
      </button>
      <p className="checkin-card-note">
        {usedToday ? config.usedText : config.pendingText}
      </p>
    </section>
  )
}

function AnimatedKicker({ icon: Icon, text }) {
  const words = text.split(' ')
  return (
    <div className="eyebrow animated-kicker" aria-label={text}>
      {Icon && <Icon size={16} />}
      <span className="kicker-words" aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} style={{ '--d': `${index * 82}ms` }}>{word}</span>
        ))}
      </span>
    </div>
  )
}

const headlineScatter = [
  { x: -14, y: -19, z: 30, scale: 1.07, rotate: -3.2 },
  { x: 12, y: -13, z: 24, scale: 1.055, rotate: 2.5 },
  { x: -8, y: 8, z: 18, scale: 1.035, rotate: -1.8 },
  { x: 18, y: -7, z: 28, scale: 1.06, rotate: 3.4 },
  { x: -18, y: -10, z: 22, scale: 1.045, rotate: -2.2 },
  { x: 7, y: 10, z: 18, scale: 1.035, rotate: 1.6 },
  { x: 16, y: -20, z: 32, scale: 1.075, rotate: 3.1 },
  { x: -10, y: -5, z: 20, scale: 1.045, rotate: -2.8 }
]

function AnimatedHeadline({ text }) {
  const ref = useRef(null)
  const lines = text === '橙色城市调度舱。' ? ['橙色城市', '调度舱。'] : [text]
  const handlePointerMove = useCallback((event) => {
    const root = ref.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const px = rect.width ? (event.clientX - rect.left) / rect.width : 0.5
    const py = rect.height ? (event.clientY - rect.top) / rect.height : 0.5
    root.style.setProperty('--headline-hot-x', `${(px * 100).toFixed(1)}%`)
    root.style.setProperty('--headline-hot-y', `${(py * 100).toFixed(1)}%`)
    root.style.setProperty('--headline-ry', `${((px - 0.5) * 12).toFixed(2)}deg`)
    root.style.setProperty('--headline-rx', `${((0.5 - py) * 8).toFixed(2)}deg`)
    root.classList.add('is-hovering')
  }, [])
  const handlePointerLeave = useCallback(() => {
    const root = ref.current
    if (!root) return
    root.style.setProperty('--headline-hot-x', '50%')
    root.style.setProperty('--headline-hot-y', '50%')
    root.style.setProperty('--headline-ry', '0deg')
    root.style.setProperty('--headline-rx', '0deg')
    root.classList.remove('is-hovering')
  }, [])

  return (
    <h1
      ref={ref}
      className="animated-headline split-headline"
      aria-label={text}
      data-text={text}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {lines.map((line, lineIndex) => (
        <span className="headline-line" key={`${line}-${lineIndex}`} aria-hidden="true">
          {Array.from(line).map((char, charIndex) => {
            const order = lines.slice(0, lineIndex).join('').length + charIndex
            const isAccent = text === '橙色城市调度舱。' && ((lineIndex === 0 && charIndex < 2) || (lineIndex === 1 && charIndex < 2))
            const scatter = headlineScatter[order % headlineScatter.length]
            const activeY = scatter.y + (scatter.y < 0 ? -9 : 7)
            return (
              <span
                className={`headline-char ${isAccent ? 'is-accent' : ''}`}
                key={`${char}-${lineIndex}-${charIndex}`}
                style={{
                  '--d': `${order * 52}ms`,
                  '--float-x': `${scatter.x}px`,
                  '--float-y': `${scatter.y}px`,
                  '--float-z': `${scatter.z}px`,
                  '--float-scale': scatter.scale,
                  '--float-rotate': `${scatter.rotate}deg`,
                  '--active-x': `${Math.round(scatter.x * 1.4)}px`,
                  '--active-y': `${activeY}px`,
                  '--active-rotate': `${(scatter.rotate * 1.45).toFixed(1)}deg`
                }}
              >
                <span className="headline-glyph">{char}</span>
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

const portalMenus = {
  passenger: {
    icon: User,
    title: '乘客功能',
    text: '乘客端提供叫车、国际出行、订单、支付、评价、投诉、优惠券、实名与帮助设置等常用功能。',
    chips: ['叫车', '国际出行', '支付评价', '发票入口', '实名资料', '帮助设置']
  },
  driver: {
    icon: CarTaxiFront,
    title: '司机功能',
    text: '司机端支持听单、接单、接驾、行程处理、提现、资质提交、资料维护和消息管理。',
    chips: ['听单大厅', '抢单拒单', '行程流转', '提现资质', '资料设置', '消息中心']
  },
  backend: {
    icon: ShieldCheck,
    title: '业务联动',
    text: '网页端优先连接现有业务服务，登录、订单、优惠券、顺风车、司机与消息数据保持统一。',
    chips: ['/auth/login', '/orders', '/coupons', '/carpool', '/driver', '/messages']
  }
}

function PortalFeatureMenu({ active, setActive, onPassenger, onDriver }) {
  const item = portalMenus[active]
  const Icon = item.icon
  return (
    <section className="interactive-menu glass-panel">
      <div className="menu-tabs" role="tablist" aria-label="网页功能菜单">
        {Object.entries(portalMenus).map(([key, value]) => {
          const TabIcon = value.icon
          return (
            <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}>
              <TabIcon size={17} />{value.title}
            </button>
          )
        })}
      </div>
      <div className="menu-panel">
        <div className="menu-orb"><Icon size={26} /></div>
        <div>
          <span className="section-kicker">interactive menu</span>
          <h2>{item.title}</h2>
          <p>{item.text}</p>
          <div className="menu-chip-row">
            {item.chips.map((chip) => <span key={chip}>{chip}</span>)}
          </div>
        </div>
        <div className="menu-actions">
          <button className="solid-button" onClick={onPassenger}><User size={16} />乘客工作台</button>
          <button className="ghost-button" onClick={onDriver}><CarTaxiFront size={16} />司机工作台</button>
        </div>
      </div>
    </section>
  )
}

function PassengerDashboard({ session, home, apiMode, onLogin, onLogout, onBack, onRefreshHome, checkinState = {}, setCheckinState, initialTab, onTabChange }) {
  const [tab, setTab] = useState(() => normalizePassengerTab(initialTab))
  const [booking, setBooking] = useState(defaultBooking)
  const [estimate, setEstimate] = useState(null)
  const [orders, setOrders] = useState([])
  const [coupons, setCoupons] = useState([])
  const [couponCenter, setCouponCenter] = useState(home.couponCenter || [])
  const [messages, setMessages] = useState([])
  const [membership, setMembership] = useState(null)
  const [supportConversation, setSupportConversation] = useState(null)
  const [supportMessages, setSupportMessages] = useState([])
  const [profile, setProfile] = useState(null)
  const [carpool, setCarpool] = useState({ list: [], mine: null })
  const [activeRuntime, setActiveRuntime] = useState(null)
  const [passengerSettings, setPassengerSettings] = usePersistentState(passengerSettingsKey, passengerDefaultSettings)
  const [focusOrderId, setFocusOrderId] = useState('')
  const [pendingOrderAction, setPendingOrderAction] = useState('')
  const pendingOrderActionRef = useRef('')
  const [syncMeta, setSyncMeta] = useState({ lastSyncAt: 0, degradedCount: 0, totalCount: 0 })
  const [toast, setToast] = useState('')
  const token = session?.token
  const activeRideOrder = useMemo(() => pickActiveRideOrder(orders), [orders])
  const checkinAccount = profile || session
  const passengerCheckinBenefit = getDailyCheckinBenefit('USER', checkinState, checkinAccount)

  const load = useCallback(async () => {
    if (!token) return
    const results = await Promise.allSettled([
      api.profile(token),
      api.orders(token),
      api.myCoupons(token),
      api.couponCenter(),
      api.messages(token),
      api.carpoolSearch(''),
      api.carpoolMine(token),
      api.membership(token),
      api.supportConversation(token),
      api.supportMessages(token)
    ])
    const [profileData, orderData, mineCoupons, centerCoupons, msgData, carpoolList, myCarpool, membershipData, supportData, supportMessageData] = results
    if (profileData.status === 'fulfilled') setProfile(profileData.value)
    setOrders(orderData.status === 'fulfilled' ? normalizeList(orderData.value) : [])
    if (mineCoupons.status === 'fulfilled') setCoupons(normalizeList(mineCoupons.value))
    if (centerCoupons.status === 'fulfilled') setCouponCenter(normalizeList(centerCoupons.value))
    if (msgData.status === 'fulfilled') setMessages(normalizeList(msgData.value))
    setCarpool((value) => ({
      ...value,
      list: carpoolList.status === 'fulfilled' ? normalizeList(carpoolList.value) : [],
      mine: myCarpool.status === 'fulfilled' ? myCarpool.value : null
    }))
    if (membershipData.status === 'fulfilled') setMembership(membershipData.value)
    if (supportData.status === 'fulfilled') setSupportConversation(supportData.value)
    if (supportMessageData.status === 'fulfilled') setSupportMessages(normalizeList(supportMessageData.value))
    setSyncMeta({
      lastSyncAt: Date.now(),
      degradedCount: results.filter((item) => item.status === 'rejected').length,
      totalCount: results.length
    })
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setTab(normalizePassengerTab(initialTab))
  }, [initialTab])

  useEffect(() => {
    if (tab !== 'ride') return
    setBooking((current) => (
      current.serviceType === SERVICE_TYPE.TAXI
        ? current
        : { ...current, serviceType: SERVICE_TYPE.TAXI }
    ))
  }, [tab])

  const changeTab = useCallback((nextTab) => {
    const normalizedTab = normalizePassengerTab(nextTab)
    setTab(normalizedTab)
    onTabChange?.(normalizedTab)
  }, [onTabChange])



  useEffect(() => {
    if (!token || !activeRideOrder?.id) {
      setActiveRuntime(null)
      return undefined
    }

    let cancelled = false
    const syncActiveRide = async () => {
      const [orderData, runtimeData] = await Promise.allSettled([
        api.orders(token),
        api.orderRuntime(token, activeRideOrder.id)
      ])
      if (cancelled) return
      setOrders(orderData.status === 'fulfilled' ? normalizeList(orderData.value) : [])
      setActiveRuntime(runtimeData.status === 'fulfilled' ? runtimeData.value : null)
    }

    syncActiveRide()
    const timer = window.setInterval(syncActiveRide, 3500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeRideOrder?.id, token])

  useEffect(() => {
    if (!token) return undefined
    const timer = window.setInterval(load, activeRideOrder?.id ? 12000 : 18000)
    return () => window.clearInterval(timer)
  }, [activeRideOrder?.id, load, token])

  useEffect(() => {
    let cancelled = false
    const route = calcRoute(booking.startPoint || booking.startId, booking.endPoint || booking.endId)
    api.estimate({
      carTypeId: booking.carTypeId,
      serviceType: booking.serviceType,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    })
      .then((data) => {
        if (!cancelled) setEstimate(data)
      })
      .catch(() => {
        if (!cancelled) setEstimate(null)
      })
    return () => {
      cancelled = true
    }
  }, [booking.carTypeId, booking.endId, booking.serviceType, booking.startId])

  const run = async (task, successText = '操作成功') => {
    try {
      setToast('正在更新...')
      const result = await task()
      await load()
      await onRefreshHome?.()
      setToast(successText)
      window.setTimeout(() => setToast(''), 2200)
      return result ?? true
    } catch (error) {
      setToast(error.message || '操作失败')
      return false
    }
  }

  const runOrderAction = async (action, order, payload) => {
    const pendingKey = orderActionPendingKey(action, order)
    if (!pendingKey) {
      return run(() => passengerOrderAction(action, order, token, payload), actionText(action))
    }
    if (pendingOrderActionRef.current === pendingKey) return undefined
    pendingOrderActionRef.current = pendingKey
    setPendingOrderAction(pendingKey)
    try {
      return await run(() => passengerOrderAction(action, order, token, payload), actionText(action))
    } finally {
      if (pendingOrderActionRef.current === pendingKey) {
        pendingOrderActionRef.current = ''
        setPendingOrderAction('')
      }
    }
  }

  const updatePassengerSettings = useCallback((patch) => {
    setPassengerSettings((current) => normalizePassengerSettings({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch)
    }))
  }, [setPassengerSettings])

  const navigateFromMessage = useCallback((target) => {
    if (!target?.tab) return
    if (target.orderId) setFocusOrderId(String(target.orderId))
    changeTab(target.tab)
  }, [changeTab])

  const estimateRide = async () => {
    const route = calcRoute(booking.startPoint || booking.startId, booking.endPoint || booking.endId)
    const data = await api.estimate({
      carTypeId: booking.carTypeId,
      serviceType: SERVICE_TYPE.TAXI,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    })
    setEstimate(data)
    return data
  }

  const estimateCarpoolOrder = useCallback(async (form = {}) => {
    const startPoi = form.startPoint || resolvePoiFromText(form.startName, 'poi101')
    const endPoi = form.endPoint || resolvePoiFromText(form.endName, 'poi102')
    const route = calcRoute(startPoi, endPoi)
    return api.estimate({
      carTypeId: Number(form.carTypeId || home.carTypes?.[0]?.id || 1),
      serviceType: SERVICE_TYPE.CARPOOL,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    })
  }, [home.carTypes])

  const createRide = () => run(async () => {
    const rideBooking = { ...booking, serviceType: SERVICE_TYPE.TAXI }
    const priced = booking.serviceType === SERVICE_TYPE.TAXI && estimate ? estimate : await estimateRide()
    const webExclusiveDiscountAmount = getUsableCheckinAmount(passengerCheckinBenefit, priced)
    await api.createOrder(token, createOrderPayload(rideBooking, priced, {
      sourceChannel: 'WEB',
      webExclusiveDiscountAmount,
      webExclusiveDiscountLabel: '网页专属签到优惠',
      webExclusiveDiscountScope: 'WEB_TAXI_ONLY',
      webCheckinAccountKey: getAccountCheckinKey('USER', checkinAccount)
    }))
    if (webExclusiveDiscountAmount > 0 && setCheckinState) {
      setCheckinState((state) => markDailyCheckinUsed(state, 'USER', checkinAccount))
    }
    changeTab('ride')
  }, '订单已提交，地图已切换到实时派单状态')

  const createCarpoolRide = (form = {}, coupon = null) => run(async () => {
    const invalidMessage = validateCarpoolOrderForm(form)
    if (invalidMessage) throw new Error(invalidMessage)
    const carTypeId = Number(form.carTypeId || home.carTypes?.[0]?.id || 1)
    const startPoi = form.startPoint || resolvePoiFromText(form.startName, 'poi101')
    const endPoi = form.endPoint || resolvePoiFromText(form.endName, 'poi102')
    const route = calcRoute(startPoi, endPoi)
    const priced = await estimateCarpoolOrder({ ...form, carTypeId })
    const couponDiscount = coupon ? Number(coupon.discountAmount || 0) : 0
    const payload = {
      carTypeId,
      serviceType: SERVICE_TYPE.CARPOOL,
      startName: String(form.startName || startPoi.name).trim(),
      startLng: String(startPoi.longitude),
      startLat: String(startPoi.latitude),
      endName: String(form.endName || endPoi.name).trim(),
      endLng: String(endPoi.longitude),
      endLat: String(endPoi.latitude),
      estimatedDistanceKm: priced.distanceKm || route.distanceKm,
      estimatedDurationMin: priced.durationMin || route.durationMin,
      userCouponId: coupon?.userCouponIdText || null,
      couponDiscount,
      couponName: coupon?.name || '',
      couponRuleDesc: coupon?.ruleText || '',
      originalAmount: priced.amount,
      payableAmount: Math.max(0, Number(priced.amount || 0) - couponDiscount),
      dispatchMode: 'CARPOOL_MATCH',
      sourceChannel: 'WEB',
      remark: buildCarpoolOrderRemark(form, priced, coupon)
    }
    await api.createOrder(token, payload)
    changeTab('orders')
  }, '顺风车订单已提交，优惠和行程信息已同步到订单')

  const createInternationalRide = (option = internationalOptions[0], form = {}) => run(async () => {
    const cleanForm = normalizeInternationalForm(form)
    const invalidMessage = validateInternationalForm(cleanForm)
    if (invalidMessage) throw new Error(invalidMessage)
    const routePoints = resolveInternationalRoutePoints(option)
    const route = calcRoute(routePoints.startPoint, routePoints.endPoint)
    const internationalBooking = {
      ...booking,
      carTypeId: 3,
      serviceType: SERVICE_TYPE.INTERNATIONAL,
      startId: routePoints.startPoint.id,
      endId: routePoints.endPoint.id,
      startPoint: routePoints.startPoint,
      endPoint: routePoints.endPoint,
      remark: buildInternationalRemark(option, cleanForm.note || booking.remark, cleanForm, {
        distanceKm: parseMetricNumber(option.distanceText, route.distanceKm),
        durationMin: parseMetricNumber(option.durationText, route.durationMin),
        amount: option.basePrice,
        currencyCode: 'USD'
      })
    }
    const priced = await api.estimate({
      carTypeId: internationalBooking.carTypeId,
      serviceType: SERVICE_TYPE.INTERNATIONAL,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    })
    const internationalEstimate = {
      ...priced,
      amount: Number(option.basePrice || priced.amount || 0),
      payable: Number(option.basePrice || priced.payable || priced.amount || 0),
      distanceKm: parseMetricNumber(option.distanceText, priced.distanceKm || route.distanceKm),
      durationMin: parseMetricNumber(option.durationText, priced.durationMin || route.durationMin),
      currencyCode: 'USD',
      exchangeRate: 7.15
    }
    await api.createOrder(token, createOrderPayload(internationalBooking, internationalEstimate))
    changeTab('orders')
  }, `${option.titleZh || '国际出行'}预约已提交，国际行程已同步到订单`)

  if (!session) {
    return <LoginRequired role="USER" onLogin={onLogin} onBack={onBack} />
  }

  return (
    <DashboardShell
      role="乘客端"
      icon={User}
      apiMode={apiMode}
      profile={profile || session}
      tab={tab}
      setTab={changeTab}
      syncMeta={syncMeta}
      onLogout={onLogout}
      onBack={onBack}
      onTabChange={onTabChange}
      tabs={[
        ['ride', SERVICE_ICON_PATHS[SERVICE_TYPE.TAXI], '叫车'],
        ['orders', Route, '订单'],
        ['coupons', Ticket, '优惠券'],
        ['carpool', SERVICE_ICON_PATHS[SERVICE_TYPE.CARPOOL], '顺风车'],
        ['international', SERVICE_ICON_PATHS[SERVICE_TYPE.INTERNATIONAL], '国际'],
        ['wallet', Wallet, '钱包实名'],
        ['invoice', CreditCard, '发票'],
        ['feedback', HelpCircle, '反馈帮助'],
        ['support', MessageSquare, '客服'],
        ['messages', Bell, '消息'],
        ['profile', Settings, '设置']
      ]}
    >
      {toast && <Toast text={toast} />}
      {tab === 'ride' && (
        <div className="dashboard-grid ride-workbench real-ride">
          {activeRideOrder ? (
            <ActiveRidePanel
              order={activeRideOrder}
              runtime={activeRuntime}
              profile={profile || session}
              onRefresh={load}
              onOpenSupport={() => changeTab('support')}
              pendingActionKey={pendingOrderAction}
              onAction={(action) => runOrderAction(action, activeRideOrder)}
            />
          ) : (
            <BookingPanel
              title="乘客叫车"
              booking={booking}
              setBooking={setBooking}
              estimate={estimate}
              carTypes={home.carTypes}
              onEstimate={estimateRide}
              onPrimary={createRide}
              primaryText="提交订单"
              benefit={passengerCheckinBenefit}
              lockedServiceType
              showServiceTabs={false}
            />
          )}
          <CityMap booking={booking} estimate={estimate} compact operational activeOrder={activeRideOrder} runtime={activeRuntime} showSummaryPanel={false} />
        </div>
      )}

      {tab === 'orders' && (
        <OrderBoard
          orders={orders}
          coupons={coupons}
          role="USER"
          onRefresh={load}
          onOpenInvoice={() => changeTab('invoice')}
          focusOrderId={focusOrderId}
          pendingActionKey={pendingOrderAction}
          onAction={runOrderAction}
        />
      )}

      {tab === 'coupons' && (
        <CouponBoard
          center={couponCenter}
          mine={coupons}
          membership={membership}
          onOpenMembership={() => changeTab('member')}
          onUseCoupon={(coupon) => {
            setBooking((current) => ({
              ...current,
              userCouponId: coupon.userCouponId || coupon.id
            }))
            changeTab('ride')
            setToast('已选择优惠券，可在叫车页下单抵扣')
            window.setTimeout(() => setToast(''), 2200)
          }}
          onReceive={(coupon) => run(() => api.receiveCoupon(token, coupon.id), '优惠券已领取')}
        />
      )}

      {tab === 'member' && (
        <MembershipBoard
          membership={membership}
          coupons={coupons}
          onActivate={() => run(() => api.activateMembership(token), '会员已开通')}
          onSyncCoupons={() => run(() => api.syncMembershipCoupons(token), '会员券包已同步')}
        />
      )}

      {tab === 'carpool' && (
        <CarpoolBoard
          data={carpool}
          coupons={coupons}
          settings={passengerSettings}
          carTypes={home.carTypes}
          onCreateOrder={createCarpoolRide}
          onEstimateOrder={estimateCarpoolOrder}
          onSearch={(keyword) => run(async () => {
            const list = await api.carpoolSearch(keyword)
            setCarpool((value) => ({ ...value, list: normalizeList(list) }))
          }, '顺风车列表已刷新')}
          onPublish={(form) => run(() => api.carpoolPublish(token, form), '顺风车已发布')}
          onApply={(trip, payload = {}) => run(() => api.carpoolApply(token, {
            tripId: trip.id,
            companionCount: Number(payload.companionCount || 0),
            note: payload.note || '网页端申请搭乘'
          }), '已申请搭乘')}
          onOwnerAction={(application, action) => run(() => api.carpoolOwnerConfirm(token, {
            applicationId: application.id,
            action,
            note: action === 'REJECT' ? '车主暂时不便同行' : '车主已确认同行'
          }), action === 'REJECT' ? '已拒绝申请' : '已确认乘客')}
          onPassengerConfirm={(application) => run(() => api.carpoolPassengerConfirm(token, {
            applicationId: application.id,
            action: 'CONFIRM',
            note: '乘客已确认同行'
          }), '已确认同行')}
          onCancel={(application) => run(() => api.carpoolCancel(token, {
            applicationId: application.id,
            reason: '网页端主动取消顺风车申请'
          }), '已取消申请')}
        />
      )}

      {tab === 'messages' && (
        <MessageBoard
          messages={messages}
          orders={orders}
          role="USER"
          onRefresh={load}
          onNavigateTarget={navigateFromMessage}
          onReadMessage={async (message) => {
            setMessages((list) => list.map((item) => item.id === message.id ? { ...item, unread: false, read: true, isRead: true, readStatus: 'READ' } : item))
            try {
              await api.markMessageRead(token, message.id)
            } catch (error) {}
          }}
        />
      )}
      {tab === 'international' && <InternationalBoard booking={booking} estimate={estimate} profile={profile || session} onSubmit={createInternationalRide} />}
      {tab === 'wallet' && (
        <PassengerWalletBoard
          profile={profile || session}
          orders={orders}
          onOpenOrder={(order) => {
            setFocusOrderId(orderKey(order))
            setTab('orders')
          }}
          onUploadAvatar={(file) => api.uploadAvatar(token, file)}
          onProfile={(form) => run(() => api.updateProfile(token, form), '资料已更新')}
          onRealName={(form) => run(() => api.submitRealName(token, form), '实名信息已提交')}
        />
      )}
      {tab === 'invoice' && (
        <InvoiceWorkbench
          orders={orders}
          profile={profile || session}
          onApplyInvoice={(order, form) => run(() => api.applyInvoice(token, order.id, form), '发票申请已提交')}
          onPreviewInvoice={(order) => api.invoiceAsset(token, order.id, { strict: true })}
        />
      )}
      {tab === 'feedback' && (
        <SupportBoard
          orders={orders}
          profile={profile || session}
          settings={passengerSettings}
          onComplaint={(order, payload) => runOrderAction('complaint', order, payload)}
          onEvaluate={(order, payload) => runOrderAction('evaluate', order, payload)}
        />
      )}
      {tab === 'support' && (
        <SupportChatPanel
          conversation={supportConversation}
          messages={supportMessages}
          profile={profile || session}
          role="USER"
          orders={orders}
          onRefresh={load}
          onSend={(content) => run(() => api.sendSupportMessage(token, content), '客服消息已发送')}
        />
      )}
      {tab === 'profile' && (
        <div className="settings-page">
          <PassengerSettingsPanel
            settings={passengerSettings}
            onSettingsChange={updatePassengerSettings}
          />
          <ProfileBoard
            profile={profile || session}
            mode="USER"
            onProfile={(form) => run(() => api.updateProfile(token, form), '资料已保存')}
          />
        </div>
      )}
    </DashboardShell>
  )
}

function DriverDashboard({ session, apiMode, onLogin, onLogout, onBack, initialTab, onTabChange }) {
  const [tab, setTab] = useState(() => normalizeDriverTab(initialTab))
  const [dashboard, setDashboard] = useState(null)
  const [waitingOrders, setWaitingOrders] = useState([])
  const [orders, setOrders] = useState([])
  const [messages, setMessages] = useState([])
  const [withdraws, setWithdraws] = useState([])
  const [supportConversation, setSupportConversation] = useState(null)
  const [supportMessages, setSupportMessages] = useState([])
  const [focusOrderId, setFocusOrderId] = useState('')
  const [driverSettings, setDriverSettings] = useState(() => readDriverSettings())
  const [rejectDraft, setRejectDraft] = useState({ orderId: null, reason: driverRejectReasonOptions[0] })
  const autoAcceptingRef = useRef(false)
  const [pendingOrderAction, setPendingOrderAction] = useState('')
  const pendingOrderActionRef = useRef('')
  const [syncMeta, setSyncMeta] = useState({ lastSyncAt: 0, degradedCount: 0, totalCount: 0 })
  const [toast, setToast] = useState('')
  const token = session?.token
  const profile = dashboard?.profile || {}

  const load = useCallback(async () => {
    if (!token) return
    const results = await Promise.allSettled([
      api.driverDashboard(token),
      api.driverWaitingOrders(token),
      api.orders(token),
      api.messages(token),
      api.driverWithdraws(token),
      api.supportConversation(token),
      api.supportMessages(token)
    ])
    const [dash, waiting, mine, msg, withdrawData, supportData, supportMessageData] = results
    if (dash.status === 'fulfilled') setDashboard(dash.value)
    else setDashboard(null)
    setWaitingOrders(waiting.status === 'fulfilled' ? normalizeList(waiting.value) : [])
    setOrders(mine.status === 'fulfilled' ? normalizeList(mine.value) : [])
    if (msg.status === 'fulfilled') setMessages(normalizeList(msg.value))
    if (withdrawData.status === 'fulfilled') setWithdraws(normalizeList(withdrawData.value))
    if (supportData.status === 'fulfilled') setSupportConversation(supportData.value)
    if (supportMessageData.status === 'fulfilled') setSupportMessages(normalizeList(supportMessageData.value))
    setSyncMeta({
      lastSyncAt: Date.now(),
      degradedCount: results.filter((item) => item.status === 'rejected').length,
      totalCount: results.length
    })
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setTab(normalizeDriverTab(initialTab))
  }, [initialTab])

  const changeTab = useCallback((nextTab) => {
    const normalizedTab = normalizeDriverTab(nextTab)
    setTab(normalizedTab)
    onTabChange?.(normalizedTab)
  }, [onTabChange])



  useEffect(() => {
    if (!token) return undefined
    const timer = window.setInterval(load, tab === 'listen' ? 5000 : 15000)
    return () => window.clearInterval(timer)
  }, [load, tab, token])

  const updateDriverSettings = useCallback((patch) => {
    setDriverSettings((current) => {
      const next = normalizeDriverSettings({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) })
      window.localStorage.setItem(driverSettingsKey, JSON.stringify(next))
      return next
    })
  }, [])

  const run = async (task, successText = '操作成功') => {
    try {
      setToast('正在更新...')
      const result = await task()
      await load()
      setToast(successText)
      window.setTimeout(() => setToast(''), 2200)
      return result ?? true
    } catch (error) {
      setToast(error.message || '操作失败')
      return false
    }
  }

  const runPendingOrderMutation = async (action, order, task, successText = actionText(action)) => {
    const pendingKey = orderActionPendingKey(action, order)
    if (!pendingKey) return run(task, successText)
    if (pendingOrderActionRef.current === pendingKey) return undefined
    pendingOrderActionRef.current = pendingKey
    setPendingOrderAction(pendingKey)
    try {
      return await run(task, successText)
    } finally {
      if (pendingOrderActionRef.current === pendingKey) {
        pendingOrderActionRef.current = ''
        setPendingOrderAction('')
      }
    }
  }

  const runOrderAction = (action, order) => (
    runPendingOrderMutation(action, order, () => driverOrderAction(action, order, token), actionText(action))
  )

  const navigateFromMessage = useCallback((target) => {
    if (!target?.tab) return
    if (target.orderId) setFocusOrderId(String(target.orderId))
    changeTab(target.tab)
  }, [changeTab])

  const toggleDriverAutoAccept = useCallback(() => {
    updateDriverSettings((current) => {
      const nextAutoAccept = !current.autoAccept
      return {
        autoAccept: nextAutoAccept,
        listeningBaselineReady: nextAutoAccept && current.listenMode,
        listeningBaselineOrderIds: nextAutoAccept && current.listenMode
          ? waitingOrders.map((order) => String(order.id || order.orderNo || '')).filter(Boolean)
          : current.listeningBaselineOrderIds
      }
    })
  }, [updateDriverSettings, waitingOrders])

  const updateDriverSettingsFromPanel = useCallback((patch) => {
    if (patch && typeof patch !== 'function' && Object.prototype.hasOwnProperty.call(patch, 'autoAccept')) {
      updateDriverSettings((current) => {
        const nextAutoAccept = Boolean(patch.autoAccept)
        return {
          ...patch,
          autoAccept: nextAutoAccept,
          listeningBaselineReady: nextAutoAccept && current.listenMode,
          listeningBaselineOrderIds: nextAutoAccept && current.listenMode
            ? waitingOrders.map((order) => String(order.id || order.orderNo || '')).filter(Boolean)
            : current.listeningBaselineOrderIds
        }
      })
      return
    }
    updateDriverSettings(patch)
  }, [updateDriverSettings, waitingOrders])

  const submitDriverReject = (order) => {
    const reason = String(rejectDraft.reason || '').trim()
    if (!reason) {
      setToast('请填写拒单原因')
      return
    }
    return runPendingOrderMutation('reject', order, async () => {
      await api.driverReject(token, order.id, reason)
      setRejectDraft({ orderId: null, reason: driverRejectReasonOptions[0] })
    }, '已提交拒单原因')
  }

  useEffect(() => {
    if (!profile.serviceStatus) return
    const online = [DRIVER_STATUS.ONLINE, DRIVER_STATUS.BUSY].includes(profile.serviceStatus)
    updateDriverSettings({
      listenMode: online,
      manualResting: profile.serviceStatus === DRIVER_STATUS.OFFLINE,
      listeningSince: online && !driverSettings.listeningSince ? Date.now() : driverSettings.listeningSince
    })
  }, [profile.serviceStatus])

  useEffect(() => {
    if (!token || autoAcceptingRef.current) return
    if (!driverSettings.autoAccept || !driverSettings.listenMode || profile.serviceStatus !== DRIVER_STATUS.ONLINE) return
    const baselineOrderIds = new Set(normalizeList(driverSettings.listeningBaselineOrderIds).map((item) => String(item)))
    const order = waitingOrders.find((item) => {
      const orderId = driverOrderIdOf(item)
      if (orderId && baselineOrderIds.has(orderId)) return false
      return isDriverOrderNewAfterListening(item, driverSettings.listeningSince)
    }) || null
    if (!order?.id) return
    autoAcceptingRef.current = true
    run(() => api.driverAccept(token, order.id), '已按设置自动接单')
      .finally(() => {
        autoAcceptingRef.current = false
      })
  }, [token, driverSettings.autoAccept, driverSettings.listenMode, driverSettings.listeningBaselineOrderIds, driverSettings.listeningSince, profile.serviceStatus, waitingOrders])

  if (!session) {
    return <LoginRequired role="DRIVER" onLogin={onLogin} onBack={onBack} />
  }

  const user = dashboard?.user || session
  const pendingWithdrawCount = normalizeList(withdraws.length ? withdraws : dashboard?.pendingWithdraw).filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length
  const activeDriverTrip = normalizeList(orders).find((order) => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus))
  const driverBusy = Boolean(activeDriverTrip) || profile.serviceStatus === DRIVER_STATUS.BUSY
  const driverOnline = profile.serviceStatus === DRIVER_STATUS.ONLINE
  const driverServiceText = driverBusy ? '服务中' : driverOnline ? '在线听单' : '休息中'
  const driverServiceHint = driverBusy ? '当前行程处理中，状态会同步到乘客端和后台。' : driverOnline ? '待抢订单会实时进入右侧列表' : '上线后才会接收新订单'
  const servicePermission = dashboard?.servicePermission || {}

  return (
    <DashboardShell
      role="司机端"
      icon={CarTaxiFront}
      apiMode={apiMode}
      profile={user}
      tab={tab}
      setTab={changeTab}
      syncMeta={syncMeta}
      onLogout={onLogout}
      onBack={onBack}
      onTabChange={onTabChange}
      tabs={[
        ['listen', Radio, '听单'],
        ['orders', Route, '订单'],
        ['wallet', Wallet, '钱包'],
        ['certification', BadgeCheck, '司机资质'],
        ['support', MessageSquare, '客服'],
        ['settings', Settings, '接单设置'],
        ['profile', Settings, '资料设置'],
        ['messages', Bell, '消息']
      ]}
    >
      {toast && <Toast text={toast} />}
      {tab === 'listen' && (
        <div className="dashboard-grid">
          <section className="glass-panel work-card wide driver-listen-card">
            <div className="card-head">
              <div>
                <span className="section-kicker">司机服务</span>
                <h2>听单大厅</h2>
              </div>
              <StatusBadge value={profile.serviceStatus || DRIVER_STATUS.OFFLINE} />
            </div>
            <div className="driver-listen-shell">
              <div className="driver-listen-stage">
                <div className="driver-listen-primary">
            <div className="driver-switch">
              {[DRIVER_STATUS.ONLINE, DRIVER_STATUS.OFFLINE].map((status) => (
                <button
                  key={status}
                  className={profile.serviceStatus === status ? 'active' : ''}
                  disabled={Boolean(activeDriverTrip)}
                  aria-pressed={profile.serviceStatus === status}
                  title={activeDriverTrip ? '当前服务中，完成行程后再切换听单状态' : ''}
                  onClick={() => run(async () => {
                    const location = await resolveDriverWebLocation(profile)
                    await api.driverStatus(token, {
                      serviceStatus: status,
                      longitude: String(location.longitude),
                      latitude: String(location.latitude)
                    })
                    updateDriverSettings({
                      listenMode: status === DRIVER_STATUS.ONLINE,
                      manualResting: status === DRIVER_STATUS.OFFLINE,
                      listeningSince: status === DRIVER_STATUS.ONLINE ? Date.now() : 0,
                      listeningBaselineReady: status === DRIVER_STATUS.ONLINE,
                      listeningBaselineOrderIds: status === DRIVER_STATUS.ONLINE
                        ? waitingOrders.map((order) => String(order.id || order.orderNo || '')).filter(Boolean)
                        : []
                    })
                  }, `司机状态已切换为${statusLabel[status]}`)}
                >
                  <Power size={18} />{statusLabel[status]}
                </button>
              ))}
            </div>
            <div className={`driver-listen-hero ${activeDriverTrip ? 'is-busy' : driverOnline ? 'is-online' : 'is-offline'}`}>
              <div className="driver-listen-hero__copy">
                <span>当前接单状态</span>
                <strong>{activeDriverTrip ? '服务中' : driverOnline ? '在线听单' : '休息中'}</strong>
                <p>{activeDriverTrip ? `${activeDriverTrip.startName} → ${activeDriverTrip.endName}` : servicePermission.message || (driverOnline ? '附近订单会自动刷新到待抢订单。' : '上线后才会收到乘客订单。')}</p>
              </div>
              <em>{servicePermission.canReceiveOrders === false ? '未解锁' : activeDriverTrip ? '进行中' : driverOnline ? '可接单' : '未上线'}</em>
            </div>
            {activeDriverTrip && (
              <button type="button" className="driver-current-trip-card" onClick={() => changeTab('orders')}>
                <div>
                  <span>当前进行中的行程</span>
                  <strong>{activeDriverTrip.startName} → {activeDriverTrip.endName}</strong>
                  <small>{driverNextActionText(activeDriverTrip)} · {formatMoney(activeDriverTrip.payableAmount || activeDriverTrip.actualAmount || activeDriverTrip.estimatedAmount, activeDriverTrip.currencyCode)}</small>
                </div>
                <ChevronRight size={17} />
              </button>
            )}
                </div>
                <div className="driver-listen-overview">
            <div className="stat-grid driver-listen-metrics">
              <Metric value={dashboard?.orders?.length || orders.length || 0} label="我的订单" />
              <Metric value={formatMoney(profile.todayIncome || 0)} label="今日收入" />
              <Metric value={formatMoney(profile.withdrawableIncome || 0)} label="可提现" />
            </div>
            <div className="driver-listen-summary">
              <SummaryPill icon={Zap} value={driverSettings.autoAccept ? '已开启' : '未开启'} label="自动接单" />
              <SummaryPill icon={Bell} value={driverSettings.voiceBroadcast ? '已开启' : '未开启'} label="语音播报" />
              <SummaryPill icon={Route} value={driverTrackModeMeta(driverSettings.trackMode).label} label="轨迹模式" />
            </div>
                </div>
              </div>
            <div className="driver-service-panel">
              <div className={driverBusy || driverOnline ? 'active' : ''}>
                <span>服务状态</span>
                <strong>{driverServiceText}</strong>
                <small>{driverServiceHint}</small>
              </div>
              <div>
                <span>待抢订单</span>
                <strong>{waitingOrders.length} 单</strong>
                <small>{driverSettings.autoAccept ? '自动接单会处理第一单' : '手动确认后接单'}</small>
              </div>
              <div>
                <span>可提现</span>
                <strong>{formatMoney(profile.withdrawableIncome || 0)}</strong>
                <small>{pendingWithdrawCount ? `${pendingWithdrawCount} 笔提现待审核` : '暂无待审核提现'}</small>
              </div>
            </div>
            <div className="driver-inline-controls">
              <button className={driverSettings.autoAccept ? 'active' : ''} onClick={toggleDriverAutoAccept}><Zap size={15} />自动接单</button>
              <button className={driverSettings.voiceBroadcast ? 'active' : ''} onClick={() => updateDriverSettings({ voiceBroadcast: !driverSettings.voiceBroadcast })}><Bell size={15} />语音播报</button>
            </div>
            </div>
          </section>
          <section className="glass-panel work-card wide">
            <div className="card-head">
              <div>
                <span className="section-kicker">待接订单</span>
                <h2>待抢订单</h2>
              </div>
              <button className="icon-button" onClick={load}><RefreshCw size={17} /></button>
            </div>
            <div className="driver-queue-note">
              <span>{driverBusy ? '服务中' : driverOnline ? '在线' : '离线'}</span>
              <strong>{waitingOrders.length ? `当前有 ${waitingOrders.length} 单可处理` : '当前没有待抢订单'}</strong>
              <small>{driverBusy ? '完成当前行程后再处理新的待抢订单。' : driverSettings.autoAccept ? '自动接单开启时，新订单会优先自动确认。' : '手动接单时，请先确认路线和距离。'}</small>
            </div>
            <OrderList
              orders={waitingOrders}
              empty="暂无待抢订单，乘客端下单后会出现在这里。"
              footer={(order) => {
                const acceptBusy = isOrderActionPending(pendingOrderAction, 'accept', order)
                const rejectBusy = isOrderActionPending(pendingOrderAction, 'reject', order)
                const orderActionLocked = isAnyOrderActionPending(pendingOrderAction, order)
                return (
                <>
                  <button
                    className={`solid-button${acceptBusy ? ' is-busy' : ''}`}
                    disabled={orderActionLocked}
                    onClick={() => runPendingOrderMutation('accept', order, () => api.driverAccept(token, order.id), '接单成功')}
                  >
                    <CheckCircle size={16} />{acceptBusy ? '接单中' : '接单'}
                  </button>
                  <button className="ghost-button" disabled={orderActionLocked} onClick={() => setRejectDraft({
                    orderId: rejectDraft.orderId === order.id ? null : order.id,
                    reason: rejectDraft.orderId === order.id ? driverRejectReasonOptions[0] : rejectDraft.reason || driverRejectReasonOptions[0]
                  })}>
                    <XCircle size={16} />拒单
                  </button>
                  {rejectDraft.orderId === order.id && (
                    <div className="driver-reject-panel">
                      <div className="feedback-chip-row">
                        {driverRejectReasonOptions.map((reason) => (
                          <button
                            type="button"
                            key={reason}
                            className={rejectDraft.reason === reason ? 'active' : ''}
                            onClick={() => setRejectDraft((draft) => ({ ...draft, reason }))}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                      <label className="plain-field textarea-field">
                        <span>拒单说明</span>
                        <textarea
                          value={rejectDraft.reason}
                          onChange={(event) => setRejectDraft((draft) => ({ ...draft, reason: event.target.value }))}
                        />
                      </label>
                      <div className="order-action-panel-actions">
                        <button className={`solid-button${rejectBusy ? ' is-busy' : ''}`} disabled={orderActionLocked} onClick={() => submitDriverReject(order)}><XCircle size={15} />{rejectBusy ? '提交中' : '确认拒单'}</button>
                        <button className="ghost-button" disabled={orderActionLocked} onClick={() => setRejectDraft({ orderId: null, reason: driverRejectReasonOptions[0] })}>取消</button>
                      </div>
                    </div>
                  )}
                </>
                )
              }}
            />
          </section>
        </div>
      )}

      {tab === 'orders' && (
        <OrderBoard
          orders={orders}
          role="DRIVER"
          onRefresh={load}
          focusOrderId={focusOrderId}
          pendingActionKey={pendingOrderAction}
          onAction={runOrderAction}
        />
      )}

      {tab === 'wallet' && (
        <DriverWallet
          dashboard={dashboard}
          withdraws={withdraws}
          onWithdraw={(form) => run(() => api.driverWithdraw(token, form), '提现申请已提交')}
        />
      )}

      {tab === 'certification' && (
        <DriverCertificationBoard
          dashboard={dashboard}
          onUploadDocument={(file, documentType) => api.driverUploadDocument(token, file, documentType)}
          onCertify={(form) => run(() => api.driverCertify(token, form), '资质信息已提交')}
        />
      )}

      {tab === 'support' && (
        <SupportChatPanel
          conversation={supportConversation}
          messages={supportMessages}
          profile={user}
          role="DRIVER"
          orders={orders}
          onRefresh={load}
          onSend={(content) => run(() => api.sendSupportMessage(token, content), '客服消息已发送')}
        />
      )}

      {tab === 'profile' && (
        <DriverProfileBoard
          dashboard={dashboard}
          user={user}
          onProfile={(form) => run(() => api.driverUpdateProfile(token, form), '司机资料已更新')}
        />
      )}

      {tab === 'settings' && (
        <DriverSettingsBoard
          dashboard={dashboard}
          settings={driverSettings}
          onSettingsChange={updateDriverSettingsFromPanel}
          onServiceStatus={(status) => run(async () => {
            const location = await resolveDriverWebLocation(profile)
            await api.driverStatus(token, {
              serviceStatus: status,
              longitude: String(location.longitude),
              latitude: String(location.latitude)
            })
            updateDriverSettings({
              listenMode: status === DRIVER_STATUS.ONLINE,
              manualResting: status === DRIVER_STATUS.OFFLINE,
              listeningSince: status === DRIVER_STATUS.ONLINE ? Date.now() : 0,
              listeningBaselineReady: status === DRIVER_STATUS.ONLINE,
              listeningBaselineOrderIds: status === DRIVER_STATUS.ONLINE
                ? waitingOrders.map((order) => String(order.id || order.orderNo || '')).filter(Boolean)
                : []
            })
          }, status === DRIVER_STATUS.ONLINE ? '听单模式已开启' : '听单模式已关闭')}
        />
      )}

      {tab === 'messages' && (
        <MessageBoard
          messages={messages}
          orders={orders}
          role="DRIVER"
          onRefresh={load}
          onNavigateTarget={navigateFromMessage}
          onReadMessage={async (message) => {
            setMessages((list) => list.map((item) => item.id === message.id ? { ...item, unread: false, read: true, isRead: true, readStatus: 'READ' } : item))
            try {
              await api.markMessageRead(token, message.id)
            } catch (error) {}
          }}
        />
      )}
    </DashboardShell>
  )
}

function BookingPanel({ title, kicker = '路线配置', booking, setBooking, estimate, carTypes, onEstimate, onPrimary, primaryText, benefit = null, variant = 'standalone', lockedServiceType = false, showServiceTabs = true }) {
  const [busyAction, setBusyAction] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [addressTarget, setAddressTarget] = useState('end')
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)
  const [addressBook, setAddressBook] = usePersistentState(addressBookKey, { history: [], favorites: [] })
  const route = calcRoute(booking.startPoint || booking.startId, booking.endPoint || booking.endId)
  const [remoteAddressCandidates, setRemoteAddressCandidates] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const hasSyncedEstimate = Boolean(estimate)
  const safeEstimate = estimate || {
    amount: 0,
    baseAmount: 0,
    longDistanceSurchargeAmount: 0,
    distanceKm: null,
    durationMin: null,
    currencyCode: 'CNY'
  }
  const canUseWebCheckinDiscount = hasSyncedEstimate && booking.serviceType === SERVICE_TYPE.TAXI && (safeEstimate.currencyCode || 'CNY') === 'CNY'
  const checkinDiscount = canUseWebCheckinDiscount && benefit?.signedToday && benefit?.status === 'pending' ? Number(benefit.amount || 0) : 0
  const options = normalizeCarTypes(carTypes)
  const selectedCarType = options.find((item) => Number(item.id) === Number(booking.carTypeId)) || options[0]
  const payableAmount = hasSyncedEstimate ? Math.max(0, Number(safeEstimate.amount || 0) - checkinDiscount) : null
  const carCards = options.map((item) => {
    const itemEstimate = hasSyncedEstimate && Number(item.id) === Number(booking.carTypeId) ? estimate : null
    const itemDiscount = Number(item.id) === Number(booking.carTypeId) ? checkinDiscount : 0
    return {
      ...item,
      estimate: itemEstimate,
      payableAmount: itemEstimate ? Math.max(0, Number(itemEstimate.amount || 0) - itemDiscount) : null,
      selected: Number(item.id) === Number(booking.carTypeId)
    }
  })
  const isEmbedded = variant === 'embedded'
  const panelClassName = [
    'booking-card',
    isEmbedded ? 'booking-card--embedded' : 'glass-panel refract',
  ].join(' ')
  const bookingPoiOptions = useMemo(() => (
    booking.serviceType === SERVICE_TYPE.TAXI
      ? poiLibrary.filter((poi) => !isInternationalPoiCandidate(poi))
      : poiLibrary
  ), [booking.serviceType])
  const safeAddressBook = useMemo(() => normalizeAddressBook(addressBook, bookingPoiOptions), [addressBook, bookingPoiOptions])
  const addressCandidates = useMemo(() => {
    const keyword = addressQuery.trim().toLowerCase()
    const savedKeys = new Set([...safeAddressBook.favorites, ...safeAddressBook.history].map((poi) => getAddressKey(poi)))
    const source = keyword
      ? remoteAddressCandidates
      : [...safeAddressBook.favorites, ...safeAddressBook.history, ...bookingPoiOptions]
    const deduped = dedupeAddressPoints(source)
    const scored = deduped.map((poi, index) => {
      const haystack = `${poi.name} ${poi.address} ${(poi.tags || []).join(' ')}`.toLowerCase()
      const key = getAddressKey(poi)
      const active = sameAddressPoint(poi, route.start) || sameAddressPoint(poi, route.end)
      const favorite = safeAddressBook.favorites.some((item) => sameAddressPoint(item, poi))
      const recent = safeAddressBook.history.some((item) => sameAddressPoint(item, poi))
      const score = (active ? 8 : 0) + (favorite ? 4 : 0) + (recent ? 2 : 0)
      return {
        ...poi,
        addressKey: key,
        active,
        favorite,
        recent,
        matched: !keyword || haystack.includes(keyword),
        score,
        listIndex: index
      }
    })
    return scored
      .filter((poi) => poi.matched)
      .sort((left, right) => keyword
        ? right.score - left.score || left.name.localeCompare(right.name, 'zh-Hans-CN')
        : left.listIndex - right.listIndex)
      .slice(0, 6)
  }, [addressQuery, bookingPoiOptions, remoteAddressCandidates, route.end, route.start, safeAddressBook.favorites, safeAddressBook.history])
  const swapRoute = () => update({
    startId: booking.endId,
    endId: booking.startId,
    startPoint: booking.endPoint || findPoi(booking.endId),
    endPoint: booking.startPoint || findPoi(booking.startId)
  })
  const openAddressSearch = (target) => {
    setAddressTarget(target)
    setAddressQuery('')
    setAddressError('')
    setRemoteAddressCandidates([])
    setAddressSearchOpen(true)
  }
  const chooseAddressCandidate = (poi) => {
    const point = normalizeWebAddressPoint(poi)
    update(addressTarget === 'start'
      ? { startId: point.id, startPoint: point }
      : { endId: point.id, endPoint: point })
    setAddressBook((current) => addAddressHistory(current, point, bookingPoiOptions))
    setAddressQuery('')
    setRemoteAddressCandidates([])
    setAddressSearchOpen(false)
  }
  const toggleAddressFavorite = (poi) => {
    setAddressBook((current) => toggleAddressFavoriteId(current, poi, bookingPoiOptions))
  }
  const clearAddressHistory = () => {
    setAddressBook((current) => ({ ...normalizeAddressBook(current, bookingPoiOptions), history: [] }))
  }
  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      window.alert('当前浏览器暂不支持定位，请手动选择地址')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestPoiByCoordinate(position.coords.latitude, position.coords.longitude, bookingPoiOptions)
        chooseAddressCandidate(nearest || {
          id: `geo-${Date.now()}`,
          name: '我的当前位置',
          address: `经纬度 ${Number(position.coords.latitude).toFixed(6)}, ${Number(position.coords.longitude).toFixed(6)}`,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'currentLocation'
        })
      },
      () => window.alert('未能获取当前位置，请检查浏览器定位权限'),
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
    )
  }

  const update = (patch) => setBooking((value) => ({ ...value, ...patch }))
  useEffect(() => {
    if (isEmbedded || !addressSearchOpen) return undefined
    const keyword = addressQuery.trim()
    let cancelled = false
    setAddressError('')
    if (!keyword) {
      setRemoteAddressCandidates([])
      setAddressLoading(false)
      return undefined
    }
    setAddressLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const list = await searchWebAddressCandidates(keyword, route.start, {
          pageSize: 8,
          serviceType: booking.serviceType
        })
        if (!cancelled) setRemoteAddressCandidates(list)
      } catch (error) {
        if (!cancelled) {
          setRemoteAddressCandidates(buildLocalAddressCandidates(keyword, route.start, { serviceType: booking.serviceType }))
          setAddressError('地图搜索暂时不可用，已显示本地候选')
        }
      } finally {
        if (!cancelled) setAddressLoading(false)
      }
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [addressQuery, addressSearchOpen, booking.serviceType, isEmbedded, route.start.latitude, route.start.longitude])
  const runAction = async (name, handler) => {
    if (!handler || busyAction) return
    setBusyAction(name)
    try {
      await Promise.resolve(handler())
    } finally {
      window.setTimeout(() => setBusyAction(''), 160)
    }
  }

  return (
    <section className={panelClassName}>
      <div className="card-head">
        <div>
          {!isEmbedded && <span className="section-kicker">{kicker}</span>}
          <h2>{title}</h2>
        </div>
        <div className="price-stack">
          <div className="price-pill">{hasSyncedEstimate ? formatMoney(payableAmount, safeEstimate.currencyCode) : '待同步'}</div>
          {checkinDiscount > 0 && <small>网页专属优惠 {formatMoney(checkinDiscount)}</small>}
        </div>
      </div>
      {showServiceTabs && (
        <div className="service-tabs">
          {Object.values(SERVICE_TYPE).map((type) => (
            <button
              key={type}
              className={booking.serviceType === type ? 'active' : ''}
              disabled={lockedServiceType && booking.serviceType !== type}
              onClick={() => {
                if (!lockedServiceType) update({ serviceType: type })
              }}
            >
              <ServiceIcon type={type} className="service-tab-icon" />
              <span>{statusLabel[type]}</span>
            </button>
          ))}
        </div>
      )}
      {isEmbedded ? (
        <div className="field-stack">
          <SelectField
            icon={Locate}
            label="上车点"
            value={booking.startId}
            onChange={(value) => update({ startId: value })}
            options={bookingPoiOptions.map((item) => [item.id, item.name])}
          />
          <SelectField
            icon={Flag}
            label="目的地"
            value={booking.endId}
            onChange={(value) => update({ endId: value })}
            options={bookingPoiOptions.map((item) => [item.id, item.name])}
          />
          <SelectField
            icon={Car}
            label="车型"
            value={String(booking.carTypeId)}
            onChange={(value) => update({ carTypeId: Number(value) })}
            options={options.map((item) => [String(item.id), getCarTypeName(item)])}
          />
        </div>
      ) : (
        <>
          <div className="booking-route-stack">
            <AddressPointField
              icon={Locate}
              label="从哪里出发"
              point={route.start}
              active={addressSearchOpen && addressTarget === 'start'}
              onClick={() => openAddressSearch('start')}
            />
            <button type="button" className="address-swap-button" onClick={swapRoute} aria-label="交换上车点和目的地">换</button>
            <AddressPointField
              icon={Flag}
              label="去哪里"
              point={route.end}
              active={addressSearchOpen && addressTarget === 'end'}
              onClick={() => openAddressSearch('end')}
            />
          </div>
          {addressSearchOpen && <div className="address-search-panel">
            <div className="address-search-head">
              <div>
                <span>地址搜索</span>
                <small>候选地址、收藏点和地图选点逻辑同步到网页端</small>
              </div>
              <div className="segmented-row address-target-tabs" role="tablist" aria-label="地址写入位置">
                <button type="button" className={addressTarget === 'start' ? 'active' : ''} onClick={() => openAddressSearch('start')}>上车点</button>
                <button type="button" className={addressTarget === 'end' ? 'active' : ''} onClick={() => openAddressSearch('end')}>目的地</button>
                <button type="button" onClick={() => setAddressSearchOpen(false)}>收起</button>
              </div>
            </div>
            <label className="address-search-input">
              <Locate size={15} />
              <input
                value={addressQuery}
                onChange={(event) => setAddressQuery(event.target.value)}
                placeholder={addressTarget === 'start' ? '搜索上车点、城市、小区、学校或商圈' : '搜索目的地、城市、小区、学校或商圈'}
              />
            </label>
            <div className="address-history-tools">
              <button type="button" onClick={useCurrentLocation}><Locate size={14} />当前位置</button>
              <button type="button" disabled={!safeAddressBook.history.length} onClick={clearAddressHistory}><XCircle size={14} />清空历史</button>
              <span>{addressLoading ? '地图搜索中...' : `${safeAddressBook.favorites.length} 个收藏 · ${safeAddressBook.history.length} 条最近`}</span>
            </div>
            {addressError && <p className="address-search-error">{addressError}</p>}
            <div className="address-candidate-list">
              {addressCandidates.map((poi) => (
                <div className={`address-candidate-row ${poi.active ? 'active' : ''}`} key={poi.addressKey || getAddressKey(poi)}>
                  <button type="button" className="address-candidate-main" onClick={() => chooseAddressCandidate(poi)}>
                    <div>
                      <strong>{poi.name}</strong>
                      <small>{poi.address}</small>
                    </div>
                    <em>{addressTarget === 'start' ? '设为上车点' : '设为目的地'}</em>
                  </button>
                  <button
                    type="button"
                    className={`address-favorite-button ${poi.favorite ? 'active' : ''}`}
                    aria-label={poi.favorite ? '取消收藏地址' : '收藏地址'}
                    onClick={() => toggleAddressFavorite(poi)}
                  >
                    <Star size={14} />
                  </button>
                </div>
              ))}
              {!addressCandidates.length && (
                <div className="address-candidate-empty">
                  {addressLoading ? '正在搜索地图地址...' : addressQuery.trim() ? '没有匹配地址，换个关键词试试' : '输入关键词后显示地图候选地址'}
                </div>
              )}
            </div>
          </div>}
          <div className="booking-estimate-head">
            <div>
              <span>实时预估</span>
              <small>{route.start.name} → {route.end.name}</small>
            </div>
            <em>{selectedCarType?.seatText || '舒适出行'}</em>
          </div>
        </>
      )}
      <div className="fare-grid">
        <MiniStat label="距离" value={hasSyncedEstimate ? `${safeEstimate.distanceKm || route.distanceKm} km` : '待同步'} />
        <MiniStat label="时间" value={hasSyncedEstimate ? `${safeEstimate.durationMin || route.durationMin} min` : '待同步'} />
        <MiniStat label="网页签到" value={checkinDiscount > 0 ? `-${formatMoney(checkinDiscount)}` : '未使用'} />
      </div>
      {!isEmbedded && (
        <>
          <div className="car-card-strip">
            {carCards.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`booking-car-card ${item.selected ? 'is-selected' : ''}`}
                onClick={() => update({ carTypeId: Number(item.id) })}
              >
                <span className={`booking-car-thumb ${getCarTypeTierClass(item)}`} aria-hidden="true">
                  <CarTypeIcon carType={item} />
                </span>
                <span className="booking-car-copy">
                  <strong>{getCarTypeName(item)}</strong>
                  <small>{item.description || getCarTypeDescription(item)}</small>
                </span>
                <span className="booking-car-price">
                  {item.estimate ? formatMoney(item.payableAmount, item.estimate.currencyCode) : (item.selected ? '待同步' : '选中后试算')}
                  {item.selected && checkinDiscount > 0 && <small>网页专属已减 {formatMoney(checkinDiscount)}</small>}
                </span>
              </button>
            ))}
          </div>
          <div className="booking-fee-breakdown">
            <span><small>起步/时距</small>{hasSyncedEstimate ? formatMoney(safeEstimate.baseAmount || safeEstimate.amount, safeEstimate.currencyCode) : '待同步'}</span>
            <span><small>远途费</small>{hasSyncedEstimate ? formatMoney(safeEstimate.longDistanceSurchargeAmount || 0, safeEstimate.currencyCode) : '待同步'}</span>
            <span><small>预计支付</small>{hasSyncedEstimate ? formatMoney(payableAmount, safeEstimate.currencyCode) : '待同步'}</span>
          </div>
        </>
      )}
      <div className="booking-actions">
        {onEstimate && (
          <button className="ghost-button" disabled={busyAction === 'estimate'} onClick={() => runAction('estimate', onEstimate)}>
            <GaugeIcon />{busyAction === 'estimate' ? '试算中' : '重新试算'}
          </button>
        )}
        <MagneticButton className="solid-button fill" disabled={busyAction === 'primary' || !hasSyncedEstimate} onClick={() => runAction('primary', onPrimary)}>
          <Navigation size={17} />{busyAction === 'primary' ? '正在推进' : hasSyncedEstimate ? primaryText : '等待后端估价'}
        </MagneticButton>
      </div>
    </section>
  )
}

function ActiveRidePanel({ order, runtime, profile, onRefresh, onAction, onOpenSupport, pendingActionKey = '' }) {
  const copy = getRideStatusCopy(order)
  const timeline = normalizeTimeline(order)
  const canCancel = [ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus)
  const waitingForPickupArrival = order.orderStatus === ORDER_STATUS.PICKING_UP && !isPassengerPickupReady(runtime, order)
  const canPickup = order.orderStatus === ORDER_STATUS.PICKING_UP && !waitingForPickupArrival
  const canPay = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID
  const cancelBusy = isOrderActionPending(pendingActionKey, 'cancel', order)
  const pickupBusy = isOrderActionPending(pendingActionKey, 'pickup', order)
  const payBusy = isOrderActionPending(pendingActionKey, 'pay', order)
  const actionLocked = isAnyOrderActionPending(pendingActionKey, order)
  const isDispatching = [ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(order.orderStatus)
  const etaMinutes = Number(runtime?.etaMinutes || order.estimatedDurationMin || 8)
  const nearbyDrivers = Math.max(1, Math.min(12, Math.round((Number(order.estimatedDistanceKm || runtime?.distanceKm || 4) * 1.8) + 2)))
  const acceptMinutes = Math.max(2, Math.min(12, Math.round(etaMinutes / 2)))
  const rideProgress = getRideProgressPercent(order)
  const showSafetyCenter = () => {
    window.alert(`安全中心\n订单：${order.orderNo || `#${order.id}`}\n紧急联系人：${profile?.emergencyContact || '未设置'} ${profile?.emergencyPhone || ''}`.trim())
  }
  const showEmergencyContact = () => {
    const contactText = `${profile?.emergencyContact || '未设置'} ${profile?.emergencyPhone || ''}`.trim()
    window.alert(`紧急联系人\n${contactText || '暂未设置紧急联系人'}`)
  }

  return (
    <section className="active-ride-card glass-panel refract">
      <div className="active-ride-head">
        <div>
          <span className="section-kicker">行程状态</span>
          <h2>{copy.title}</h2>
          <p>{copy.desc}</p>
        </div>
        <StatusBadge value={order.orderStatus} />
      </div>
      {isDispatching && (
        <div className="dispatch-status-banner">
          <div className="dispatch-count-ring"><span>{Math.max(12, 60 - acceptMinutes * 4)}s</span></div>
          <div>
            <strong>智能派单中</strong>
            <small>系统正在把订单同步给附近空闲司机，接单后网页、后台和小程序会同步更新。</small>
          </div>
        </div>
      )}
      <div className="active-route-line">
        <div><span className="address-dot start" /><small>上车点</small><strong>{order.startName}</strong></div>
        <div><span className="address-dot end" /><small>目的地</small><strong>{order.endName}</strong></div>
      </div>
      <div className="active-ride-metrics">
        <MiniStat label={isDispatching ? '预计接单' : '预计接驾'} value={`${isDispatching ? acceptMinutes : etaMinutes} min`} />
        <MiniStat label={isDispatching ? '附近司机' : '行程距离'} value={isDispatching ? `${nearbyDrivers} 位` : `${runtime?.distanceKm || order.estimatedDistanceKm || '-'} km`} />
        <MiniStat label="订单金额" value={formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)} />
      </div>
      <div className="ride-progress-panel">
        <div className="ride-progress-head">
          <span>{isDispatching ? '派单进度' : '路线进度'}</span>
          <strong>{rideProgress}%</strong>
        </div>
        <div className="ride-progress-track"><i style={{ width: `${rideProgress}%` }} /></div>
        <p>{isDispatching ? '取消前请留意司机接单状态，派单成功后会进入接驾流程。' : '若车辆偏离既定路线，请优先使用安全中心或联系客服。'}</p>
      </div>
      <div className="active-driver-card">
        <CarTaxiFront size={20} />
        <div>
          <strong>{order.driverId ? '李师傅已接单' : '正在匹配附近司机'}</strong>
          <span>{order.driverId ? '车辆位置会随行程进度刷新' : '司机端听单大厅接单后这里会自动变化'}</span>
        </div>
      </div>
      <div className="active-safety-actions">
        <button type="button" onClick={showSafetyCenter}><ShieldCheck size={15} />安全中心</button>
        <button type="button" onClick={showEmergencyContact}><Phone size={15} />紧急联系人</button>
        <button type="button" onClick={onOpenSupport}><MessageSquare size={15} />联系客服</button>
      </div>
      <div className="active-timeline">
        {timeline.slice(0, 4).map((item, index) => (
          <span key={`${item.label}-${index}`} className={item.tone || 'waiting'}>{item.label}</span>
        ))}
      </div>
      <div className="active-ride-actions">
        <button className="ghost-button" onClick={onRefresh}><RefreshCw size={16} />刷新状态</button>
        {canCancel && <button className={`ghost-button${cancelBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('cancel')}><XCircle size={16} />{cancelBusy ? '处理中' : '取消订单'}</button>}
        {waitingForPickupArrival && <button className="ghost-button" disabled={actionLocked} onClick={onRefresh}><Navigation size={16} />司机未到达，刷新接驾状态</button>}
        {canPickup && <button className={`solid-button${pickupBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('pickup')}><Navigation size={16} />{pickupBusy ? '处理中' : '我已上车'}</button>}
        {canPay && <button className={`solid-button${payBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('pay')}><CreditCard size={16} />{payBusy ? '支付中' : '支付'}</button>}
      </div>
    </section>
  )
}

function ActiveMapSheet({ order, runtime, amount, currency, duration, distance }) {
  const copy = getRideStatusCopy(order)
  const timeline = normalizeTimeline(order)
  const amountText = amount === null || amount === undefined ? '待同步' : formatMoney(amount, currency)
  const etaText = runtime?.etaMinutes ?? duration
  const distanceText = distance === null || distance === undefined ? '待同步' : `${distance} km`
  return (
    <>
      <div className="active-map-sheet">
        <div className="active-map-sheet__head">
          <div>
            <span className="section-kicker">订单进度</span>
            <h3>{copy.title}</h3>
            <p>{copy.desc}</p>
          </div>
          <StatusBadge value={order.orderStatus} />
        </div>
        <div className="active-map-sheet__grid">
          <MiniStat label="订单号" value={order.orderNo || `#${order.id}`} />
          <MiniStat label="司机" value={order.driverId ? '已接单' : '待接单'} />
          <MiniStat label="预估费用" value={amountText} />
          <MiniStat label="ETA" value={etaText === null || etaText === undefined ? '待同步' : `${etaText} min`} />
        </div>
        <div className="active-map-sheet__line">
          <div><span className="address-dot start" /><small>从哪里出发</small><strong>{order.startName}</strong></div>
          <div><span className="address-dot end" /><small>去哪里</small><strong>{order.endName}</strong></div>
        </div>
        <div className="active-map-sheet__foot">
          <span><Clock size={14} />{order.updatedAt || order.createdAt || '-'}</span>
          <span><Route size={14} />{distanceText}</span>
        </div>
      </div>
      <div className="active-map-timeline">
        {timeline.slice(0, 5).map((item, index) => <span key={`${item.label}-${index}`} className={item.tone || 'waiting'}>{item.label}</span>)}
      </div>
    </>
  )
}

function pickActiveRideOrder(orders = []) {
  const candidates = normalizeList(orders)
    .filter((order) => {
      if (!order) return false
      if (order.serviceType === SERVICE_TYPE.CARPOOL) return false
      return [ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus) ||
        (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID)
    })
    .sort((left, right) => {
      const rightTime = Date.parse(String(right.updatedAt || right.createdAt || '').replace(' ', 'T')) || Number(right.id || 0)
      const leftTime = Date.parse(String(left.updatedAt || left.createdAt || '').replace(' ', 'T')) || Number(left.id || 0)
      return rightTime - leftTime
    })
  return candidates[0] || null
}

function buildRouteFromOrder(order = {}) {
  const start = {
    name: order.startName || '上车点',
    latitude: Number(order.startLat || order.startLatitude || order.latitude || 0),
    longitude: Number(order.startLng || order.startLongitude || order.longitude || 0)
  }
  const end = {
    name: order.endName || '目的地',
    latitude: Number(order.endLat || order.endLatitude || 0),
    longitude: Number(order.endLng || order.endLongitude || 0)
  }
  return {
    start,
    end,
    distanceKm: Number(order.actualDistanceKm || order.estimatedDistanceKm || 1.2),
    durationMin: Number(order.actualDurationMin || order.estimatedDurationMin || 8)
  }
}

function buildEstimateFromOrder(order = {}, route = {}) {
  return {
    distanceKm: Number(order.actualDistanceKm || order.estimatedDistanceKm || route.distanceKm || 1.2),
    durationMin: Number(order.actualDurationMin || order.estimatedDurationMin || route.durationMin || 8),
    amount: Number(order.payableAmount || order.actualAmount || order.estimatedAmount || 0),
    currencyCode: order.currencyCode || 'CNY'
  }
}

function getRideStatusCopy(order = {}) {
  const map = {
    [ORDER_STATUS.DISPATCHING]: {
      title: '正在为你呼叫附近司机',
      desc: '订单已提交，司机端听单大厅可实时接单。',
      mapLabel: '智能派单中'
    },
    [ORDER_STATUS.ACCEPTED]: {
      title: '司机已接单',
      desc: '司机车辆位置将按订单状态持续更新。',
      mapLabel: '司机已接单'
    },
    [ORDER_STATUS.PICKING_UP]: {
      title: '司机接驾中',
      desc: '请在上车点等待，确认上车后行程会进入进行中。',
      mapLabel: '司机接驾中'
    },
    [ORDER_STATUS.IN_TRIP]: {
      title: '行程进行中',
      desc: '路线和预计到达时间会跟随订单状态刷新。',
      mapLabel: '行程进行中'
    },
    [ORDER_STATUS.FINISHED]: {
      title: '行程已结束',
      desc: '请完成支付，订单状态会在多端更新。',
      mapLabel: '待支付'
    }
  }
  return map[order.orderStatus] || {
    title: statusLabel[order.orderStatus] || '订单处理中',
    desc: '正在读取订单状态。',
    mapLabel: statusLabel[order.orderStatus] || '订单进度'
  }
}

function normalizeTimeline(order = {}) {
  const source = Array.isArray(order.timeline) && order.timeline.length
    ? order.timeline
    : [{ label: getRideStatusCopy(order).mapLabel, tone: statusTone[order.orderStatus] || 'waiting' }]
  return source.map((item) => ({
    label: item.label || item.title || '-',
    tone: item.tone || statusTone[order.orderStatus] || 'waiting'
  }))
}

function CityMap({ booking, estimate, compact = false, operational = true, activeOrder = null, runtime = null, bookingPanel = null, preferStableMap = false, showSummaryPanel = true }) {
  const tilt = useTiltCard({ maxX: 6, maxY: 9 })
  const route = activeOrder ? buildRouteFromOrder(activeOrder) : calcRoute(booking.startPoint || booking.startId, booking.endPoint || booking.endId)
  const syncedEstimate = activeOrder ? buildEstimateFromOrder(activeOrder, route) : estimate
  const hasSyncedTripData = Boolean(activeOrder || estimate)
  const amount = hasSyncedTripData ? Number(syncedEstimate?.amount ?? syncedEstimate?.payableAmount ?? 0) : null
  const duration = runtime?.etaMinutes ?? (hasSyncedTripData ? (syncedEstimate?.durationMin ?? route.durationMin) : null)
  const distance = runtime?.distanceKm ?? (hasSyncedTripData ? (syncedEstimate?.distanceKm ?? route.distanceKm) : null)
  const currency = activeOrder?.currencyCode || estimate?.currencyCode || syncedEstimate?.currencyCode || 'CNY'
  const amountText = amount === null ? '待同步' : formatMoney(amount, currency)
  const durationText = duration === null ? '待同步' : `${duration} min`
  const distanceText = distance === null ? '待同步' : `${distance} km`
  const mapStateText = activeOrder ? getRideStatusCopy(activeOrder).mapLabel : '等待提交订单'
  const trees = Array.from({ length: 8 }, (_, index) => ({
    left: `${index * 15 - 8}%`,
    scale: 0.78 + (index % 3) * 0.08,
    delay: `${index * -0.48}s`
  }))
  const buildings = Array.from({ length: 9 }, (_, index) => ({
    left: `${index * 13 - 7}%`,
    scale: 0.82 + [0.12, 0.36, 0.02, 0.52, 0.22, 0.44][index % 6],
    delay: `${index * -0.38}s`,
    variant: index % 6
  }))
  const mapCardClassName = `city-map map-card-v2 glass-panel ${operational ? '' : 'tilt-card'} ${compact ? 'compact' : ''} ${operational ? 'operational-map' : ''} ${bookingPanel ? 'has-booking-panel' : ''} ${showSummaryPanel ? '' : 'map-only'}`.replace(/\s+/g, ' ').trim()
  const tiltProps = operational
    ? {}
    : {
        ref: tilt.ref,
        onPointerMove: tilt.onPointerMove,
        onPointerLeave: tilt.onPointerLeave
      }

  return (
    <section className={mapCardClassName} {...tiltProps}>
      <div className="map-topline map-header-v2">
        <div>
          <span><MapPin size={15} />{route.start.name}</span>
          <small>{operational ? '腾讯地图' : '实时调度地图'}</small>
        </div>
          {showSummaryPanel && <strong>{amountText}</strong>}
      </div>
      {operational ? (
          <TencentRouteMapV2 route={route} amount={amount} currency={currency} duration={duration} distance={distance} serviceType={activeOrder?.serviceType || booking.serviceType} order={activeOrder} runtime={runtime} showSummaryPanel={!bookingPanel && showSummaryPanel} preferStableMap={preferStableMap} />
      ) : (
      <div className="map-canvas map-canvas-v2">
        <div className="map-road-net" aria-hidden="true">
          <span className="road-a" />
          <span className="road-b" />
          <span className="road-c" />
          <span className="road-d" />
          <span className="road-e" />
        </div>
        {!operational && <div className="side-drive-scene" aria-hidden="true">
          <div className="city-strip back">
            {buildings.map((building, index) => <span key={`back-${index}`} className={`tower-${building.variant}`} style={{ '--tree-x': building.left, '--tree-scale': building.scale, '--tree-delay': building.delay }} />)}
          </div>
          <div className="side-road-surface">
            <span className="road-edge top" />
            <span className="road-edge bottom" />
            <span className="road-lane-line" />
            <span className="road-speed-line a" />
            <span className="road-speed-line b" />
          </div>
          <div className="tree-strip front">
            {trees.map((tree, index) => <span key={`front-${index}`} style={{ '--tree-x': `${index * 13 - 18}%`, '--tree-scale': 0.82 + (index % 3) * 0.08, '--tree-delay': `${index * -0.5}s` }} />)}
          </div>
        </div>}
        <svg className="route-svg-v2" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="route-road-shadow" d="M9 56 L91 56" />
          <path className="route-road-bed" d="M9 56 L91 56" />
          <path className="route-road-lane" d="M9 56 L91 56" />
          <path className="route-shadow-path" d="M9 56 L91 56" />
          <path className="route-main-path" d="M9 56 L91 56" />
          <path className="route-glow-path" d="M9 56 L91 56" />
        </svg>
        <div className="map-pin-v2 start">
          <span><MapPin size={17} /></span>
          <small>上车点</small>
          <strong>{route.start.name}</strong>
        </div>
        <div className="map-pin-v2 end">
          <span><Flag size={17} /></span>
          <small>目的地</small>
          <strong>{route.end.name}</strong>
        </div>
        {!operational && <div className="map-live-taxi" aria-hidden="true">
          <div className="mini-taxi mini-taxi-v2">
            <span className="taxi-light" />
            <span className="taxi-body" />
            <span className="taxi-exhaust" />
            <span className="wheel left" />
            <span className="wheel right" />
          </div>
        </div>}
        <div className="eta-bubble glass-panel eta-bubble-v2">
          <strong>{durationText}</strong>
          <span>{operational ? '预计行程' : '司机靠近中'}</span>
        </div>
        <div className="map-route-sheet glass-panel">
          <span><Navigation size={15} />{operational ? mapStateText : '智能派单'}</span>
          <strong>{distanceText}</strong>
          <small>{statusLabel[booking.serviceType]} · {currency}</small>
        </div>
      </div>
      )}
      {bookingPanel && <div className="map-booking-panel">{bookingPanel}</div>}
      <div className="map-bottomline">
        <span><Clock size={15} />预计 {duration === null ? '待同步' : `${duration} 分钟`}</span>
        <span><Route size={15} />{distanceText}</span>
      </div>
    </section>
  )
}

function TencentRouteMapV2({ route, amount, currency, duration, distance, serviceType, order = null, runtime = null, showSummaryPanel = true, preferStableMap = false }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [scriptFailed, setScriptFailed] = useState(false)
  const [routePoints, setRoutePoints] = useState([])
  const start = route.start
  const end = route.end
  const mapKey = getTencentMapKey()

  useEffect(() => {
    if (!mapKey) return
    if (window.TMap?.Map) {
      setScriptReady(true)
      return
    }
    const existing = document.querySelector('script[data-sunshine-tencent-map]')
    if (existing) {
      existing.addEventListener('load', () => setScriptReady(true), { once: true })
      return
    }
    const script = document.createElement('script')
    script.dataset.sunshineTencentMap = 'true'
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(mapKey)}`
    script.async = true
    script.onload = () => setScriptReady(true)
    script.onerror = () => setScriptFailed(true)
    document.head.appendChild(script)
  }, [mapKey])

  useEffect(() => {
    let cancelled = false
    const syncRoute = async () => {
      const points = await fetchTencentDrivingRoute(start, end, mapKey)
      if (!cancelled) setRoutePoints(points)
    }
    if (mapKey) syncRoute()
    else setRoutePoints([])
    return () => {
      cancelled = true
    }
  }, [start, end, mapKey])

  useEffect(() => {
    if (!scriptReady || !mapRef.current || !window.TMap?.Map) return
    const TMap = window.TMap
    const startPoint = new TMap.LatLng(start.latitude, start.longitude)
    const endPoint = new TMap.LatLng(end.latitude, end.longitude)
    const center = new TMap.LatLng((start.latitude + end.latitude) / 2, (start.longitude + end.longitude) / 2)
    mapRef.current.innerHTML = ''
    const map = new TMap.Map(mapRef.current, {
      center,
      zoom: 14,
      pitch: 0,
      rotation: 0,
      showControl: false,
      baseMap: {
        type: 'vector',
        features: ['base', 'building2d', 'label']
      }
    })
    mapInstanceRef.current = map

    const renderRouteSource = mergeRouteEndpoints(
      routePoints.length ? routePoints : (runtime?.route?.length ? runtime.route : [start, end]),
      start,
      end
    )
    const renderRoute = renderRouteSource
      .map((point) => new TMap.LatLng(Number(point.latitude), Number(point.longitude)))

    const routeLayer = new TMap.MultiPolyline({
      map,
      styles: {
        route: new TMap.PolylineStyle({
          color: '#1596c7',
          width: 6,
          borderWidth: 4,
          borderColor: '#ffffff',
          lineCap: 'round'
        })
      },
      geometries: [{
        id: 'route',
        styleId: 'route',
        paths: renderRoute
      }]
    })

    const geometries = [{
      id: 'start',
      styleId: 'start',
      position: startPoint
    }, {
      id: 'end',
      styleId: 'end',
      position: endPoint
    }]
    if (runtime?.driverLocation) {
      geometries.push({
        id: 'driver',
        styleId: 'driver',
        position: new TMap.LatLng(runtime.driverLocation.latitude, runtime.driverLocation.longitude)
      })
    }
    const markerLayer = new TMap.MultiMarker({
      map,
      styles: {
        start: new TMap.MarkerStyle({
          width: 28,
          height: 36,
          anchor: { x: 14, y: 32 },
          src: '/assets/map-start.png'
        }),
        end: new TMap.MarkerStyle({
          width: 28,
          height: 36,
          anchor: { x: 14, y: 32 },
          src: '/assets/map-end.png'
        }),
        driver: new TMap.MarkerStyle({
          width: 30,
          height: 30,
          anchor: { x: 15, y: 15 },
          src: '/assets/map-driver.png'
        })
      },
      geometries
    })

    if (TMap.LatLngBounds) {
      const source = renderRouteSource
      const latitudes = source.map((point) => Number(point.latitude))
      const longitudes = source.map((point) => Number(point.longitude))
      const southWest = new TMap.LatLng(Math.min(...latitudes), Math.min(...longitudes))
      const northEast = new TMap.LatLng(Math.max(...latitudes), Math.max(...longitudes))
      const bounds = new TMap.LatLngBounds(southWest, northEast)
      if (typeof map.fitBounds === 'function') {
        map.fitBounds(bounds)
      }
    }

    return () => {
      if (typeof markerLayer.setMap === 'function') markerLayer.setMap(null)
      if (typeof routeLayer.setMap === 'function') routeLayer.setMap(null)
      if (typeof map.destroy === 'function') map.destroy()
      if (mapInstanceRef.current === map) mapInstanceRef.current = null
    }
  }, [scriptReady, start, end, runtime?.driverLocation, runtime?.route, routePoints])

  const useNativeMap = Boolean(!preferStableMap && mapKey && scriptReady && !scriptFailed && window.TMap?.Map)
  const mapSourceLabel = useNativeMap ? '腾讯地图' : (preferStableMap ? '腾讯地图路线' : '地图加载中')
  const amountText = amount === null || amount === undefined ? '待同步' : formatMoney(amount, currency)
  const distanceText = distance === null || distance === undefined ? '待同步' : `${distance} km`
  const durationText = duration === null || duration === undefined ? '待同步' : `${duration} min`

  return (
    <div className="miniapp-sync-shell">
      <div className="miniapp-sync-map">
        {(!useNativeMap || preferStableMap) && <RealTileRouteMap route={route} runtime={runtime} order={order} routePoints={routePoints} />}
        {mapKey && <div className={`tencent-map-canvas miniapp-map-native ${useNativeMap ? 'is-ready' : ''}`} ref={mapRef} />}
        <div className="miniapp-sync-brand">
          <strong>阳光出行</strong>
          <span>{mapSourceLabel}</span>
        </div>
      </div>
      {showSummaryPanel && (
        <div className="miniapp-sync-panel">
          {order ? (
            <ActiveMapSheet order={order} runtime={runtime} amount={amount} currency={currency} duration={duration} distance={distance} />
          ) : (
            <>
              <div className="miniapp-sync-tabs">
                {Object.values(SERVICE_TYPE).map((type) => (
                  <button key={type} className={serviceType === type ? 'active' : ''}>
                    <ServiceIcon type={type} className="miniapp-service-icon" />
                    <span>{serviceShortLabel[type]}</span>
                  </button>
                ))}
              </div>
              <div className="miniapp-sync-addresses">
                <div><span className="address-dot start" /><small>从哪里出发</small><strong>{start.name}</strong></div>
                <div><span className="address-dot end" /><small>去哪里</small><strong>{end.name}</strong></div>
              </div>
              <div className="miniapp-sync-metrics">
                <MiniStat label="预估" value={amountText} />
                <MiniStat label="距离" value={distanceText} />
                <MiniStat label="时间" value={durationText} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TencentRouteMap({ route, amount, currency, duration, distance, serviceType }) {
  const mapRef = useRef(null)
  const [scriptReady, setScriptReady] = useState(false)
  const start = route.start
  const end = route.end
  const mapKey = getTencentMapKey()
  const amountText = amount === null || amount === undefined ? '待同步' : formatMoney(amount, currency)
  const distanceText = distance === null || distance === undefined ? '待同步' : `${distance} km`
  const durationText = duration === null || duration === undefined ? '待同步' : `${duration} min`

  useEffect(() => {
    if (!mapKey) return
    if (window.qq?.maps) {
      setScriptReady(true)
      return
    }
    const existing = document.querySelector('script[data-sunshine-tencent-map]')
    if (existing) {
      existing.addEventListener('load', () => setScriptReady(true), { once: true })
      return
    }
    const script = document.createElement('script')
    script.dataset.sunshineTencentMap = 'true'
    script.src = `https://map.qq.com/api/js?v=2.exp&key=${encodeURIComponent(mapKey)}`
    script.async = true
    script.onload = () => setScriptReady(true)
    document.head.appendChild(script)
  }, [mapKey])

  useEffect(() => {
    if (!scriptReady || !mapRef.current || !window.qq?.maps) return
    const qq = window.qq
    const startPoint = new qq.maps.LatLng(start.latitude, start.longitude)
    const endPoint = new qq.maps.LatLng(end.latitude, end.longitude)
    const center = new qq.maps.LatLng((start.latitude + end.latitude) / 2, (start.longitude + end.longitude) / 2)
    const map = new qq.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      mapTypeId: qq.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false
    })
    new qq.maps.Marker({ map, position: startPoint, title: start.name })
    new qq.maps.Marker({ map, position: endPoint, title: end.name })
    new qq.maps.Polyline({
      map,
      path: [startPoint, endPoint],
      strokeColor: '#ff7a00',
      strokeWeight: 5,
      strokeDashStyle: 'solid'
    })
  }, [scriptReady, start, end])

  return (
    <div className="tencent-map-shell miniapp-map-shell">
      {mapKey ? <div className="tencent-map-canvas miniapp-map-native" ref={mapRef} /> : <MiniappRouteMap route={route} />}
      <div className="miniapp-map-brand">
        <strong>阳光出行</strong>
        <span>腾讯地图</span>
      </div>
      <div className="miniapp-ride-panel">
        <div className="service-tabs miniapp-tabs">
          {Object.values(SERVICE_TYPE).map((type) => (
            <button key={type} className={serviceType === type ? 'active' : ''}>
              <ServiceIcon type={type} className="miniapp-service-icon" />
              <span>{serviceShortLabel[type]}</span>
            </button>
          ))}
        </div>
        <div className="miniapp-address-stack">
          <div><span className="address-dot start" /><small>从哪里出发</small><strong>{start.name}</strong></div>
          <div><span className="address-dot end" /><small>去哪里</small><strong>{end.name}</strong></div>
        </div>
        <div className="miniapp-estimate-row">
          <MiniStat label="预估" value={amountText} />
          <MiniStat label="距离" value={distanceText} />
          <MiniStat label="时间" value={durationText} />
        </div>
      </div>
    </div>
  )
}

function MiniappRouteMap({ route }) {
  return <RealTileRouteMap route={route} />
}

function RealTileRouteMap({ route, runtime = null, order = null, routePoints = [] }) {
  const start = route.start
  const end = route.end
  const geometry = buildTileMapGeometry(start, end, routePoints)
  const driver = runtime?.driverLocation ? projectPointIntoGeometry(runtime.driverLocation, geometry) : null
  return (
    <div className="miniapp-map-fallback real-map-fallback">
      <div className="real-map-tiles" aria-hidden="true">
        {geometry.tiles.map((tile) => (
          <MapTileImage
            key={`${tile.x}-${tile.y}`}
            tile={tile}
          />
        ))}
      </div>
      <div className="real-map-soften" />
      <svg className="real-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="real-map-route-shadow" d={geometry.routePath} />
        <path className="real-map-route-line" d={geometry.routePath} />
      </svg>
      <div className="real-map-label school-road">学院大街</div>
      <div className="real-map-label sanhe-road">三河妇幼</div>
      <div className="real-map-pin start" style={{ left: `${geometry.start.x}%`, top: `${geometry.start.y}%` }}>
        <span>起</span><strong>{start.name}</strong>
      </div>
      <div className="real-map-pin end" style={{ left: `${geometry.end.x}%`, top: `${geometry.end.y}%` }}>
        <span>终</span><strong>{end.name}</strong>
      </div>
      {driver && (
        <div className="real-map-driver" style={{ left: `${driver.x}%`, top: `${driver.y}%` }}>
          <span><CarTaxiFront size={14} /></span>
          <strong>{order?.driverId ? '司机位置' : '附近司机'}</strong>
        </div>
      )}
      <div className="real-map-scale"><i />100 米</div>
    </div>
  )
}

function MapTileImage({ tile }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)
  const style = {
    left: `${tile.left}%`,
    top: `${tile.top}%`,
    width: `${tile.size}%`,
    height: `${tile.height}%`
  }

  if (exhausted) return <span className="real-map-tile-fallback" style={style} aria-hidden="true" />

  return (
    <img
      src={tile.urls[sourceIndex]}
      alt=""
      draggable="false"
      decoding="async"
      loading="eager"
      referrerPolicy="no-referrer"
      style={style}
      onError={() => {
        if (sourceIndex < tile.urls.length - 1) {
          setSourceIndex((value) => value + 1)
        } else {
          setExhausted(true)
        }
      }}
    />
  )
}

function buildTileMapGeometry(start, end, routePoints = []) {
  const effectiveRoute = Array.isArray(routePoints) && routePoints.length ? routePoints : [start, end]
  const distance = haversineForMap(start.latitude, start.longitude, end.latitude, end.longitude)
  const zoom = distance > 12 ? 12 : distance > 5 ? 13 : distance > 2 ? 14 : 16
  const width = 920
  const height = 390
  const projectedRoute = effectiveRoute.map((point) => projectMapPoint(point.latitude, point.longitude, zoom))
  const startPixel = projectMapPoint(start.latitude, start.longitude, zoom)
  const endPixel = projectMapPoint(end.latitude, end.longitude, zoom)
  const center = {
    x: projectedRoute.reduce((sum, point) => sum + point.x, 0) / projectedRoute.length,
    y: projectedRoute.reduce((sum, point) => sum + point.y, 0) / projectedRoute.length
  }
  const left = center.x - width / 2
  const top = center.y - height / 2
  const right = left + width
  const bottom = top + height
  const startTileX = Math.floor(left / 256) - 1
  const endTileX = Math.floor(right / 256) + 1
  const startTileY = Math.floor(top / 256) - 1
  const endTileY = Math.floor(bottom / 256) + 1
  const maxTile = 2 ** zoom
  const tiles = []

  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      if (y < 0 || y >= maxTile) continue
      const wrappedX = ((x % maxTile) + maxTile) % maxTile
      tiles.push({
        x: wrappedX,
        y,
        urls: buildTileUrls(zoom, wrappedX, y),
        left: ((x * 256 - left) / width) * 100,
        top: ((y * 256 - top) / height) * 100,
        size: (256 / width) * 100,
        height: (256 / height) * 100
      })
    }
  }

  const startPct = pixelToMapPct(startPixel, left, top, width, height)
  const endPct = pixelToMapPct(endPixel, left, top, width, height)
  const routePct = projectedRoute.map((point) => pixelToMapPct(point, left, top, width, height))
  const routePath = routePct.reduce((path, point, index) => {
    const prefix = index === 0 ? 'M' : 'L'
    return `${path}${index ? ' ' : ''}${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')

  return {
    zoom,
    left,
    top,
    width,
    height,
    tiles,
    start: startPct,
    end: endPct,
    routePath
  }
}

function buildTileUrls(zoom, x, y) {
  return [
    `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    `https://b.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    `https://c.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    `https://a.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`,
    `https://b.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`,
    `https://c.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`
  ]
}

async function fetchTencentDrivingRoute(start, end, mapKey) {
  if (!mapKey || !start || !end) return []
  try {
    const from = `${Number(start.latitude)},${Number(start.longitude)}`
    const to = `${Number(end.latitude)},${Number(end.longitude)}`
    const response = await fetch(`/__tencent_map__/ws/direction/v1/driving/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&key=${encodeURIComponent(mapKey)}&output=json`)
    if (!response.ok) return []
    const payload = await response.json()
    const route = payload?.result?.routes?.[0]
    if (!route?.polyline?.length) return []
    return decodeTencentPolyline(route.polyline)
  } catch (error) {
    return []
  }
}

function mergeRouteEndpoints(points = [], start, end) {
  const source = Array.isArray(points) ? points
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude)
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    : []

  const startPoint = {
    latitude: Number(start?.latitude),
    longitude: Number(start?.longitude)
  }
  const endPoint = {
    latitude: Number(end?.latitude),
    longitude: Number(end?.longitude)
  }

  if (!Number.isFinite(startPoint.latitude) || !Number.isFinite(startPoint.longitude) || !Number.isFinite(endPoint.latitude) || !Number.isFinite(endPoint.longitude)) {
    return source
  }

  if (!source.length) return [startPoint, endPoint]

  const merged = source.slice()
  if (!sameLatLng(merged[0], startPoint)) merged.unshift(startPoint)
  if (!sameLatLng(merged[merged.length - 1], endPoint)) merged.push(endPoint)
  return merged
}

function sameLatLng(a, b, threshold = 0.00008) {
  if (!a || !b) return false
  return Math.abs(Number(a.latitude) - Number(b.latitude)) <= threshold &&
    Math.abs(Number(a.longitude) - Number(b.longitude)) <= threshold
}

function decodeTencentPolyline(polyline = []) {
  const values = Array.isArray(polyline) ? polyline.slice() : []
  if (values.length < 4) return []
  for (let index = 2; index < values.length; index += 1) {
    values[index] = Number(values[index - 2]) + Number(values[index]) / 1000000
  }
  const points = []
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({
      latitude: values[index],
      longitude: values[index + 1]
    })
  }
  return points
}

function projectPointIntoGeometry(point, geometry) {
  if (!point || !geometry) return null
  const projected = projectMapPoint(point.latitude, point.longitude, geometry.zoom)
  return pixelToMapPct(projected, geometry.left, geometry.top, geometry.width, geometry.height)
}

function pixelToMapPct(point, left, top, width, height) {
  return {
    x: Math.max(8, Math.min(92, ((point.x - left) / width) * 100)),
    y: Math.max(14, Math.min(82, ((point.y - top) / height) * 100))
  }
}

function projectMapPoint(latitude, longitude, zoom) {
  const size = 256 * 2 ** zoom
  const sinLat = Math.sin((Number(latitude) * Math.PI) / 180)
  return {
    x: ((Number(longitude) + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size
  }
}

function haversineForMap(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (Number(value) * Math.PI) / 180
  const radius = 6371
  const dLat = toRad(lat2) - toRad(lat1)
  const dLon = toRad(lon2) - toRad(lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getTencentMapKey() {
  try {
    return import.meta.env?.VITE_TENCENT_MAP_KEY || localStorage.getItem('sunshine-tencent-map-key') || DEFAULT_TENCENT_MAP_KEY
  } catch (error) {
    return import.meta.env?.VITE_TENCENT_MAP_KEY || DEFAULT_TENCENT_MAP_KEY
  }
}

function SunshineMotionLogoLegacy({ className = '' }) {
  const rootClassName = ['sunshine-motion-logo', className].filter(Boolean).join(' ')
  const sunPath = 'M126 287 C116 188 177 115 263 115 C350 115 410 188 400 287 Z'
  const rayLayers = [
    { id: 'ray-1', d: 'M128 210 L66 199', strokeWidth: 42 },
    { id: 'ray-2', d: 'M151 140 L98 102', strokeWidth: 38 },
    { id: 'ray-3', d: 'M199 98 L164 40', strokeWidth: 38 },
    { id: 'ray-4', d: 'M270 91 L270 24', strokeWidth: 38 },
    { id: 'ray-5', d: 'M341 98 L377 40', strokeWidth: 38 },
    { id: 'ray-6', d: 'M389 140 L452 101', strokeWidth: 38 },
    { id: 'ray-7', d: 'M409 210 L490 198', strokeWidth: 42 }
  ]
  const wordLayers = [
    { id: 'word-1', char: '阳', x: 518, y: 258 },
    { id: 'word-2', char: '光', x: 612, y: 258 },
    { id: 'word-3', char: '出', x: 706, y: 258 },
    { id: 'word-4', char: '行', x: 803, y: 258 }
  ]

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__p2mReady = true
    }
  }, [])

  return (
    <span id="logo-root" className={rootClassName} role="img" aria-label="阳光出行">
      <svg
        className="sunshine-motion-logo__svg"
        viewBox="0 0 1206 463"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="sunshineMotionSunGradient" cx="34%" cy="28%" r="76%">
            <stop offset="0%" stopColor="#ffc321" />
            <stop offset="54%" stopColor="#ffab10" />
            <stop offset="100%" stopColor="#ff8f05" />
          </radialGradient>
          <linearGradient id="sunshineMotionTextGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff9f12" />
            <stop offset="56%" stopColor="#ff8c07" />
            <stop offset="100%" stopColor="#ff7a00" />
          </linearGradient>
          <clipPath id="sunshineMotionSunClip" clipPathUnits="userSpaceOnUse">
            <path d={sunPath} />
          </clipPath>
          <mask id="sunshineMotionSunRiseMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <rect className="sunshine-motion-logo__sun-rise-clip" x="118" y="114" width="290" height="174" fill="#fff" />
          </mask>
          <mask id="sunshineMotionRoadInnerMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path
              className="sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--road-inner"
              d="M201 413 C253 337 344 315 518 353"
              pathLength="1"
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="104"
            />
          </mask>
          <mask id="sunshineMotionRoadOuterMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path
              className="sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--road-outer"
              d="M23 362 C94 313 194 286 333 288 C402 289 463 301 529 318"
              pathLength="1"
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="128"
            />
          </mask>
          {rayLayers.map((ray) => (
            <mask key={ray.id} id={`sunshineMotionMask-${ray.id}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <rect width="1206" height="463" fill="#000" />
              <path
                className={`sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--${ray.id}`}
                d={ray.d}
                pathLength="1"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={ray.strokeWidth}
              />
            </mask>
          ))}
          <mask id="sunshineMotionTaglineMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <rect x="514" y="319" width="686" height="86" rx="3" fill="#fff" />
          </mask>
          <mask id="sunshineMotionCarSoftMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path d="M154 187 H379 C397 187 410 200 410 219 V306 H132 V226 C132 202 145 187 154 187 Z" fill="#fff" />
          </mask>
          <mask id="sunshineMotionCarBodyMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path d="M170 282 C188 236 202 215 219 212 C247 207 295 207 318 212 C337 216 350 238 366 282 C322 296 214 296 170 282 Z" fill="#fff" />
          </mask>
          <mask id="sunshineMotionCarCabinMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path d="M198 239 C208 216 218 207 238 206 H300 C320 207 331 217 341 240 Z" fill="#fff" />
          </mask>
          <mask id="sunshineMotionCarLightsMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <path d="M174 235 H186 M350 235 H363" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="28" />
          </mask>
        </defs>
        <g className="sunshine-motion-logo__stack">
          <circle
            className="sunshine-motion-logo__sun-core"
            cx="263"
            cy="252"
            r="139"
            fill="url(#sunshineMotionSunGradient)"
            clipPath="url(#sunshineMotionSunClip)"
            mask="url(#sunshineMotionSunRiseMask)"
          />
          {rayLayers.map((ray) => (
            <image
              key={ray.id}
              className={`sunshine-motion-logo__layer sunshine-motion-logo__layer--${ray.id}`}
              href={sunshineLogo}
              width="1206"
              height="463"
              mask={`url(#sunshineMotionMask-${ray.id})`}
            />
          ))}
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--road-inner" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionRoadInnerMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--road-outer" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionRoadOuterMask)" />
          {wordLayers.map((word) => (
            <text
              key={word.id}
              className={`sunshine-motion-logo__layer sunshine-motion-logo__layer--${word.id} sunshine-motion-logo__word`}
              x={word.x}
              y={word.y}
              fill="url(#sunshineMotionTextGradient)"
            >
              {word.char}
            </text>
          ))}
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--tagline" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionTaglineMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--car-soft" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionCarSoftMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--car-body" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionCarBodyMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--car-cabin" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionCarCabinMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--car-lights" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionCarLightsMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--final" href={sunshineLogo} width="1206" height="463" />
        </g>
      </svg>
    </span>
  )
}

function SunshineMotionLogo({ className = '' }) {
  const motionDurationMs = 2500
  const sunPath = 'M126 287 C116 188 177 115 263 115 C350 115 410 188 400 287 Z'
  const rayLayers = [
    { id: 'ray-1', d: 'M128 210 L66 199', strokeWidth: 42 },
    { id: 'ray-2', d: 'M151 140 L98 102', strokeWidth: 38 },
    { id: 'ray-3', d: 'M199 98 L164 40', strokeWidth: 38 },
    { id: 'ray-4', d: 'M270 91 L270 24', strokeWidth: 38 },
    { id: 'ray-5', d: 'M341 98 L377 40', strokeWidth: 38 },
    { id: 'ray-6', d: 'M389 140 L452 101', strokeWidth: 38 },
    { id: 'ray-7', d: 'M409 210 L490 198', strokeWidth: 42 }
  ]
  const wordLayers = [
    { id: 'word-1', x: 520, y: 164, width: 176, height: 174 },
    { id: 'word-2', x: 700, y: 164, width: 160, height: 172 },
    { id: 'word-3', x: 864, y: 164, width: 154, height: 172 },
    { id: 'word-4', x: 1018, y: 164, width: 170, height: 176 }
  ]
  const { hasSeek, seekMs } = useMemo(() => {
    if (typeof window === 'undefined') return { hasSeek: false, seekMs: 0 }
    const params = new URLSearchParams(window.location.search)
    const staticMode = params.get('static') === '1'
    const rawSeek = Number(params.get('t') || '0')
    const boundedSeek = Number.isFinite(rawSeek) ? Math.max(0, Math.min(motionDurationMs, rawSeek)) : 0
    return {
      hasSeek: staticMode || params.has('t'),
      seekMs: staticMode ? motionDurationMs : boundedSeek
    }
  }, [])
  const rootClassName = ['sunshine-motion-logo', className, hasSeek ? 'is-seeking' : ''].filter(Boolean).join(' ')
  const rootStyle = useMemo(() => ({
    '--sunshine-logo-motion-duration': `${motionDurationMs}ms`,
    '--sunshine-logo-motion-seek': `${seekMs}ms`
  }), [motionDurationMs, seekMs])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__p2mReady = true
    }
  }, [])

  return (
    <span id="logo-root" className={rootClassName} style={rootStyle} role="img" aria-label="阳光出行">
      <svg
        className="sunshine-motion-logo__svg"
        viewBox="0 0 1206 463"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="sunshineMotionSunGradient" cx="34%" cy="28%" r="76%">
            <stop offset="0%" stopColor="#ffc321" />
            <stop offset="54%" stopColor="#ffab10" />
            <stop offset="100%" stopColor="#ff8f05" />
          </radialGradient>
          <clipPath id="sunshineMotionSunClip" clipPathUnits="userSpaceOnUse">
            <path d={sunPath} />
          </clipPath>
          <mask id="sunshineMotionSunRiseMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            <rect className="sunshine-motion-logo__sun-rise-clip" x="110" y="118" width="312" height="180" fill="#fff" />
          </mask>
          <mask id="sunshineMotionRevealMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="1206" height="463" fill="#000" />
            {rayLayers.map((ray) => (
              <path
                key={ray.id}
                className={`sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--${ray.id}`}
                d={ray.d}
                pathLength="1"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={ray.strokeWidth}
              />
            ))}
            <path
              className="sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--road-outer"
              d="M23 362 C94 313 194 286 333 288 C402 289 463 301 529 318"
              pathLength="1"
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="128"
            />
            <path
              className="sunshine-motion-logo__mask-stroke sunshine-motion-logo__mask-stroke--road-inner"
              d="M201 413 C253 337 344 315 518 353"
              pathLength="1"
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="104"
            />
            {wordLayers.map((word) => (
              <rect
                key={word.id}
                className={`sunshine-motion-logo__mask-word sunshine-motion-logo__mask-word--${word.id}`}
                x={word.x}
                y={word.y}
                width={word.width}
                height={word.height}
                rx="4"
                fill="#fff"
              />
            ))}
            <rect
              className="sunshine-motion-logo__mask-word sunshine-motion-logo__mask-word--tagline"
              x="514"
              y="319"
              width="686"
              height="86"
              rx="3"
              fill="#fff"
            />
            <path
              className="sunshine-motion-logo__mask-car-part sunshine-motion-logo__mask-car-part--car-soft"
              d="M154 187 H379 C397 187 410 200 410 219 V306 H132 V226 C132 202 145 187 154 187 Z"
              fill="#fff"
            />
            <path
              className="sunshine-motion-logo__mask-car-part sunshine-motion-logo__mask-car-part--car-body"
              d="M170 282 C188 236 202 215 219 212 C247 207 295 207 318 212 C337 216 350 238 366 282 C322 296 214 296 170 282 Z"
              fill="#fff"
            />
            <path
              className="sunshine-motion-logo__mask-car-part sunshine-motion-logo__mask-car-part--car-cabin"
              d="M198 239 C208 216 218 207 238 206 H300 C320 207 331 217 341 240 Z"
              fill="#fff"
            />
            <path
              className="sunshine-motion-logo__mask-car-part sunshine-motion-logo__mask-car-part--car-lights"
              d="M174 235 H186 M350 235 H363"
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="28"
            />
          </mask>
        </defs>
        <g className="sunshine-motion-logo__stack">
          <circle
            className="sunshine-motion-logo__sun-core"
            cx="263"
            cy="252"
            r="139"
            fill="url(#sunshineMotionSunGradient)"
            clipPath="url(#sunshineMotionSunClip)"
            mask="url(#sunshineMotionSunRiseMask)"
          />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--reveal" href={sunshineLogo} width="1206" height="463" mask="url(#sunshineMotionRevealMask)" />
          <image className="sunshine-motion-logo__layer sunshine-motion-logo__layer--final" href={sunshineLogo} width="1206" height="463" />
        </g>
      </svg>
    </span>
  )
}

function DashboardShell({ role, icon: Icon, apiMode, profile, tabs, tab, setTab, syncMeta = {}, onLogout, onBack, onTabChange, children }) {
  const activeTab = tabs.find(([key]) => key === tab)
  const notices = buildDataWarnings({ profile, syncMeta, apiMode })
  const activeLabel = activeTab?.[2] || '工作台'
  const titleText = tab === 'profile'
    ? activeLabel
    : resolveAccountDisplayName(profile, role)
  return (
    <main className={`dashboard-shell${tab === 'support' ? ' dashboard-shell--support' : ''}`}>
      <aside className="side-nav glass-panel">
        <div className="brand-mark brand-mark--static" aria-hidden="true">
          <SunshineMotionLogo className="dashboard-brand-logo" />
        </div>
        <div className="nav-tabs">
          {tabs.map(([key, TabIcon, label]) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                if (tab !== key) setTab(key)
              }}
            >
              <IconSlot icon={TabIcon} size={18} className="nav-tab-icon" />{label}
            </button>
          ))}
        </div>
        <button className="ghost-button side-logout" onClick={onLogout}><LogOut size={17} />退出登录</button>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-header glass-panel">
          <div className="dashboard-title-block">
            <span className="section-kicker">{role} · {activeLabel}</span>
            <h1>{titleText}</h1>
          </div>
          <div className="header-right">
            <ModeChip mode={apiMode.mode} message={apiMode.message} />
            <button className="ghost-button" onClick={onBack}>门户</button>
          </div>
        </header>
        <NoticeStrip notices={notices} className="dashboard-notice-strip" />
        <div className="dashboard-view-stage" key={tab}>
          {children}
        </div>
      </section>
    </main>
  )
}


function OrderBoard({ orders, coupons = [], role, onAction, onRefresh, onOpenInvoice, focusOrderId = '', pendingActionKey = '' }) {
  const [listExpanded, setListExpanded] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [refreshing, setRefreshing] = useState(false)
  const sourceOrders = normalizeList(orders)
  const filteredOrders = useMemo(() => sourceOrders.filter((order) => {
    const typeMatched = typeFilter === 'ALL' || order.serviceType === typeFilter
    const statusMatched = statusFilter === 'ALL' || getOrderStatusBucket(order) === statusFilter
    return typeMatched && statusMatched
  }), [sourceOrders, typeFilter, statusFilter])
  const visibleCount = listExpanded ? filteredOrders.length : Math.min(6, filteredOrders.length)
  const selectedOrder = useMemo(() => {
    if (!filteredOrders.length) return null
    const target = filteredOrders.find((order) => orderKey(order) === selectedOrderId)
    return target || filteredOrders[0]
  }, [filteredOrders, selectedOrderId])
  const typeCount = (key) => key === 'ALL' ? sourceOrders.length : sourceOrders.filter((order) => order.serviceType === key).length
  const statusCount = (key) => key === 'ALL' ? sourceOrders.length : sourceOrders.filter((order) => getOrderStatusBucket(order) === key).length

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId(null)
      return
    }
    if (!selectedOrderId || !filteredOrders.some((order) => orderKey(order) === selectedOrderId)) {
      setSelectedOrderId(orderKey(filteredOrders[0]))
    }
  }, [filteredOrders, selectedOrderId])

  useEffect(() => {
    if (!focusOrderId || !sourceOrders.length) return
    const target = sourceOrders.find((order) => orderKey(order) === String(focusOrderId))
    if (target) {
      setTypeFilter('ALL')
      setStatusFilter('ALL')
      setSelectedOrderId(orderKey(target))
    }
  }, [focusOrderId, sourceOrders])

  const refreshOrders = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="dashboard-grid order-detail-layout">
      <section className="glass-panel work-card order-board-card">
        <div className="card-head order-board-head">
          <div>
            <span className="section-kicker">订单</span>
            <h2>{role === 'DRIVER' ? '司机订单' : '我的订单'} <small>{filteredOrders.length}/{sourceOrders.length}</small></h2>
          </div>
          <div className="order-board-actions">
            {filteredOrders.length > 6 && (
              <button className="order-list-toggle" onClick={() => setListExpanded((value) => !value)}>
                {listExpanded ? '收起订单' : `展开全部 ${filteredOrders.length} 单`} <ChevronRight size={15} />
              </button>
            )}
            <button
              className={`icon-button${refreshing ? ' is-refreshing' : ''}`}
              disabled={refreshing}
              title={refreshing ? '刷新中' : '刷新订单'}
              onClick={refreshOrders}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        <div className="order-filter-panel">
          <div className="order-filter-row">
            <span className="order-filter-label">业务</span>
            <div className="segmented-row order-filter-tabs">
              {orderTypeTabs.map(([key, label]) => (
                <button key={key} className={typeFilter === key ? 'active' : ''} onClick={() => setTypeFilter(key)}>
                  {key !== 'ALL' && <ServiceIcon type={key} className="order-filter-service-icon" />}
                  {label}<span>{typeCount(key)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="order-filter-row">
            <span className="order-filter-label">状态</span>
            <div className="segmented-row order-filter-tabs status">
              {orderStatusTabs.map(([key, label]) => (
                <button key={key} className={statusFilter === key ? 'active' : ''} onClick={() => setStatusFilter(key)}>
                  {label}<span>{statusCount(key)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <OrderList
          orders={filteredOrders}
          empty={sourceOrders.length ? '当前筛选下暂无订单。' : '暂无订单。'}
          limit={visibleCount}
          selectedOrderId={selectedOrderId}
          onSelect={(order) => setSelectedOrderId(orderKey(order))}
          footer={(order) => (
            <>
              <OrderActions role={role} order={order} pendingActionKey={pendingActionKey} onAction={(action, payload) => onAction(action, order, payload)} />
            </>
          )}
        />
      </section>
      <OrderDetailPanel
        order={selectedOrder}
        coupons={coupons}
        role={role}
        onAction={(action, payload) => selectedOrder && onAction(action, selectedOrder, payload)}
        onOpenInvoice={onOpenInvoice}
        pendingActionKey={pendingActionKey}
      />
    </div>
  )
}

function orderKey(order = {}) {
  return String(order.id || order.orderNo || '')
}

function getOrderStatusBucket(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) return 'CANCELLED'
  if (order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID) return 'WAITING_PAY'
  if (order.orderStatus === ORDER_STATUS.FINISHED) return 'COMPLETED'
  if ([ORDER_STATUS.CREATED, ORDER_STATUS.DISPATCHING].includes(order.orderStatus)) return 'DISPATCHING'
  if ([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP].includes(order.orderStatus)) return 'PROCESSING'
  return 'PROCESSING'
}

function OrderDetailPanel({ order, coupons = [], role, onAction, onOpenInvoice, pendingActionKey = '' }) {
  const [activeAction, setActiveAction] = useState('')
  const [payForm, setPayForm] = useState({ payChannel: 'WECHAT' })
  const [selectedPayCouponId, setSelectedPayCouponId] = useState('')
  const [reviewForm, setReviewForm] = useState({ score: 5, tags: passengerReviewTags.slice(0, 2), content: '', anonymous: false })
  const [complaintForm, setComplaintForm] = useState({ complaintType: 'SERVICE', content: '', contactPhone: '' })
  const [formError, setFormError] = useState('')
  const [submittingAction, setSubmittingAction] = useState('')
  const selectedOrderKey = orderKey(order || {})
  const payCouponOptions = useMemo(() => buildPayCouponOptions(order || {}, coupons), [order, coupons])

  useEffect(() => {
    setActiveAction('')
    setFormError('')
    setPayForm({ payChannel: 'WECHAT' })
    setSelectedPayCouponId(order?.userCouponId ? String(order.userCouponId) : '')
    setReviewForm({ score: 5, tags: passengerReviewTags.slice(0, 2), content: '', anonymous: false })
    setComplaintForm({ complaintType: 'SERVICE', content: '', contactPhone: '' })
  }, [order?.userCouponId, selectedOrderKey])

  if (!order) {
    return (
      <section className="glass-panel work-card order-detail-card order-detail-card-empty">
        <div className="order-empty-receipt">
          <span>订单详情</span>
          <strong>暂无可查看的订单</strong>
          <small>选择左侧订单后，这里显示路线、费用、流程和售后操作。</small>
        </div>
      </section>
    )
  }
  const rawAmount = Number(order.payableAmount || order.actualAmount || order.estimatedAmount || 0)
  const originalPayAmount = getOrderOriginalPayAmount(order)
  const webExclusiveDiscount = Number(order.webExclusiveDiscountAmount || 0)
  const selectedPayCoupon = payCouponOptions.find((coupon) => coupon.userCouponIdText === selectedPayCouponId) || null
  const selectedCouponDiscount = selectedPayCoupon ? selectedPayCoupon.discountAmount : 0
  const finalPayAmount = roundMoney(Math.max(0, originalPayAmount - webExclusiveDiscount - selectedCouponDiscount))
  const amount = formatMoney(finalPayAmount || rawAmount, order.currencyCode)
  const feeRows = buildOrderFeeRows(order)
  const paymentFeeRows = selectedPayCoupon
    ? buildOrderFeeRows({
      ...order,
      payableAmount: finalPayAmount,
      actualAmount: finalPayAmount,
      couponDiscount: Number(webExclusiveDiscount + selectedCouponDiscount),
      couponName: selectedPayCoupon.name,
      couponRuleDesc: selectedPayCoupon.ruleText
    })
    : feeRows
  const steps = buildOrderFlowSteps(order)
  const isPassenger = role !== 'DRIVER'
  const canPay = isPassenger && order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID
  const canEvaluate = isPassenger && order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID && !isOrderEvaluated(order)
  const canComplain = isPassenger && order.orderStatus !== ORDER_STATUS.CANCELLED && !isOrderComplained(order)
  const canInvoice = isPassenger && order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID
  const canRefundInfo = isPassenger && order.payStatus === PAY_STATUS.PAID
  const canDriverStart = role === 'DRIVER' && order.orderStatus === ORDER_STATUS.ACCEPTED
  const canDriverPickup = role === 'DRIVER' && order.orderStatus === ORDER_STATUS.PICKING_UP
  const canDriverFinish = role === 'DRIVER' && order.orderStatus === ORDER_STATUS.IN_TRIP
  const driverStartBusy = isOrderActionPending(pendingActionKey, 'start', order)
  const driverPickupBusy = isOrderActionPending(pendingActionKey, 'pickup', order)
  const driverFinishBusy = isOrderActionPending(pendingActionKey, 'finish', order)
  const orderActionLocked = isAnyOrderActionPending(pendingActionKey, order)
  const trackCount = normalizeList(order.track || order.trackHistory || order.locations).length
  const payMethod = passengerPaymentMethods.find(([value]) => value === payForm.payChannel) || passengerPaymentMethods[0]

  const submitPay = async () => {
    if (!canPay || submittingAction || orderActionLocked) return
    setFormError('')
    setSubmittingAction('pay')
    try {
      const success = await onAction('pay', {
        payChannel: payForm.payChannel,
        payableAmount: finalPayAmount || rawAmount,
        originalAmount: originalPayAmount,
        userCouponId: selectedPayCoupon?.userCouponIdText || null,
        couponDiscount: selectedCouponDiscount,
        couponName: selectedPayCoupon?.name || '',
        couponRuleDesc: selectedPayCoupon?.ruleText || ''
      })
      if (success === false) {
        setFormError('支付提交失败，请稍后重试')
        return
      }
      setActiveAction('')
    } finally {
      setSubmittingAction('')
    }
  }

  const toggleReviewTag = (tag) => {
    setReviewForm((value) => ({
      ...value,
      tags: value.tags.includes(tag)
        ? value.tags.filter((item) => item !== tag)
        : [...value.tags, tag]
    }))
  }

  const submitReview = async () => {
    if (submittingAction || orderActionLocked) return
    const score = Number(reviewForm.score)
    const content = String(reviewForm.content || '').trim() || reviewForm.tags.join('、') || '服务体验良好'
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      setFormError('请选择 1-5 星评分')
      return
    }
    if (content.length < 2) {
      setFormError('请补充评价内容')
      return
    }
    setFormError('')
    setSubmittingAction('evaluate')
    try {
      const success = await onAction('evaluate', {
        score,
        tags: reviewForm.tags,
        content,
        anonymous: reviewForm.anonymous
      })
      if (success === false) {
        setFormError('评价提交失败，请稍后重试')
        return
      }
      setActiveAction('')
    } finally {
      setSubmittingAction('')
    }
  }

  const submitComplaint = async () => {
    if (submittingAction || orderActionLocked) return
    const content = String(complaintForm.content || '').trim()
    const contactPhone = String(complaintForm.contactPhone || '').trim()
    if (!content) {
      setFormError('请填写反馈内容')
      return
    }
    if (contactPhone && !isValidPhone(contactPhone)) {
      setFormError('联系电话需要为 11 位手机号')
      return
    }
    setFormError('')
    setSubmittingAction('complaint')
    try {
      const success = await onAction('complaint', {
        complaintType: complaintForm.complaintType,
        contactPhone,
        content
      })
      if (success === false) {
        setFormError('投诉提交失败，请稍后重试')
        return
      }
      setActiveAction('')
    } finally {
      setSubmittingAction('')
    }
  }

  return (
    <section className="glass-panel work-card order-detail-card">
      <div className="card-head">
        <div>
          <span className="section-kicker">订单详情</span>
          <h2>{order.startName || '-'} <ChevronRight size={16} /> {order.endName || '-'}</h2>
        </div>
        <div className="order-badges">
          <StatusBadge value={order.orderStatus} />
          <StatusBadge value={order.payStatus} />
        </div>
      </div>

      <div className="order-detail-hero">
        <div>
          <span>订单金额</span>
          <strong>{amount}</strong>
          <small>{statusLabel[order.serviceType] || order.serviceType || '出行服务'} · {order.orderNo || `#${order.id}`}</small>
        </div>
        <div className="order-detail-mini-map">
          <span className="order-route-dot start" />
          <i />
          <span className="order-route-dot end" />
        </div>
      </div>

      <div className="order-detail-metrics">
        <MiniStat label="距离" value={`${order.actualDistanceKm || order.estimatedDistanceKm || '-'} km`} />
        <MiniStat label="时间" value={`${order.actualDurationMin || order.estimatedDurationMin || '-'} min`} />
        <MiniStat label="下单" value={formatOrderDisplayTime(order)} />
      </div>

      <div className="order-fee-breakdown-panel">
        <div className="order-action-panel-head">
          <span><DollarSign size={15} />费用明细</span>
        </div>
        <div className="fee-row-list">
          {feeRows.map((item) => (
            <div className={item.tone ? `fee-row ${item.tone}` : 'fee-row'} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="order-flow-panel" style={{ '--order-flow-count': steps.length }}>
        {steps.map((step, index) => (
          <div className={`order-flow-step ${step.state}`} key={step.key}>
            <span>{step.state === 'upcoming' ? index + 1 : '✓'}</span>
            <p>{step.label}</p>
          </div>
        ))}
      </div>

      <div className="order-detail-info">
        <InfoPanel title="订单信息" items={[
          ['业务类型', statusLabel[order.serviceType] || order.serviceType || '-'],
          ['司机信息', order.driverName || order.driverNickname || (order.driverId ? `司机 #${order.driverId}` : '待分配')],
          ['支付状态', statusLabel[order.payStatus] || '-'],
          ['发票状态', orderInvoiceStatusText(order)],
          ['评价状态', orderEvaluationStatusText(order)],
          ['投诉状态', orderComplaintStatusText(order)],
          ['轨迹记录', trackCount ? `${trackCount} 条` : '待上报']
        ]} />
      </div>

      {role === 'DRIVER' && <DriverTripProgressPanel order={order} trackCount={trackCount} />}

      <div className="order-detail-actions">
        {canPay && <button className="solid-button" disabled={orderActionLocked} onClick={() => setActiveAction(activeAction === 'pay' ? '' : 'pay')}><CreditCard size={16} />支付确认</button>}
        {canRefundInfo && <button className="ghost-button" disabled={orderActionLocked} onClick={() => setActiveAction(activeAction === 'refund' ? '' : 'refund')}><RefreshCw size={16} />申请退款</button>}
        {canEvaluate && <button className="ghost-button" disabled={orderActionLocked} onClick={() => setActiveAction(activeAction === 'evaluate' ? '' : 'evaluate')}><Star size={16} />写评价</button>}
        {canComplain && <button className="ghost-button" disabled={orderActionLocked} onClick={() => setActiveAction(activeAction === 'complaint' ? '' : 'complaint')}><AlertTriangle size={16} />投诉反馈</button>}
        {canInvoice && <button className="ghost-button" onClick={onOpenInvoice}><CreditCard size={16} />申请发票</button>}
        {canDriverStart && <button className={`solid-button${driverStartBusy ? ' is-busy' : ''}`} disabled={orderActionLocked} onClick={() => onAction('start')}><Play size={16} />{driverStartBusy ? '处理中' : '开始接驾'}</button>}
        {canDriverPickup && <button className={`solid-button${driverPickupBusy ? ' is-busy' : ''}`} disabled={orderActionLocked} onClick={() => onAction('pickup')}><Navigation size={16} />{driverPickupBusy ? '处理中' : '确认上车'}</button>}
        {canDriverFinish && <button className={`solid-button${driverFinishBusy ? ' is-busy' : ''}`} disabled={orderActionLocked} onClick={() => onAction('finish')}><Flag size={16} />{driverFinishBusy ? '处理中' : '完成行程'}</button>}
      </div>

      {activeAction === 'pay' && (
        <div className="order-action-panel payment-confirm-panel">
          <div className="order-action-panel-head">
            <span><CreditCard size={15} />支付确认</span>
            <strong>{amount}</strong>
          </div>
          <div className="payment-method-grid">
            {passengerPaymentMethods.map(([value, label, desc]) => (
              <button
                type="button"
                key={value}
                className={payForm.payChannel === value ? 'active' : ''}
                onClick={() => setPayForm({ payChannel: value })}
              >
                <span>{label}</span>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          <div className="payment-coupon-panel">
            <div className="payment-coupon-head">
              <div>
                <span>优惠券</span>
                <small>{payCouponOptions.length ? `可用 ${payCouponOptions.length} 张` : '当前订单暂无可用优惠券'}</small>
              </div>
              {selectedPayCoupon && (
                <button type="button" className="ghost-button compact-action" onClick={() => setSelectedPayCouponId('')}>不使用</button>
              )}
            </div>
            {payCouponOptions.length ? (
              <div className="payment-coupon-list">
                {payCouponOptions.map((coupon) => (
                  <button
                    type="button"
                    key={coupon.userCouponIdText}
                    className={selectedPayCouponId === coupon.userCouponIdText ? 'active' : ''}
                    onClick={() => setSelectedPayCouponId(coupon.userCouponIdText)}
                  >
                    <strong>-{formatMoney(coupon.discountAmount, order.currencyCode)}</strong>
                    <span>{coupon.name}</span>
                    <small>{coupon.ruleText || coupon.validText || '本单可用'}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="payment-coupon-empty">与小程序一致：未达到门槛、业务类型不匹配或已使用的券不会出现在可用列表。</p>
            )}
          </div>
          <InfoPanel title="支付核对" items={[
            ['订单编号', order.orderNo || `#${order.id}`],
            ['支付方式', payMethod[1]],
            ['应付金额', amount],
            ['优惠券', selectedPayCoupon ? `${selectedPayCoupon.name} -${formatMoney(selectedCouponDiscount, order.currencyCode)}` : '不使用'],
            ['费用构成', paymentFeeRows.map((item) => `${item.label}${item.value}`).join(' / ')]
          ]} />
          <p className="payment-safe-tip"><ShieldCheck size={14} />支付成功后钱包流水、订单支付状态和发票入口会同步更新。</p>
          {formError && <p className="form-error-line">{formError}</p>}
          <div className="order-action-panel-actions">
            <button className="solid-button" disabled={submittingAction === 'pay' || orderActionLocked} onClick={submitPay}>
              <CreditCard size={16} />{submittingAction === 'pay' ? '支付中...' : `确认支付 ${amount}`}
            </button>
            <button className="ghost-button" disabled={submittingAction === 'pay' || orderActionLocked} onClick={() => setActiveAction('')}>稍后处理</button>
          </div>
        </div>
      )}

      {activeAction === 'refund' && (
        <div className="order-action-panel refund-info-panel">
          <div className="order-action-panel-head">
            <span><RefreshCw size={15} />退款说明</span>
            <small>{order.orderNo || `#${order.id}`}</small>
          </div>
          <p className="payment-safe-tip"><ShieldCheck size={14} />退款需提交投诉反馈或联系人工处理，网页端不会直接修改当前订单状态。</p>
          <InfoPanel title="处理路径" items={[
            ['订单金额', amount],
            ['支付状态', statusLabel[order.payStatus] || order.payStatus || '-'],
            ['建议操作', isOrderComplained(order) ? '等待平台处理反馈' : '提交投诉反馈说明退款原因'],
            ['处理结果', '通过消息列表和订单状态同步']
          ]} />
          <div className="order-action-panel-actions">
            {!isOrderComplained(order) && <button className="solid-button" onClick={() => setActiveAction('complaint')}><AlertTriangle size={16} />去提交投诉</button>}
            <button className="ghost-button" onClick={() => setActiveAction('')}>我知道了</button>
          </div>
        </div>
      )}

      {activeAction === 'evaluate' && (
        <div className="order-action-panel review-panel">
          <div className="order-action-panel-head">
            <span><Star size={15} />行程评价</span>
            <small>{order.orderNo || `#${order.id}`}</small>
          </div>
          <div className="score-row" role="group" aria-label="评分">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                type="button"
                key={score}
                className={reviewForm.score >= score ? 'active' : ''}
                onClick={() => setReviewForm((value) => ({ ...value, score }))}
              >
                <Star size={16} />
              </button>
            ))}
            <span>{reviewForm.score} 星</span>
          </div>
          <div className="feedback-chip-row">
            {passengerReviewTags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={reviewForm.tags.includes(tag) ? 'active' : ''}
                onClick={() => toggleReviewTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <label className="plain-field textarea-field">
            <span>评价内容</span>
            <textarea
              value={reviewForm.content}
              maxLength={300}
              placeholder="可以补充司机服务、路线、车内环境等体验"
              onChange={(event) => setReviewForm((value) => ({ ...value, content: event.target.value }))}
            />
            <small>{reviewForm.content.length}/300</small>
          </label>
          <button
            type="button"
            className={`review-anonymous-toggle ${reviewForm.anonymous ? 'active' : ''}`}
            onClick={() => setReviewForm((value) => ({ ...value, anonymous: !value.anonymous }))}
          >
            <span className={`toggle-pill ${reviewForm.anonymous ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
            <strong>匿名评价</strong>
            <small>提交后评价记录不展示乘客身份</small>
          </button>
          {formError && <p className="form-error-line">{formError}</p>}
          <div className="order-action-panel-actions">
            <button className="solid-button" disabled={submittingAction === 'evaluate' || orderActionLocked} onClick={submitReview}>
              <Star size={16} />{submittingAction === 'evaluate' ? '提交中...' : '提交评价'}
            </button>
            <button className="ghost-button" disabled={submittingAction === 'evaluate' || orderActionLocked} onClick={() => setActiveAction('')}>取消</button>
          </div>
        </div>
      )}

      {activeAction === 'complaint' && (
        <div className="order-action-panel complaint-panel">
          <div className="order-action-panel-head">
            <span><AlertTriangle size={15} />投诉反馈</span>
            <small>提交后会同步到消息和订单状态</small>
          </div>
          <div className="feedback-chip-row">
            {complaintTypeOptions.map(([value, label, desc]) => (
              <button
                type="button"
                key={value}
                className={complaintForm.complaintType === value ? 'active' : ''}
                title={desc}
                onClick={() => setComplaintForm((form) => ({ ...form, complaintType: value }))}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="plain-field textarea-field">
            <span>问题说明</span>
            <textarea
              value={complaintForm.content}
              maxLength={300}
              placeholder="请说明发生时间、问题经过和希望处理方式"
              onChange={(event) => setComplaintForm((form) => ({ ...form, content: event.target.value }))}
            />
            <small>{complaintForm.content.length}/300</small>
          </label>
          <Field label="联系电话" value={complaintForm.contactPhone} onChange={(value) => setComplaintForm((form) => ({ ...form, contactPhone: value }))} />
          {formError && <p className="form-error-line">{formError}</p>}
          <div className="order-action-panel-actions">
            <button className="solid-button" disabled={submittingAction === 'complaint' || orderActionLocked} onClick={submitComplaint}>
              <AlertTriangle size={16} />{submittingAction === 'complaint' ? '提交中...' : '提交投诉'}
            </button>
            <button className="ghost-button" disabled={submittingAction === 'complaint' || orderActionLocked} onClick={() => setActiveAction('')}>取消</button>
          </div>
        </div>
      )}
    </section>
  )
}

function DriverTripProgressPanel({ order, trackCount }) {
  const nextAction = driverNextActionText(order)
  const incomeAmount = order.driverIncomeAmount !== undefined && order.driverIncomeAmount !== null
    ? Number(order.driverIncomeAmount)
    : Number(order.actualAmount || order.payableAmount || order.estimatedAmount || 0) * 0.8
  const income = formatMoney(incomeAmount, order.currencyCode)
  const progress = getRideProgressPercent(order)
  return (
    <div className="driver-trip-progress-panel">
      <div className="order-action-panel-head">
        <span><Navigation size={15} />司机行程进度</span>
        <small>{order.orderNo || `#${order.id}`}</small>
      </div>
      <div className="driver-trip-progress-grid">
        <SummaryPill icon={Clock} value={nextAction} label="下一步" />
        <SummaryPill icon={Route} value={trackCount ? `${trackCount} 条` : '待上报'} label="轨迹记录" />
        <SummaryPill icon={DollarSign} value={income} label="预估收入" />
      </div>
      <div className="driver-trip-progress-track">
        <div><span>路线进度</span><strong>{progress}%</strong></div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <p>{order.orderStatus === ORDER_STATUS.IN_TRIP ? '保持轨迹上报，偏离路线时请主动联系乘客或客服。' : '按下一步操作推进，乘客端和后台会同步更新订单状态。'}</p>
      </div>
      <div className="driver-trip-checklist">
        {[
          ['接单', true],
          ['开始接驾', [ORDER_STATUS.PICKING_UP, ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED].includes(order.orderStatus)],
          ['确认上车', [ORDER_STATUS.IN_TRIP, ORDER_STATUS.FINISHED].includes(order.orderStatus)],
          ['完成行程', order.orderStatus === ORDER_STATUS.FINISHED]
        ].map(([label, done]) => (
          <span className={done ? 'done' : ''} key={label}>
            <CheckCircle size={14} />{label}
          </span>
        ))}
      </div>
    </div>
  )
}

function driverNextActionText(order = {}) {
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return '开始接驾'
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return '确认乘客上车'
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) return '到达后完成行程'
  if (order.orderStatus === ORDER_STATUS.FINISHED) return order.payStatus === PAY_STATUS.PAID ? '行程已闭环' : '等待乘客支付'
  if (order.orderStatus === ORDER_STATUS.CANCELLED) return '订单已取消'
  return '等待接单'
}

function orderInvoiceStatusText(order = {}) {
  const status = String(order.invoiceStatus || '').toUpperCase()
  if (!status || status === 'NONE') return '未申请'
  return statusLabel[status] || status
}

function normalizeInvoiceStatus(source = {}) {
  if (typeof source === 'string') return String(source || 'NONE').toUpperCase()
  return String(source?.invoiceStatus || 'NONE').toUpperCase()
}

function invoiceStatusLabel(source = {}) {
  const status = normalizeInvoiceStatus(source)
  if (status === 'NONE') return '待开票'
  if (status === 'APPLIED') return '处理中'
  if (status === 'ISSUED') return '已开票'
  if (status === 'REJECTED') return '驳回待修改'
  return statusLabel[status] || status
}

function invoiceStatusTone(source = {}) {
  const status = normalizeInvoiceStatus(source)
  if (status === 'NONE') return 'active'
  if (status === 'APPLIED') return 'waiting'
  if (status === 'ISSUED') return 'success'
  if (status === 'REJECTED') return 'danger'
  return statusTone[status] || 'muted'
}

function invoiceStatusText(order = {}) {
  return invoiceStatusLabel(order)
}


function orderEvaluationStatusText(order = {}) {
  const status = String(order.evaluationStatus || '').toUpperCase()
  if (status.startsWith('DONE')) return '已评价'
  if (status === 'PENDING') return '待评价'
  return '待评价'
}

function isOrderEvaluated(order = {}) {
  return String(order.evaluationStatus || '').toUpperCase().startsWith('DONE')
}

function orderComplaintStatusText(order = {}) {
  const status = String(order.complaintStatus || '').toUpperCase()
  if (!status || status === 'NONE') return '无投诉'
  if (['DONE', 'RESOLVED', 'CLOSED'].includes(status)) return '已处理'
  return statusLabel[status] || status
}

function isOrderComplained(order = {}) {
  const status = String(order.complaintStatus || '').toUpperCase()
  return Boolean(status && status !== 'NONE')
}

function buildOrderFlowSteps(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return [
      { key: 'created', label: '已创建', state: 'done' },
      { key: 'cancelled', label: '已取消', state: 'danger' }
    ]
  }
  const sequence = [
    [ORDER_STATUS.CREATED, '已创建'],
    [ORDER_STATUS.DISPATCHING, '等待接单'],
    [ORDER_STATUS.ACCEPTED, '司机接单'],
    [ORDER_STATUS.PICKING_UP, '接驾中'],
    [ORDER_STATUS.IN_TRIP, '行程中'],
    [ORDER_STATUS.FINISHED, '已完成']
  ]
  const activeIndex = Math.max(0, sequence.findIndex(([status]) => status === order.orderStatus))
  return sequence.map(([key, label], index) => ({
    key,
    label,
    state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming'
  }))
}

function formatOrderDisplayTime(order = {}) {
  const raw = order.createdAt || order.createdTime || order.createTime || order.orderTime || order.submitTime || order.updatedAt || order.updateTime
  if (!raw) return '-'
  if (Array.isArray(raw)) {
    const [year, month, day, hour = 0, minute = 0] = raw
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
  const value = String(raw).replace('T', ' ').replace(/\.\d+Z?$/, '')
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`
  return value.slice(0, 16)
}

function OrderList({ orders, footer, empty, limit, selectedOrderId, onSelect, className = '' }) {
  if (!orders?.length) {
    return (
      <div className="order-empty-list">
        <strong>暂无订单</strong>
        <span>{empty}</span>
      </div>
    )
  }
  const visibleOrders = Number.isFinite(limit) ? orders.slice(0, limit) : orders
  return (
    <div className={`order-list compact-order-list${className ? ` ${className}` : ''}`}>
      {visibleOrders.map((order, index) => {
        const key = order.id || order.orderNo || index
        const orderTime = formatOrderDisplayTime(order)
        return (
        <article
          className={`order-card glass-panel compact slim ${orderKey(order) === selectedOrderId ? 'is-selected' : ''} ${onSelect ? 'is-clickable' : ''}`}
          key={key}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onClick={onSelect ? () => onSelect(order) : undefined}
          onKeyDown={onSelect ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(order)
            }
          } : undefined}
        >
          <div className="order-line">
            <div className="order-card-copy">
              <div className="order-card-topline">
                <span className="order-type-label">
                  <ServiceIcon type={order.serviceType} className="order-type-icon" />
                  {statusLabel[order.serviceType] || order.serviceType}
                </span>
                <div className="order-badges">
                  <StatusBadge value={order.orderStatus} />
                  <StatusBadge value={order.payStatus} />
                </div>
              </div>
              <h3>{order.startName} <ChevronRight size={16} /> {order.endName}</h3>
              <p className="order-subline"><span>{order.orderNo || `#${order.id}`}</span><span className="order-time">下单 {orderTime}</span></p>
            </div>
          </div>
          <div className="order-slim-meta">
            <strong>{formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)}</strong>
            <span>{order.estimatedDistanceKm || '-'} km</span>
            <span>{order.estimatedDurationMin || '-'} min</span>
          </div>
          <div className="order-actions slim">{footer?.(order)}</div>
        </article>
      )})}
    </div>
  )
}

function OrderActions({ role, order, onAction, pendingActionKey = '' }) {
  const startBusy = isOrderActionPending(pendingActionKey, 'start', order)
  const pickupBusy = isOrderActionPending(pendingActionKey, 'pickup', order)
  const finishBusy = isOrderActionPending(pendingActionKey, 'finish', order)
  const cancelBusy = isOrderActionPending(pendingActionKey, 'cancel', order)
  const actionLocked = isAnyOrderActionPending(pendingActionKey, order)
  const passengerPickupReady = isPassengerPickupReady(order.runtime || order, order)
  if (role === 'DRIVER') {
    return (
      <>
        {order.orderStatus === ORDER_STATUS.ACCEPTED && <button className={`solid-button${startBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('start')}><Play size={16} />{startBusy ? '处理中' : '开始接驾'}</button>}
        {order.orderStatus === ORDER_STATUS.PICKING_UP && <button className={`solid-button${pickupBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('pickup')}><Navigation size={16} />{pickupBusy ? '处理中' : '确认上车'}</button>}
        {order.orderStatus === ORDER_STATUS.IN_TRIP && <button className={`solid-button${finishBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('finish')}><Flag size={16} />{finishBusy ? '处理中' : '完成行程'}</button>}
      </>
    )
  }
  return (
    <>
      {[ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus) && (
        <button className={`ghost-button${cancelBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('cancel')}><XCircle size={16} />{cancelBusy ? '处理中' : '取消'}</button>
      )}
      {order.orderStatus === ORDER_STATUS.PICKING_UP && !passengerPickupReady && <button className="ghost-button" disabled><Navigation size={16} />等待司机到达</button>}
      {order.orderStatus === ORDER_STATUS.PICKING_UP && passengerPickupReady && <button className={`solid-button${pickupBusy ? ' is-busy' : ''}`} disabled={actionLocked} onClick={() => onAction('pickup')}><Navigation size={16} />{pickupBusy ? '处理中' : '我已上车'}</button>}
    </>
  )
}

function CouponBoard({ center, mine, membership, onReceive, onOpenMembership, onUseCoupon }) {
  const [status, setStatus] = useState('UNUSED')
  const [walletExpanded, setWalletExpanded] = useState(false)
  const [centerExpanded, setCenterExpanded] = useState(false)
  const [claimingId, setClaimingId] = useState('')
  const centerList = normalizeList(center)
  const templateMap = useMemo(() => new Map(centerList.map((coupon) => [Number(coupon.id), coupon])), [centerList])
  const walletList = normalizeList(mine).map((coupon) => ({ ...templateMap.get(Number(coupon.couponId)), ...coupon }))
  const ownedCouponKeys = useMemo(() => new Set(walletList.map(couponTemplateKey).filter(Boolean)), [walletList])
  const visibleWallet = walletList.filter((coupon) => normalizeCouponStatus(coupon) === status)
  const walletDisplay = walletExpanded ? visibleWallet : visibleWallet.slice(0, 2)
  const centerDisplay = centerExpanded ? centerList : centerList.slice(0, 3)
  const usableCoupons = walletList.filter((coupon) => normalizeCouponStatus(coupon) === 'UNUSED')
  const usedCoupons = walletList.filter((coupon) => normalizeCouponStatus(coupon) === 'USED')
  const expiredCoupons = walletList.filter((coupon) => normalizeCouponStatus(coupon) === 'EXPIRED')
  const activeMembership = Boolean(membership?.active || membership?.memberStatus === 'ACTIVE')
  const memberDesc = activeMembership
    ? `有效期至 ${membership?.expireDate || membership?.validEndTime || membership?.endTime || '--'} · 每周3张不同优惠券`
    : '每周赠送3张不同优惠券 · 优先客服'
  const statusTabs = [
    ['UNUSED', '可使用', usableCoupons.length],
    ['USED', '已使用', usedCoupons.length],
    ['EXPIRED', '已过期', expiredCoupons.length]
  ]
  const receiveCoupon = async (coupon) => {
    const key = couponTemplateKey(coupon)
    if (!key || ownedCouponKeys.has(key) || claimingId) return
    setClaimingId(key)
    try {
      await onReceive(coupon)
    } finally {
      setClaimingId('')
    }
  }
  return (
    <div className="coupon-board miniapp-coupon-board">
      <section className="coupon-page-card coupon-hero-panel">
        <div>
          <h2>优惠券中心</h2>
          <p>领券购物更优惠</p>
        </div>
        <div className="coupon-hero-wallet" aria-hidden="true">
          <span className="coupon-hero-ticket left">%</span>
          <span className="coupon-hero-ticket right">券</span>
          <span className="coupon-hero-wallet-body" />
          <span className="coupon-hero-coin front">¥</span>
          <span className="coupon-hero-coin back">+</span>
        </div>
      </section>

      <div className="miniapp-coupon-tabs" role="tablist" aria-label="优惠券状态">
        {statusTabs.map(([key, label, count]) => (
          <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label} ({count})</button>
        ))}
      </div>

      <div className="miniapp-coupon-content">
        <section className="coupon-page-card coupon-section coupon-section-mine">
          <div className="coupon-section-head">
            <div className="coupon-section-title-wrap">
              <span className="coupon-section-icon orange" />
              <h3>我的券包</h3>
            </div>
            <span>{visibleWallet.length} 张{statusTabs.find(([key]) => key === status)?.[1] || '优惠券'} <ChevronRight size={14} /></span>
          </div>
          {visibleWallet.length ? (
            <div className="coupon-wallet-list miniapp-coupon-list">
              {walletDisplay.map((coupon, index) => (
                <CouponTicket
                  coupon={coupon}
                  key={coupon.id || coupon.userCouponId || `${coupon.couponId}-${index}`}
                  owned
                  theme="orange"
                  variant="miniapp"
                  onUse={() => onUseCoupon?.(coupon)}
                />
              ))}
            </div>
          ) : <EmptyState text="暂无对应优惠券。" />}
          {visibleWallet.length > 2 && (
            <button className="coupon-list-toggle miniapp-toggle orange" onClick={() => setWalletExpanded((value) => !value)}>
              {walletExpanded ? '收起' : `展开更多 (${visibleWallet.length - 2})`} <ChevronRight size={14} />
            </button>
          )}
        </section>

        <section className="coupon-page-card coupon-section coupon-section-center">
          <div className="coupon-section-head">
            <div className="coupon-section-title-wrap">
              <span className="coupon-section-icon purple" />
              <h3>券中心</h3>
              <small>更多优惠券等你来领</small>
            </div>
            <span>{centerList.length} 张可领券 <ChevronRight size={14} /></span>
          </div>
          {centerList.length ? (
            <div className="coupon-center-list miniapp-coupon-list">
              {centerDisplay.map((coupon) => {
                const key = couponTemplateKey(coupon)
                const claimed = ownedCouponKeys.has(key)
                return (
                  <CouponTicket
                    coupon={coupon}
                    key={coupon.id}
                    claimed={claimed}
                    busy={claimingId === key}
                    onReceive={() => receiveCoupon(coupon)}
                    theme="purple"
                    variant="miniapp"
                  />
                )
              })}
            </div>
          ) : <EmptyState text="当前暂无可领取优惠券。" />}
          {centerList.length > 3 && (
            <button className="coupon-list-toggle miniapp-toggle purple" onClick={() => setCenterExpanded((value) => !value)}>
              {centerExpanded ? '收起' : `展开更多 (${centerList.length - 3})`} <ChevronRight size={14} />
            </button>
          )}
        </section>

        <button className={`member-coupon-banner ${activeMembership ? 'is-active' : ''}`} onClick={onOpenMembership}>
          <span className="member-coupon-crown"><Sparkles size={17} /></span>
          <span>
            <strong>{activeMembership ? '会员已开通，专属券包已到账' : '开通会员尊享更多优惠'}</strong>
            <small>{memberDesc}</small>
          </span>
          <em>{activeMembership ? '查看' : '去开通'}</em>
        </button>
      </div>
    </div>
  )
}

function CouponTicket({ coupon, owned = false, onReceive, onUse, claimed = false, busy = false, theme = owned ? 'orange' : 'purple', variant = 'default' }) {
  const discount = getCouponValue(coupon)
  const threshold = coupon.thresholdAmount || coupon.minAmount || coupon.conditionAmount || 0
  const status = normalizeCouponStatus(coupon)
  const rawScope = coupon.serviceType || coupon.scope || coupon.serviceScope
  const scope = statusLabel[rawScope] || rawScope || '全场通用'
  const validity = formatDateTimeShort(coupon.validEndTime || coupon.expireTime || coupon.endTime || coupon.validTo || '')
  const expiring = owned && status === 'UNUSED' && isCouponExpiringSoon(coupon)
  const miniappMode = variant === 'miniapp'
  const title = coupon.couponName || coupon.name || `优惠券 #${coupon.couponId || coupon.id}`
  const rule = coupon.ruleDesc || (Number(threshold) > 0 ? `满 ${threshold} 可用` : '无门槛可用')
  const code = coupon.couponCode || coupon.code || coupon.userCouponCode || coupon.userCouponNo || ''
  const stock = coupon.stock ?? coupon.remainingStock ?? coupon.leftCount
  const meta = code
    ? `券码 ${code}`
    : stock !== undefined && stock !== null
      ? `库存 ${stock} · ${validity ? `有效至 ${validity}` : scope}`
      : validity ? `有效至 ${validity}` : scope
  const valueUnit = discount.type === 'cash' ? '元' : ''
  const sideText = owned
    ? status === 'UNUSED' ? '立即使用' : statusLabel[status] || status
    : busy ? '领取中' : claimed ? '已领取' : '领取'
  if (miniappMode) {
    const disabled = owned && status !== 'UNUSED'
    const actionDisabled = (!owned && (claimed || busy)) || (owned && status !== 'UNUSED')
    return (
      <article className={`coupon-ticket coupon-ticket-miniapp coupon-theme-${theme} coupon-value-${discount.type} ${owned ? 'owned' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <div className="coupon-ticket-value">
          <div className="coupon-mini-value">
            {discount.type === 'cash' && <small>¥</small>}
            <strong>{discount.text}</strong>
            {valueUnit && <em>{valueUnit}</em>}
          </div>
          <span>{scope}</span>
        </div>
        <div className="coupon-ticket-main">
          <strong>{title}</strong>
          <p>{rule}</p>
          <small>{meta}</small>
        </div>
        <div className="coupon-ticket-side">
          <button
            className={`coupon-side-action ${actionDisabled ? 'is-claimed' : ''}`}
            disabled={actionDisabled}
            onClick={owned ? onUse : onReceive}
          >
            {sideText}
          </button>
        </div>
      </article>
    )
  }
  return (
    <article className={`coupon-ticket ${owned ? 'owned' : ''} ${discount.type === 'rate' ? 'rate' : ''} ${status !== 'UNUSED' ? 'is-disabled' : ''} ${expiring ? 'is-expiring' : ''}`}>
      <div className={`coupon-ticket-value coupon-value-${discount.type}`}>
        {discount.type === 'cash' && <small>¥</small>}<strong>{discount.text}</strong>
      </div>
      <div className="coupon-ticket-main">
        <div className="coupon-ticket-title">
          <strong>{coupon.couponName || coupon.name || `优惠券 #${coupon.couponId || coupon.id}`}</strong>
          {owned && <StatusBadge value={status} />}
          {expiring && <span className="coupon-expire-badge">临期</span>}
        </div>
        <p>{coupon.ruleDesc || (Number(threshold) > 0 ? `满 ${threshold} 元可用` : '无门槛可用')}</p>
        <div className="coupon-ticket-meta">
          <span>{scope}</span>
          {validity && <span>有效至 {validity}</span>}
        </div>
      </div>
      {!owned && (
        <button className={`coupon-claim ${claimed ? 'is-claimed' : ''}`} disabled={claimed || busy} onClick={onReceive}>
          {busy ? '领取中' : claimed ? '已领取' : '领取'}
        </button>
      )}
    </article>
  )
}

function couponTemplateKey(coupon = {}) {
  const value = coupon.couponId ?? coupon.templateId ?? coupon.template_id ?? coupon.id ?? coupon.couponName ?? coupon.name
  return value === undefined || value === null ? '' : String(value)
}

function normalizeCouponStatus(coupon = {}) {
  return String(coupon.couponStatus || coupon.status || 'UNUSED').toUpperCase()
}

function couponExpireMs(coupon = {}) {
  const raw = coupon.validEndTime || coupon.expireTime || coupon.endTime || coupon.validTo
  if (!raw) return 0
  const value = Array.isArray(raw)
    ? new Date(raw[0], Number(raw[1]) - 1, raw[2], raw[3] || 23, raw[4] || 59, raw[5] || 59).getTime()
    : new Date(String(raw).replace(' ', 'T')).getTime()
  return Number.isFinite(value) ? value : 0
}

function isCouponExpiringSoon(coupon = {}) {
  const endMs = couponExpireMs(coupon)
  if (!endMs) return false
  const now = Date.now()
  return endMs >= now && endMs - now <= 7 * 24 * 60 * 60 * 1000
}

function formatDateTimeShort(value) {
  if (!value) return ''
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0] = value
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
  const text = String(value).replace('T', ' ').replace(/\.\d+Z?$/, '')
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/)
  return match ? `${match[1]}${match[2] ? ` ${match[2]}` : ''}` : text.slice(0, 16)
}

function couponCashValue(coupon = {}) {
  const discount = getCouponValue(coupon)
  if (discount.type !== 'cash') return 0
  return Number(String(discount.text).replace(/[^\d.]/g, '')) || 0
}

function couponDiscountAmountForOrder(coupon = {}, amount = 0) {
  const totalAmount = Math.max(0, Number(amount || 0))
  if (!totalAmount) return 0
  const discount = getCouponValue(coupon)
  if (discount.type === 'rate') {
    const rate = Number(coupon.discountRate ?? coupon.rate ?? coupon.discount)
    if (Number.isFinite(rate) && rate > 0 && rate < 1) {
      return roundMoney(totalAmount * (1 - rate))
    }
    const textRate = Number(String(discount.text || '').replace(/[^\d.]/g, ''))
    if (Number.isFinite(textRate) && textRate > 0 && textRate < 10) {
      return roundMoney(totalAmount * (1 - textRate / 10))
    }
  }
  const cashValue = couponCashValue(coupon)
  return roundMoney(Math.min(cashValue, Math.max(0, totalAmount - 0.01)))
}

function getOrderOriginalPayAmount(order = {}) {
  const value = Number(order.originalAmount || order.estimatedAmount || order.actualAmount || order.payableAmount || 0)
  return Number.isFinite(value) ? value : 0
}

function buildPayCouponOptions(order = {}, coupons = []) {
  const originalAmount = getOrderOriginalPayAmount(order)
  const serviceType = String(order.serviceType || '').toUpperCase()
  const usableBaseAmount = Math.max(0, originalAmount - Number(order.webExclusiveDiscountAmount || 0))
  return normalizeList(coupons)
    .map((coupon) => {
      const name = coupon.couponName || coupon.name || `优惠券 #${coupon.couponId || coupon.id || ''}`
      const userCouponIdText = String(coupon.userCouponId || coupon.id || coupon.couponId || '')
      const threshold = Number(coupon.thresholdAmount || coupon.minAmount || coupon.conditionAmount || 0)
      const scope = String(coupon.serviceScope || coupon.serviceType || coupon.scope || 'ALL').toUpperCase()
      const discountAmount = couponDiscountAmountForOrder(coupon, usableBaseAmount)
      const scopeMatched = scope === 'ALL' || scope === serviceType || (scope === 'TAXI' && serviceType === SERVICE_TYPE.TAXI)
      const validEndMs = couponExpireMs(coupon)
      const expired = validEndMs > 0 && validEndMs < Date.now()
      return {
        ...coupon,
        name,
        userCouponIdText,
        threshold,
        scope,
        discountAmount,
        ruleText: coupon.ruleDesc || (threshold > 0 ? `满 ${formatMoney(threshold, order.currencyCode)} 可用` : '无门槛可用'),
        validText: coupon.validEndTime || coupon.expireTime || coupon.endTime || coupon.validTo || '',
        usable: Boolean(userCouponIdText) &&
          normalizeCouponStatus(coupon) === 'UNUSED' &&
          discountAmount > 0 &&
          originalAmount >= threshold &&
          scopeMatched &&
          !expired
      }
    })
    .filter((coupon) => coupon.usable)
    .sort((left, right) => right.discountAmount - left.discountAmount)
}

function getCouponValue(coupon = {}) {
  const couponType = coupon.couponType || coupon.type
  const rawAmount = coupon.discountAmount ?? coupon.amount ?? coupon.faceValue ?? coupon.couponAmount
  const amount = Number(rawAmount)
  if (Number.isFinite(amount) && amount > 0) {
    return { type: 'cash', text: amount.toString().replace(/\.00$/, '') }
  }
  const rawRate = coupon.discountRate ?? coupon.rate ?? coupon.discount
  const rate = Number(rawRate)
  if (Number.isFinite(rate) && rate > 0 && rate < 1) {
    return { type: 'rate', text: `${Number((rate * 10).toFixed(1)).toString().replace(/\.0$/, '')}折` }
  }
  const match = `${coupon.couponName || ''}${coupon.ruleDesc || ''}`.match(/(\d+(?:\.\d+)?)\s*折/)
  if (match) return { type: 'rate', text: `${match[1]}折` }
  if (couponType === 'DISCOUNT') return { type: 'rate', text: '折扣' }
  return { type: 'benefit', text: Number(coupon.thresholdAmount || coupon.minAmount || coupon.conditionAmount || 0) > 0 ? '满减' : '免门槛' }
}

function resolvePoiFromText(value = '', fallbackId = 'poi101') {
  if (value && typeof value === 'object') return normalizeWebAddressPoint(value, findPoi(fallbackId))
  const keyword = String(value || '').trim().toLowerCase()
  if (!keyword) return findPoi(fallbackId) || poiLibrary[0]
  return poiLibrary.find((poi) => {
    const text = `${poi.name} ${poi.address} ${(poi.tags || []).join(' ')}`.toLowerCase()
    return text.includes(keyword) || keyword.includes(String(poi.name || '').toLowerCase())
  }) || findPoi(fallbackId) || poiLibrary[0]
}

function getAddressKey(point = {}) {
  const normalized = normalizeWebAddressPoint(point)
  return [
    normalized.name,
    normalized.address,
    Number(normalized.latitude || 0).toFixed(6),
    Number(normalized.longitude || 0).toFixed(6)
  ].join('|')
}

function normalizeWebAddressPoint(point = {}, fallback = poiLibrary[0]) {
  const source = point || {}
  const location = source.location || {}
  const latitude = Number(source.latitude ?? source.lat ?? location.lat ?? fallback?.latitude)
  const longitude = Number(source.longitude ?? source.lng ?? location.lng ?? fallback?.longitude)
  return {
    id: String(source.id || source.uid || source.addressKey || getStableAddressId(source) || fallback?.id || `addr-${Date.now()}`),
    name: source.name || source.title || source.address || fallback?.name || '已选地址',
    address: source.address || source.addr || source.name || source.title || fallback?.address || '已选地址',
    latitude: Number.isFinite(latitude) ? latitude : Number(fallback?.latitude || 0),
    longitude: Number.isFinite(longitude) ? longitude : Number(fallback?.longitude || 0),
    city: source.city || source.ad_info?.city || fallback?.city || '',
    district: source.district || source.ad_info?.district || fallback?.district || '',
    source: source.source || 'web',
    tags: Array.isArray(source.tags) ? source.tags : [],
    distanceText: source.distanceText || ''
  }
}

function getStableAddressId(source = {}) {
  const raw = `${source.name || source.title || ''}-${source.address || source.addr || ''}`.trim()
  if (!raw) return ''
  let hash = 0
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(index)
    hash |= 0
  }
  return `addr-${Math.abs(hash)}`
}

function dedupeAddressPoints(points = []) {
  const seen = new Set()
  const result = []
  points.forEach((point) => {
    const normalized = normalizeWebAddressPoint(point)
    const key = getAddressKey(normalized)
    if (seen.has(key)) return
    seen.add(key)
    result.push(normalized)
  })
  return result
}

function sameAddressPoint(left, right) {
  if (!left || !right) return false
  return getAddressKey(left) === getAddressKey(right)
}

function normalizeAddressBook(book = {}, allowedPois = poiLibrary) {
  const normalizeList = (items = []) => dedupeAddressPoints(items.map((item) => {
    if (typeof item === 'string') return allowedPois.find((poi) => poi.id === item) || null
    return item
  }).filter(Boolean))
  return {
    history: normalizeList(book.history).slice(0, 8),
    favorites: normalizeList(book.favorites).slice(0, 12)
  }
}

function addAddressHistory(book = {}, point = {}, allowedPois = poiLibrary) {
  const normalized = normalizeAddressBook(book, allowedPois)
  const address = normalizeWebAddressPoint(point)
  const key = getAddressKey(address)
  return {
    ...normalized,
    history: [address, ...normalized.history.filter((item) => getAddressKey(item) !== key)].slice(0, 8)
  }
}

function toggleAddressFavoriteId(book = {}, point = {}, allowedPois = poiLibrary) {
  const normalized = normalizeAddressBook(book, allowedPois)
  const address = normalizeWebAddressPoint(point)
  const key = getAddressKey(address)
  const exists = normalized.favorites.some((item) => getAddressKey(item) === key)
  return {
    ...normalized,
    favorites: exists
      ? normalized.favorites.filter((item) => getAddressKey(item) !== key)
      : [address, ...normalized.favorites.filter((item) => getAddressKey(item) !== key)].slice(0, 12)
  }
}

function findNearestPoiByCoordinate(latitude, longitude, pois = poiLibrary) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !pois.length) return null
  return pois
    .map((poi) => ({
      ...poi,
      distance: haversineForMap(lat, lng, Number(poi.latitude), Number(poi.longitude))
    }))
    .sort((left, right) => left.distance - right.distance)[0] || null
}

function buildLocalAddressCandidates(keyword = '', currentLocation = null, options = {}) {
  const text = String(keyword || '').trim().toLowerCase()
  const serviceType = options.serviceType || SERVICE_TYPE.TAXI
  const source = serviceType === SERVICE_TYPE.TAXI
    ? poiLibrary.filter((poi) => !isInternationalPoiCandidate(poi))
    : poiLibrary
  return source
    .map((poi) => {
      const normalized = normalizeWebAddressPoint(poi)
      const haystack = `${normalized.name} ${normalized.address} ${(normalized.tags || []).join(' ')}`.toLowerCase()
      const distance = currentLocation
        ? haversineForMap(currentLocation.latitude, currentLocation.longitude, normalized.latitude, normalized.longitude)
        : 0
      const score = !text ? 1 : (haystack.includes(text) ? 12 : 0) + (normalized.name.toLowerCase().startsWith(text) ? 8 : 0)
      return {
        ...normalized,
        source: 'local',
        score,
        distanceKm: Number(distance.toFixed(2)),
        distanceText: distance ? formatDistanceLabel(distance) : ''
      }
    })
    .filter((item) => !text || item.score > 0)
    .sort((left, right) => right.score - left.score || Number(left.distanceKm || 0) - Number(right.distanceKm || 0))
    .slice(0, Number(options.pageSize || 8))
}

async function searchWebAddressCandidates(keyword = '', currentLocation = null, options = {}) {
  const text = String(keyword || '').trim()
  if (!text) return buildLocalAddressCandidates('', currentLocation, options)
  const mapKey = getTencentMapKey()
  if (!mapKey) return buildLocalAddressCandidates(text, currentLocation, options)
  const params = new URLSearchParams({
    keyword: text,
    key: mapKey,
    output: 'json',
    page_size: String(options.pageSize || 8),
    page_index: '1'
  })
  if (currentLocation?.latitude && currentLocation?.longitude) {
    params.set('location', `${Number(currentLocation.latitude)},${Number(currentLocation.longitude)}`)
  }
  const response = await fetch(`/__tencent_map__/ws/place/v1/suggestion/?${params.toString()}`)
  if (!response.ok) throw new Error('地图搜索失败')
  const payload = await response.json()
  if (Number(payload.status) !== 0) throw new Error(payload.message || '地图搜索失败')
  const remote = (payload.data || []).map((item) => {
    const point = normalizeWebAddressPoint({
      id: item.id,
      name: item.title,
      address: item.address,
      location: item.location,
      city: item.ad_info?.city,
      district: item.ad_info?.district,
      source: 'tencent'
    })
    const distanceKm = currentLocation
      ? haversineForMap(currentLocation.latitude, currentLocation.longitude, point.latitude, point.longitude)
      : 0
    return {
      ...point,
      distanceKm: Number(distanceKm.toFixed(2)),
      distanceText: distanceKm ? formatDistanceLabel(distanceKm) : ''
    }
  })
  return dedupeAddressPoints([...remote, ...buildLocalAddressCandidates(text, currentLocation, options)])
    .slice(0, Number(options.pageSize || 8))
}

function formatDistanceLabel(distanceKm = 0) {
  const distance = Number(distanceKm || 0)
  if (!Number.isFinite(distance) || distance <= 0) return ''
  if (distance < 1) return `${Math.max(50, Math.round(distance * 1000))}m`
  return `${distance.toFixed(1)}km`
}

function buildCarpoolOrderRemark(form = {}, estimate = {}, coupon = null) {
  const meta = {
    departDate: form.departDate || '',
    timeRange: form.timeRange || '',
    passengerCount: Number(form.passengerCount || 1),
    hasLuggage: form.luggageMode || '',
    tollMode: form.tollMode || '',
    originalAmount: Number(estimate.amount || 0),
    discountAmount: Number(coupon?.discountAmount || 0),
    payableAmount: Math.max(0, Number(estimate.amount || 0) - Number(coupon?.discountAmount || 0))
  }
  const note = String(form.note || '').trim()
  return `[CARPOOL_META]${JSON.stringify(meta)}[/CARPOOL_META]${note ? ` ${note}` : ''}`
}

function validateCarpoolOrderForm(form = {}) {
  const startName = String(form.startName || '').trim()
  const endName = String(form.endName || '').trim()
  if (!startName || !endName) return '请先补全顺风车起点和终点'
  if (startName === endName) return '顺风车起点和终点不能相同'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.departDate || ''))) return '请选择有效的顺风车出发日期'
  const departMs = dateInputMs(form.departDate)
  const todayMs = dateInputMs(formatDateInput())
  if (Number.isFinite(departMs) && departMs < todayMs) return '顺风车出发日期不能早于今天'
  if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(String(form.timeRange || ''))) return '请选择有效的顺风车出发时段'
  const passengerCount = Number(form.passengerCount)
  if (!Number.isFinite(passengerCount) || passengerCount < 1 || passengerCount > 4) return '顺风车乘车人数需要在 1-4 人之间'
  return ''
}

function MembershipBoard({ membership, coupons = [], onActivate, onSyncCoupons }) {
  const active = Boolean(membership?.active || membership?.memberStatus === 'ACTIVE')
  const memberCoupons = normalizeList(coupons).filter((coupon) => {
    const mode = String(coupon.receiveMode || coupon.operationType || '').toUpperCase()
    const name = `${coupon.couponName || coupon.name || ''}`
    return mode === 'MEMBER_WEEKLY' || name.includes('会员')
  })
  const usableMemberCoupons = memberCoupons.filter((coupon) => normalizeCouponStatus(coupon) === 'UNUSED')
  const expireText = membership?.expireDate || membership?.validEndTime || membership?.endTime || '-'
  const lastSyncText = membership?.lastSyncAt || membership?.lastIssuedAt || membership?.updatedAt || '待同步'
  const levelText = active ? membership?.memberLevel || '阳光会员' : '开通后生效'
  const progressItems = [
    ['1', '开通会员', active ? 'done' : 'active'],
    ['2', '同步券包', active && memberCoupons.length ? 'done' : active ? 'active' : ''],
    ['3', '下单抵扣', usableMemberCoupons.length ? 'done' : '']
  ]
  return (
    <div className="dashboard-grid member-board">
      <section className={`glass-panel work-card member-hero-card ${active ? 'is-active' : 'is-idle'}`}>
        <div className="card-head">
          <div>
            <span className="section-kicker">会员权益</span>
            <h2>{active ? membership?.memberLevel || '阳光会员' : '未开通会员'}</h2>
          </div>
          <BadgeCheck size={24} />
        </div>
        <div className="member-status-line">
          <StatusBadge value={active ? 'ACTIVE' : 'NONE'} />
          <span>{active ? `有效期至 ${expireText}` : '开通后每周自动同步专属优惠券'}</span>
        </div>
        <div className="member-privilege-list">
          {[
            ['会员等级', levelText],
            ['权益同步', active ? lastSyncText : '开通后可同步'],
            ['下单抵扣', usableMemberCoupons.length ? `${usableMemberCoupons.length} 张可用` : '暂无可用会员券']
          ].map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        <div className="member-benefit-grid">
          <SummaryPill icon={Ticket} value={`${membership?.weeklyCouponTotal || memberCoupons.length || 0} 张`} label="累计会员券" />
          <SummaryPill icon={BadgeCheck} value={`${usableMemberCoupons.length} 张`} label="当前可用" />
          <SummaryPill icon={RefreshCw} value={membership?.issuedCount || 0} label="本次到账" />
        </div>
        <div className="member-progress-list">
          {progressItems.map(([step, label, state]) => (
            <div className={state} key={step}><span>{step}</span><p>{label}</p></div>
          ))}
        </div>
        <div className="member-actions">
          <button className="solid-button" onClick={active ? onSyncCoupons : onActivate}>
            <Ticket size={16} />{active ? '同步本周券包' : '开通会员'}
          </button>
          <button className="ghost-button" disabled={!active} onClick={onSyncCoupons}><RefreshCw size={16} />刷新权益</button>
        </div>
      </section>
      <section className="glass-panel work-card wide member-coupon-card">
        <div className="card-head"><div><span className="section-kicker">会员券包</span><h2>专属优惠券</h2></div><Wallet size={21} /></div>
        {memberCoupons.length ? (
          <div className="coupon-wallet-list member-coupon-list">
            {memberCoupons.slice(0, 6).map((coupon, index) => (
              <CouponTicket coupon={coupon} key={coupon.id || coupon.userCouponId || `${coupon.couponName}-${index}`} owned />
            ))}
          </div>
        ) : <EmptyState text={active ? '本周会员券尚未同步，点击同步本周券包。' : '开通会员后这里会显示每周专属券。'} />}
      </section>

      {false && <section className="glass-panel work-card support-profile-card support-order-panel">
        <div className="card-head">
          <div>
            <span className="section-kicker">关联订单</span>
            <h2>订单信息</h2>
          </div>
          <Route size={21} />
        </div>

        {relatedOrder ? (
          <>
            <div className="support-order-hero">
              <div className="support-order-service">
                <span className="support-order-service-icon">
                  <ServiceIcon type={relatedOrder.serviceType} />
                </span>
                <div>
                  <strong>{orderPanelTitle}</strong>
                  <small>{relatedOrder.orderNo || `#${relatedOrder.id}`}</small>
                </div>
              </div>
              <StatusBadge value={relatedOrder.orderStatus} />
            </div>

            <div className="support-order-route">
              <div>
                <span className="address-dot start" />
                <small>上车点</small>
                <strong>{relatedOrder.startName || '-'}</strong>
              </div>
              <div>
                <span className="address-dot end" />
                <small>目的地</small>
                <strong>{relatedOrder.endName || '-'}</strong>
              </div>
            </div>

            <div className="support-order-metrics">
              <MiniStat label="订单金额" value={orderAmount} />
              <MiniStat label="预估里程" value={orderDistance} />
              <MiniStat label="预估时长" value={orderDuration} />
            </div>

            <InfoPanel title="订单详情" items={orderDetailItems} />

            <div className="support-order-note">
              <strong>客服会优先参考这笔订单</strong>
              <small>{isDriver ? '处理听单、提现、资质和行程异常时，会结合当前或最近订单信息定位问题。' : '处理费用、发票、取消和行程问题时，会结合当前或最近订单信息定位问题。'}</small>
            </div>
          </>
        ) : (
          <div className="support-order-empty">
            <EmptyState text="暂无可关联订单" />
            <small>有订单后，这里会显示路线、金额和状态，方便客服更快定位问题。</small>
          </div>
        )}
      </section>}
    </div>
  )
}

function formatOrderTime(order = {}) {
  const value = order.createdTime || order.createTime || order.orderTime || order.departTime || order.updatedAt
  if (!value) return '时间未记录'
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0] = value
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
  return String(value).replace('T', ' ').slice(0, 16)
}

function formatDateInput(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  const safeDate = Number.isNaN(value.getTime()) ? new Date() : value
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')}`
}

function getCarTypeDescription(item = {}) {
  const name = getCarTypeName(item)
  if (name.includes('商务')) return '更宽敞，适合接送机和跨城'
  if (name.includes('舒适')) return '空间更稳，适合多人出行'
  return '日常通勤，响应更快'
}

function getRideProgressPercent(order = {}) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) return 0
  if (order.orderStatus === ORDER_STATUS.FINISHED) return 100
  if (order.orderStatus === ORDER_STATUS.IN_TRIP) return 68
  if (order.orderStatus === ORDER_STATUS.PICKING_UP) return 42
  if (order.orderStatus === ORDER_STATUS.ACCEPTED) return 28
  if (order.orderStatus === ORDER_STATUS.DISPATCHING) return 16
  return 8
}

function isPassengerPickupReady(runtime = {}, order = {}) {
  if (order.orderStatus !== ORDER_STATUS.PICKING_UP) return false
  const remainDistanceKm = Number(runtime?.remainDistanceKm)
  const remainingSeconds = Number(runtime?.remainingSeconds)
  const hasDistance = Number.isFinite(remainDistanceKm)
  const hasSeconds = Number.isFinite(remainingSeconds)
  if (hasDistance && hasSeconds) return remainDistanceKm <= 0.05 && remainingSeconds <= 60
  if (hasDistance) return remainDistanceKm <= 0.05
  if (hasSeconds) return remainingSeconds <= 60
  return runtime?.driverArrived === true
}

function buildOrderFeeRows(order = {}) {
  const currency = order.currencyCode || 'CNY'
  const payable = Number(order.payableAmount || order.actualAmount || order.estimatedAmount || 0)
  const estimated = Number(order.estimatedAmount || payable)
  const actual = Number(order.actualAmount || payable)
  const webExclusiveDiscount = Number(order.webExclusiveDiscountAmount || 0)
  const discount = Math.max(0, estimated - payable)
  const recordedDiscount = Number(order.couponDiscount || discount || 0)
  const couponDiscount = Math.max(0, Number((recordedDiscount - webExclusiveDiscount).toFixed(2)))
  const cancelFee = Number(order.cancelFee || 0)
  const rows = [
    { label: '预估费用', value: formatMoney(estimated, currency) },
    { label: '实际费用', value: formatMoney(actual || estimated, currency) }
  ]
  if (webExclusiveDiscount > 0) {
    rows.push({ label: order.webExclusiveDiscountLabel || '网页专属优惠', value: `-${formatMoney(webExclusiveDiscount, currency)}`, tone: 'discount' })
  }
  if (couponDiscount > 0) {
    rows.push({ label: order.couponName || '优惠抵扣', value: `-${formatMoney(couponDiscount, currency)}`, tone: 'discount' })
  } else if (!webExclusiveDiscount && discount > 0) {
    rows.push({ label: order.couponName || '优惠抵扣', value: `-${formatMoney(discount, currency)}`, tone: 'discount' })
  }
  if (cancelFee > 0) rows.push({ label: '取消费', value: formatMoney(cancelFee, currency), tone: 'warning' })
  rows.push({ label: '应付合计', value: formatMoney(payable, currency), tone: 'total' })
  return rows
}

function buildSupportFeedbackSummary(orders = []) {
  return normalizeList(orders).reduce((summary, order) => {
    const canEvaluate = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID && !isOrderEvaluated(order)
    const canComplain = order.orderStatus !== ORDER_STATUS.CANCELLED && !isOrderComplained(order)
    if (isOrderEvaluated(order)) summary.evaluated += 1
    if (isOrderComplained(order)) summary.complained += 1
    if (canEvaluate || canComplain) summary.actionable += 1
    if (canEvaluate) summary.pending += 1
    return summary
  }, { evaluated: 0, complained: 0, actionable: 0, pending: 0 })
}

function maskPhone(value = '') {
  const text = String(value || '')
  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(-4)}` : text
}

function dateInputMs(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return NaN
  return new Date(`${text}T00:00:00`).getTime()
}

function buildPassengerWalletRecords(orders = []) {
  return normalizeList(orders)
    .filter((order) => [PAY_STATUS.PAID, PAY_STATUS.REFUNDED].includes(order.payStatus))
    .sort((left, right) => walletOrderTimeMs(right) - walletOrderTimeMs(left))
    .slice(0, 20)
    .map((order, index) => {
      const refunded = order.payStatus === PAY_STATUS.REFUNDED
      const amount = Number(order.actualAmount || order.payableAmount || order.estimatedAmount || order.cancelFee || 0)
      const timeText = formatWalletRecordTime(order)
      return {
        key: `wallet-${order.id || order.orderNo || index}`,
        order,
        orderNo: order.orderNo || `#${order.id}`,
        title: buildWalletRouteText(order),
        serviceLabel: statusLabel[order.serviceType] || order.serviceType || '出行服务',
        statusText: refunded ? '已退款' : '已支付',
        marker: refunded ? '退' : '支',
        tone: refunded ? 'refund' : 'spend',
        amount,
        currencyCode: order.currencyCode || 'CNY',
        amountText: `${refunded ? '+' : '-'}${formatMoney(amount, order.currencyCode)}`,
        timeText
      }
    })
}

function buildPassengerWalletSummary(records = []) {
  if (!records.length) {
    return {
      spendText: formatMoney(0),
      refundText: formatMoney(0),
      countText: '0 笔',
      latestText: '等待同步'
    }
  }
  return {
    spendText: formatWalletTotals(records.filter((item) => item.tone === 'spend')),
    refundText: formatWalletTotals(records.filter((item) => item.tone === 'refund')),
    countText: `${records.length} 笔`,
    latestText: records[0]?.timeText || '已同步'
  }
}

function formatWalletTotals(records = []) {
  const totals = records.reduce((map, item) => {
    const currency = item.currencyCode || 'CNY'
    map[currency] = Number(map[currency] || 0) + Number(item.amount || 0)
    return map
  }, {})
  const entries = ['CNY', 'USD']
    .filter((currency) => totals[currency])
    .map((currency) => formatMoney(totals[currency], currency))
  return entries.length ? entries.join(' / ') : formatMoney(0)
}

function buildWalletRouteText(order = {}) {
  const startName = String(order.startName || '').trim()
  const endName = String(order.endName || '').trim()
  if (startName && endName) return `${startName} 至 ${endName}`
  return startName || endName || order.orderNo || `订单 #${order.id || '--'}`
}

function walletOrderTimeMs(order = {}) {
  return dateLikeToMs(order.paidAt || order.refundedAt || order.finishedAt || order.updatedAt || order.createdAt) || Number(order.id || 0)
}

function formatWalletRecordTime(order = {}) {
  const raw = order.paidAt || order.refundedAt || order.finishedAt || order.updatedAt || order.createdAt
  const text = formatOrderDisplayTime({ createdAt: raw })
  return text === '-' ? '时间待同步' : text.replace(/^\d{4}-/, '')
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function driverIncomeMonthKey(order = {}) {
  const raw = order.completedAt || order.finishTime || order.finishedAt || order.updatedAt || order.createdAt
  const date = raw ? new Date(String(raw).replace(/-/g, '/')) : new Date()
  if (Number.isNaN(date.getTime())) return currentMonthKey()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function driverIncomeAmount(order = {}) {
  const explicit = order.driverIncomeAmount ?? order.driverIncome ?? order.incomeAmount
  if (explicit !== undefined && explicit !== null) return Number(explicit) || 0
  return Number(order.payableAmount || order.actualAmount || order.estimatedAmount || 0) * 0.8
}

function buildDriverIncomeMonthOptions(orders = []) {
  const months = new Set([currentMonthKey()])
  normalizeList(orders).forEach((order) => months.add(driverIncomeMonthKey(order)))
  return Array.from(months)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({ value, label: formatDriverMonthLabel(value) }))
}

function formatDriverMonthLabel(value = '') {
  const match = String(value).match(/^(\d{4})-(\d{2})$/)
  if (!match) return '本月'
  return value === currentMonthKey() ? '本月' : `${match[1]}年${Number(match[2])}月`
}

function CarpoolBoard({ data, coupons = [], settings = passengerDefaultSettings, carTypes = fallbackCarTypes, onSearch, onPublish, onApply, onOwnerAction, onPassengerConfirm, onCancel, onCreateOrder, onEstimateOrder }) {
  const [active, setActive] = useState('search')
  const [selectedTripId, setSelectedTripId] = useState('')
  const [selectedOrderCouponId, setSelectedOrderCouponId] = useState('')
  const [publishError, setPublishError] = useState('')
  const [applyError, setApplyError] = useState('')
  const [orderEstimate, setOrderEstimate] = useState(null)
  const [orderEstimateLoading, setOrderEstimateLoading] = useState(false)
  const [orderEstimateError, setOrderEstimateError] = useState('')
  const [applyDraft, setApplyDraft] = useState({
    companionCount: 0,
    note: ''
  })
  const [form, setForm] = useState({
    startName: '燕京理工学院-南门',
    endName: '天洋广场',
    startPoint: findPoi('poi101'),
    endPoint: findPoi('poi102'),
    departDate: formatDateInput(),
    timeRange: '18:00-21:00',
    passengerCount: 1,
    seatCount: 3,
    sharedAmount: 12,
    luggageMode: 'HAS_LUGGAGE',
    tollMode: 'NEGOTIABLE',
    note: ''
  })
  const luggageOptions = [['NO_LUGGAGE', '无行李'], ['HAS_LUGGAGE', '有行李']]
  const tollOptions = [['PASSENGER_PAYS', '乘客出高速费'], ['NEGOTIABLE', '高速费协商']]
  const timeRangeOptions = ['07:00-09:00', '09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00']
  const [addressQuery, setAddressQuery] = useState('')
  const [addressTarget, setAddressTarget] = useState('end')
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)
  const [addressBook, setAddressBook] = usePersistentState(addressBookKey, { history: [], favorites: [] })
  const [remoteAddressCandidates, setRemoteAddressCandidates] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const mine = splitCarpoolMine(data.mine, data.list)
  const list = useMemo(() => normalizeList(data.list), [data.list])
  const selectedTrip = list.find((trip) => String(trip.id) === String(selectedTripId)) || list[0] || null
  const carTypeId = Number(carTypes?.[0]?.id || 1)
  const currentStart = form.startPoint || resolvePoiFromText(form.startName, 'poi101')
  const currentEnd = form.endPoint || resolvePoiFromText(form.endName, 'poi102')
  const carpoolPoiOptions = poiLibrary
  const safeAddressBook = useMemo(() => normalizeAddressBook(addressBook, carpoolPoiOptions), [addressBook, carpoolPoiOptions])
  const addressCandidates = useMemo(() => {
    const keyword = addressQuery.trim().toLowerCase()
    const source = keyword
      ? remoteAddressCandidates
      : [...safeAddressBook.favorites, ...safeAddressBook.history, ...carpoolPoiOptions]
    const deduped = dedupeAddressPoints(source)
    const scored = deduped.map((poi, index) => {
      const haystack = `${poi.name} ${poi.address} ${(poi.tags || []).join(' ')}`.toLowerCase()
      const key = getAddressKey(poi)
      const active = sameAddressPoint(poi, currentStart) || sameAddressPoint(poi, currentEnd)
      const favorite = safeAddressBook.favorites.some((item) => sameAddressPoint(item, poi))
      const recent = safeAddressBook.history.some((item) => sameAddressPoint(item, poi))
      const score = (active ? 8 : 0) + (favorite ? 4 : 0) + (recent ? 2 : 0)
      return {
        ...poi,
        addressKey: key,
        active,
        favorite,
        recent,
        matched: !keyword || haystack.includes(keyword),
        score,
        listIndex: index
      }
    })
    return scored
      .filter((poi) => poi.matched)
      .sort((left, right) => keyword
        ? right.score - left.score || left.name.localeCompare(right.name, 'zh-Hans-CN')
        : left.listIndex - right.listIndex)
      .slice(0, 6)
  }, [addressQuery, currentEnd, currentStart, remoteAddressCandidates, safeAddressBook.favorites, safeAddressBook.history])
  const routePreview = useMemo(() => {
    return calcRoute(currentStart, currentEnd)
  }, [currentEnd, currentStart])
  const hasOrderEstimate = Boolean(orderEstimate)
  const orderCouponOptions = useMemo(() => buildPayCouponOptions({
    serviceType: SERVICE_TYPE.CARPOOL,
    estimatedAmount: hasOrderEstimate ? orderEstimate.amount : null,
    originalAmount: hasOrderEstimate ? orderEstimate.amount : null,
    currencyCode: orderEstimate?.currencyCode || 'CNY'
  }, coupons), [coupons, hasOrderEstimate, orderEstimate?.amount, orderEstimate?.currencyCode])
  const selectedOrderCoupon = orderCouponOptions.find((coupon) => coupon.userCouponIdText === selectedOrderCouponId) || null
  const carpoolOrderDiscount = selectedOrderCoupon ? Number(selectedOrderCoupon.discountAmount || 0) : 0
  const carpoolOrderPayable = hasOrderEstimate
    ? roundMoney(Math.max(0, Number(orderEstimate.amount || 0) - carpoolOrderDiscount))
    : null
  const update = (patch) => setForm((draft) => ({ ...draft, ...patch }))
  const swapAddress = () => update({
    startName: form.endName,
    endName: form.startName,
    startPoint: form.endPoint,
    endPoint: form.startPoint
  })
  const openAddressSearch = (target) => {
    setAddressTarget(target)
    setAddressQuery('')
    setAddressError('')
    setRemoteAddressCandidates([])
    setAddressSearchOpen(true)
  }
  const chooseAddressCandidate = (poi) => {
    const point = normalizeWebAddressPoint(poi)
    update(addressTarget === 'start'
      ? { startName: point.name, startPoint: point }
      : { endName: point.name, endPoint: point })
    setAddressBook((current) => addAddressHistory(current, point, carpoolPoiOptions))
    setAddressQuery('')
    setRemoteAddressCandidates([])
    setAddressSearchOpen(false)
  }
  const toggleAddressFavorite = (poi) => {
    setAddressBook((current) => toggleAddressFavoriteId(current, poi, carpoolPoiOptions))
  }
  const clearAddressHistory = () => {
    setAddressBook((current) => ({ ...normalizeAddressBook(current, carpoolPoiOptions), history: [] }))
  }
  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      window.alert('当前浏览器暂不支持定位，请手动选择地址')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestPoiByCoordinate(position.coords.latitude, position.coords.longitude, carpoolPoiOptions)
        chooseAddressCandidate(nearest || {
          id: `geo-carpool-${Date.now()}`,
          name: '我的当前位置',
          address: `经纬度 ${Number(position.coords.latitude).toFixed(6)}, ${Number(position.coords.longitude).toFixed(6)}`,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'currentLocation'
        })
      },
      () => window.alert('未能获取当前位置，请检查浏览器定位权限'),
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
    )
  }
  const renderCarpoolAddressPicker = ({ includeSearchPanel = true } = {}) => (
    <>
      <div className="booking-route-stack carpool-route-stack">
        <AddressPointField
          icon={Locate}
          label="从哪里出发"
          point={currentStart}
          active={addressSearchOpen && addressTarget === 'start'}
          onClick={() => openAddressSearch('start')}
        />
        <button type="button" className="address-swap-button" onClick={swapAddress} aria-label="交换上车点和目的地">换</button>
        <AddressPointField
          icon={Flag}
          label="去哪里"
          point={currentEnd}
          active={addressSearchOpen && addressTarget === 'end'}
          onClick={() => openAddressSearch('end')}
        />
      </div>
      {includeSearchPanel && addressSearchOpen && <div className="address-search-panel carpool-address-search-panel">
        <div className="address-search-head">
          <div>
            <span>地址搜索</span>
            <small>候选地址、收藏点和地图选点逻辑同步到网页端</small>
          </div>
          <div className="segmented-row address-target-tabs" role="tablist" aria-label="地址写入位置">
            <button type="button" className={addressTarget === 'start' ? 'active' : ''} onClick={() => openAddressSearch('start')}>上车点</button>
            <button type="button" className={addressTarget === 'end' ? 'active' : ''} onClick={() => openAddressSearch('end')}>目的地</button>
            <button type="button" onClick={() => setAddressSearchOpen(false)}>收起</button>
          </div>
        </div>
        <label className="address-search-input">
          <Locate size={15} />
          <input
            value={addressQuery}
            onChange={(event) => setAddressQuery(event.target.value)}
            placeholder={addressTarget === 'start' ? '搜索上车点、城市、小区、学校或商圈' : '搜索目的地、城市、小区、学校或商圈'}
          />
        </label>
        <div className="address-history-tools">
          <button type="button" onClick={useCurrentLocation}><Locate size={14} />当前位置</button>
          <button type="button" disabled={!safeAddressBook.history.length} onClick={clearAddressHistory}><XCircle size={14} />清空历史</button>
          <span>{addressLoading ? '地图搜索中...' : `${safeAddressBook.favorites.length} 个收藏 · ${safeAddressBook.history.length} 条最近`}</span>
        </div>
        {addressError && <p className="address-search-error">{addressError}</p>}
        <div className="address-candidate-list">
          {addressCandidates.map((poi) => (
            <div className={`address-candidate-row ${poi.active ? 'active' : ''}`} key={poi.addressKey || getAddressKey(poi)}>
              <button type="button" className="address-candidate-main" onClick={() => chooseAddressCandidate(poi)}>
                <div>
                  <strong>{poi.name}</strong>
                  <small>{poi.address}</small>
                </div>
                <em>{addressTarget === 'start' ? '设为上车点' : '设为目的地'}</em>
              </button>
              <button
                type="button"
                className={`address-favorite-button ${poi.favorite ? 'active' : ''}`}
                aria-label={poi.favorite ? '取消收藏地址' : '收藏地址'}
                onClick={() => toggleAddressFavorite(poi)}
              >
                <Star size={14} />
              </button>
            </div>
          ))}
          {!addressCandidates.length && (
            <div className="address-candidate-empty">
              {addressLoading ? '正在搜索地图地址...' : addressQuery.trim() ? '没有匹配地址，换个关键词试试' : '输入关键词后显示地图候选地址'}
            </div>
          )}
        </div>
      </div>}
    </>
  )

  useEffect(() => {
    if (!onEstimateOrder) {
      setOrderEstimate(null)
      setOrderEstimateLoading(false)
      setOrderEstimateError('后端估价接口未配置')
      return undefined
    }
    let cancelled = false
    setOrderEstimate(null)
    setOrderEstimateError('')
    setOrderEstimateLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const data = await onEstimateOrder({ ...form, carTypeId })
        if (!cancelled) setOrderEstimate(data || null)
      } catch (error) {
        if (!cancelled) setOrderEstimateError(error.message || '后端估价暂未同步')
      } finally {
        if (!cancelled) setOrderEstimateLoading(false)
      }
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [carTypeId, form.endName, form.endPoint, form.startName, form.startPoint, onEstimateOrder])

  useEffect(() => {
    if (!addressSearchOpen) return undefined
    const keyword = addressQuery.trim()
    let cancelled = false
    setAddressError('')
    if (!keyword) {
      setRemoteAddressCandidates([])
      setAddressLoading(false)
      return undefined
    }
    setAddressLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const list = await searchWebAddressCandidates(keyword, currentStart, {
          pageSize: 8,
          serviceType: SERVICE_TYPE.CARPOOL
        })
        if (!cancelled) setRemoteAddressCandidates(list)
      } catch (error) {
        if (!cancelled) {
          setRemoteAddressCandidates(buildLocalAddressCandidates(keyword, currentStart, { serviceType: SERVICE_TYPE.CARPOOL }))
          setAddressError('地图搜索暂时不可用，已显示本地候选')
        }
      } finally {
        if (!cancelled) setAddressLoading(false)
      }
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [addressQuery, addressSearchOpen, currentStart.latitude, currentStart.longitude])

  useEffect(() => {
    if (!selectedTripId && list[0]?.id) setSelectedTripId(String(list[0].id))
    if (selectedTripId && list.length && !list.some((trip) => String(trip.id) === String(selectedTripId))) {
      setSelectedTripId(String(list[0].id))
    }
  }, [list, selectedTripId])

  useEffect(() => {
    if (!normalizePassengerSettings(settings).autoUseCoupon || !orderCouponOptions.length) {
      setSelectedOrderCouponId('')
      return
    }
    if (!orderCouponOptions.some((coupon) => coupon.userCouponIdText === selectedOrderCouponId)) {
      setSelectedOrderCouponId(orderCouponOptions[0].userCouponIdText)
    }
  }, [orderCouponOptions, selectedOrderCouponId, settings])

  const submitPublish = () => {
    const startName = form.startName.trim()
    const endName = form.endName.trim()
    const seatCount = Number(form.seatCount)
    const sharedAmount = Number(form.sharedAmount)
    if (!startName || !endName) {
      setPublishError('请填写完整的出发地和目的地')
      return
    }
    if (startName === endName) {
      setPublishError('出发地和目的地不能相同')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.departDate)) {
      setPublishError('出发日期格式需要为 YYYY-MM-DD')
      return
    }
    const todayMs = dateInputMs(formatDateInput())
    const departMs = dateInputMs(form.departDate)
    if (Number.isFinite(departMs) && departMs < todayMs) {
      setPublishError('出发日期不能早于今天')
      return
    }
    if (!Number.isFinite(seatCount) || seatCount < 1 || seatCount > 6) {
      setPublishError('可提供座位需要在 1-6 座之间')
      return
    }
    if (!Number.isFinite(sharedAmount) || sharedAmount < 0) {
      setPublishError('分摊金额不能小于 0')
      return
    }
    const luggageLabel = luggageOptions.find(([key]) => key === form.luggageMode)?.[1] || '无行李'
    const tollLabel = tollOptions.find(([key]) => key === form.tollMode)?.[1] || '高速费协商'
    setPublishError('')
    onPublish({
      startName,
      endName,
      startLat: String((form.startPoint || {}).latitude || ''),
      startLng: String((form.startPoint || {}).longitude || ''),
      endLat: String((form.endPoint || {}).latitude || ''),
      endLng: String((form.endPoint || {}).longitude || ''),
      departTime: `${form.departDate} ${form.timeRange.split('-')[0]}:00`,
      seatCount,
      sharedAmount,
      baggageRule: `${luggageLabel} · ${tollLabel}`,
      tripRemark: form.note || '网页端顺风车发布'
    })
  }

  const submitApply = (trip = selectedTrip) => {
    if (!trip?.id) {
      setApplyError('请先选择一条可搭乘行程')
      return
    }
    const companionCount = Number(applyDraft.companionCount)
    const totalSeatCount = companionCount + 1
    const remainSeat = carpoolRemainSeatCount(trip)
    if (!Number.isFinite(companionCount) || companionCount < 0 || companionCount > 3) {
      setApplyError('同行人数需要在 0-3 人之间')
      return
    }
    if (Number.isFinite(remainSeat) && totalSeatCount > remainSeat) {
      setApplyError(`当前余座仅 ${remainSeat} 座，请调整同行人数`)
      return
    }
    setApplyError('')
    onApply(trip, {
      companionCount,
      note: applyDraft.note.trim() || `网页端申请搭乘，合计 ${totalSeatCount} 人`
    })
  }

  return (
    <div className="dashboard-grid carpool-board">
      <section className="glass-panel work-card wide carpool-main-card">
        <div className="card-head carpool-head">
          <div className="carpool-title-block"><span className="section-kicker">同行</span><h2>顺风车</h2></div>
          <div className="price-stack carpool-price-stack">
            <div className="price-pill">{hasOrderEstimate ? formatMoney(carpoolOrderPayable, orderEstimate.currencyCode) : (orderEstimateLoading ? '同步中' : '待估价')}</div>
            {selectedOrderCoupon && <small>优惠 {formatMoney(carpoolOrderDiscount, orderEstimate?.currencyCode || 'CNY')}</small>}
          </div>
        </div>
        <div className="segmented-row carpool-tabs">
          {[
            ['search', '可搭乘', data.list?.length || 0],
            ['publish', '发布行程', ''],
            ['mine', '我的顺风车', mine.total]
          ].map(([key, label, count]) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}>{label}{count !== '' && <span>{count}</span>}</button>)}
        </div>
        <div className="carpool-summary-strip">
          <SummaryPill icon={SERVICE_ICON_PATHS[SERVICE_TYPE.CARPOOL]} label="可搭乘行程" value={`${list.length} 条`} />
          <SummaryPill icon={Clock} label="待确认" value={`${mine.pendingTotal} 条`} />
          <SummaryPill icon={Route} label="当前选择" value={selectedTrip ? `${selectedTrip.startName} → ${selectedTrip.endName}` : '未选择'} />
        </div>
        {active !== 'mine' && <div className="carpool-selection-panel">
          <div className="group-head">
            <div>
              <strong>顺风车选择</strong>
              <small>对齐小程序的地址、日期、时段、人数和出行偏好</small>
            </div>
            <span>乘客行程</span>
          </div>
          {renderCarpoolAddressPicker()}
          <div className="carpool-choice-grid">
            <label className="plain-field"><span>出发日期</span><input type="date" value={form.departDate} min={formatDateInput()} onChange={(event) => update({ departDate: event.target.value })} /></label>
            <label className="plain-field"><span>时间段</span><select value={form.timeRange} onChange={(event) => update({ timeRange: event.target.value })}>{timeRangeOptions.map((item) => <option key={item} value={item}>{item.replace('-', ' - ')}</option>)}</select></label>
            <label className="plain-field"><span>乘车人数</span><select value={form.passengerCount} onChange={(event) => update({ passengerCount: Number(event.target.value) })}>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>{item} 人</option>)}</select></label>
          </div>
          <div className="carpool-preference-grid">
            <CarpoolOptionGroup title="行李情况" value={form.luggageMode} options={luggageOptions} onChange={(value) => update({ luggageMode: value })} />
            <CarpoolOptionGroup title="高速费方案" value={form.tollMode} options={tollOptions} onChange={(value) => update({ tollMode: value })} />
          </div>
          <label className="plain-field carpool-note"><span>补充说明</span><textarea value={form.note} maxLength={100} placeholder="上车点细节、是否赶时间等" onChange={(event) => update({ note: event.target.value })} /></label>
          {active === 'publish' ? (
            <div className="carpool-publish-panel">
              <div className="stat-grid carpool-publish-stats">
                <Metric value={mine.ownerRecords.length} label="我发布的" />
                <Metric value={mine.passengerRecords.length} label="我申请的" />
                <Metric value={mine.pendingTotal} label="待确认" />
              </div>
              <div className="carpool-form-grid carpool-publish-extra-grid">
                <Field label="可提供座位" value={form.seatCount} onChange={(value) => update({ seatCount: value })} />
                <Field label="分摊金额" value={form.sharedAmount} onChange={(value) => update({ sharedAmount: value })} />
              </div>
              {publishError && <p className="form-error-line">{publishError}</p>}
              <button className="solid-button fill" onClick={submitPublish}><Send size={16} />发布顺风车</button>
            </div>
          ) : (
            <div className="carpool-selection-actions">
              <button
                type="button"
                className="solid-button"
                onClick={() => {
                  setActive('search')
                  onSearch(`${form.startName} ${form.endName}`.trim())
                }}
              >
                <RefreshCw size={16} />查找顺路车
              </button>
              <button type="button" className="ghost-button" onClick={() => setActive('publish')}><Send size={16} />按此行程发布</button>
            </div>
          )}
          {active !== 'publish' && <div className="carpool-confirm-panel">
            <div className="payment-coupon-head">
              <div>
                <span>顺风车确认下单</span>
                <small>对齐小程序确认页：路线、人数、行李、高速费和优惠券会一起写入订单。</small>
              </div>
              <strong>{hasOrderEstimate ? formatMoney(carpoolOrderPayable, orderEstimate.currencyCode) : '待后端估价'}</strong>
            </div>
            <div className="carpool-confirm-stats">
              <MiniStat label="路线距离" value={hasOrderEstimate ? `${Number(orderEstimate.distanceKm || routePreview.distanceKm || 0).toFixed(1)} km` : `${Number(routePreview.distanceKm || 0).toFixed(1)} km`} />
              <MiniStat label="订单金额" value={hasOrderEstimate ? formatMoney(orderEstimate.amount, orderEstimate.currencyCode) : (orderEstimateLoading ? '同步中' : '待同步')} />
              <MiniStat label="优惠" value={selectedOrderCoupon ? `已选 ${formatMoney(carpoolOrderDiscount, orderEstimate?.currencyCode || 'CNY')}` : '以后端结算'} />
            </div>
            {orderEstimateError && <p className="payment-coupon-empty">{orderEstimateError}</p>}
            {orderCouponOptions.length ? (
              <div className="payment-coupon-list carpool-coupon-list">
                {orderCouponOptions.slice(0, 3).map((coupon) => (
                  <button
                    type="button"
                    key={coupon.userCouponIdText}
                    className={selectedOrderCouponId === coupon.userCouponIdText ? 'active' : ''}
                    onClick={() => setSelectedOrderCouponId(
                      selectedOrderCouponId === coupon.userCouponIdText ? '' : coupon.userCouponIdText
                    )}
                  >
                    <strong>-{formatMoney(coupon.discountAmount, orderEstimate?.currencyCode || 'CNY')}</strong>
                    <span>{coupon.name}</span>
                    <small>{coupon.ruleText || '顺风车订单可用'}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="payment-coupon-empty carpool-coupon-empty">暂无满足顺风车金额和业务范围的可用券。</p>
            )}
            <button type="button" className="solid-button fill" disabled={!hasOrderEstimate || orderEstimateLoading} onClick={() => onCreateOrder?.({ ...form, carTypeId }, selectedOrderCoupon)}>
              <Send size={16} />{orderEstimateLoading ? '同步估价中' : '提交顺风车订单'}
            </button>
          </div>}
        </div>}
        {active === 'search' && (
          <div className="carpool-trip-list">
            {list.length ? list.map((trip) => (
              <CarpoolTripCard
                trip={trip}
                key={trip.id}
                selected={String(selectedTrip?.id) === String(trip.id)}
                onSelect={() => setSelectedTripId(String(trip.id))}
                onApply={() => {
                  setSelectedTripId(String(trip.id))
                  submitApply(trip)
                }}
              />
            )) : <EmptyState text="暂无匹配的顺风车。" />}
          </div>
        )}
        {active === 'mine' && (
          <div className="carpool-mine-panel">
            {mine.records.length ? mine.records.map((record) => (
              <CarpoolRecordCard
                record={record}
                key={record.id}
                onOwnerAction={onOwnerAction}
                onPassengerConfirm={onPassengerConfirm}
                onCancel={onCancel}
              />
            )) : <EmptyState text="暂无顺风车记录。" />}
          </div>
        )}
      </section>
    </div>
  )
}

function CarpoolOptionGroup({ title, value, options, onChange }) {
  return (
    <div className="option-group web">
      <strong>{title}</strong>
      <div className="option-grid-two web">
        {options.map(([key, label]) => <button key={key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>{label}</button>)}
      </div>
    </div>
  )
}

function CarpoolTripCard({ trip, onApply, muted = false, selected = false, onSelect }) {
  const canApply = trip.canApply !== false && !trip.hasApplied && !['FULL', 'CONFIRMED', 'CANCELLED', 'FINISHED'].includes(String(trip.status || trip.tripStatus || '').toUpperCase())
  const actionText = selected ? '已选择，填写申请' : '选择行程'
  return (
    <article
      className={`carpool-trip-card glass-panel ${muted ? 'muted-card' : ''} ${selected ? 'is-selected' : ''}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (!onSelect) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="order-line">
        <div><h3>{trip.startName} <ChevronRight size={16} /> {trip.endName}</h3><p>{trip.departTimeText || trip.departTime || trip.createTime || '-'} · 余座 {trip.remainSeatCount ?? trip.remainingSeatCount ?? trip.seatCount ?? '-'}</p></div>
        <strong>{formatMoney(trip.sharedAmount || trip.amount || 0)}</strong>
      </div>
      <div className="carpool-trip-meta">
        <span>{trip.baggageRule || '行李规则待确认'}</span>
        <span>{trip.statusText || carpoolTripStatusText(trip.status || trip.tripStatus)}</span>
        {trip.myApplicationStatusText && <span>{trip.myApplicationStatusText}</span>}
      </div>
      {trip.tripRemark && <p className="muted">{trip.tripRemark}</p>}
      {onApply && (
        <div className="order-actions">
          <button
            className={canApply ? 'solid-button' : 'ghost-button'}
            disabled={!canApply}
            onClick={(event) => {
              event.stopPropagation()
              if (canApply) onApply()
            }}
          >
            <Send size={16} />{canApply ? actionText : carpoolTripActionText(trip)}
          </button>
        </div>
      )}
    </article>
  )
}

function carpoolRemainSeatCount(trip = {}) {
  const raw = trip.remainSeatCount ?? trip.remainingSeatCount ?? trip.availableSeatCount ?? trip.seatCount
  const value = Number(raw)
  return Number.isFinite(value) ? value : '-'
}

function carpoolTripActionText(trip = {}) {
  if (trip.hasApplied || trip.myApplicationStatusText) return trip.myApplicationStatusText || '已申请'
  const status = String(trip.status || trip.tripStatus || '').toUpperCase()
  return carpoolTripStatusText(status)
}

function CarpoolRecordCard({ record, onOwnerAction, onPassengerConfirm, onCancel }) {
  const trip = record.trip || record
  const applications = normalizeList(record.applications)
  const application = record.application
  return (
    <article className="carpool-record-card glass-panel">
      <div className="carpool-record-head">
        <div>
          <span>{record.roleText || (record.role === 'owner' ? '我发布' : '我申请')}</span>
          <h3>{trip.startName || record.startName} <ChevronRight size={15} /> {trip.endName || record.endName}</h3>
          <p>{record.departTimeText || trip.departTimeText || trip.departTime || '-'} · {record.seatText || trip.seatText || `余座 ${trip.remainSeatCount ?? trip.seatCount ?? '-'}`}</p>
        </div>
        <StatusBadge value={record.statusText ? null : (record.status || trip.status || application?.applicationStatus)} label={record.statusText || trip.statusText || application?.statusText || '待确认'} />
      </div>
      {record.role === 'owner' && (
        <div className="carpool-application-list">
          {applications.length ? applications.map((item) => (
            <CarpoolApplicationRow
              application={item}
              key={item.id}
              onOwnerAction={onOwnerAction}
              onCancel={onCancel}
            />
          )) : <EmptyState text="暂无乘客申请，发布后会在这里处理确认。" />}
        </div>
      )}
      {record.role !== 'owner' && application && (
        <CarpoolApplicationRow
          application={application}
          passengerMode
          onPassengerConfirm={onPassengerConfirm}
          onCancel={onCancel}
        />
      )}
    </article>
  )
}

function CarpoolApplicationRow({ application, passengerMode = false, onOwnerAction, onPassengerConfirm, onCancel }) {
  const status = application.applicationStatus || application.status
  return (
    <div className="carpool-application-row">
      <div>
        <span>{passengerMode ? '我的申请' : (application.passengerText || application.passengerName || '同行乘客')}</span>
        <p>{application.seatText || `${Number(application.totalSeatCount || application.companionCount || 1)} 人同行`} · {application.noteText || application.note || '未填写备注'}</p>
      </div>
      <div className="carpool-application-actions">
        <StatusBadge value={status} label={application.statusText || carpoolApplicationStatusText(status)} />
        {!passengerMode && application.canOwnerApprove && <button className="solid-button" onClick={() => onOwnerAction?.(application, 'APPROVE')}>确认</button>}
        {!passengerMode && application.canOwnerReject && <button className="ghost-button" onClick={() => onOwnerAction?.(application, 'REJECT')}>拒绝</button>}
        {passengerMode && application.canPassengerConfirm && <button className="solid-button" onClick={() => onPassengerConfirm?.(application)}>确认同行</button>}
        {passengerMode && application.canPassengerCancel && <button className="ghost-button" onClick={() => onCancel?.(application)}>取消</button>}
      </div>
    </div>
  )
}

function splitCarpoolMine(payload, searchableTrips = []) {
  const source = payload?.data || payload || {}
  const tripLookup = new Map(normalizeList(searchableTrips).map((trip) => [Number(trip.id), trip]))
  const ownerRecords = normalizeList(source.ownerRecords).length
    ? normalizeList(source.ownerRecords).map(normalizeCarpoolOwnerRecord)
    : normalizeList(source.published || source.publishList || source.ownerTrips || source.trips || source.createdTrips || []).map((trip) => normalizeCarpoolOwnerRecord({
      trip,
      applications: normalizeList(trip.applications || trip.applyList)
    }))
  const passengerRecords = normalizeList(source.passengerRecords).length
    ? normalizeList(source.passengerRecords).map(normalizeCarpoolPassengerRecord)
    : normalizeList(source.applied || source.applyList || source.applications || source.joinedTrips || []).map((application) => {
      const trip = application.trip || application.carpoolTrip || tripLookup.get(Number(application.tripId))
      return normalizeCarpoolPassengerRecord({ trip: trip || application, application })
    })
  const records = [...ownerRecords, ...passengerRecords]
  const pendingTotal = Number(source.summary?.pendingTotal ?? records.filter((item) => item.statusBucket === 'pending').length)
  return { ownerRecords, passengerRecords, records, pendingTotal, total: records.length }
}

function normalizeCarpoolOwnerRecord(item = {}) {
  const trip = normalizeCarpoolTrip(item.trip || item)
  const applications = normalizeList(item.applications).map(normalizeCarpoolApplication)
  return {
    id: `owner-${trip.id || item.id || Math.random()}`,
    role: 'owner',
    roleText: '我发布',
    trip,
    applications,
    statusBucket: item.statusBucket || carpoolStatusBucket(trip.status),
    statusText: item.statusBucketText || trip.statusText || carpoolTripStatusText(trip.status),
    seatText: `已约 ${trip.bookedSeatCount || Math.max(Number(trip.seatCount || 0) - Number(trip.remainSeatCount || trip.remainingSeatCount || 0), 0)} / 共 ${trip.seatCount || '-'} 座`,
    departTimeText: trip.departTimeText || formatOrderTime(trip)
  }
}

function normalizeCarpoolPassengerRecord(item = {}) {
  const trip = normalizeCarpoolTrip(item.trip || item)
  const application = normalizeCarpoolApplication(item.application || item)
  return {
    id: `passenger-${application.id || trip.id || Math.random()}`,
    role: 'passenger',
    roleText: '我申请',
    trip,
    application,
    statusBucket: item.statusBucket || carpoolStatusBucket(application.applicationStatus),
    statusText: item.statusBucketText || application.statusText || carpoolApplicationStatusText(application.applicationStatus),
    seatText: application.seatText,
    departTimeText: trip.departTimeText || formatOrderTime(trip)
  }
}

function normalizeCarpoolTrip(trip = {}) {
  const status = trip.status || trip.tripStatus || 'PUBLISHED'
  return {
    ...trip,
    startName: trip.startName || '待补充出发地',
    endName: trip.endName || '待补充目的地',
    departTimeText: trip.departTimeText || formatOrderTime(trip),
    status,
    statusText: trip.statusText || carpoolTripStatusText(status),
    seatText: `余 ${trip.remainSeatCount ?? trip.remainingSeatCount ?? trip.seatCount ?? '-'} / 共 ${trip.seatCount ?? '-'} 座`
  }
}

function normalizeCarpoolApplication(application = {}) {
  const status = application.applicationStatus || application.status || 'APPLIED'
  return {
    ...application,
    applicationStatus: status,
    statusText: application.statusText || application.applicationStatusText || carpoolApplicationStatusText(status),
    seatText: application.seatText || `${Number(application.totalSeatCount || application.companionCount || 1)} 人同行`,
    noteText: application.noteText || application.note || '未填写备注',
    canOwnerApprove: Boolean(application.canOwnerApprove || ['APPLIED', 'PENDING'].includes(status)),
    canOwnerReject: Boolean(application.canOwnerReject || ['APPLIED', 'PENDING'].includes(status)),
    canPassengerConfirm: Boolean(application.canPassengerConfirm || status === 'OWNER_CONFIRMED'),
    canPassengerCancel: Boolean(application.canPassengerCancel || !['CANCELLED', 'REJECTED'].includes(status))
  }
}

function carpoolTripStatusText(status) {
  return {
    PUBLISHED: '可申请',
    MATCHING: '拼友匹配中',
    FULL: '座位已满',
    CONFIRMED: '已确认成行',
    CANCELLED: '已取消',
    FINISHED: '已完成'
  }[status] || status || '可申请'
}

function carpoolApplicationStatusText(status) {
  return {
    APPLIED: '待车主确认',
    OWNER_CONFIRMED: '待乘客确认',
    PASSENGER_CONFIRMED: '已确认同行',
    CONFIRMED: '已确认同行',
    CANCELLED: '已取消',
    REJECTED: '已拒绝'
  }[status] || status || '待确认'
}

function carpoolStatusBucket(status) {
  if (['CANCELLED', 'REJECTED', 'FINISHED'].includes(status)) return 'completed'
  if (['CONFIRMED', 'PASSENGER_CONFIRMED'].includes(status)) return 'upcoming'
  return 'pending'
}

function InternationalBoard({ booking, estimate, profile, onSubmit }) {
  const [selectedOptionId, setSelectedOptionId] = useState(internationalOptions[0].id)
  const selectedOption = internationalOptions.find((item) => item.id === selectedOptionId) || internationalOptions[0]
  const [form, setForm] = useState(() => buildInternationalForm(profile))
  const routePoints = resolveInternationalRoutePoints(selectedOption)
  const internationalBooking = {
    ...booking,
    serviceType: SERVICE_TYPE.INTERNATIONAL,
    carTypeId: 3,
    startId: routePoints.startPoint.id,
    endId: routePoints.endPoint.id,
    startPoint: routePoints.startPoint,
    endPoint: routePoints.endPoint
  }
  const route = calcRoute(routePoints.startPoint, routePoints.endPoint)
  const distanceKm = parseMetricNumber(selectedOption.distanceText, route.distanceKm)
  const durationMin = parseMetricNumber(selectedOption.durationText, route.durationMin)
  const safeEstimate = {
    ...estimateLocalFare(internationalBooking.carTypeId, SERVICE_TYPE.INTERNATIONAL, distanceKm, durationMin),
    amount: selectedOption.basePrice,
    payable: selectedOption.basePrice,
    distanceKm,
    durationMin,
    currencyCode: 'USD',
    exchangeRate: 7.15
  }
  const updateForm = (patch) => setForm((value) => ({ ...value, ...patch }))
  const submit = () => onSubmit(selectedOption, form)

  return (
    <div className="dashboard-grid ride-workbench international-workbench">
      <InternationalBookingPanel
        option={selectedOption}
        form={form}
        onFormChange={updateForm}
        estimate={safeEstimate}
        onSubmit={submit}
      />
      <section className="glass-panel work-card international-map-card">
        <div className="international-map-head">
          <div>
            <span className="section-kicker">Global route</span>
            <h2>{selectedOption.routeCode}</h2>
            <p>{selectedOption.startName} → {selectedOption.endName}</p>
          </div>
          <span>{selectedOption.countryText}</span>
        </div>
        <CityMap booking={internationalBooking} estimate={safeEstimate} compact showSummaryPanel={false} />
        <div className="international-route-pass">
          <div>
            <span>当地时间</span>
            <strong>{form.date} {form.time}</strong>
          </div>
          <div>
            <span>服务语言</span>
            <strong>中文服务</strong>
          </div>
          <div>
            <span>参考汇率</span>
            <strong>1 USD ≈ 7.15 CNY</strong>
          </div>
        </div>
      </section>
      <section className="glass-panel work-card international-desk-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">International Booking Desk</span>
            <h2>国际出行</h2>
          </div>
          <ServiceIcon type={SERVICE_TYPE.INTERNATIONAL} className="card-head-service-icon" />
        </div>
        <div className="international-desk-summary">
          <div><span>方案</span><strong>{internationalOptions.length}</strong><small>跨境线路</small></div>
          <div><span>币种</span><strong>USD</strong><small>CNY 7.15</small></div>
          <div><span>服务</span><strong>中文</strong><small>司机/客服</small></div>
        </div>
        <div className="international-option-list">
          {internationalOptions.map((item) => (
            <button
              type="button"
              className={`international-option-card ${item.id === selectedOption.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setSelectedOptionId(item.id)}
            >
              <span className="international-route-code">{item.routeCode}</span>
              <div>
                <strong>{item.titleZh}</strong>
                <small>{item.titleEn}</small>
              </div>
              <em>{formatMoney(item.basePrice, 'USD')}</em>
              <p>{item.startName} → {item.endName}</p>
              <div className="international-chip-row">
                <span>{item.badge}</span>
                <span>{item.vehicle}</span>
                <span>{item.durationText}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="international-detail-grid">
          <div><span>Currency</span><strong>{safeEstimate.currencyCode} · {safeEstimate.exchangeRate}</strong></div>
          <div><span>Fare</span><strong>{formatMoney(safeEstimate.amount, safeEstimate.currencyCode)}</strong></div>
          <div><span>Docs</span><strong>{selectedOption.documents.slice(0, 2).join(' / ')}</strong></div>
        </div>
        <div className="international-preflight-list">
          <div>
            <span>出行资料</span>
            {selectedOption.documents.map((item) => <strong key={item}><CheckCircle size={14} />{item}</strong>)}
          </div>
          <div>
            <span>包含服务</span>
            {selectedOption.inclusions.slice(0, 4).map((item) => <strong key={item}><CheckCircle size={14} />{item}</strong>)}
          </div>
        </div>
        <p className="international-notice">{selectedOption.notice}</p>
      </section>
    </div>
  )
}

function InternationalBookingPanel({ option, form, onFormChange, estimate, onSubmit }) {
  const [busyAction, setBusyAction] = useState(false)
  const runAction = async () => {
    if (busyAction) return
    setBusyAction(true)
    try {
      await Promise.resolve(onSubmit?.())
    } finally {
      window.setTimeout(() => setBusyAction(false), 180)
    }
  }

  return (
    <section className="booking-card glass-panel refract international-booking-card">
      <div className="international-booking-hero">
        <div>
          <span className="section-kicker">Global Travel Desk</span>
          <h2>国际出行</h2>
          <p>机场接送、口岸通行、商务预约与多币种结算一站完成。</p>
        </div>
        <div className="international-price-card">
          <span>预计支付</span>
          <strong>{formatMoney(estimate.amount, estimate.currencyCode)}</strong>
          <small>1 USD ≈ {estimate.exchangeRate} CNY</small>
        </div>
      </div>

      <div className="international-route-panel">
        <div>
          <span>FROM</span>
          <strong>{option.startName}</strong>
        </div>
        <i>→</i>
        <div>
          <span>TO</span>
          <strong>{option.endName}</strong>
        </div>
      </div>

      <div className="fare-grid international-summary-grid">
        <MiniStat label="里程" value={`${estimate.distanceKm} km`} />
        <MiniStat label="时长" value={`${estimate.durationMin} min`} />
        <MiniStat label="车型" value={option.vehicle} />
      </div>

      <div className="international-form-grid">
        <label className="plain-field">
          <span>预约日期</span>
          <input type="date" value={form.date} onChange={(event) => onFormChange({ date: event.target.value })} />
        </label>
        <label className="plain-field">
          <span>当地时间</span>
          <input type="time" value={form.time} onChange={(event) => onFormChange({ time: event.target.value })} />
        </label>
        <label className="plain-field">
          <span>乘车人数</span>
          <input type="number" min="1" max="6" value={form.passengerCount} onChange={(event) => onFormChange({ passengerCount: event.target.value })} />
        </label>
        <label className="plain-field">
          <span>行李件数</span>
          <input type="number" min="0" max="20" value={form.luggageCount} onChange={(event) => onFormChange({ luggageCount: event.target.value })} />
        </label>
      </div>

      <div className="international-form-stack">
        <label className="plain-field">
          <span>联系人</span>
          <input value={form.contactName} onChange={(event) => onFormChange({ contactName: event.target.value })} placeholder="请填写真实联系人" />
        </label>
        <label className="plain-field">
          <span>联系电话</span>
          <input value={form.contactPhone} onChange={(event) => onFormChange({ contactPhone: event.target.value })} placeholder="手机或国际区号电话" />
        </label>
        <label className="plain-field">
          <span>航班/编号</span>
          <input value={form.flightNo} onChange={(event) => onFormChange({ flightNo: event.target.value.toUpperCase() })} placeholder="如 CX331 / MU505" />
        </label>
        <label className="plain-field">
          <span>接机牌</span>
          <input value={form.pickupSign} onChange={(event) => onFormChange({ pickupSign: event.target.value })} placeholder="默认使用联系人姓名" />
        </label>
        <label className="plain-field international-note-field">
          <span>补充需求</span>
          <textarea value={form.note} onChange={(event) => onFormChange({ note: event.target.value })} placeholder="例如儿童座椅、航班延误、企业接待要求" />
        </label>
      </div>

      <div className="international-doc-strip">
        {option.documents.map((item) => <span key={item}><CheckCircle size={13} />{item}</span>)}
      </div>

      <div className="booking-actions">
        <MagneticButton className="solid-button fill" disabled={busyAction} onClick={runAction}>
          <Send size={17} />{busyAction ? '正在提交预约' : `确认预约${option.titleZh}`}
        </MagneticButton>
      </div>
    </section>
  )
}

function PassengerWalletBoard({ profile, orders = [], onProfile, onRealName, onOpenOrder, onUploadAvatar }) {
  const [editingRealName, setEditingRealName] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [realNameError, setRealNameError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(() => resolveMediaAssetUrl(profile?.avatar || '/images/avatar-user.svg'))
  const [avatarFile, setAvatarFile] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)
  const [form, setForm] = useState({
    nickname: safeEditableText(profile?.nickname),
    avatar: profile?.avatar || '/images/avatar-user.svg',
    emergencyContact: safeEditableText(profile?.emergencyContact),
    emergencyPhone: profile?.emergencyPhone || '',
    defaultLanguage: profile?.defaultLanguage || 'zh-CN'
  })
  const [realName, setRealName] = useState({
    realName: safeEditableText(profile?.realName),
    idCard: safeEditableText(profile?.idCard)
  })

  useEffect(() => {
    setForm({
      nickname: safeEditableText(profile?.nickname),
      avatar: profile?.avatar || '/images/avatar-user.svg',
      emergencyContact: safeEditableText(profile?.emergencyContact),
      emergencyPhone: profile?.emergencyPhone || '',
      defaultLanguage: profile?.defaultLanguage || 'zh-CN'
    })
    setAvatarFile(null)
    setAvatarPreview(resolveMediaAssetUrl(profile?.avatar || '/images/avatar-user.svg'))
    setRealName({
      realName: safeEditableText(profile?.realName),
      idCard: safeEditableText(profile?.idCard)
    })
  }, [profile])
  const walletRecords = useMemo(() => buildPassengerWalletRecords(orders), [orders])
  const walletSummary = useMemo(() => buildPassengerWalletSummary(walletRecords), [walletRecords])
  const authMeta = passengerAuthStatusMeta(profile?.authStatus)
  const verifiedText = authMeta.label
  const walletProfileProgress = [
    form.nickname,
    form.avatar,
    form.defaultLanguage,
    profile?.phone,
    realName.realName,
    realName.idCard
  ].filter(Boolean).length

  const profileFieldKeys = ['nickname', 'emergencyContact', 'emergencyPhone', 'defaultLanguage']

  const chooseAvatar = () => avatarInputRef.current?.click()
  const handleAvatarFile = (file) => {
    if (!file) return
    if (avatarPreview && avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    const localPreview = URL.createObjectURL(file)
    setAvatarFile(file)
    setAvatarPreview(localPreview)
    setForm((draft) => ({ ...draft, avatar: localPreview }))
    setProfileError('')
  }

  const saveRealName = async () => {
    const realNameText = realName.realName.trim()
    const idCard = realName.idCard.trim()
    if (realNameText.length < 2 || realNameText.length > 20) {
      setRealNameError('真实姓名需要 2-20 个字')
      return
    }
    if (!isValidIdCard(idCard)) {
      setRealNameError('请输入正确的身份证号')
      return
    }
    setRealNameError('')
    const success = await onRealName({ realName: realNameText, idCard })
    if (success === false) {
      setRealNameError('实名信息提交失败，请稍后重试')
      return
    }
    setEditingRealName(false)
  }

  const saveProfile = async () => {
    if (uploadingAvatar) return
    let avatar = form.avatar
    if (avatarFile) {
      setUploadingAvatar(true)
      try {
        const uploadResult = await onUploadAvatar?.(avatarFile)
        avatar = uploadResult?.fileUrl || uploadResult?.avatar || uploadResult?.url || ''
        if (!avatar) {
          setProfileError('头像上传失败，请重新选择')
          return
        }
        setAvatarFile(null)
        setAvatarPreview(resolveMediaAssetUrl(avatar))
      } catch (error) {
        setProfileError(error.message || '头像上传失败，请重新选择')
        return
      } finally {
        setUploadingAvatar(false)
      }
    }
    const payload = {
      ...form,
      avatar,
      nickname: form.nickname.trim(),
      emergencyContact: form.emergencyContact.trim(),
      emergencyPhone: form.emergencyPhone.trim(),
      defaultLanguage: form.defaultLanguage.trim() || 'zh-CN'
    }
    if (!payload.nickname) {
      setProfileError('请填写昵称')
      return
    }
    if (payload.emergencyPhone && !isValidContactPhone(payload.emergencyPhone)) {
      setProfileError('紧急电话需要为 8-16 位纯数字')
      return
    }
    setProfileError('')
    const success = await onProfile(payload)
    if (success === false) {
      setProfileError('资料保存失败，请稍后重试')
      return
    }
    setEditingProfile(false)
  }

  return (
    <div className="dashboard-grid passenger-wallet-board">
      <section className="glass-panel work-card wallet-board-card">
        <div className="card-head">
          <h2>钱包与实名</h2>
          <div className="wallet-head-actions">
            <button className="ghost-button compact-action" onClick={() => setBalanceVisible((value) => !value)}>
              {balanceVisible ? <EyeOff size={14} /> : <Eye size={14} />}{balanceVisible ? '隐藏余额' : '显示余额'}
            </button>
            {editingRealName ? (
              <button className="ghost-button compact-action" onClick={() => setEditingRealName(false)}>取消</button>
            ) : (
              <button className="ghost-button compact-action" onClick={() => setEditingRealName(true)}><BadgeCheck size={14} />编辑实名</button>
            )}
          </div>
        </div>
        <div className="wallet-asset-hero">
          <div className="wallet-asset-top">
            <span>账户资产</span>
            <em><ShieldCheck size={14} />安全保障</em>
          </div>
          <div className="wallet-asset-amount">
            <small>钱包余额</small>
            <strong>{balanceVisible ? formatMoney(profile?.walletBalance || 0) : '****'}</strong>
          </div>
          <p>{walletSummary.latestText} 更新。</p>
          <div className="wallet-asset-summary">
            <span><small>近期支出</small>{balanceVisible ? walletSummary.spendText : '****'}</span>
            <span><small>退款入账</small>{balanceVisible ? walletSummary.refundText : '****'}</span>
            <span><small>交易笔数</small>{balanceVisible ? walletSummary.countText : '****'}</span>
          </div>
        </div>
        <div className="wallet-auth-strip">
          <SummaryPill icon={BadgeCheck} value={verifiedText} label="实名状态" />
          <SummaryPill icon={Lock} value={profile?.phone ? maskPhone(profile.phone) : '-'} label="安全手机" />
          <SummaryPill icon={RefreshCw} value="实时" label="账务同步" />
        </div>
        {editingRealName ? (
          <>
            {Object.keys(realName).map((key) => (
              <Field key={key} label={fieldLabel(key)} value={realName[key]} onChange={(value) => setRealName((draft) => ({ ...draft, [key]: value }))} />
            ))}
            {realNameError && <p className="form-error-line">{realNameError}</p>}
            <button className="solid-button fill profile-save-button" onClick={saveRealName}><BadgeCheck size={15} />提交实名</button>
          </>
        ) : (
          <div className="profile-view-list wallet-readonly-list">
            {Object.keys(realName).map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{key === 'idCard' ? maskIdCard(realName[key]) : realName[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="glass-panel work-card wide profile-edit-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">账户资料</span>
            <h2>资料与发票入口</h2>
          </div>
          {editingProfile ? (
            <button className="ghost-button compact-action" onClick={() => setEditingProfile(false)}>取消</button>
          ) : (
            <button className="ghost-button compact-action" onClick={() => setEditingProfile(true)}><Settings size={14} />编辑资料</button>
          )}
        </div>
        <div className="wallet-profile-summary" aria-label="账户资料摘要">
          <span className={authMeta.verified ? 'ready' : 'pending'}><BadgeCheck size={14} />{verifiedText}</span>
          <div><strong>{walletProfileProgress}/6</strong><small>资料完整度</small></div>
          <div><strong>{form.defaultLanguage || 'zh-CN'}</strong><small>默认语言</small></div>
        </div>
        {editingProfile ? (
          <>
            <div className="profile-avatar-editor">
              <button type="button" className="profile-avatar-preview" onClick={chooseAvatar} disabled={uploadingAvatar}>
                <img src={avatarPreview} alt="乘客头像" onError={() => setAvatarPreview('/images/avatar-user.svg')} />
                <span>{uploadingAvatar ? '上传中...' : '更换头像'}</span>
              </button>
              <div>
                <strong>乘客头像</strong>
                <small>与小程序资料编辑保持一致，保存资料时会先上传头像。</small>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  handleAvatarFile(file)
                }}
              />
            </div>
            <div className="form-grid wallet-profile-form">
              {profileFieldKeys.map((key) => (
                <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
              ))}
            </div>
            {profileError && <p className="form-error-line">{profileError}</p>}
            <button className={`solid-button profile-save-button${uploadingAvatar ? ' is-busy' : ''}`} disabled={uploadingAvatar} onClick={saveProfile}><ShieldCheck size={15} />{uploadingAvatar ? '头像上传中...' : '保存资料'}</button>
          </>
        ) : (
          <div className="profile-view-list wallet-readonly-list">
            {profileFieldKeys.map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{form[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="invoice-panel">
          <CreditCard size={18} />
          <div><strong>发票资料</strong><p>完成支付后，在发票页选择订单并提交抬头。</p></div>
        </div>
      </section>
      <section className="glass-panel work-card wallet-ledger-card">
        <div className="card-head">
          <div><span className="section-kicker">流水明细</span><h2>账户流水</h2><small>按最近支付或退款时间排序</small></div>
          <div className="wallet-ledger-actions">
            <span>全部流水</span>
            <strong>{walletRecords.length} 条</strong>
          </div>
        </div>
        {walletRecords.length ? (
          <div className="wallet-record-list">
            {walletRecords.map((record) => (
              <button
                type="button"
                className="wallet-record-row"
                key={record.key}
                onClick={() => onOpenOrder?.(record.order)}
              >
                <span className={`wallet-record-mark ${record.tone}`}>{record.marker}</span>
                <span className="wallet-record-copy">
                  <strong>{record.title}</strong>
                  <small>{record.serviceLabel} · {record.statusText} · {record.timeText}</small>
                </span>
                <span className="wallet-record-side">
                  <strong className={record.tone}>{balanceVisible ? record.amountText : '****'}</strong>
                  <small>{record.orderNo}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="wallet-empty-ledger">
            <span><CreditCard size={22} /></span>
            <strong>暂无账户流水</strong>
            <p>完成行程支付、退款或优惠抵扣后，明细会自动同步到这里。</p>
          </div>
        )}
      </section>
    </div>
  )
}

function InvoiceBoard({ orders = [], profile, onApplyInvoice, onPreviewInvoice }) {
  const eligibleOrders = normalizeList(orders).filter((order) => order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID)
  const applyOrders = eligibleOrders.filter((order) => String(order.invoiceStatus || 'NONE').toUpperCase() !== 'ISSUED')
  const issuedOrders = eligibleOrders.filter((order) => ['APPLIED', 'ISSUED'].includes(String(order.invoiceStatus || '').toUpperCase()))
  const [invoiceTab, setInvoiceTab] = useState('apply')
  const [selectedId, setSelectedId] = useState('')
  const [formError, setFormError] = useState('')
  const [previewBusy, setPreviewBusy] = useState(false)
  const [form, setForm] = useState({
    invoiceTitle: pickFirstCleanText(profile?.realName, profile?.nickname, '个人'),
    taxNo: '',
    buyerPhone: profile?.phone || '',
    remark: '网页端申请电子发票'
  })
  const [previewUrl, setPreviewUrl] = useState('')
  const visibleOrders = invoiceTab === 'issued' ? issuedOrders : applyOrders
  const selectedOrder = visibleOrders.find((order) => String(order.id) === String(selectedId)) || visibleOrders[0] || eligibleOrders.find((order) => String(order.id) === String(selectedId)) || eligibleOrders[0]

  useEffect(() => {
    if (visibleOrders[0]?.id && !visibleOrders.some((order) => String(order.id) === String(selectedId))) {
      setSelectedId(String(visibleOrders[0].id))
    }
    if (!visibleOrders.length && eligibleOrders[0]?.id && !selectedId) setSelectedId(String(eligibleOrders[0].id))
  }, [visibleOrders, eligibleOrders, selectedId])

  useEffect(() => {
    setForm((draft) => ({
      ...draft,
      invoiceTitle: draft.invoiceTitle || pickFirstCleanText(profile?.realName, profile?.nickname, '个人'),
      buyerPhone: draft.buyerPhone || profile?.phone || ''
    }))
  }, [profile])

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const update = (patch) => setForm((draft) => ({ ...draft, ...patch }))
  const selectedInvoiceStatus = String(selectedOrder?.invoiceStatus || 'NONE').toUpperCase()
  const invoiceAppliedCount = issuedOrders.length
  const validateInvoiceForm = () => {
    const title = form.invoiceTitle.trim()
    const phone = form.buyerPhone.trim()
    const taxNo = form.taxNo.trim()
    if (!selectedOrder) return '请先选择一笔已支付订单'
    if (!title) return '请填写发票抬头'
    if (phone && !isValidPhone(phone)) return '接收手机需要为 11 位手机号'
    if (taxNo && !/^[0-9A-Z]{15,20}$/i.test(taxNo)) return '税号通常为 15-20 位数字或字母'
    return ''
  }
  const apply = async () => {
    const error = validateInvoiceForm()
    if (error) {
      setFormError(error)
      return
    }
    setFormError('')
    await onApplyInvoice(selectedOrder, {
      ...form,
      invoiceTitle: form.invoiceTitle.trim(),
      taxNo: form.taxNo.trim(),
      buyerPhone: form.buyerPhone.trim(),
      remark: form.remark.trim()
    })
  }
  const preview = async () => {
    if (!selectedOrder) return
    setPreviewBusy(true)
    try {
      const url = await onPreviewInvoice(selectedOrder)
      setPreviewUrl((oldUrl) => {
        if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
        return url
      })
    } finally {
      setPreviewBusy(false)
    }
  }

  return (
    <div className="dashboard-grid invoice-board">
      <section className="glass-panel work-card invoice-picker-card">
        <div className="card-head"><div><span className="section-kicker">电子发票</span><h2>发票中心</h2></div><CreditCard size={21} /></div>
        <div className="invoice-summary-grid">
          <SummaryPill icon={CreditCard} label="可开票订单" value={`${eligibleOrders.length} 单`} />
          <SummaryPill icon={Send} label="已提交申请" value={`${invoiceAppliedCount} 单`} />
        </div>
        <div className="segmented-row invoice-tabs">
          <button className={invoiceTab === 'apply' ? 'active' : ''} onClick={() => setInvoiceTab('apply')}>可申请<span>{applyOrders.length}</span></button>
          <button className={invoiceTab === 'issued' ? 'active' : ''} onClick={() => setInvoiceTab('issued')}>我的发票<span>{issuedOrders.length}</span></button>
        </div>
        {eligibleOrders.length ? (
          <>
            <label className="plain-field">
              <span>选择订单</span>
              <select value={String(selectedOrder?.id || '')} onChange={(event) => setSelectedId(event.target.value)}>
                {(visibleOrders.length ? visibleOrders : eligibleOrders).map((order) => (
                  <option key={order.id} value={String(order.id)}>
                    {order.orderNo || `#${order.id}`} · {formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)}
                  </option>
                ))}
              </select>
            </label>
            <div className="invoice-order-list">
              {(visibleOrders.length ? visibleOrders : eligibleOrders).slice(0, 6).map((order) => {
                const active = String(order.id) === String(selectedOrder?.id)
                const invoiceStatus = String(order.invoiceStatus || 'NONE').toUpperCase()
                return (
                  <button className={active ? 'active' : ''} key={order.id} onClick={() => setSelectedId(String(order.id))}>
                    <span className="invoice-order-service">
                      <ServiceIcon type={order.serviceType} className="invoice-order-service-icon" />
                      {statusLabel[order.serviceType] || '出行服务'}
                    </span>
                    <strong>{order.startName} → {order.endName}</strong>
                    <small>{order.orderNo || `#${order.id}`} · {formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)}</small>
                    <StatusBadge value={invoiceStatus} label={orderInvoiceStatusText(order)} />
                  </button>
                )
              })}
            </div>
            {selectedOrder && (
              <InfoPanel title="订单信息" items={[
                ['路线', `${selectedOrder.startName} → ${selectedOrder.endName}`],
                ['金额', formatMoney(selectedOrder.payableAmount || selectedOrder.actualAmount || selectedOrder.estimatedAmount, selectedOrder.currencyCode)],
                ['发票状态', statusLabel[selectedOrder.invoiceStatus] || selectedOrder.invoiceStatus || '未申请'],
                ['支付状态', statusLabel[selectedOrder.payStatus] || selectedOrder.payStatus]
              ]} />
            )}
          </>
        ) : <EmptyState text="暂无可开票订单，完成并支付行程后会显示在这里。" />}
      </section>
      <section className="glass-panel work-card wide invoice-form-card">
        <div className="card-head"><h2>开票信息</h2><ShieldCheck size={21} /></div>
        {selectedOrder && (
          <div className="invoice-form-hero">
            <div>
              <span>当前订单</span>
              <strong>{selectedOrder.startName} → {selectedOrder.endName}</strong>
              <small>{orderInvoiceStatusText(selectedOrder)} · {formatMoney(selectedOrder.payableAmount || selectedOrder.actualAmount || selectedOrder.estimatedAmount, selectedOrder.currencyCode)}</small>
            </div>
            <StatusBadge value={selectedInvoiceStatus} label={orderInvoiceStatusText(selectedOrder)} />
          </div>
        )}
        <div className="form-grid">
          {['invoiceTitle', 'taxNo', 'buyerPhone', 'remark'].map((key) => (
            <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => update({ [key]: value })} />
          ))}
        </div>
        {formError && <p className="form-error-line">{formError}</p>}
        <div className="invoice-actions">
          <button className="solid-button" disabled={!selectedOrder || selectedInvoiceStatus === 'ISSUED' || invoiceTab === 'issued'} onClick={apply}>
            <Send size={16} />{selectedInvoiceStatus === 'APPLIED' ? '更新发票申请' : selectedInvoiceStatus === 'ISSUED' ? '已开票' : '提交发票申请'}
          </button>
          <button className="ghost-button" disabled={!selectedOrder || previewBusy} onClick={preview}><CreditCard size={16} />{previewBusy ? '预览中...' : '预览发票'}</button>
        </div>
        {previewUrl && (
          <div className="invoice-preview">
            <img src={previewUrl} alt="电子发票预览" />
          </div>
        )}
      </section>
    </div>
  )
}

function InvoiceWorkbench({ orders = [], profile, onApplyInvoice, onPreviewInvoice }) {
  const sourceOrders = normalizeList(orders)
  const eligibleOrders = useMemo(
    () => sourceOrders.filter((order) => order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID),
    [sourceOrders]
  )
  const actionableOrders = useMemo(
    () => eligibleOrders.filter((order) => ['NONE', 'REJECTED'].includes(normalizeInvoiceStatus(order))),
    [eligibleOrders]
  )
  const historyOrders = useMemo(
    () => eligibleOrders.filter((order) => ['APPLIED', 'ISSUED'].includes(normalizeInvoiceStatus(order))),
    [eligibleOrders]
  )
  const historyProfiles = useMemo(() => {
    const profiles = new Map()
    const pick = (...values) => values.map((value) => String(value ?? '').trim()).find(Boolean) || ''
    eligibleOrders.forEach((order) => {
      const meta = order?.invoiceMeta || {}
      const title = pick(order.invoiceTitle, meta.buyerName, meta.title)
      if (!title) return
      const taxNo = pick(order.taxNo, meta.buyerTaxNo, meta.taxNo)
      const buyerPhone = pick(order.buyerPhone, meta.buyerPhone)
      const key = [title, taxNo === '个人无需填写' ? '' : taxNo, buyerPhone].join('::')
      const next = {
        key,
        title,
        taxNo: taxNo === '个人无需填写' ? '' : taxNo,
        buyerPhone,
        lastUsedAt: pick(order.invoiceAppliedAt, order.invoiceHandledAt, meta.appliedAt, meta.issueAt, order.updatedAt, order.createdAt)
      }
      const current = profiles.get(key)
      if (!current || (dateLikeToMs(next.lastUsedAt) || 0) > (dateLikeToMs(current.lastUsedAt) || 0)) {
        profiles.set(key, next)
      }
    })
    return Array.from(profiles.values()).sort((left, right) => (dateLikeToMs(right.lastUsedAt) || 0) - (dateLikeToMs(left.lastUsedAt) || 0))
  }, [eligibleOrders])
  const [invoiceTab, setInvoiceTab] = useState('apply')
  const [selectedId, setSelectedId] = useState('')
  const [filters, setFilters] = useState({ time: 'ALL', type: 'ALL', amount: 'ALL' })
  const buildDraft = useCallback((order = {}) => {
    const meta = order?.invoiceMeta || {}
    const pick = (...values) => values.map((value) => String(value ?? '').trim()).find(Boolean) || ''
    const taxNo = pick(order.taxNo, meta.buyerTaxNo, meta.taxNo)
    return {
      invoiceTitle: pick(order.invoiceTitle, meta.buyerName, meta.title, pickFirstCleanText(profile?.realName, profile?.nickname, '个人')),
      taxNo: taxNo === '个人无需填写' ? '' : taxNo,
      buyerPhone: pick(order.buyerPhone, meta.buyerPhone, profile?.phone),
      remark: pick(meta.remark, order.invoiceRemark, '网页端申请电子发票')
    }
  }, [profile])
  const [form, setForm] = useState(() => buildDraft())
  const [touched, setTouched] = useState({})
  const [actionError, setActionError] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewAsset, setPreviewAsset] = useState(null)
  const scopedOrders = invoiceTab === 'history' ? historyOrders : actionableOrders
  const visibleOrders = useMemo(() => {
    const now = Date.now()
    return scopedOrders.filter((order) => {
      const amount = Number(order.payableAmount || order.actualAmount || order.estimatedAmount || 0)
      const eventTime = dateLikeToMs(order.finishedAt || order.paidAt || order.invoiceAppliedAt || order.updatedAt || order.createdAt || order.createdTime || order.createTime) || 0
      const timeMatched = filters.time === 'ALL'
        || (filters.time === '30D' && eventTime >= now - 30 * 24 * 60 * 60 * 1000)
        || (filters.time === '90D' && eventTime >= now - 90 * 24 * 60 * 60 * 1000)
        || (filters.time === '180D' && eventTime >= now - 180 * 24 * 60 * 60 * 1000)
      const typeMatched = filters.type === 'ALL' || order.serviceType === filters.type
      const amountMatched = filters.amount === 'ALL'
        || (filters.amount === '0-50' && amount < 50)
        || (filters.amount === '50-100' && amount >= 50 && amount < 100)
        || (filters.amount === '100+' && amount >= 100)
      return timeMatched && typeMatched && amountMatched
    })
  }, [filters.amount, filters.time, filters.type, scopedOrders])
  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => String(order.id) === String(selectedId)) || visibleOrders[0] || null,
    [selectedId, visibleOrders]
  )
  const selectedInvoiceStatus = normalizeInvoiceStatus(selectedOrder)
  const selectedRejectReason = String(selectedOrder?.invoiceRejectReason || selectedOrder?.invoiceMeta?.rejectReason || selectedOrder?.invoiceMeta?.handleRemark || '').trim()
  const canApplyInvoice = Boolean(selectedOrder) && !applyBusy && !previewBusy && !['APPLIED', 'ISSUED'].includes(selectedInvoiceStatus)
  const canViewInvoice = Boolean(selectedOrder) && selectedInvoiceStatus === 'ISSUED'
  const submitButtonClass = canApplyInvoice ? 'solid-button' : 'ghost-button invoice-action-button--muted'
  const previewButtonClass = canViewInvoice ? 'solid-button invoice-action-button--primary' : 'ghost-button invoice-action-button--muted'
  const downloadButtonClass = canViewInvoice ? 'line-button invoice-action-button--accent' : 'line-button invoice-action-button--muted'
  const fieldErrors = useMemo(() => {
    const title = String(form.invoiceTitle || '').trim()
    const taxNo = String(form.taxNo || '').trim()
    const buyerPhone = String(form.buyerPhone || '').trim()
    const personal = !title || title === '个人' || title.includes('个人')
    return {
      invoiceTitle: title ? '' : '请填写发票抬头',
      taxNo: !personal && !taxNo
        ? '企业抬头请填写税号'
        : taxNo && !/^[0-9A-Z]{15,20}$/i.test(taxNo)
          ? '税号通常为 15-20 位数字或字母'
          : '',
      buyerPhone: !buyerPhone
        ? '请填写接收手机'
        : !isValidPhone(buyerPhone)
          ? '请输入 11 位手机号'
          : ''
    }
  }, [form.buyerPhone, form.invoiceTitle, form.taxNo])
  const activeProfileKey = [String(form.invoiceTitle || '').trim(), String(form.taxNo || '').trim(), String(form.buyerPhone || '').trim()].join('::')

  useEffect(() => {
    const exists = visibleOrders.some((order) => String(order.id) === String(selectedId))
    if (!exists) {
      setSelectedId(visibleOrders[0]?.id ? String(visibleOrders[0].id) : '')
    }
  }, [selectedId, visibleOrders])

  useEffect(() => {
    setTouched({})
    setActionError('')
    setForm(buildDraft(selectedOrder || {}))
  }, [buildDraft, selectedOrder?.id])

  useEffect(() => {
    if (!previewAsset?.url?.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(previewAsset.url)
  }, [previewAsset])

  useEffect(() => {
    if (previewAsset && String(previewAsset.orderId) !== String(selectedOrder?.id || '')) {
      setPreviewAsset(null)
    }
  }, [previewAsset, selectedOrder?.id])

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const updateField = (key, value) => {
    setForm((draft) => ({ ...draft, [key]: value }))
    setTouched((current) => ({ ...current, [key]: true }))
    setActionError('')
  }
  const useHistoryProfile = (item) => {
    setForm((draft) => ({
      ...draft,
      invoiceTitle: item.title,
      taxNo: item.taxNo,
      buyerPhone: item.buyerPhone || draft.buyerPhone
    }))
    setTouched((current) => ({ ...current, invoiceTitle: true, taxNo: true, buyerPhone: true }))
    setActionError('')
  }
  const validateBeforeApply = () => {
    if (!selectedOrder) return '请先选择一笔订单'
    return fieldErrors.invoiceTitle || fieldErrors.taxNo || fieldErrors.buyerPhone || ''
  }
  const ensureInvoiceAsset = async () => {
    if (!selectedOrder || selectedInvoiceStatus !== 'ISSUED') return null
    if (previewAsset && String(previewAsset.orderId) === String(selectedOrder.id)) return previewAsset
    setPreviewBusy(true)
    setActionError('')
    try {
      const asset = await onPreviewInvoice(selectedOrder)
      const next = { ...asset, orderId: selectedOrder.id }
      setPreviewAsset(next)
      return next
    } catch (error) {
      setActionError(error.message || '查看发票失败，请稍后重试')
      return null
    } finally {
      setPreviewBusy(false)
    }
  }
  const applyInvoice = async () => {
    setTouched({ invoiceTitle: true, taxNo: true, buyerPhone: true })
    const error = validateBeforeApply()
    if (error) {
      setActionError(error)
      return
    }
    setApplyBusy(true)
    setActionError('')
    try {
      const success = await onApplyInvoice(selectedOrder, {
        invoiceTitle: String(form.invoiceTitle || '').trim(),
        taxNo: String(form.taxNo || '').trim(),
        buyerPhone: String(form.buyerPhone || '').trim(),
        remark: String(form.remark || '').trim()
      })
      if (success === false) {
        setActionError('提交申请失败，请稍后重试')
        return
      }
      setInvoiceTab('history')
    } catch (error) {
      setActionError(error.message || '提交申请失败，请稍后重试')
    } finally {
      setApplyBusy(false)
    }
  }
  const downloadInvoice = async () => {
    const asset = await ensureInvoiceAsset()
    if (!asset) return
    const anchor = document.createElement('a')
    anchor.href = asset.url
    anchor.download = asset.filename || `invoice-${selectedOrder?.id || 'download'}.png`
    anchor.rel = 'noopener'
    anchor.click()
  }
  const processingCount = historyOrders.filter((order) => normalizeInvoiceStatus(order) === 'APPLIED').length
  const issuedCount = historyOrders.filter((order) => normalizeInvoiceStatus(order) === 'ISSUED').length

  return (
    <div className="dashboard-grid invoice-workbench">
      <section className="glass-panel work-card invoice-center-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">电子发票</span>
            <h2>发票中心</h2>
            <small>已开票订单可直接查看发票，图片与小程序、后台同步。</small>
          </div>
          <CreditCard size={21} />
        </div>

        <div className="invoice-summary-grid invoice-summary-grid--focused invoice-summary-grid--interactive">
          <SummaryPill
            icon={CreditCard}
            label="可开票订单"
            value={`${actionableOrders.length} 单`}
            interactive
            active={invoiceTab === 'apply'}
            onClick={() => setInvoiceTab('apply')}
          />
          <SummaryPill
            icon={Clock}
            label="处理中"
            value={`${processingCount} 单`}
            interactive
            active={invoiceTab === 'history' && processingCount > 0}
            onClick={() => setInvoiceTab('history')}
          />
          <SummaryPill
            icon={ShieldCheck}
            label="已开票"
            value={`${issuedCount} 单`}
            interactive
            active={invoiceTab === 'history'}
            onClick={() => setInvoiceTab('history')}
          />
        </div>

        <div className="invoice-filter-row">
          <label className="plain-field">
            <span>时间</span>
            <select value={filters.time} onChange={(event) => updateFilter('time', event.target.value)}>
              <option value="ALL">全部时间</option>
              <option value="30D">最近 30 天</option>
              <option value="90D">最近 90 天</option>
              <option value="180D">最近 180 天</option>
            </select>
          </label>
          <label className="plain-field">
            <span>订单类型</span>
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              <option value="ALL">全部类型</option>
              <option value={SERVICE_TYPE.TAXI}>即时打车</option>
              <option value={SERVICE_TYPE.CARPOOL}>顺风车</option>
              <option value={SERVICE_TYPE.INTERNATIONAL}>国际出行</option>
            </select>
          </label>
          <label className="plain-field">
            <span>金额</span>
            <select value={filters.amount} onChange={(event) => updateFilter('amount', event.target.value)}>
              <option value="ALL">全部金额</option>
              <option value="0-50">50 元以下</option>
              <option value="50-100">50 - 100 元</option>
              <option value="100+">100 元以上</option>
            </select>
          </label>
        </div>

        {eligibleOrders.length ? (
          visibleOrders.length ? (
            <div className="invoice-order-stack">
              {visibleOrders.map((order) => {
                const active = String(order.id) === String(selectedOrder?.id)
                return (
                  <button
                    type="button"
                    className={`invoice-order-card${active ? ' active' : ''}`}
                    key={order.id}
                    onClick={() => setSelectedId(String(order.id))}
                  >
                    <div className="invoice-order-card__head">
                      <span className="invoice-order-card__no">{order.orderNo || `#${order.id}`}</span>
                      <StatusBadge label={invoiceStatusText(order)} tone={invoiceStatusTone(order)} />
                    </div>
                    <strong className="invoice-order-card__route">{`${order.startName} → ${order.endName}`}</strong>
                    <div className="invoice-order-card__foot">
                      <span className="invoice-order-card__meta">
                        <ServiceIcon type={order.serviceType} className="invoice-order-service-icon" />
                        {(statusLabel[order.serviceType] || '出行服务')} · {formatOrderDisplayTime(order)}
                      </span>
                      <strong className="invoice-order-card__amount">{formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)}</strong>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState text="当前筛选条件下暂无订单" />
          )
        ) : (
          <EmptyState text="暂无可开票订单，完成并支付行程后会显示在这里。" />
        )}
      </section>

      <section className="glass-panel work-card wide invoice-detail-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">开票操作</span>
            <h2>开票信息</h2>
            <small>只保留申请、查看和下载的关键操作。</small>
          </div>
          <ShieldCheck size={21} />
        </div>

        {selectedOrder ? (
          <>
            <div className="invoice-current-order">
              <div>
                <span>当前订单</span>
                <strong>{`${selectedOrder.startName} → ${selectedOrder.endName}`}</strong>
                <small>{selectedOrder.orderNo || `#${selectedOrder.id}`} · {formatMoney(selectedOrder.payableAmount || selectedOrder.actualAmount || selectedOrder.estimatedAmount, selectedOrder.currencyCode)}</small>
              </div>
              <StatusBadge label={invoiceStatusText(selectedOrder)} tone={invoiceStatusTone(selectedOrder)} />
            </div>

            <div className="invoice-panel-section">
              <div className="invoice-panel-section__title">
                <strong>发票信息</strong>
                <small>抬头和税号会保存到当前订单，后续历史可直接带出。</small>
              </div>
              <div className="invoice-form-grid invoice-form-grid--two">
                <label className={`plain-field invoice-field${touched.invoiceTitle && fieldErrors.invoiceTitle ? ' has-error' : ''}`}>
                  <span>{fieldLabel('invoiceTitle')}</span>
                  <input value={form.invoiceTitle || ''} onChange={(event) => updateField('invoiceTitle', event.target.value)} />
                  {touched.invoiceTitle && fieldErrors.invoiceTitle ? <small>{fieldErrors.invoiceTitle}</small> : null}
                </label>
                <label className={`plain-field invoice-field${touched.taxNo && fieldErrors.taxNo ? ' has-error' : ''}`}>
                  <span>{fieldLabel('taxNo')}</span>
                  <input value={form.taxNo || ''} onChange={(event) => updateField('taxNo', event.target.value.toUpperCase())} />
                  {touched.taxNo && fieldErrors.taxNo ? <small>{fieldErrors.taxNo}</small> : null}
                </label>
              </div>
            </div>

            <div className="invoice-panel-section">
              <div className="invoice-panel-section__title">
                <strong>接收信息</strong>
                <small>发票通知会同步到填写手机号。</small>
              </div>
              <div className="invoice-form-grid">
                <label className={`plain-field invoice-field${touched.buyerPhone && fieldErrors.buyerPhone ? ' has-error' : ''}`}>
                  <span>{fieldLabel('buyerPhone')}</span>
                  <input value={form.buyerPhone || ''} onChange={(event) => updateField('buyerPhone', event.target.value)} />
                  {touched.buyerPhone && fieldErrors.buyerPhone ? <small>{fieldErrors.buyerPhone}</small> : null}
                </label>
                <label className="plain-field invoice-field">
                  <span>{fieldLabel('remark')}</span>
                  <textarea value={form.remark || ''} onChange={(event) => updateField('remark', event.target.value)} />
                </label>
              </div>
            </div>

            {historyProfiles.length ? (
              <div className="invoice-panel-section">
                <div className="invoice-panel-section__title">
                  <strong>历史抬头</strong>
                  <small>从你的真实订单开票信息里自动带出。</small>
                </div>
                <div className="invoice-history-list">
                  {historyProfiles.slice(0, 6).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className={`invoice-history-chip${activeProfileKey === item.key ? ' active' : ''}`}
                      onClick={() => useHistoryProfile(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.taxNo || '个人抬头'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="invoice-panel-section invoice-panel-section--actions">
              <div className={`invoice-status-note invoice-status-note--${invoiceStatusTone(selectedOrder)}`}>
                {selectedInvoiceStatus === 'ISSUED'
                  ? '发票已开具，可直接查看发票或下载。'
                  : selectedInvoiceStatus === 'APPLIED'
                    ? '发票申请已提交，后台处理中。'
                    : selectedInvoiceStatus === 'REJECTED'
                      ? (selectedRejectReason || '发票申请被驳回，请修改信息后重新提交。')
                      : '确认抬头与手机号后即可提交申请。'}
              </div>

              <div className="invoice-actions invoice-actions--dense">
                <button
                  className={`${submitButtonClass}${applyBusy ? ' is-busy' : ''}`}
                  disabled={!canApplyInvoice}
                  onClick={applyInvoice}
                >
                  <Send size={16} />{applyBusy ? '提交中...' : selectedInvoiceStatus === 'REJECTED' ? '重新提交申请' : '提交申请'}
                </button>
                <button
                  className={`${previewButtonClass}${previewBusy ? ' is-busy' : ''}`}
                  disabled={previewBusy || !canViewInvoice}
                  onClick={ensureInvoiceAsset}
                >
                  <Eye size={16} />{previewBusy ? '查看中...' : '查看发票'}
                </button>
                <button
                  className={downloadButtonClass}
                  disabled={previewBusy || !canViewInvoice}
                  onClick={downloadInvoice}
                >
                  <Download size={16} />下载发票
                </button>
              </div>

              {actionError ? <p className="form-error-line">{actionError}</p> : null}
            </div>

            {selectedInvoiceStatus === 'ISSUED' ? (
              <div className="invoice-preview-card">
                <div className="invoice-panel-section__title">
                  <strong>发票预览</strong>
                  <small>展示与小程序、后台一致的真实发票图片。</small>
                </div>
                {previewAsset ? (
                  <a className="invoice-preview-link" href={previewAsset.url} target="_blank" rel="noreferrer">
                    <img src={previewAsset.url} alt="电子发票预览" className="invoice-preview-image" />
                  </a>
                ) : (
                  <div className="invoice-preview-placeholder">
                    <Eye size={18} />
                    <span>点击“查看发票”后展示真实发票图片</span>
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState text={eligibleOrders.length ? '请选择一笔订单查看开票信息' : '完成并支付订单后，可在这里申请发票。'} />
        )}
      </section>
    </div>
  )
}

function supportConversationStatusLabel(conversation = {}) {
  if (conversation?.manualMode || conversation?.status === 'MANUAL') return '人工接待中'
  if (conversation?.status === 'CLOSED') return '已关闭'
  return 'AI接待中'
}

function SupportChatPanel({ conversation, messages = [], profile, role, onRefresh, onSend, orders = [] }) {
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [aiReplyPending, setAiReplyPending] = useState(null)
  const threadEndRef = useRef(null)
  const sortedMessages = normalizeList(messages).slice().sort((left, right) => {
    const a = dateLikeToMs(left.createdAt || left.time) || Number(left.id || 0)
    const b = dateLikeToMs(right.createdAt || right.time) || Number(right.id || 0)
    return a - b
  })
  const isDriver = role === 'DRIVER'
  const serviceName = '阳光客服'
  const conversationStatusText = supportConversationStatusLabel(conversation)
  const supportTitle = isDriver ? '司机客服会话' : '乘客客服会话'
  const supportHint = isDriver ? '听单、提现与资质问题在线处理' : '订单、费用、发票与行程问题在线处理'
  const quickPrompts = isDriver
    ? ['提现多久到账？', '听单接不到订单', '资质审核进度', '联系乘客异常']
    : ['司机多久到？', '如何取消订单？', '费用有疑问', '联系司机']
  const lastMessage = sortedMessages[sortedMessages.length - 1]
  const mineCount = sortedMessages.filter((item) => item.senderRole === role).length
  const showAiReplyPending = Boolean(aiReplyPending)
  const supportOrders = useMemo(() => normalizeList(orders).filter(Boolean), [orders])
  const relatedOrder = useMemo(() => {
    const activeOrder = pickActiveRideOrder(supportOrders)
    if (activeOrder) return activeOrder
    return supportOrders
      .filter((item) => item.serviceType !== SERVICE_TYPE.CARPOOL)
      .slice()
      .sort((left, right) => {
        const a = dateLikeToMs(left.updatedAt || left.createdAt || left.createTime || left.orderTime) || Number(left.id || 0)
        const b = dateLikeToMs(right.updatedAt || right.createdAt || right.createTime || right.orderTime) || Number(right.id || 0)
        return b - a
      })[0] || supportOrders[0] || null
  }, [supportOrders])
  const profileName = profile?.nickname || (isDriver ? '司机' : '乘客')
  const canSend = Boolean(draft.trim()) && !sending
  const orderAmount = relatedOrder
    ? formatMoney(relatedOrder.payableAmount || relatedOrder.actualAmount || relatedOrder.estimatedAmount, relatedOrder.currencyCode)
    : '-'
  const orderDistance = relatedOrder ? `${relatedOrder.actualDistanceKm || relatedOrder.estimatedDistanceKm || '-'} km` : '-'
  const orderDuration = relatedOrder ? `${relatedOrder.actualDurationMin || relatedOrder.estimatedDurationMin || '-'} min` : '-'
  const orderDetailItems = relatedOrder ? [
    ['订单号', relatedOrder.orderNo || `#${relatedOrder.id}`],
    ['服务类型', statusLabel[relatedOrder.serviceType] || relatedOrder.serviceType || '出行服务'],
    ['支付状态', statusLabel[relatedOrder.payStatus] || relatedOrder.payStatus || '-'],
    [isDriver ? '乘客备注' : '司机信息', isDriver ? (relatedOrder.remark || '未填写') : (relatedOrder.driverName || relatedOrder.driverNickname || (relatedOrder.driverId ? `司机 #${relatedOrder.driverId}` : '待分配'))],
    ['下单时间', formatOrderDisplayTime(relatedOrder)]
  ] : []
  const orderPanelTitle = relatedOrder && pickActiveRideOrder([relatedOrder]) ? '当前订单' : '最近订单'

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: sortedMessages.length > 4 || showAiReplyPending ? 'smooth' : 'auto'
    })
  }, [sortedMessages.length, showAiReplyPending])

  useEffect(() => {
    if (!aiReplyPending) return
    const pendingAt = dateLikeToMs(aiReplyPending.createdAt) || 0
    const hasNewServiceReply = sortedMessages.some((item) => {
      const itemAt = dateLikeToMs(item.createdAt || item.time) || 0
      return item.senderRole !== role && itemAt >= pendingAt
    })
    if (hasNewServiceReply) {
      setAiReplyPending(null)
    }
  }, [aiReplyPending, role, sortedMessages])

  const handleDraftChange = (event) => {
    const nextValue = event.target.value
    setDraft(nextValue)
    if (sendError && nextValue.trim()) {
      setSendError('')
    }
  }

  const send = async (overrideContent = '') => {
    const content = (overrideContent || draft).trim()
    if (!content) {
      setSendError('请输入要咨询的问题')
      return
    }
    setSendError('')
    setSending(true)
    try {
      const ok = await onSend(content)
      setDraft('')
      if (ok !== false) {
        setAiReplyPending({
          id: `ai-pending-${Date.now()}`,
          createdAt: new Date().toISOString()
        })
      }
    } finally {
      setSending(false)
    }
  }

  const refreshConversation = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="dashboard-grid support-chat-grid">
      <section className="glass-panel work-card wide support-chat-card">
        <div className="card-head support-chat-head">
          <div>
            <h2>{supportTitle}</h2>
          </div>
          <button
            className={`icon-button support-refresh-button${refreshing ? ' is-refreshing' : ''}`}
            type="button"
            title={refreshing ? '刷新中' : '刷新会话'}
            disabled={refreshing}
            onClick={refreshConversation}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="support-service-bar">
          <div className="support-service-avatar" aria-hidden="true">
            <MessageSquare size={18} />
          </div>
          <div className="support-service-copy">
            <strong>{serviceName}</strong>
            <p>{supportHint}</p>
          </div>
          <div className="support-service-status">
            <span className="support-live-pill">
              <i className="support-live-dot" />
              {conversationStatusText}
            </span>
            <small>通常 1-3 分钟回复</small>
          </div>
        </div>

        <div className="support-chat-summary">
          <SummaryPill icon={MessageSquare} label="会话状态" value={conversationStatusText} />
          <SummaryPill icon={Send} label="我发送的" value={`${mineCount} 条`} />
          <SummaryPill icon={Clock} label="最近消息" value={lastMessage ? formatDateTimeShort(lastMessage.createdAt || lastMessage.time) : '刚刚接入'} />
        </div>

        <div className="support-chat-stage">
          <div className="chat-thread" role="log" aria-live="polite" aria-relevant="additions text">
          {sortedMessages.length ? sortedMessages.map((item, index) => {
            const mine = item.senderRole === role
            const senderText = mine ? (isDriver ? '司机端' : '乘客端') : (item.systemNotice ? '系统' : (item.fromAdmin ? '人工客服' : 'AI客服'))
            return (
              <div className={`chat-row ${mine ? 'mine' : 'service'}`} key={item.id || index}>
                <span className={`chat-avatar ${mine ? 'mine' : 'service'}`} aria-hidden="true">
                  {mine ? <User size={15} /> : <MessageSquare size={15} />}
                </span>
                <article className={`chat-bubble ${mine ? 'mine' : 'service'}`}>
                  <div className="chat-bubble-meta">
                    <span>{mine ? profileName : serviceName}</span>
                    <small>{`${senderText} · ${formatDateTimeShort(item.createdAt || item.time)}`}</small>
                  </div>
                  <p>{item.content}</p>
                </article>
              </div>
            )
          }) : (
            <div className="support-thread-empty">
              <EmptyState text="发送消息开始沟通" />
            </div>
          )}
            {showAiReplyPending && (
              <div className="chat-row service ai-reply-pending" role="status" aria-live="polite">
                <span className="chat-avatar service" aria-hidden="true">
                  <MessageSquare size={15} />
                </span>
                <article className="chat-bubble service pending">
                  <div className="chat-bubble-meta">
                    <span>{serviceName}</span>
                    <small>AI客服 · 刚刚</small>
                  </div>
                  <p>AI回复中...</p>
                </article>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          <div className="support-chat-footer">
            <div className="support-quick-block">
              <div className="support-inline-label">
                <Star size={14} />
                <span>常见咨询</span>
              </div>
              <div className="quick-question-row">
                {quickPrompts.map((item) => (
                  <button key={item} type="button" onClick={() => send(item)} disabled={sending}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

        <div className="chat-composer">
          <div className="chat-compose-field">
            <textarea
              value={draft}
              maxLength={500}
              placeholder="输入要咨询的问题"
              onChange={handleDraftChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  send()
                }
              }}
            />
            <div className="chat-compose-meta">
              <small>{isDriver ? '提现、听单和资质问题会同步到司机端会话。' : '支持订单、费用、发票和联系司机问题。'}</small>
              <small>{`${draft.trim().length}/500`}</small>
            </div>
          </div>
          <button className="solid-button support-send-button" type="button" disabled={!canSend} onClick={() => send()}>
            <Send size={16} />
            {sending ? '发送中...' : '发送'}
          </button>
          </div>
        </div>
        </div>
        {sendError && <p className="form-error-line support-chat-error">{sendError}</p>}
      </section>

      <section className="glass-panel work-card support-profile-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">会话状态</span>
            <h2>当前会话</h2>
          </div>
          <MessageSquare size={21} />
        </div>
        <InfoPanel title="当前会话" items={[
          ['状态', conversationStatusText],
          ['身份', isDriver ? '司机' : '乘客'],
          ['账号', profile?.phone || conversation?.phone || '-'],
          ['会员', conversation?.member ? conversation?.memberLevel || '阳光会员' : '普通账户']
        ]} />
        <div className="coverage-grid support-grid">
          {(isDriver
            ? ['听单异常', '提现进度', '资质审核', '联系乘客']
            : ['订单问题', '发票处理', '优惠异常', '安全反馈']
          ).map((item) => <span key={item}><CheckCircle size={15} />{item}</span>)}
        </div>
        <div className="support-contact-card">
          <Phone size={16} />
          <div>
            <strong>{serviceName}</strong>
            <small>{conversation?.lastMessageAt ? `最近更新：${formatDateTimeShort(conversation.lastMessageAt)}` : '会话记录将保留在当前账号下。'}</small>
          </div>
        </div>
      </section>
    </div>
  )
}

function SupportChatBoard({ conversation, messages = [], profile, role, onRefresh, onSend }) {
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const sortedMessages = normalizeList(messages).slice().sort((left, right) => {
    const a = dateLikeToMs(left.createdAt || left.time) || Number(left.id || 0)
    const b = dateLikeToMs(right.createdAt || right.time) || Number(right.id || 0)
    return a - b
  })
  const quickPrompts = role === 'DRIVER'
    ? ['提现多久审核？', '听单接不到订单', '资质审核进度']
    : ['订单费用有疑问', '发票什么时候开具', '优惠券无法使用']
  const lastMessage = sortedMessages[sortedMessages.length - 1]
  const mineCount = sortedMessages.filter((item) => item.senderRole === role).length
  const send = async (overrideContent = '') => {
    const content = (overrideContent || draft).trim()
    if (!content) {
      setSendError('请输入要咨询的问题')
      return
    }
    setSendError('')
    setSending(true)
    try {
      await onSend(content)
      setDraft('')
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="dashboard-grid support-chat-grid">
      <section className="glass-panel work-card wide support-chat-card">
        <div className="card-head">
          <div><span className="section-kicker">在线客服</span><h2>{role === 'DRIVER' ? '司机客服会话' : '乘客客服会话'}</h2></div>
          <button className="icon-button" onClick={onRefresh}><RefreshCw size={16} /></button>
        </div>
        <div className="support-chat-summary">
          <SummaryPill icon={MessageSquare} label="会话状态" value={statusLabel[conversation?.status] || conversation?.status || '已接入'} />
          <SummaryPill icon={Send} label="我发送的" value={`${mineCount} 条`} />
          <SummaryPill icon={Clock} label="最近消息" value={lastMessage ? formatDateTimeShort(lastMessage.createdAt || lastMessage.time) : '暂无'} />
        </div>
        <div className="chat-thread">
          {sortedMessages.length ? sortedMessages.map((item, index) => {
            const mine = item.senderRole === role
            return (
              <article className={`chat-bubble ${mine ? 'mine' : 'service'}`} key={item.id || index}>
                <div className="chat-bubble-meta">
                  <span>{mine ? resolveAccountDisplayName(profile, '我') : '阳光客服'}</span>
                  <small>{formatDateTimeShort(item.createdAt || item.time)}</small>
                </div>
                <p>{item.content}</p>
              </article>
            )
          }) : <EmptyState text="发送消息开始沟通。" />}
        </div>
        <div className="quick-question-row">
          {quickPrompts.map((item) => (
            <button key={item} type="button" onClick={() => send(item)} disabled={sending}>{item}</button>
          ))}
        </div>
        <div className="chat-composer">
          <textarea
            value={draft}
            maxLength={500}
            placeholder="输入要咨询的问题"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                send()
              }
            }}
          />
          <button className="solid-button" disabled={sending} onClick={() => send()}><Send size={16} />{sending ? '发送中...' : '发送'}</button>
        </div>
        {sendError && <p className="form-error-line">{sendError}</p>}
      </section>
      <section className="glass-panel work-card support-profile-card">
        <div className="card-head"><h2>会话状态</h2><MessageSquare size={21} /></div>
        <InfoPanel title="当前会话" items={[
          ['状态', statusLabel[conversation?.status] || conversation?.status || '已接入'],
          ['身份', role === 'DRIVER' ? '司机' : '乘客'],
          ['账号', profile?.phone || conversation?.phone || '-'],
          ['会员', conversation?.member ? conversation?.memberLevel || '阳光会员' : '无']
        ]} />
        <div className="coverage-grid support-grid">
          {(role === 'DRIVER'
            ? ['听单异常', '提现进度', '资质审核', '乘客沟通']
            : ['订单问题', '发票处理', '优惠券异常', '安全反馈']
          ).map((item) => <span key={item}><CheckCircle size={15} />{item}</span>)}
        </div>
      </section>
    </div>
  )
}

function PassengerSettingsPanel({ settings, onSettingsChange }) {
  const safeSettings = normalizePassengerSettings(settings)
  const update = (key) => onSettingsChange?.({ [key]: !safeSettings[key] })
  const coreSettings = [
    {
      key: 'pushEnabled',
      icon: Bell,
      title: '消息通知',
      checked: safeSettings.pushEnabled
    },
    {
      key: 'autoUseCoupon',
      icon: Ticket,
      title: '自动匹配优惠券',
      checked: safeSettings.autoUseCoupon
    }
  ]
  const advancedSettings = [
    {
      key: 'tripRemind',
      icon: Route,
      title: '行程提醒',
      checked: safeSettings.tripRemind
    },
    {
      key: 'invoiceRemind',
      icon: CreditCard,
      title: '发票提醒',
      checked: safeSettings.invoiceRemind
    },
    {
      key: 'privacyMask',
      icon: Lock,
      title: '隐私脱敏',
      checked: safeSettings.privacyMask
    },
    {
      key: 'emergencyShare',
      icon: ShieldCheck,
      title: '紧急共享',
      checked: safeSettings.emergencyShare
    }
  ]

  return (
    <section className="glass-panel work-card wide passenger-settings-card">
      <div className="card-head settings-card-head">
        <div>
          <span className="section-kicker">系统设置</span>
          <h2>出行偏好</h2>
        </div>
        <Settings size={21} />
      </div>
      <div className="settings-stack">
        <section className="setting-section-panel">
          <div className="setting-section-head">
            <div>
              <strong>通知与优惠</strong>
            </div>
          </div>
          <div className="settings-list">
            {coreSettings.map((item) => (
              <PassengerSettingRow
                key={item.key}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
                checked={item.checked}
                onToggle={() => update(item.key)}
              />
            ))}
          </div>
        </section>
        <section className="setting-section-panel">
          <div className="setting-section-head">
            <div>
              <strong>出行与安全</strong>
            </div>
          </div>
          <div className="settings-list">
            {advancedSettings.map((item) => (
              <PassengerSettingRow
                key={item.key}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
                checked={item.checked}
                onToggle={() => update(item.key)}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function PassengerSettingRow({ icon: Icon, title, desc, checked, onToggle }) {
  return (
    <button type="button" className="passenger-setting-row" onClick={onToggle}>
      <span className="passenger-setting-icon"><Icon size={16} /></span>
      <span className="passenger-setting-copy">
        <strong>{title}</strong>
        {desc ? <small>{desc}</small> : null}
      </span>
      <span className={`toggle-pill ${checked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  )
}

function SupportBoard({ orders, profile, settings, onComplaint, onEvaluate }) {
  const candidates = orders?.length ? orders : []
  const safeSettings = normalizePassengerSettings(settings)
  const [activeFeedback, setActiveFeedback] = useState(null)
  const [reviewForm, setReviewForm] = useState({ score: 5, tags: passengerReviewTags.slice(0, 2), content: '', anonymous: false })
  const [complaintForm, setComplaintForm] = useState({ complaintType: 'SERVICE', content: '', contactPhone: profile?.phone || '' })
  const [feedbackError, setFeedbackError] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const feedbackSummary = useMemo(() => buildSupportFeedbackSummary(candidates), [candidates])
  const complaintHistory = candidates.filter((order) => isOrderComplained(order))
  const reviewHistory = candidates.filter((order) => isOrderEvaluated(order))

  const openFeedback = (action, order) => {
    setActiveFeedback({ action, order })
    setFeedbackError('')
    setReviewForm({ score: 5, tags: passengerReviewTags.slice(0, 2), content: '', anonymous: false })
    setComplaintForm({ complaintType: 'SERVICE', content: '', contactPhone: profile?.phone || '' })
  }

  const toggleSupportReviewTag = (tag) => {
    setReviewForm((value) => ({
      ...value,
      tags: value.tags.includes(tag)
        ? value.tags.filter((item) => item !== tag)
        : [...value.tags, tag]
    }))
  }

  const submitSupportReview = async () => {
    const order = activeFeedback?.order
    const score = Number(reviewForm.score)
    const content = String(reviewForm.content || '').trim() || reviewForm.tags.join('、') || '服务体验良好'
    if (!order) {
      setFeedbackError('请先选择要评价的订单')
      return
    }
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      setFeedbackError('请选择 1-5 星评分')
      return
    }
    setSubmittingFeedback(true)
    try {
      const success = await onEvaluate?.(order, { score, tags: reviewForm.tags, content, anonymous: Boolean(reviewForm.anonymous) })
      if (success === false) {
        setFeedbackError('评价提交失败，请稍后重试')
        return
      }
      setActiveFeedback(null)
      setFeedbackError('')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const submitSupportComplaint = async () => {
    const order = activeFeedback?.order
    const content = String(complaintForm.content || '').trim()
    const contactPhone = String(complaintForm.contactPhone || '').trim()
    if (!order) {
      setFeedbackError('请先选择要投诉的订单')
      return
    }
    if (!content) {
      setFeedbackError('请填写反馈内容')
      return
    }
    if (contactPhone && !isValidPhone(contactPhone)) {
      setFeedbackError('联系电话需要为 11 位手机号')
      return
    }
    setSubmittingFeedback(true)
    try {
      const success = await onComplaint?.(order, {
        complaintType: complaintForm.complaintType,
        contactPhone,
        content
      })
      if (success === false) {
        setFeedbackError('投诉提交失败，请稍后重试')
        return
      }
      setActiveFeedback(null)
      setFeedbackError('')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  return (
    <div className="dashboard-grid settings-support-grid">
      <section className="glass-panel work-card wide">
        <div className="card-head settings-card-head">
          <div>
            <span className="section-kicker">服务反馈</span>
            <h2>评价与投诉</h2>
            <p>同步小程序评价记录、投诉反馈和帮助中心，订单处理结果会回写到订单与消息。</p>
          </div>
          <MessageSquare size={21} />
        </div>
        <div className="support-feedback-hero">
          <div>
            <span>反馈中心</span>
            <strong>{feedbackSummary.actionable} 单可处理</strong>
            <p>评价和投诉结果都会同步到订单记录，方便后续追踪。</p>
          </div>
          <div className="support-feedback-metrics">
            <SummaryPill icon={Star} label="已评价" value={`${feedbackSummary.evaluated} 单`} />
            <SummaryPill icon={AlertTriangle} label="已投诉" value={`${feedbackSummary.complained} 单`} />
            <SummaryPill icon={Clock} label="待反馈" value={`${feedbackSummary.pending} 单`} />
          </div>
        </div>
        {candidates.length ? (
          <OrderList
            orders={candidates}
            empty="暂无可评价订单，完成一次行程后会出现在这里。"
            limit={8}
            selectedOrderId={activeFeedback?.order ? orderKey(activeFeedback.order) : ''}
            className="support-order-list"
            footer={(order) => (
              <>
                <button
                  className={`ghost-button${activeFeedback?.action === 'evaluate' && orderKey(activeFeedback.order) === orderKey(order) ? ' is-selected' : ''}`}
                  disabled={!(order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID && !isOrderEvaluated(order))}
                  onClick={() => openFeedback('evaluate', order)}
                >
                  <Star size={16} />评价
                </button>
                <button
                  className={`ghost-button${activeFeedback?.action === 'complaint' && orderKey(activeFeedback.order) === orderKey(order) ? ' is-selected' : ''}`}
                  disabled={order.orderStatus === ORDER_STATUS.CANCELLED || isOrderComplained(order)}
                  onClick={() => openFeedback('complaint', order)}
                >
                  <AlertTriangle size={16} />投诉
                </button>
              </>
            )}
          />
        ) : <EmptyState text="暂无可评价订单，完成一次行程后会出现在这里。" />}
        {activeFeedback?.action === 'evaluate' && (
          <div className="order-action-panel support-feedback-panel">
            <div className="order-action-panel-head">
              <span><Star size={15} />评价订单</span>
              <small>{activeFeedback.order?.orderNo || `#${activeFeedback.order?.id}`}</small>
            </div>
            <div className="score-row" role="group" aria-label="个人中心评价评分">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  type="button"
                  key={score}
                  className={reviewForm.score >= score ? 'active' : ''}
                  onClick={() => setReviewForm((value) => ({ ...value, score }))}
                >
                  <Star size={16} />
                </button>
              ))}
              <span>{reviewForm.score} 星</span>
            </div>
            <div className="feedback-chip-row">
              {passengerReviewTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={reviewForm.tags.includes(tag) ? 'active' : ''}
                  onClick={() => toggleSupportReviewTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <label className="plain-field textarea-field">
              <span>评价内容</span>
            <textarea
                value={reviewForm.content}
                maxLength={300}
                placeholder="补充本次行程体验"
                onChange={(event) => setReviewForm((value) => ({ ...value, content: event.target.value }))}
              />
              <small>{reviewForm.content.length}/300</small>
            </label>
            <button
              type="button"
              className={`review-anonymous-toggle ${reviewForm.anonymous ? 'active' : ''}`}
              onClick={() => setReviewForm((value) => ({ ...value, anonymous: !value.anonymous }))}
            >
              <span>匿名评价</span>
              <span className={`toggle-pill ${reviewForm.anonymous ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
            </button>
            {feedbackError && <p className="form-error-line">{feedbackError}</p>}
            <div className="order-action-panel-actions">
              <button className="solid-button" disabled={submittingFeedback} onClick={submitSupportReview}><Star size={16} />{submittingFeedback ? '提交中...' : '提交评价'}</button>
              <button className="ghost-button" disabled={submittingFeedback} onClick={() => setActiveFeedback(null)}>取消</button>
            </div>
          </div>
        )}
        {activeFeedback?.action === 'complaint' && (
          <div className="order-action-panel support-feedback-panel">
            <div className="order-action-panel-head">
              <span><AlertTriangle size={15} />投诉反馈</span>
              <small>{activeFeedback.order?.orderNo || `#${activeFeedback.order?.id}`}</small>
            </div>
            <div className="feedback-chip-row">
              {complaintTypeOptions.map(([value, label, desc]) => (
                <button
                  type="button"
                  key={value}
                  className={complaintForm.complaintType === value ? 'active' : ''}
                  title={desc}
                  onClick={() => setComplaintForm((form) => ({ ...form, complaintType: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="plain-field textarea-field">
              <span>问题说明</span>
              <textarea
                value={complaintForm.content}
                maxLength={300}
                placeholder="请说明问题经过、发生时间和希望处理方式"
                onChange={(event) => setComplaintForm((form) => ({ ...form, content: event.target.value }))}
              />
              <small>{complaintForm.content.length}/300</small>
            </label>
            <Field label="联系电话" value={complaintForm.contactPhone} onChange={(value) => setComplaintForm((form) => ({ ...form, contactPhone: value }))} />
            {feedbackError && <p className="form-error-line">{feedbackError}</p>}
            <div className="order-action-panel-actions">
              <button className="solid-button" disabled={submittingFeedback} onClick={submitSupportComplaint}><AlertTriangle size={16} />{submittingFeedback ? '提交中...' : '提交投诉'}</button>
              <button className="ghost-button" disabled={submittingFeedback} onClick={() => setActiveFeedback(null)}>取消</button>
            </div>
          </div>
        )}
      </section>
      <section className="glass-panel work-card">
        <div className="card-head settings-card-head settings-card-head--compact">
          <div>
            <span className="section-kicker">帮助入口</span>
            <h2>帮助与记录</h2>
          </div>
          <HelpCircle size={21} />
        </div>
        <div className="coverage-grid support-grid">
          {['常见问题', '紧急联系人', '隐私设置', '行程安全', '消息通知', '版本信息'].map((item) => <span key={item}><CheckCircle size={15} />{item}</span>)}
        </div>
        <div className="help-faq-list">
          {passengerHelpList.map((item) => (
            <article className="help-faq-row" key={item.id}>
              <span><HelpCircle size={15} /></span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.content}</small>
              </div>
            </article>
          ))}
        </div>
        <InfoPanel title="当前用户" items={[
          ['昵称', resolveAccountDisplayName(profile, '-')],
          ['紧急联系人', pickFirstCleanText(profile?.emergencyContact) || '-'],
          ['消息通知', safeSettings.pushEnabled ? '已开启' : '已关闭'],
          ['自动优惠', safeSettings.autoUseCoupon ? '已开启' : '手动选择']
        ]} />
        <div className="feedback-history-panel">
          <div className="feedback-history-head">
            <span>处理记录</span>
            <small>{complaintHistory.length + reviewHistory.length} 条</small>
          </div>
          {complaintHistory.length || reviewHistory.length ? (
            <div className="feedback-history-list">
              {complaintHistory.map((order) => (
                <div className="feedback-history-row" key={`complaint-${orderKey(order)}`}>
                  <AlertTriangle size={14} />
                  <div>
                    <strong>{orderComplaintStatusText(order)}</strong>
                    <small>{order.orderNo || `#${order.id}`} · {formatOrderTime(order)}</small>
                  </div>
                </div>
              ))}
              {reviewHistory.map((order) => (
                <div className="feedback-history-row" key={`review-${orderKey(order)}`}>
                  <Star size={14} />
                  <div>
                    <strong>{orderEvaluationStatusText(order)}</strong>
                    <small>{order.orderNo || `#${order.id}`} · {formatOrderTime(order)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="feedback-history-empty">
              <strong>还没有处理记录</strong>
              <small>提交评价或投诉后可在这里查看状态。</small>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DriverWallet({ dashboard, withdraws = [], onWithdraw }) {
  const [withdraw, setWithdraw] = useState({ applyAmount: '', bankName: '', bankAccount: '' })
  const [withdrawError, setWithdrawError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey())

  const visibleWithdraws = withdraws.length ? withdraws : normalizeList(dashboard?.pendingWithdraw)
  const incomeOrders = normalizeList(dashboard?.orders).filter((order) => String(order.orderStatus || '').toUpperCase() === ORDER_STATUS.FINISHED)
  const monthOptions = useMemo(() => buildDriverIncomeMonthOptions(incomeOrders), [incomeOrders])
  const activeMonth = monthOptions.some((item) => item.value === selectedMonth) ? selectedMonth : (monthOptions[0]?.value || currentMonthKey())
  const monthBills = useMemo(() => incomeOrders
    .filter((order) => driverIncomeMonthKey(order) === activeMonth)
    .sort((left, right) => walletOrderTimeMs(right) - walletOrderTimeMs(left)), [incomeOrders, activeMonth])
  const selectedMonthIncome = monthBills.reduce((sum, order) => sum + driverIncomeAmount(order), 0)
  const availableAmount = Number(dashboard?.profile?.withdrawableIncome || 0)
  const todayIncome = Number(dashboard?.profile?.todayIncome || 0)
  const monthIncome = Number(dashboard?.profile?.monthIncome || dashboard?.profile?.monthlyIncome || todayIncome)
  const quickWithdrawAmounts = [50, 100, 200, availableAmount]
    .filter((amount, index, list) => Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= availableAmount && list.indexOf(amount) === index)
    .slice(0, 4)
  const submitWithdraw = async () => {
    const amount = Number(withdraw.applyAmount)
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setWithdrawError('请输入正确的提现金额')
      return
    }
    if (amount > availableAmount) {
      setWithdrawError(`提现金额不能超过 ${formatMoney(availableAmount)}`)
      return
    }
    if (!String(withdraw.bankName || '').trim()) {
      setWithdrawError('请输入开户行')
      return
    }
    if (!String(withdraw.bankAccount || '').trim()) {
      setWithdrawError('请输入银行卡号')
      return
    }
    setWithdrawError('')
    const success = await onWithdraw({
      applyAmount: amount,
      bankName: String(withdraw.bankName).trim(),
      bankAccount: String(withdraw.bankAccount).trim()
    })
    if (success !== false) setWithdraw({ applyAmount: '', bankName: '', bankAccount: '' })
  }
  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card driver-withdraw-card">
        <div className="card-head"><h2>钱包提现</h2><DollarSign size={21} /></div>
        <div className="driver-wallet-hero">
          <div className="driver-wallet-hero-head">
            <span>收益总览</span>
            <em>收益明细</em>
          </div>
          <div className="driver-income-grid">
            <div>
              <span>今日收入</span>
              <strong>{formatMoney(todayIncome)}</strong>
            </div>
            <div>
              <span>本月收入</span>
              <strong>{formatMoney(monthIncome)}</strong>
            </div>
            <div>
              <span>可提现</span>
              <strong>{formatMoney(availableAmount)}</strong>
            </div>
          </div>
          <p>订单完结后收益自动入账，提现申请会进入后台审核并同步到司机端记录。</p>
        </div>
        <div className="stat-grid dashboard-stat-grid compact-stats">
          <Metric value={formatMoney(availableAmount)} label="可提现余额" />
          <Metric value={visibleWithdraws.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length} label="待审核提现" />
        </div>
        <div className="withdraw-quick-row">
          {quickWithdrawAmounts.map((amount) => (
            <button
              type="button"
              key={amount}
              className={Number(withdraw.applyAmount) === Number(amount) ? 'active' : ''}
              onClick={() => setWithdraw((draft) => ({ ...draft, applyAmount: amount }))}
            >
              {amount === availableAmount ? '全部' : formatMoney(amount)}
            </button>
          ))}
        </div>
        <Field label="提现金额" value={withdraw.applyAmount} onChange={(value) => setWithdraw((draft) => ({ ...draft, applyAmount: value }))} />
        <Field label="开户行" value={withdraw.bankName} onChange={(value) => setWithdraw((draft) => ({ ...draft, bankName: value }))} />
        <Field label="银行卡号" value={withdraw.bankAccount} onChange={(value) => setWithdraw((draft) => ({ ...draft, bankAccount: value }))} />
        {withdrawError && <p className="form-error-line">{withdrawError}</p>}
        <button className="solid-button fill" onClick={submitWithdraw}><Wallet size={16} />提交提现</button>
        <p className="withdraw-safe-note">提交后进入后台审核，审核状态会同步到司机端和后台提现记录。</p>
      </section>
      <section className="glass-panel work-card withdraw-record-card">
        <div className="card-head"><h2>提现记录</h2><Clock size={21} /></div>
        {visibleWithdraws.length ? (
          <div className="record-list">
            {visibleWithdraws.slice(0, 6).map((item) => (
              <article className="record-row" key={item.id || `${item.createdAt}-${item.applyAmount}`}>
                <div>
                  <strong>{formatMoney(item.applyAmount || item.amount || 0)}</strong>
                  <span>{withdrawBankName(item)} · {withdrawBankAccount(item)}</span>
                  {(item.rejectReason || item.reject_reason) && <small>{item.rejectReason || item.reject_reason}</small>}
                </div>
                <div>
                  <StatusBadge value={String(item.status || 'PENDING').toUpperCase()} label={withdrawStatusText(item)} />
                  <small>{withdrawCreatedAt(item)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState text="暂无提现记录，提交提现后会同步显示。" />}
      </section>
      <section className="glass-panel work-card wide driver-income-bills-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">收入账单</span>
            <h2>月度流水</h2>
            <small>按小程序收益页同步最近完成订单收入</small>
          </div>
          <select value={activeMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="driver-income-month-summary">
          <SummaryPill icon={DollarSign} label="当月收入" value={formatMoney(selectedMonthIncome || monthIncome)} />
          <SummaryPill icon={Route} label="完成订单" value={`${monthBills.length} 单`} />
          <SummaryPill icon={Clock} label="账单月份" value={formatDriverMonthLabel(activeMonth)} />
        </div>
        {monthBills.length ? (
          <div className="driver-income-bill-list">
            {monthBills.slice(0, 10).map((order) => (
              <article className="driver-income-bill-row" key={orderKey(order)}>
                <div>
                  <strong>{order.startName} → {order.endName}</strong>
                  <small>{order.orderNo || `#${order.id}`} · {formatOrderDisplayTime(order)}</small>
                </div>
                <span>+{formatMoney(driverIncomeAmount(order), order.currencyCode)}</span>
              </article>
            ))}
          </div>
        ) : <EmptyState text="当前月份暂无完成订单流水。" />}
      </section>
    </div>
  )
}

function DriverCertificationBoard({ dashboard, onUploadDocument, onCertify }) {
  const [certError, setCertError] = useState('')
  const [uploadingDocument, setUploadingDocument] = useState('')
  const [editingCert, setEditingCert] = useState(false)
  const documentInputs = useRef({})
  const [cert, setCert] = useState(() => buildDriverCertificationForm(dashboard))

  useEffect(() => {
    if (!editingCert) setCert(buildDriverCertificationForm(dashboard))
  }, [dashboard, editingCert])

  const driverAudit = auditStatusMeta(dashboard?.profile?.auditStatus)
  const vehicleAudit = auditStatusMeta(dashboard?.vehicle?.auditStatus)
  const certFieldKeys = ['licenseNo', 'plateNo', 'brand', 'modelName', 'color', 'seatCount', 'insuranceExpireDate', 'annualInspectExpireDate']
  const updateCert = (patch) => setCert((draft) => ({ ...draft, ...patch }))
  const chooseDocument = (key) => {
    documentInputs.current[key]?.click()
  }
  const resetCert = () => {
    setCert(buildDriverCertificationForm(dashboard))
    setCertError('')
    setUploadingDocument('')
    setEditingCert(false)
  }
  const handleDocumentFile = async (key, file) => {
    if (!file || uploadingDocument) return
    const documentType = key === 'vehicleLicenseImageUrl' ? 'VEHICLE_LICENSE' : 'DRIVER_LICENSE'
    const localPreview = URL.createObjectURL(file)
    updateCert({ [key]: localPreview })
    setUploadingDocument(key)
    setCertError('')
    try {
      const result = await onUploadDocument?.(file, documentType)
      const fileUrl = result?.fileUrl || result?.url || localPreview
      updateCert({ [key]: fileUrl })
      if (fileUrl !== localPreview) URL.revokeObjectURL(localPreview)
    } catch (error) {
      updateCert({ [key]: '' })
      setCertError(error.message || '证件图片上传失败，请重新选择')
      URL.revokeObjectURL(localPreview)
    } finally {
      setUploadingDocument('')
    }
  }
  const submitCert = async () => {
    const payload = Object.fromEntries(Object.entries(cert).map(([key, value]) => [key, String(value ?? '').trim()]))
    const requiredKeys = [
      'licenseNo',
      'plateNo',
      'brand',
      'modelName',
      'color',
      'seatCount',
      'insuranceExpireDate',
      'annualInspectExpireDate',
      'vehicleLicenseImageUrl',
      'driverLicenseImageUrl'
    ]
    const emptyKey = requiredKeys.find((key) => !payload[key])
    if (emptyKey) {
      setCertError(`请填写${fieldLabel(emptyKey)}`)
      return
    }
    const seatCount = Number(payload.seatCount)
    if (!Number.isFinite(seatCount) || seatCount < 4 || seatCount > 9) {
      setCertError('座位数需要在 4-9 座之间')
      return
    }
    if (isLocalDriverDocumentPath(payload.vehicleLicenseImageUrl)) {
      setCertError('行驶证照片上传未完成，请重新上传')
      return
    }
    if (isLocalDriverDocumentPath(payload.driverLicenseImageUrl)) {
      setCertError('驾驶证照片上传未完成，请重新上传')
      return
    }
    const confirmed = window.confirm(
      dashboard?.vehicle?.id
        ? '提交更换后，车辆审核状态会回到待审核，接单权限会临时锁定，确认继续吗？'
        : '提交后需要等待管理员审核，审核通过后才能解锁接单功能，确认提交吗？'
    )
    if (!confirmed) return
    setCertError('')
    const success = await onCertify({ ...payload, seatCount })
    if (success !== false) setEditingCert(false)
  }

  return (
    <div className="dashboard-grid driver-certification-board">
      <section className="glass-panel work-card wide driver-cert-card">
        <div className="card-head">
          <div><span className="section-kicker">车辆认证</span><h2>司机资质</h2></div>
          {editingCert ? (
            <button type="button" className="ghost-button compact-action" onClick={resetCert}>取消编辑</button>
          ) : (
            <button type="button" className="ghost-button compact-action" onClick={() => setEditingCert(true)}><BadgeCheck size={14} />编辑资质</button>
          )}
        </div>
        <div className="cert-summary-grid">
          <SummaryPill icon={BadgeCheck} value={driverAudit.label} label="人证审核" />
          <SummaryPill icon={Car} value={vehicleAudit.label} label="车辆审核" />
          <SummaryPill icon={ShieldCheck} value={dashboard?.servicePermission?.message || '待同步'} label="接单权限" />
        </div>
        <div className="driver-cert-notice">
          <ShieldCheck size={16} />
          <div>
            <strong>{dashboard?.vehicle?.id ? '编辑车辆资质后需要重新审核' : '请补齐车辆和证件资料'}</strong>
            <small>行驶证、驾驶证图片可点击预览；点击编辑后才可以重新选择上传，提交后接单权限会按审核状态同步。</small>
          </div>
        </div>
        {editingCert ? (
          <div className="form-grid">
            {certFieldKeys.map((key) => (
              <Field key={key} label={fieldLabel(key)} value={cert[key]} onChange={(value) => setCert((draft) => ({ ...draft, [key]: value }))} />
            ))}
          </div>
        ) : (
          <div className="profile-view-list driver-cert-readonly-list">
            {certFieldKeys.map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{cert[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="driver-document-grid">
          {[
            ['vehicleLicenseImageUrl', '行驶证图片', '请上传清晰完整的行驶证照片'],
            ['driverLicenseImageUrl', '驾驶证图片', '请上传清晰完整的驾驶证照片']
          ].map(([key, title, desc]) => (
            <DriverDocumentCard
              key={key}
              title={title}
              desc={desc}
              value={cert[key]}
              uploading={uploadingDocument === key}
              editable={editingCert}
              onPreview={() => previewDriverDocument(cert[key], title)}
              onChoose={() => chooseDocument(key)}
              inputRef={(node) => {
                if (node) documentInputs.current[key] = node
              }}
              onFile={(file) => handleDocumentFile(key, file)}
            />
          ))}
        </div>
        {certError && <p className="form-error-line">{certError}</p>}
        {editingCert && (
          <div className="driver-cert-actions">
            <button className="solid-button" disabled={Boolean(uploadingDocument)} onClick={submitCert}>
              <ShieldCheck size={16} />{uploadingDocument ? '图片上传中...' : (dashboard?.vehicle?.id ? '提交变更审核' : '提交资质')}
            </button>
            <button type="button" className="ghost-button" disabled={Boolean(uploadingDocument)} onClick={resetCert}>取消</button>
          </div>
        )}
      </section>
    </div>
  )
}

function DriverDocumentCard({ title, desc, value, uploading, editable = false, onPreview, onChoose, inputRef, onFile }) {
  const [imageBroken, setImageBroken] = useState(false)
  const previewUrl = resolveDriverDocumentUrl(value)
  const imageSrc = !value || imageBroken ? buildDocumentPlaceholder(title, value) : previewUrl

  useEffect(() => {
    setImageBroken(false)
  }, [value])

  return (
    <article className="driver-document-card">
      <div className="driver-document-head">
        <div>
          <strong>{title}</strong>
          <small>{desc}</small>
        </div>
        <StatusBadge value={value ? 'READY' : 'PENDING'} label={value ? '已上传' : '待上传'} />
      </div>
      <button
        type="button"
        className={`driver-document-preview ${value ? 'has-image' : ''}`}
        onClick={value ? onPreview : editable ? onChoose : undefined}
      >
        <img src={imageSrc} alt={title} onError={() => setImageBroken(true)} />
        <span>{uploading ? '上传中...' : value ? '点击预览' : editable ? '点击选择图片' : '未上传'}</span>
      </button>
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onFile?.(file)
          }}
        />
      )}
      <div className="driver-document-actions">
        {editable && <button type="button" className="ghost-button" onClick={onChoose}>{value ? '重新选择' : '上传图片'}</button>}
        {value && <button type="button" className="ghost-button" onClick={onPreview}><Eye size={14} />预览</button>}
      </div>
    </article>
  )
}

function buildDriverCertificationForm(dashboard = {}) {
  const profile = dashboard?.profile || {}
  const vehicle = dashboard?.vehicle || {}
  return {
    licenseNo: pickFirstCleanText(profile.licenseNo, profile.license_no, 'DRV20260514001'),
    plateNo: pickFirstCleanText(vehicle.plateNo, vehicle.plate_no, '冀R·A8888'),
    brand: pickFirstCleanText(vehicle.brand, '比亚迪'),
    modelName: pickFirstCleanText(vehicle.modelName, vehicle.model_name, '汉 EV'),
    color: pickFirstCleanText(vehicle.color, '橙白'),
    seatCount: vehicle.seatCount || vehicle.seat_count || 5,
    insuranceExpireDate: pickFirstCleanText(vehicle.insuranceExpireDate, vehicle.insurance_expire_date, '2026-12-31'),
    annualInspectExpireDate: pickFirstCleanText(vehicle.annualInspectExpireDate, vehicle.annual_inspect_expire_date, '2026-12-31'),
    vehicleLicenseImageUrl: pickFirstCleanText(vehicle.vehicleLicenseImageUrl, vehicle.vehicle_license_image_url),
    driverLicenseImageUrl: pickFirstCleanText(vehicle.driverLicenseImageUrl, vehicle.driver_license_image_url)
  }
}

function DriverProfileBoard({ dashboard, user, onProfile }) {
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [form, setForm] = useState({
    nickname: safeEditableText(user?.nickname),
    cityCode: dashboard?.profile?.cityCode || '310100',
    licenseNo: dashboard?.profile?.licenseNo || 'DRV20260514001',
    emergencyContact: safeEditableText(dashboard?.profile?.emergencyContact || user?.emergencyContact),
    emergencyPhone: dashboard?.profile?.emergencyPhone || user?.emergencyPhone || '',
    defaultLanguage: user?.defaultLanguage || 'zh-CN'
  })
  const profileFieldKeys = ['nickname', 'cityCode', 'licenseNo', 'emergencyContact', 'emergencyPhone', 'defaultLanguage']

  useEffect(() => {
    if (editingProfile) return
    setForm({
      nickname: safeEditableText(user?.nickname),
      cityCode: dashboard?.profile?.cityCode || '310100',
      licenseNo: dashboard?.profile?.licenseNo || 'DRV20260514001',
      emergencyContact: safeEditableText(dashboard?.profile?.emergencyContact || user?.emergencyContact),
      emergencyPhone: dashboard?.profile?.emergencyPhone || user?.emergencyPhone || '',
      defaultLanguage: user?.defaultLanguage || 'zh-CN'
    })
  }, [dashboard?.profile?.cityCode, dashboard?.profile?.emergencyContact, dashboard?.profile?.emergencyPhone, dashboard?.profile?.licenseNo, editingProfile, user?.defaultLanguage, user?.emergencyContact, user?.emergencyPhone, user?.nickname])

  const cancelProfileEdit = () => {
    setForm({
      nickname: safeEditableText(user?.nickname),
      cityCode: dashboard?.profile?.cityCode || '310100',
      licenseNo: dashboard?.profile?.licenseNo || 'DRV20260514001',
      emergencyContact: safeEditableText(dashboard?.profile?.emergencyContact || user?.emergencyContact),
      emergencyPhone: dashboard?.profile?.emergencyPhone || user?.emergencyPhone || '',
      defaultLanguage: user?.defaultLanguage || 'zh-CN'
    })
    setProfileError('')
    setEditingProfile(false)
  }

  const saveProfile = async () => {
    if (savingProfile) return
    const payload = {
      ...form,
      nickname: form.nickname.trim(),
      cityCode: form.cityCode.trim(),
      licenseNo: form.licenseNo.trim(),
      emergencyContact: form.emergencyContact.trim(),
      emergencyPhone: form.emergencyPhone.trim(),
      defaultLanguage: form.defaultLanguage.trim() || 'zh-CN'
    }
    if (!payload.nickname) {
      setProfileError('请填写司机昵称')
      return
    }
    if (!payload.cityCode) {
      setProfileError('请填写服务城市')
      return
    }
    if (!payload.licenseNo || payload.licenseNo.length < 6) {
      setProfileError('请填写正确的驾驶证号')
      return
    }
    if (!isValidContactPhone(payload.emergencyPhone)) {
      setProfileError('请填写 8-16 位纯数字紧急电话')
      return
    }
    setProfileError('')
    setSavingProfile(true)
    try {
      const success = await onProfile(payload)
      if (success !== false) setEditingProfile(false)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card wide">
        <div className="card-head">
          <div><span className="section-kicker">司机资料</span><h2>资料编辑</h2></div>
          {editingProfile ? (
            <button type="button" className="ghost-button compact-action" onClick={cancelProfileEdit}>取消编辑</button>
          ) : (
            <button type="button" className="ghost-button compact-action" onClick={() => setEditingProfile(true)}><Settings size={14} />编辑资料</button>
          )}
        </div>
        {editingProfile ? (
          <>
            <div className="form-grid">
              {profileFieldKeys.map((key) => (
                <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
              ))}
            </div>
            {profileError && <p className="form-error-line">{profileError}</p>}
            <button className={`solid-button profile-save-button${savingProfile ? ' is-busy' : ''}`} disabled={savingProfile} onClick={saveProfile}>
              <ShieldCheck size={16} />{savingProfile ? '保存中...' : '保存司机资料'}
            </button>
          </>
        ) : (
          <div className="profile-view-list wallet-readonly-list">
            {profileFieldKeys.map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{key === 'emergencyPhone' && form[key] ? maskPhone(form[key]) : form[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="glass-panel work-card">
        <div className="card-head"><h2>司机状态</h2><User size={21} /></div>
        <InfoPanel title="当前状态" items={[
          ['服务状态', statusLabel[dashboard?.profile?.serviceStatus] || '-'],
          ['今日订单', dashboard?.orders?.length || 0],
          ['资质状态', dashboard?.servicePermission?.message || '-'],
          ['资料状态', dashboard?.profile?.auditStatus || '-']
        ]} />
      </section>
    </div>
  )
}

function DriverSettingsBoard({ dashboard, settings = driverDefaultSettings, onSettingsChange, onServiceStatus }) {
  const safeSettings = normalizeDriverSettings(settings)
  const trackMeta = driverTrackModeMeta(safeSettings.trackMode)

  return (
    <div className="dashboard-grid driver-settings-board">
      <section className="glass-panel work-card wide driver-settings-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">接单设置</span>
            <h2>听单、轨迹与语音播报</h2>
            <small>对齐司机小程序设置页，当前偏好会保存在网页端。</small>
          </div>
          <Settings size={21} />
        </div>
        <div className="driver-settings-hero">
          <div>
            <span>当前状态</span>
            <strong>{safeSettings.listenMode ? '听单中' : '休息中'}</strong>
            <small>{trackMeta.label}轨迹 · {driverVoiceStyleLabel(safeSettings.voiceStyle)}</small>
          </div>
          <StatusBadge value={dashboard?.profile?.serviceStatus || DRIVER_STATUS.OFFLINE} />
        </div>
        <DriverSettingsPanel
          settings={safeSettings}
          serviceStatus={dashboard?.profile?.serviceStatus}
          onSettingsChange={onSettingsChange}
          onServiceStatus={onServiceStatus}
        />
      </section>
      <section className="glass-panel work-card">
        <div className="card-head"><h2>设置摘要</h2><Radio size={21} /></div>
        <InfoPanel title="当前偏好" items={[
          ['听单模式', safeSettings.listenMode ? '开启' : '关闭'],
          ['自动接单', safeSettings.autoAccept ? '开启' : '关闭'],
          ['语音播报', safeSettings.voiceBroadcast ? '开启' : '关闭'],
          ['轨迹模式', trackMeta.label],
          ['播报声音', driverVoiceStyleLabel(safeSettings.voiceStyle)]
        ]} />
      </section>
    </div>
  )
}

function DriverSettingsPanel({ settings, serviceStatus, onSettingsChange, onServiceStatus }) {
  const [previewText, setPreviewText] = useState('')
  const safeSettings = normalizeDriverSettings(settings)
  const trackMeta = driverTrackModeMeta(safeSettings.trackMode)
  const updateSetting = (patch) => onSettingsChange?.(patch)
  const toggleListenMode = () => {
    const nextStatus = safeSettings.listenMode ? DRIVER_STATUS.OFFLINE : DRIVER_STATUS.ONLINE
    onServiceStatus?.(nextStatus)
  }
  const previewVoice = () => {
    const label = driverVoiceStyleLabel(safeSettings.voiceStyle)
    setPreviewText(`已试听：${label}`)
    if (!safeSettings.voiceBroadcast) return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(`当前声音为${label}，请确认播报效果。`)
      utterance.lang = 'zh-CN'
      utterance.rate = safeSettings.voiceStyle === 'playful' ? 1.08 : 0.96
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="driver-settings-panel">
      <div className="settings-row-list">
        <DriverSettingRow
          icon={Radio}
          title="听单模式"
          desc="关闭后不再接收新订单。"
          checked={safeSettings.listenMode}
          onToggle={toggleListenMode}
          meta={statusLabel[serviceStatus] || '离线'}
        />
        <DriverSettingRow
          icon={Zap}
          title="自动接单"
          desc="听单开启后，网页端会自动接取第一条待抢订单。"
          checked={safeSettings.autoAccept}
          onToggle={() => updateSetting({ autoAccept: !safeSettings.autoAccept })}
        />
        <DriverSettingRow
          icon={Bell}
          title="语音播报"
          desc="播报接驾、上车、目的地提醒和订单变化。"
          checked={safeSettings.voiceBroadcast}
          onToggle={() => updateSetting({ voiceBroadcast: !safeSettings.voiceBroadcast })}
        />
      </div>

      <div className="settings-choice-panel">
        <div>
          <span>轨迹模式</span>
          <p>{trackMeta.desc}</p>
        </div>
        <div className="choice-chip-row">
          {driverTrackModeOptions.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={safeSettings.trackMode === value ? 'active' : ''}
              onClick={() => updateSetting({ trackMode: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <small>当前选择：{trackMeta.label}</small>
      </div>

      <div className="settings-choice-panel">
        <div>
          <span>播报声音</span>
          <p>与小程序声音选项保持一致，网页端会保存当前偏好。</p>
        </div>
        <div className="voice-chip-grid">
          {driverVoiceStyleOptions.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={safeSettings.voiceStyle === value ? 'active' : ''}
              onClick={() => updateSetting({ voiceStyle: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="voice-preview-row">
          <button type="button" className="ghost-button" onClick={previewVoice}><Play size={15} />试听</button>
          <small>{previewText || `当前选择：${driverVoiceStyleLabel(safeSettings.voiceStyle)}`}</small>
        </div>
      </div>
    </div>
  )
}

function DriverSettingRow({ icon: Icon, title, desc, checked, onToggle, meta }) {
  return (
    <button type="button" className="driver-setting-row" onClick={onToggle}>
      <span className="driver-setting-icon"><Icon size={16} /></span>
      <span className="driver-setting-copy">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      {meta && <span className="driver-setting-meta">{meta}</span>}
      <span className={`toggle-pill ${checked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  )
}

function messageTypeLabel(type) {
  const labels = {
    ORDER: '订单',
    PAYMENT: '支付',
    COUPON: '优惠券',
    SYSTEM: '系统',
    DRIVER: '司机'
  }
  return labels[type] || type || '通知'
}

function dateLikeToMs(value) {
  if (!value) return null
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, Number(month) - 1, day, hour, minute, second).getTime()
  }
  const parsed = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function driverOrderIdOf(order = {}) {
  const value = order.id || order.orderId || order.orderNo || order.order_id || order.order_no || ''
  return value === undefined || value === null ? '' : String(value)
}

function driverOrderCreatedAtMs(order = {}) {
  return dateLikeToMs(order.createdAt || order.createTime || order.createdTime || order.created_at || order.orderTime || order.submitTime) || 0
}

function isDriverOrderNewAfterListening(order = {}, listeningSince = 0) {
  const since = Number(listeningSince || 0)
  if (!since) return false
  return Boolean(order.isNew) || driverOrderCreatedAtMs(order) >= since
}

function messageEventTime(item) {
  return dateLikeToMs(item.createdAt || item.createdTime || item.createTime)
}

function orderEventTime(order, templateCode = '') {
  const eventMap = {
    ORDER_CREATED: ['createdAt', 'createdTime', 'createTime'],
    DRIVER_ACCEPTED: ['acceptedAt', 'updatedAt', 'createdAt'],
    DRIVER_ON_THE_WAY: ['acceptedAt', 'updatedAt', 'createdAt'],
    TRIP_STARTED: ['startedAt', 'updatedAt', 'createdAt'],
    TRIP_FINISHED: ['finishedAt', 'updatedAt', 'createdAt'],
    PAY_SUCCESS: ['paidAt', 'updatedAt', 'createdAt'],
    ORDER_CANCELLED: ['cancelledAt', 'canceledAt', 'updatedAt', 'createdAt']
  }
  const keys = eventMap[templateCode] || ['updatedAt', 'createdAt', 'createdTime', 'createTime']
  for (const key of keys) {
    const time = dateLikeToMs(order[key])
    if (time) return time
  }
  return null
}

function matchMessageOrder(item, orders = []) {
  if (!['ORDER', 'PAYMENT'].includes(item.type) && !String(item.title || '').includes('订单') && !String(item.title || '').includes('行程')) {
    return null
  }
  const messageMs = messageEventTime(item)
  const template = item.templateCode || ''
  if (template === 'ORDER_CANCELLED') {
    return [...orders]
      .filter((order) => order.orderStatus === ORDER_STATUS.CANCELLED)
      .sort((a, b) => (dateLikeToMs(b.createdAt || b.createdTime || b.createTime) || 0) - (dateLikeToMs(a.createdAt || a.createdTime || a.createTime) || 0))[0] || null
  }
  let best = null
  let bestDelta = Number.POSITIVE_INFINITY
  for (const order of orders) {
    const orderMs = orderEventTime(order, template)
    if (!messageMs || !orderMs) continue
    const delta = Math.abs(messageMs - orderMs)
    if (delta < bestDelta) {
      best = order
      bestDelta = delta
    }
  }
  return bestDelta <= 1000 * 60 * 90 ? best : null
}

function enrichMessagesWithOrders(messages, orders) {
  return messages.map((item) => ({ ...item, order: matchMessageOrder(item, orders) }))
}

function getMessageText(message = {}) {
  return [
    message.title,
    message.content,
    message.type,
    message.templateCode,
    message.bizType,
    message.url,
    message.linkUrl,
    message.targetUrl,
    message.path
  ].filter(Boolean).join(' ')
}

function normalizeMessageRoute(value = '') {
  const text = String(value || '').trim()
  return text.startsWith('/pages/') ? text : ''
}

function getMessageRouteOrderId(route = '') {
  const matched = String(route || '').match(/[?&](?:id|orderId)=([^&]+)/)
  return matched ? decodeURIComponent(matched[1]) : ''
}

function extractWebMessageOrderId(message = {}) {
  const direct = message.orderId || message.orderNo || message.bizId || message.targetId || message.bizNo
  if (direct) return String(direct)
  const linked = orderKey(message.order || {})
  if (linked) return linked
  const text = getMessageText(message)
  const matched = text.match(/(?:ORDER|ORD|order|订单|行程)[^\dA-Za-z]*([A-Za-z0-9_-]{4,})/)
  return matched ? matched[1] : ''
}

function mapMiniappRouteToWebTarget(route = '', message = {}, role = 'USER') {
  const cleanRoute = normalizeMessageRoute(route)
  if (!cleanRoute) return null
  const path = cleanRoute.split('?')[0]
  const orderId = getMessageRouteOrderId(cleanRoute) || extractWebMessageOrderId(message)
  const orderTarget = () => ({ tab: 'orders', orderId, label: '查看订单' })
  if (/\/pages\/(order-detail|payment-confirm|fare-settlement|taxi-waiting|driver-arrival|trip-progress|trip-detail)\//.test(path)) {
    return orderTarget()
  }
  if (path === '/pages/orders/index') return orderTarget()
  if (path === '/pages/invoice/index') return { tab: 'invoice', orderId, label: '处理发票' }
  if (path === '/pages/coupon/index') return { tab: 'coupons', label: '查看券包' }
  if (path === '/pages/wallet/index' || path === '/pages/withdraw/index') return { tab: 'wallet', label: role === 'DRIVER' ? '查看钱包' : '查看钱包实名' }
  if (path === '/pages/onboarding/index') return { tab: 'certification', label: '查看资质' }
  if (path === '/pages/settings/index') return { tab: role === 'DRIVER' ? 'settings' : 'profile', label: role === 'DRIVER' ? '接单设置' : '出行偏好' }
  if (path === '/pages/profile/index' || path === '/pages/profile-edit/index' || path === '/pages/profileEdit/index' || path === '/pages/auth/index') return { tab: 'profile', label: '查看资料' }
  if (path === '/pages/carpool/index' || path === '/pages/carpool-trips/index') return { tab: 'carpool', label: '查看顺风车' }
  if (path === '/pages/international/index' || path === '/pages/international-orders/index') return { tab: 'international', label: '查看国际出行' }
  if (path === '/pages/support/index') return { tab: 'support', label: '联系客服' }
  if (path === '/pages/messages/index') return { tab: 'messages', label: '留在消息' }
  if (path === '/pages/dashboard/index') return { tab: 'listen', label: '返回听单' }
  return null
}

function resolveWebMessageTarget(message = {}, role = 'USER') {
  const explicitTarget = mapMiniappRouteToWebTarget(
    message.url || message.linkUrl || message.targetUrl || message.path,
    message,
    role
  )
  if (explicitTarget) return explicitTarget

  const text = getMessageText(message)
  const orderId = extractWebMessageOrderId(message)
  if (/INVOICE|发票/.test(text)) return { tab: 'invoice', orderId, label: '处理发票' }
  if (/COUPON|优惠券|券包/.test(text)) return { tab: 'coupons', label: '查看券包' }
  if (/MEMBER|会员/.test(text)) return { tab: 'member', label: '查看会员' }
  if (/WALLET|WITHDRAW|钱包|收入|收益|提现|结算|打款/.test(text)) return { tab: 'wallet', label: role === 'DRIVER' ? '查看钱包' : '查看钱包实名' }
  if (role === 'DRIVER' && /CERT|车辆|认证|审核|证照|资质|接单权限/.test(text)) return { tab: 'certification', label: '查看资质' }
  if (role === 'DRIVER' && /SETTING|设置|听单|自动接单|语音|轨迹/.test(text)) return { tab: 'settings', label: '接单设置' }
  if (/ORDER|订单|行程|支付|司机|接单|取消|完成|上车/.test(text) || message.order) return { tab: 'orders', orderId, label: '查看订单' }
  if (/SUPPORT|客服|人工|投诉|反馈/.test(text)) return { tab: 'support', label: '联系客服' }
  return null
}

function isMessageRead(item, index) {
  if (item?.unread === true) return false
  if (item?.unread === false) return true
  if (item?.isRead === true || item?.read === true) return true
  if (item?.isRead === false || item?.read === false) return false
  const state = String(item?.readStatus || item?.messageStatus || item?.status || '').toUpperCase()
  if (['READ', 'READED', 'DONE', 'PROCESSED'].includes(state)) return true
  if (['UNREAD', 'NEW', 'PENDING'].includes(state)) return false
  return index > 1
}

function MessageBoard({ messages, orders = [], role = 'USER', onRefresh, onReadMessage, onNavigateTarget }) {
  const [expanded, setExpanded] = useState(false)
  const [readFilter, setReadFilter] = useState('UNREAD')
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [readOverrides, setReadOverrides] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const list = useMemo(
    () => enrichMessagesWithOrders(messages || [], orders || []).map((item, index) => ({
      ...item,
      __isRead: readOverrides[item.id] ?? isMessageRead(item, index),
      __target: resolveWebMessageTarget(item, role)
    })),
    [messages, orders, readOverrides, role]
  )
  const filteredList = useMemo(() => {
    if (readFilter === 'READ') return list.filter((item) => item.__isRead)
    if (readFilter === 'UNREAD') return list.filter((item) => !item.__isRead)
    return list
  }, [list, readFilter])
  const unreadCount = list.filter((item) => !item.__isRead).length
  const readCount = list.length - unreadCount
  const linkedOrderCount = list.filter((item) => item.order).length
  const limit = 4
  const hasMore = filteredList.length > limit
  const visibleMessages = expanded || !hasMore ? filteredList : filteredList.slice(0, limit)

  const markMessageReadIfNeeded = async (item) => {
    if (!item.__isRead) {
      setReadOverrides((value) => ({ ...value, [item.id]: true }))
      try {
        await onReadMessage?.(item)
      } catch (error) {}
    }
  }

  const openMessage = async (item) => {
    const nextItem = item.__isRead ? item : { ...item, __isRead: true, unread: false, read: true, isRead: true, readStatus: 'READ' }
    setSelectedMessage(nextItem)
    await markMessageReadIfNeeded(item)
  }

  const navigateMessageTarget = async (item) => {
    if (!item?.__target) return
    await markMessageReadIfNeeded(item)
    setSelectedMessage(null)
    onNavigateTarget?.(item.__target, item)
  }

  const messageDetailModal = selectedMessage && typeof document !== 'undefined'
    ? createPortal(
      <div className="modal-layer" onMouseDown={() => setSelectedMessage(null)}>
        <div className="center-screen">
          <section className="glass-panel login-modal message-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedMessage(null)}><XCircle size={20} /></button>
            <span className="section-kicker">消息详情</span>
            <h2>{selectedMessage.title}</h2>
            <div className="message-detail-meta">
              <span className={selectedMessage.__isRead ? 'read' : 'unread'}>{selectedMessage.__isRead ? '已读' : '未读'}</span>
              <span>{messageTypeLabel(selectedMessage.type)}</span>
              <span>{selectedMessage.time || selectedMessage.createdTime || selectedMessage.createTime || '-'}</span>
            </div>
            <div className="message-detail-body">
              <p>{selectedMessage.content}</p>
              {selectedMessage.order && (
                <div className="message-detail-order">
                  <strong>{selectedMessage.order.startName} <ChevronRight size={14} /> {selectedMessage.order.endName}</strong>
                  <span>{selectedMessage.order.orderNo || `#${selectedMessage.order.id}`}</span>
                  <span>{formatOrderDisplayTime(selectedMessage.order)}</span>
                  <span>{formatMoney(selectedMessage.order.payableAmount || selectedMessage.order.actualAmount || selectedMessage.order.estimatedAmount, selectedMessage.order.currencyCode)}</span>
                </div>
              )}
              {selectedMessage.__target && (
                <button
                  type="button"
                  className="solid-button message-target-action"
                  onClick={() => navigateMessageTarget(selectedMessage)}
                >
                  <ChevronRight size={15} />{selectedMessage.__target.label || '去处理'}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>,
      document.body
    )
    : null

  const markCurrentListRead = async () => {
    const targets = filteredList.filter((item) => !item.__isRead)
    if (!targets.length || markingRead) return
    setMarkingRead(true)
    setReadOverrides((value) => ({
      ...value,
      ...Object.fromEntries(targets.map((item) => [item.id, true]))
    }))
    try {
      await Promise.allSettled(targets.map((item) => onReadMessage?.(item)))
    } finally {
      setMarkingRead(false)
    }
  }

  const refreshMessages = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="glass-panel work-card message-board-card">
      <div className="card-head">
        <div><span className="section-kicker">消息</span><h2>消息中心</h2></div>
        <div className="message-head-actions">
          <div className="message-read-tabs">
            <button className={readFilter === 'UNREAD' ? 'active is-unread' : 'is-unread'} type="button" onClick={() => setReadFilter('UNREAD')}>未读 <span>{unreadCount}</span></button>
            <button className={readFilter === 'READ' ? 'active is-read' : 'is-read'} type="button" onClick={() => setReadFilter('READ')}>已读 <span>{readCount}</span></button>
            <button className={readFilter === 'ALL' ? 'active is-read' : 'is-read'} type="button" onClick={() => setReadFilter('ALL')}>全部 <span>{list.length}</span></button>
          </div>
          {unreadCount > 0 && (
            <button className="message-list-toggle head-toggle" type="button" disabled={markingRead} onClick={markCurrentListRead}>
              {markingRead ? '同步中' : '全部已读'}
            </button>
          )}
          {hasMore && (
            <button className="message-list-toggle head-toggle" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? '收起' : `展开 ${filteredList.length} 条`}
              <ChevronRight size={12} className={expanded ? 'rotated' : ''} />
            </button>
          )}
          <button
            className={`icon-button${refreshing ? ' is-refreshing' : ''}`}
            disabled={refreshing}
            title={refreshing ? '刷新中' : '刷新消息'}
            onClick={refreshMessages}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>
      <div className="message-summary-strip">
        <SummaryPill icon={Bell} label="未读消息" value={`${unreadCount} 条`} />
        <SummaryPill icon={Route} label="订单相关" value={`${linkedOrderCount} 条`} />
        <SummaryPill icon={MessageSquare} label="当前筛选" value={`${filteredList.length} 条`} />
      </div>
      {filteredList.length ? (
        <>
          <div className="message-list compact-message-list">
            {visibleMessages.map((item, index) => (
              <article
                className={`message-card compact-message-card ${item.__isRead ? 'is-read' : 'is-unread'}`}
                key={item.id || `${item.title}-${item.time}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => openMessage(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openMessage(item)
                  }
                }}
              >
                <span className="message-icon"><Bell size={15} /></span>
                <div className="message-body">
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                  {item.order ? (
                    <div className="message-order-link">
                      <span>{item.order.startName} <ChevronRight size={11} /> {item.order.endName}</span>
                      <small>{item.order.orderNo || `#${item.order.id}`} · {formatOrderDisplayTime(item.order)} · {formatMoney(item.order.payableAmount || item.order.actualAmount || item.order.estimatedAmount, item.order.currencyCode)}</small>
                    </div>
                  ) : (
                    <small>{messageTypeLabel(item.type)} · {item.time || item.createdTime || item.createTime || '-'}</small>
                  )}
                  {item.order && <small>{messageTypeLabel(item.type)} · {item.time || item.createdTime || item.createTime || '-'}</small>}
                  {item.__target && (
                    <button
                      type="button"
                      className="message-target-chip"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigateMessageTarget(item)
                      }}
                    >
                      {item.__target.label || '去处理'}<ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : <EmptyState text={readFilter === 'UNREAD' ? '暂无未读消息。' : readFilter === 'READ' ? '暂无已读消息。' : '暂无消息。'} />}
      {messageDetailModal}
    </section>
  )
}

function ProfileBoard({ profile, mode, onProfile }) {
  const [editing, setEditing] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [form, setForm] = useState({
    nickname: safeEditableText(profile?.nickname),
    realName: safeEditableText(profile?.realName),
    emergencyContact: safeEditableText(profile?.emergencyContact),
    emergencyPhone: profile?.emergencyPhone || ''
  })

  useEffect(() => {
    setForm({
      nickname: safeEditableText(profile?.nickname),
      realName: safeEditableText(profile?.realName),
      emergencyContact: safeEditableText(profile?.emergencyContact),
      emergencyPhone: profile?.emergencyPhone || '',
      defaultLanguage: profile?.defaultLanguage || 'zh-CN'
    })
  }, [profile])

  const displayNickname = resolveAccountDisplayName(profile, '')
  const displayRealName = pickFirstCleanText(profile?.realName)
  const displayEmergencyContact = pickFirstCleanText(profile?.emergencyContact)
  const profileViewItems = [
    ['昵称', displayNickname || '-'],
    ['真实姓名', displayRealName || '-'],
    ['紧急联系人', displayEmergencyContact || '-'],
    ['紧急电话', profile?.emergencyPhone || '-']
  ]
  const authMeta = passengerAuthStatusMeta(profile?.authStatus)

  const saveProfile = async () => {
    if (!onProfile || savingProfile) return
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, String(value ?? '').trim()]))
    if (!payload.nickname) {
      setProfileError('请填写昵称')
      return
    }
    if (payload.emergencyPhone && !isValidContactPhone(payload.emergencyPhone)) {
      setProfileError('紧急电话需要为 8-16 位纯数字')
      return
    }
    setProfileError('')
    setSavingProfile(true)
    try {
      const success = await onProfile(payload)
      if (success === false) {
        setProfileError('资料保存失败，请稍后重试')
        return
      }
      setEditing(false)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <section className="glass-panel work-card settings-account-panel">
      <div className="settings-account-head">
        <div className="settings-account-summary">
          <div className="settings-account-identity">
            <span className="settings-profile-avatar">{resolveProfileAvatarText(profile, '乘')}</span>
            <div>
              <span className="section-kicker">资料</span>
              <strong>{displayNickname || '未设置昵称'}</strong>
              <small>{profile?.phone || '-'}</small>
            </div>
          </div>
          <div className="settings-account-tags">
            <span className={`settings-mini-badge ${authMeta.verified ? 'is-good' : ''}`}><ShieldCheck size={14} />{authMeta.label}</span>
            <span className="settings-mini-badge"><Locate size={14} />{profile?.cityCode || '默认城市'}</span>
          </div>
        </div>
        <div className="settings-account-actions">
          <div className="settings-account-metrics">
            <div><span>钱包余额</span><strong>{formatMoney(profile?.walletBalance || profile?.withdrawableIncome || 0)}</strong></div>
          </div>
          <button className="ghost-button compact-action" onClick={() => setEditing((value) => !value)}>
            <Settings size={14} />{editing ? '收起编辑' : '编辑资料'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="settings-account-editor">
          <div className="card-head settings-card-head settings-card-head--compact">
            <div>
              <span className="section-kicker">编辑资料</span>
              <h2>基础信息</h2>
            </div>
          </div>
          <div className="profile-form-grid settings-profile-form-grid">
            <Field label={fieldLabel('nickname')} value={form.nickname} onChange={(value) => setForm((draft) => ({ ...draft, nickname: value }))} />
            <Field label={fieldLabel('realName')} value={form.realName} onChange={(value) => setForm((draft) => ({ ...draft, realName: value }))} />
            <Field label={fieldLabel('emergencyContact')} value={form.emergencyContact} onChange={(value) => setForm((draft) => ({ ...draft, emergencyContact: value }))} />
            <Field label={fieldLabel('emergencyPhone')} value={form.emergencyPhone} onChange={(value) => setForm((draft) => ({ ...draft, emergencyPhone: value }))} />
          </div>
          {profileError && <p className="form-error-line">{profileError}</p>}
          {onProfile && (
            <div className="settings-profile-actions">
              <button className="ghost-button" disabled={savingProfile} onClick={() => setEditing(false)}>取消</button>
              <button className={`solid-button profile-save-button${savingProfile ? ' is-busy' : ''}`} disabled={savingProfile} onClick={saveProfile}>
                <ShieldCheck size={15} />{savingProfile ? '保存中...' : '保存资料'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <section className="settings-info-panel">
          <div className="card-head settings-card-head settings-card-head--compact">
            <div>
              <span className="section-kicker">资料</span>
              <h2>基础信息</h2>
            </div>
          </div>
          <div className="settings-profile-list">
            {profileViewItems.map(([label, value]) => (
              <div className="settings-profile-list-item" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}

function InfoPanel({ title, items }) {
  return (
    <section className="info-panel">
      <h3>{title}</h3>
      {items.map(([label, value]) => <div className="thin-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
  )
}

function buildAuthForm(roleCode, mode) {
  return {
    phone: mode === 'login' ? roleMeta[roleCode].phone : '',
    nickname: '',
    password: mode === 'login' ? '123456' : '',
    confirmPassword: ''
  }
}

function LoginModal({ roleCode, onClose, onSwitch, onLogin, onRegister }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(() => buildAuthForm(roleCode, 'login'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const Icon = roleMeta[roleCode].icon
  const roleName = roleCode === 'DRIVER' ? '司机' : '乘客'

  useEffect(() => {
    setForm(buildAuthForm(roleCode, mode))
    setError('')
  }, [roleCode, mode])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const phone = form.phone.trim()
      const password = form.password
      if (!/^1\d{10}$/.test(phone)) {
        throw new Error('请输入正确的 11 位手机号')
      }
      if (!password || password.length < 6 || password.length > 20) {
        throw new Error('密码长度需要 6-20 位')
      }
      if (mode === 'register') {
        const nickname = form.nickname.trim()
        if (!nickname) throw new Error('请输入昵称')
        if (nickname.length > 20) throw new Error('昵称不能超过 20 个字')
        if (password !== form.confirmPassword) throw new Error('两次输入的密码不一致')
        await onRegister({ roleCode, phone, password, nickname, defaultLanguage: 'zh-CN' })
      } else {
        await onLogin({ roleCode, phone, password })
      }
    } catch (err) {
      setError(err.message || (mode === 'register' ? '注册失败' : '登录失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <form className="login-modal glass-panel refract" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><XCircle size={20} /></button>
        <div className="login-orb"><Icon size={34} /></div>
        <span className="section-kicker">{mode === 'register' ? 'CREATE ACCOUNT' : 'ACCOUNT LOGIN'}</span>
        <h2>{roleName}{mode === 'register' ? '注册' : '登录'}</h2>
        <div className="auth-mode-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
        </div>
        <div className="role-switch">
          {Object.keys(roleMeta).map((role) => (
            <button type="button" key={role} className={roleCode === role ? 'active' : ''} onClick={() => onSwitch(role)}>
              {role === 'DRIVER' ? '司机端' : '乘客端'}
            </button>
          ))}
        </div>
        <label className="input-field"><Phone size={17} /><input placeholder="手机号" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} /></label>
        {mode === 'register' && (
          <label className="input-field"><User size={17} /><input placeholder="昵称" value={form.nickname} onChange={(event) => setForm((value) => ({ ...value, nickname: event.target.value }))} /></label>
        )}
        <label className="input-field"><Lock size={17} /><input placeholder="密码" type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></label>
        {mode === 'register' && (
          <label className="input-field"><ShieldCheck size={17} /><input placeholder="确认密码" type="password" value={form.confirmPassword} onChange={(event) => setForm((value) => ({ ...value, confirmPassword: event.target.value }))} /></label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="solid-button fill" disabled={busy}>
          {busy ? (mode === 'register' ? '注册中...' : '登录中...') : (mode === 'register' ? '注册并进入' : '进入工作台')}
        </button>
        <p className="modal-note">
          {mode === 'register' ? '注册成功后会自动进入对应端。' : '已有账号可直接登录，新用户请切换到注册。'}
        </p>
      </form>
    </div>
  )
}

function LoginRequired({ role, onLogin, onBack }) {
  return (
    <main className="center-screen">
      <section className="glass-panel work-card">
        <Sparkles size={32} />
        <h1>需要先登录</h1>
        <p>请选择身份进入对应页面。</p>
        <div className="hero-actions">
          <button className="solid-button" onClick={onLogin}>去登录</button>
          <button className="ghost-button" onClick={onBack}>返回门户</button>
        </div>
      </section>
    </main>
  )
}

function CityRoadBackdrop({ onlineCount = 1 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const carCount = clampFleetCount(onlineCount)
    canvas.dataset.carCount = String(carCount)
    const carSeeds = Array.from({ length: carCount }, (_, index) => ({
      road: index % 5,
      lane: index % 2 ? -1 : 1,
      offset: (index * 0.173) % 1,
      speed: 0.00086 + (index % 7) * 0.0001,
      size: 0.94 + (index % 5) * 0.09,
      hue: index % 4
    }))
    const blocks = Array.from({ length: 62 }, (_, index) => ({
      x: ((index * 37) % 100) / 100,
      y: ((index * 61) % 100) / 100,
      w: 34 + (index % 4) * 22,
      h: 28 + (index % 5) * 18,
      tone: index % 6,
      lift: index % 3
    }))
    let frame = 0
    let raf = 0
    let lastRender = 0
    let width = window.innerWidth
    let height = window.innerHeight
    let pointerX = 0.5
    let pointerY = 0.5

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const move = (event) => {
      pointerX = event.clientX / Math.max(1, width)
      pointerY = event.clientY / Math.max(1, height)
    }

    const roundRect = (x, y, w, h, r) => {
      const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
      context.beginPath()
      context.moveTo(x + radius, y)
      context.lineTo(x + w - radius, y)
      context.quadraticCurveTo(x + w, y, x + w, y + radius)
      context.lineTo(x + w, y + h - radius)
      context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
      context.lineTo(x + radius, y + h)
      context.quadraticCurveTo(x, y + h, x, y + h - radius)
      context.lineTo(x, y + radius)
      context.quadraticCurveTo(x, y, x + radius, y)
      context.closePath()
    }

    const getRoads = () => [
      { cx: width * 0.5, cy: height * 0.24, length: width * 1.18, roadWidth: 58, angle: 0, dash: 0 },
      { cx: width * 0.48, cy: height * 0.52, length: width * 1.36, roadWidth: 78, angle: 0, dash: 18 },
      { cx: width * 0.54, cy: height * 0.78, length: width * 1.18, roadWidth: 64, angle: 0, dash: 36 },
      { cx: width * 0.26, cy: height * 0.5, length: height * 1.12, roadWidth: 64, angle: Math.PI / 2, dash: 52 },
      { cx: width * 0.76, cy: height * 0.5, length: height * 1.12, roadWidth: 68, angle: Math.PI / 2, dash: 74 }
    ]

    const drawBlock = (block) => {
      const parallaxX = (pointerX - 0.5) * (18 + block.lift * 10)
      const parallaxY = (pointerY - 0.5) * (14 + block.lift * 8)
      const x = block.x * width + parallaxX - block.w / 2
      const y = block.y * height + parallaxY - block.h / 2
      const alpha = 0.08 + block.lift * 0.025
      context.fillStyle = block.tone === 0
        ? `rgba(255,122,0,${alpha + 0.04})`
        : block.tone === 1
          ? `rgba(0,168,150,${alpha})`
          : `rgba(31,41,55,${alpha})`
      roundRect(x, y, block.w, block.h, 8)
      context.fill()
      context.fillStyle = 'rgba(255,255,255,.34)'
      for (let yy = y + 9; yy < y + block.h - 6; yy += 12) {
        context.fillRect(x + 8, yy, Math.max(8, block.w - 16), 1.2)
      }
    }

    const drawRoad = (road, index) => {
      context.save()
      context.translate(road.cx, road.cy)
      context.rotate(road.angle)

      const gradient = context.createLinearGradient(-road.length / 2, 0, road.length / 2, 0)
      gradient.addColorStop(0, 'rgba(255,255,255,.2)')
      gradient.addColorStop(0.42, 'rgba(255,122,0,.2)')
      gradient.addColorStop(1, 'rgba(255,255,255,.28)')
      context.fillStyle = 'rgba(255,255,255,.28)'
      roundRect(-road.length / 2 - 4, -road.roadWidth / 2 - 4, road.length + 8, road.roadWidth + 8, road.roadWidth / 2)
      context.fill()
      context.fillStyle = gradient
      roundRect(-road.length / 2, -road.roadWidth / 2, road.length, road.roadWidth, road.roadWidth / 2)
      context.fill()

      context.strokeStyle = index % 2 ? 'rgba(0,168,150,.14)' : 'rgba(255,122,0,.2)'
      context.lineWidth = 1.4
      context.beginPath()
      context.moveTo(-road.length / 2, -road.roadWidth / 2 + 8)
      context.lineTo(road.length / 2, -road.roadWidth / 2 + 8)
      context.moveTo(-road.length / 2, road.roadWidth / 2 - 8)
      context.lineTo(road.length / 2, road.roadWidth / 2 - 8)
      context.stroke()

      const dashOffset = road.dash % 96
      context.strokeStyle = 'rgba(255,255,255,.78)'
      context.lineWidth = 4
      context.lineCap = 'round'
      for (let x = -road.length / 2 - dashOffset; x < road.length / 2; x += 96) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x + 38, 0)
        context.stroke()
      }
      context.restore()
    }

    const drawCar = (road, seed) => {
      const direction = seed.lane > 0 ? 1 : -1
      const laneY = seed.lane * (road.roadWidth * 0.23)
      const t = (seed.offset + frame * seed.speed) % 1
      const x = (t - 0.5) * road.length * direction
      const y = laneY + Math.sin((frame + seed.offset * 400) * 0.03) * 1.2
      const bodyW = 27 * seed.size
      const bodyH = 14 * seed.size

      context.save()
      context.translate(road.cx, road.cy)
      context.rotate(road.angle + (direction < 0 ? Math.PI : 0))
      context.translate(x, y)

      context.shadowColor = 'rgba(31,41,55,.16)'
      context.shadowBlur = 10
      context.fillStyle = 'rgba(31,41,55,.1)'
      roundRect(-bodyW / 2 - 2, -bodyH / 2 + 4, bodyW + 5, bodyH + 2, 999)
      context.fill()

      context.shadowColor = seed.hue === 1 ? 'rgba(0,168,150,.18)' : 'rgba(255,122,0,.26)'
      context.shadowBlur = 12
      const bodyColor = seed.hue === 2 ? 'rgba(255,255,255,.92)' : seed.hue === 1 ? 'rgba(0,168,150,.76)' : 'rgba(255,122,0,.9)'
      context.fillStyle = bodyColor
      roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 7)
      context.fill()

      context.shadowBlur = 0
      context.fillStyle = 'rgba(31,41,55,.76)'
      roundRect(-bodyW * 0.13, -bodyH * 0.58, bodyW * 0.38, bodyH * 0.58, 4)
      context.fill()

      context.fillStyle = 'rgba(255,255,255,.92)'
      roundRect(bodyW * 0.02, -bodyH * 0.76, bodyW * 0.22, bodyH * 0.2, 999)
      context.fill()

      context.strokeStyle = 'rgba(255,255,255,.62)'
      context.lineWidth = 1.4
      context.beginPath()
      context.moveTo(-bodyW * 0.36, 0)
      context.lineTo(bodyW * 0.36, 0)
      context.stroke()

      context.fillStyle = 'rgba(255,245,220,.95)'
      context.beginPath()
      context.arc(bodyW / 2 + 5, -bodyH * 0.22, 2.6, 0, Math.PI * 2)
      context.arc(bodyW / 2 + 5, bodyH * 0.22, 2.6, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = 'rgba(255,255,255,.38)'
      roundRect(-bodyW / 2 - 14, -bodyH * 0.22, 11, bodyH * 0.44, 999)
      context.fill()
      context.restore()
    }

    const drawIntersections = (roads) => {
      context.save()
      context.globalCompositeOperation = 'screen'
      roads.forEach((road, index) => {
        if (index > 2) return
        context.fillStyle = index % 2 ? 'rgba(0,168,150,.08)' : 'rgba(255,122,0,.1)'
        context.beginPath()
        context.arc(road.cx, road.cy, road.roadWidth * 0.72, 0, Math.PI * 2)
        context.fill()
      })
      context.restore()
    }

    const render = (time = 0) => {
      if (time - lastRender < 32) {
        raf = requestAnimationFrame(render)
        return
      }
      lastRender = time
      frame += 1
      context.clearRect(0, 0, width, height)
      const sky = context.createLinearGradient(0, 0, width, height)
      sky.addColorStop(0, '#fff3e3')
      sky.addColorStop(0.42, '#fffaf4')
      sky.addColorStop(1, '#ecfff8')
      context.fillStyle = sky
      context.fillRect(0, 0, width, height)

      const roads = getRoads()
      context.save()
      context.translate((pointerX - 0.5) * -12, (pointerY - 0.5) * -10)
      blocks.forEach(drawBlock)
      roads.forEach(drawRoad)
      drawIntersections(roads)
      carSeeds.forEach((seed) => drawCar(roads[seed.road], seed))
      context.restore()
      raf = requestAnimationFrame(render)
    }
    resize()
    render()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
    }
  }, [onlineCount])
  return <canvas className="city-road-backdrop" ref={canvasRef} aria-hidden="true" />
}

function WaterRippleLayer() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const ripples = []
    let width = 0
    let height = 0
    let frame = 0
    let raf = 0
    let lastPointer = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const pushRipple = (x, y, strength = 1) => {
      ripples.push({ x, y, r: 0, alpha: 0.78 * strength, speed: 4.4 + Math.random() * 2.8 })
      if (ripples.length > 46) ripples.shift()
    }

    const onPointerMove = (event) => {
      const now = performance.now()
      if (now - lastPointer < 48) return
      lastPointer = now
      pushRipple(event.clientX, event.clientY, 0.82)
    }

    const onPointerDown = (event) => {
      pushRipple(event.clientX, event.clientY, 1.45)
    }

    const render = () => {
      frame += 1
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      for (let line = 0; line < 8; line += 1) {
        const yBase = height * (0.08 + line * 0.13)
        context.beginPath()
        for (let x = -60; x <= width + 60; x += 28) {
          const y = yBase
            + Math.sin(x * 0.018 + frame * 0.036 + line) * 18
            + Math.cos(x * 0.01 - frame * 0.026 + line * 2) * 11
          if (x === -60) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.strokeStyle = line % 2
          ? 'rgba(255,122,0,.16)'
          : 'rgba(255,255,255,.28)'
        context.lineWidth = line % 2 ? 4.2 : 2.4
        context.stroke()
      }

      if (frame % 72 === 0) {
        pushRipple(width * (0.18 + Math.random() * 0.64), height * (0.12 + Math.random() * 0.72), 0.55)
      }

      ripples.forEach((ripple, index) => {
        ripple.r += ripple.speed
        ripple.alpha *= 0.974
        for (let ring = 0; ring < 3; ring += 1) {
          const radius = ripple.r + ring * 17
          const alpha = ripple.alpha * (0.42 - ring * 0.08)
          const gradient = context.createRadialGradient(ripple.x, ripple.y, Math.max(1, radius * 0.66), ripple.x, ripple.y, radius)
          gradient.addColorStop(0, 'rgba(255,255,255,0)')
          gradient.addColorStop(0.42, `rgba(255,255,255,${alpha})`)
          gradient.addColorStop(0.66, `rgba(255,122,0,${alpha * 0.62})`)
          gradient.addColorStop(0.86, `rgba(0,168,150,${alpha * 0.3})`)
          gradient.addColorStop(1, 'rgba(255,255,255,0)')
          context.strokeStyle = gradient
          context.lineWidth = 2.1 + Math.sin(frame * 0.05 + index + ring) * 0.7
          context.beginPath()
          context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2)
          context.stroke()
        }
      })

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        if (ripples[i].alpha < 0.015 || ripples[i].r > Math.max(width, height) * 0.7) ripples.splice(i, 1)
      }

      context.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(render)
    }

    resize()
    render()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
  return <canvas className="water-ripple-layer" ref={canvasRef} aria-hidden="true" />
}

function ClickImpactLayer() {
  const ref = useRef(null)
  useEffect(() => {
    const onPointerDown = (event) => {
      if (event.button && event.button !== 0) return
      const root = ref.current
      if (!root) return
      const burst = document.createElement('span')
      burst.className = 'impact-burst'
      burst.style.left = `${event.clientX}px`
      burst.style.top = `${event.clientY}px`

      const ring = document.createElement('span')
      ring.className = 'impact-ring'
      burst.appendChild(ring)

      for (let i = 0; i < 14; i += 1) {
        const particle = document.createElement('span')
        particle.className = 'impact-particle'
        const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.28
        const distance = 18 + Math.random() * 36
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
        particle.style.setProperty('--delay', `${i * 8}ms`)
        burst.appendChild(particle)
      }

      root.appendChild(burst)
      window.setTimeout(() => burst.remove(), 620)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true })
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
  return <div className="click-impact-layer" ref={ref} aria-hidden="true" />
}

function CursorAura() {
  const ref = useRef(null)
  useEffect(() => {
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let tx = x
    let ty = y
    let raf = 0
    const move = (event) => {
      tx = event.clientX
      ty = event.clientY
    }
    const tick = () => {
      x += (tx - x) * 0.14
      y += (ty - y) * 0.14
      if (ref.current) ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move)
    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [])
  return <div className="cursor-aura" ref={ref} aria-hidden="true" />
}

function CursorTaxi() {
  const ref = useRef(null)
  const smokeRef = useRef(null)
  useEffect(() => {
    let x = window.innerWidth * 0.72
    let y = window.innerHeight * 0.34
    let tx = x
    let ty = y
    let angle = 0
    let raf = 0
    let lastSmoke = 0
    let active = false
    const move = (event) => {
      tx = event.clientX
      ty = event.clientY
      if (!active) {
        active = true
        ref.current?.classList.add('is-active')
      }
    }
    const spawnSmoke = (velocity) => {
      const root = smokeRef.current
      if (!root) return
      const puff = document.createElement('span')
      puff.className = 'smoke-puff'
      const rad = angle * Math.PI / 180
      const distance = 22 + Math.min(velocity, 46) * 0.42
      const side = (Math.random() - 0.5) * 16
      const px = x - Math.cos(rad) * distance - Math.sin(rad) * side
      const py = y - Math.sin(rad) * distance + Math.cos(rad) * side
      const size = 8 + Math.min(velocity, 70) * 0.2 + Math.random() * 10
      puff.style.left = `${px}px`
      puff.style.top = `${py}px`
      puff.style.width = `${size * (1.2 + Math.random() * 0.6)}px`
      puff.style.height = `${size * 0.62}px`
      puff.style.setProperty('--sx', `${-Math.cos(rad) * (12 + Math.random() * 12)}px`)
      puff.style.setProperty('--sy', `${-Math.sin(rad) * (10 + Math.random() * 10) - 4}px`)
      if (root.children.length > 28) root.firstElementChild?.remove()
      root.appendChild(puff)
      window.setTimeout(() => puff.remove(), 720)
    }
    const crash = (event) => {
      if (!ref.current) return
      if (event) {
        tx = event.clientX
        ty = event.clientY
      }
      if (!active) {
        active = true
        ref.current.classList.add('is-active')
      }
      ref.current.classList.remove('is-crashing')
      void ref.current.offsetWidth
      ref.current.classList.add('is-crashing')
      window.setTimeout(() => ref.current?.classList.remove('is-crashing'), 280)
    }
    const tick = () => {
      const dx = tx - x
      const dy = ty - y
      const speed = Math.hypot(dx, dy)
      x += dx * 0.2
      y += dy * 0.2
      if (speed > 0.2) angle = Math.atan2(dy, dx) * 180 / Math.PI
      const now = performance.now()
      if (speed > 8 && now - lastSmoke > (speed > 42 ? 34 : 48)) {
        lastSmoke = now
        spawnSmoke(speed)
      }
      if (ref.current) {
        const movingLeft = Math.cos(angle * Math.PI / 180) < -0.08
        const facingAngle = movingLeft ? angle - 180 : angle
        ref.current.classList.toggle('is-driving', speed > 7)
        ref.current.classList.toggle('is-fast', speed > 34)
        ref.current.style.setProperty('--cursor-speed', `${Math.min(1, speed / 70).toFixed(3)}`)
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${facingAngle}deg) scaleX(${movingLeft ? -1 : 1})`
      }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', crash, { passive: true, capture: true })
    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', crash, true)
    }
  }, [])
  return (
    <>
      <div className="cursor-smoke-layer" ref={smokeRef} aria-hidden="true" />
      <div className="cursor-taxi" ref={ref} aria-hidden="true">
        <span className="cursor-car-unit">
          <span className="cursor-car-body" />
          <span className="cursor-wheel a" />
          <span className="cursor-wheel b" />
        </span>
      </div>
    </>
  )
}

function SvgFilters() {
  return (
    <svg className="svg-filters" aria-hidden="true">
      <filter id="liquidGlass" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.05" numOctaves="2" seed="7" result="noise">
          <animate attributeName="baseFrequency" values="0.012 0.032;0.027 0.078;0.015 0.04;0.012 0.032" dur="7s" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

function TopLoadBar({ visible, progress, active }) {
  return (
    <div className={`top-load-bar ${visible ? 'is-visible' : ''} ${active ? 'is-active' : 'is-idle'}`} aria-hidden="true">
      <div className="top-load-bar__trail" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      <div className="top-load-bar__car" style={{ left: `calc(${Math.max(0, Math.min(100, progress))}% - 11px)` }}>
        <span className="top-load-bar__car-body" />
        <span className="top-load-bar__wheel top-load-bar__wheel--a" />
        <span className="top-load-bar__wheel top-load-bar__wheel--b" />
      </div>
    </div>
  )
}

function MagneticButton({ className = '', children, onClick, disabled = false, type = 'button' }) {
  const ref = useRef(null)
  const handleMove = (event) => {
    if (disabled) return
    const rect = ref.current.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    ref.current.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`
  }
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'translate(0, 0)'
  }
  return <button ref={ref} type={type} className={`magnetic ${className}`} disabled={disabled} onMouseMove={handleMove} onMouseLeave={reset} onClick={onClick}>{children}</button>
}

function Field({ label, value, onChange }) {
  return (
    <label className="plain-field">
      <span>{label}</span>
      <input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SelectField({ label, value, options, onChange, icon: Icon }) {
  return (
    <label className="select-field">
      <Icon size={18} />
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => <option value={optionValue} key={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function AddressPointField({ label, point, onClick, icon: Icon = MapPin, active = false }) {
  const address = normalizeWebAddressPoint(point)
  return (
    <button type="button" className={`address-point-field ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{address.name}</strong>
      <small>{address.address}</small>
    </button>
  )
}

function AddressSearchField({ label, point, placeholder, onSelect, icon: Icon = MapPin, currentLocation = null, serviceType = SERVICE_TYPE.CARPOOL }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const selected = normalizeWebAddressPoint(point)

  useEffect(() => {
    const keyword = query.trim()
    let cancelled = false
    if (!open || !keyword) {
      setItems([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const list = await searchWebAddressCandidates(keyword, currentLocation || selected, { serviceType, pageSize: 6 })
        if (!cancelled) setItems(list)
      } catch (error) {
        if (!cancelled) setItems(buildLocalAddressCandidates(keyword, currentLocation || selected, { serviceType, pageSize: 6 }))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 240)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [currentLocation, open, query, selected.latitude, selected.longitude, serviceType])

  const choose = (item) => {
    const next = normalizeWebAddressPoint(item)
    onSelect?.(next)
    setQuery('')
    setItems([])
    setOpen(false)
  }

  return (
    <label className="plain-field address-search-field">
      <span>{label}</span>
      <div className="address-search-field__box">
        <Icon size={16} />
        <input
          value={open ? query : selected.name}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      <small>{selected.address}</small>
      {open && (
        <div className="address-search-field__menu">
          {loading && <div className="address-search-field__empty">地图搜索中...</div>}
          {!loading && query.trim() && !items.length && <div className="address-search-field__empty">没有匹配地址，换个关键词试试</div>}
          {items.map((item) => (
            <button type="button" key={getAddressKey(item)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
              <strong>{item.name}</strong>
              <span>{item.address}</span>
              {item.distanceText && <em>{item.distanceText}</em>}
            </button>
          ))}
        </div>
      )}
    </label>
  )
}

function StatusBadge({ value, label, tone }) {
  const resolvedTone = tone || statusTone[value] || 'muted'
  return <span className={`status-badge ${resolvedTone}`}>{label || statusLabel[value] || value || '-'}</span>
}

function formatSyncClock(value) {
  if (!value) return '待同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待同步'
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ModeChip({ mode, message }) {
  const label = mode === 'backend' ? '在线服务' : mode === 'demo' ? '离线数据' : '连接中'
  return <span className={`mode-chip ${mode}`} title={message}><span />{label}</span>
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>
}

function MiniStat({ label, value }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>
}

function serviceIconPath(type) {
  return SERVICE_ICON_PATHS[type] || SERVICE_ICON_PATHS[String(type || '').toLowerCase()] || SERVICE_ICON_PATHS[SERVICE_TYPE.TAXI]
}

function ServiceIcon({ type, className = '', alt = '' }) {
  return (
    <img
      className={['service-icon', className].filter(Boolean).join(' ')}
      src={serviceIconPath(type)}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
    />
  )
}

function IconSlot({ icon, size = 18, className = '' }) {
  if (!icon) return null
  if (typeof icon === 'string') {
    return <img className={['service-icon', className].filter(Boolean).join(' ')} src={icon} alt="" aria-hidden="true" loading="lazy" />
  }
  const Icon = icon
  return <Icon size={size} />
}

function SummaryPill({ icon: Icon, label, value, hint = '', interactive = false, active = false, onClick, className = '' }) {
  const classes = ['summary-pill', interactive ? 'summary-pill--interactive' : '', active ? 'is-active' : '', className].filter(Boolean).join(' ')
  const content = (
    <>
      <span className="summary-pill-icon"><IconSlot icon={Icon} size={15} className="summary-pill-service-icon" /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
        {hint && <em>{hint}</em>}
      </div>
    </>
  )
  if (interactive) {
    return <button type="button" className={classes} onClick={onClick} aria-pressed={active}>{content}</button>
  }
  return <div className={classes}>{content}</div>
}

function FeatureCard({ icon: Icon, title, text }) {
  return <article className="feature-card glass-panel interactive-border"><Icon size={22} /><h3>{title}</h3><p>{text}</p></article>
}

function RoleCard({ icon: Icon, title, text, active, onClick }) {
  const tilt = useTiltCard({ maxX: 8, maxY: 10 })
  return (
    <button className="role-card glass-panel tilt-card interactive-border" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} onClick={onClick}>
      <Icon size={28} />
      <div><h3>{title}</h3><p>{text}</p></div>
      <span>{active ? '进入' : '登录'} <ChevronRight size={16} /></span>
    </button>
  )
}

function EmptyState({ text }) {
  return <div className="empty-state"><Sparkles size={22} /><span>{text}</span></div>
}

function Toast({ text }) {
  return <div className="toast"><CheckCircle size={17} />{text}</div>
}

function GaugeIcon() {
  return <Zap size={16} />
}

function usePointerVars() {
  useEffect(() => {
    const move = (event) => {
      document.documentElement.style.setProperty('--mx', `${event.clientX}px`)
      document.documentElement.style.setProperty('--my', `${event.clientY}px`)
      document.documentElement.style.setProperty('--px', `${(event.clientX / window.innerWidth - 0.5).toFixed(3)}`)
      document.documentElement.style.setProperty('--py', `${(event.clientY / window.innerHeight - 0.5).toFixed(3)}`)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
}

function useTopLoadBar() {
  const [state, setState] = useState({ visible: false, progress: 0, active: false })
  const hideTimerRef = useRef(0)

  useEffect(() => {
    const handleLoading = (event) => {
      const isActive = Boolean(event.detail?.active)
      window.clearTimeout(hideTimerRef.current)
      if (isActive) {
        setState((current) => ({
          visible: true,
          active: true,
          progress: current.visible ? Math.max(current.progress, 14) : 14
        }))
        return
      }
      setState((current) => current.visible ? { ...current, active: false, progress: 100 } : current)
      hideTimerRef.current = window.setTimeout(() => {
        setState({ visible: false, progress: 0, active: false })
      }, 320)
    }

    window.addEventListener('sunshine-api-loading', handleLoading)
    return () => {
      window.clearTimeout(hideTimerRef.current)
      window.removeEventListener('sunshine-api-loading', handleLoading)
    }
  }, [])

  useEffect(() => {
    if (!state.active) return undefined
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = current.progress >= 88
          ? current.progress
          : current.progress + Math.max(1.4, (92 - current.progress) * 0.08)
        return { ...current, progress: Math.min(88, next) }
      })
    }, 120)
    return () => window.clearInterval(timer)
  }, [state.active])

  return state
}

function useTiltCard({ maxX = 10, maxY = 12 } = {}) {
  const ref = useRef(null)
  const onPointerMove = (event) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    element.style.setProperty('--tilt-rx', `${(-y * maxX).toFixed(2)}deg`)
    element.style.setProperty('--tilt-ry', `${(x * maxY).toFixed(2)}deg`)
    element.style.setProperty('--tilt-lift', '-8px')
    element.style.setProperty('--shine-x', `${Math.round((x + 0.5) * 100)}%`)
    element.style.setProperty('--shine-y', `${Math.round((y + 0.5) * 100)}%`)
  }
  const onPointerLeave = () => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--tilt-rx', '0deg')
    element.style.setProperty('--tilt-ry', '0deg')
    element.style.setProperty('--tilt-lift', '0px')
    element.style.setProperty('--shine-x', '50%')
    element.style.setProperty('--shine-y', '50%')
  }
  return { ref, onPointerMove, onPointerLeave }
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') || initialValue
    } catch (error) {
      return initialValue
    }
  })
  useEffect(() => {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  }, [key, value])
  return [value, setValue]
}

function resolvePortalAccount(passengerSession, driverSession, preferredRole) {
  if (preferredRole === 'DRIVER' && driverSession) return { ...driverSession, roleCode: 'DRIVER' }
  if (preferredRole === 'USER' && passengerSession) return { ...passengerSession, roleCode: 'USER' }
  if (passengerSession) return { ...passengerSession, roleCode: 'USER' }
  if (driverSession) return { ...driverSession, roleCode: 'DRIVER' }
  return null
}

function getLocalDateKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getAccountCheckinKey(roleCode = 'USER', account = null) {
  const role = roleCode === 'DRIVER' ? 'DRIVER' : 'USER'
  const userId = account?.id ?? account?.userId
  if (userId !== undefined && userId !== null && String(userId).trim()) return `${role}:user:${String(userId).trim()}`
  const phone = account?.phone || account?.mobile
  if (phone && String(phone).trim()) return `${role}:phone:${String(phone).trim()}`
  const token = account?.token
  if (token && String(token).trim()) return `${role}:token:${String(token).trim().slice(0, 18)}`
  const nickname = account?.nickname || account?.realName
  if (nickname && String(nickname).trim()) return `${role}:name:${String(nickname).trim()}`
  return role
}

function readDailyCheckinEntry(state = {}, roleCode = 'USER', account = null) {
  const accountKey = getAccountCheckinKey(roleCode, account)
  const current = state?.[accountKey]
  if (current) return current
  return accountKey === (roleCode === 'DRIVER' ? 'DRIVER' : 'USER') ? state?.[accountKey] : null
}

function claimDailyCheckinState(state = {}, roleCode = 'USER', rewardAmount = drawDailyCheckinRewardAmount(), account = null) {
  const role = roleCode === 'DRIVER' ? 'DRIVER' : 'USER'
  const accountKey = getAccountCheckinKey(role, account)
  const today = getLocalDateKey()
  const current = state?.[accountKey] || {}
  if (current.date === today) return state || {}
  return {
    ...(state || {}),
    [accountKey]: {
      date: today,
      amount: normalizeDailyCheckinAmount(rewardAmount),
      status: 'pending',
      roleCode: role,
      channel: 'WEB',
      accountKey,
      claimedAt: new Date().toISOString()
    }
  }
}

function markDailyCheckinUsed(state = {}, roleCode = 'USER', account = null) {
  const role = roleCode === 'DRIVER' ? 'DRIVER' : 'USER'
  const accountKey = getAccountCheckinKey(role, account)
  const current = state?.[accountKey]
  if (!current || current.date !== getLocalDateKey()) return state || {}
  return {
    ...(state || {}),
    [accountKey]: {
      ...current,
      status: 'used',
      usedAt: new Date().toISOString()
    }
  }
}

function getDailyCheckinBenefit(roleCode = 'USER', state = {}, account = null) {
  const role = roleCode === 'DRIVER' ? 'DRIVER' : 'USER'
  if (!account) {
    return {
      roleCode: role,
      accountKey: getAccountCheckinKey(role, account),
      channel: 'WEB',
      amount: 0,
      status: 'idle',
      signedToday: false
    }
  }
  const current = readDailyCheckinEntry(state, role, account) || {}
  const signedToday = current.date === getLocalDateKey()
  return {
    roleCode: role,
    accountKey: getAccountCheckinKey(role, account),
    channel: 'WEB',
    amount: signedToday ? normalizeDailyCheckinAmount(current.amount) : 0,
    status: signedToday ? (current.status || 'pending') : 'idle',
    signedToday
  }
}

function getUsableCheckinAmount(benefit, estimate) {
  if (!benefit?.signedToday || benefit.status !== 'pending') return 0
  if ((estimate?.currencyCode || 'CNY') !== 'CNY') return 0
  return roundMoney(Math.min(normalizeDailyCheckinAmount(benefit.amount), Math.max(0, Number(estimate?.amount || 0) - 0.01)))
}

function roundMoney(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(2))
}

function drawDailyCheckinRewardAmount() {
  const totalWeight = dailyCheckinRewardBands.reduce((sum, band) => sum + band.weight, 0)
  let ticket = Math.random() * totalWeight
  const selectedBand = dailyCheckinRewardBands.find((band) => {
    ticket -= band.weight
    return ticket <= 0
  }) || dailyCheckinRewardBands[0]
  const cents = selectedBand.minCents + Math.floor(Math.random() * (selectedBand.maxCents - selectedBand.minCents + 1))
  return normalizeDailyCheckinAmount(cents / 100)
}

function normalizeDailyCheckinAmount(value) {
  const amount = roundMoney(value)
  if (amount <= 0) return dailyCheckinRewardRange.min
  return Math.min(dailyCheckinRewardRange.max, Math.max(dailyCheckinRewardRange.min, amount))
}

function normalizeCarTypes(carTypes) {
  const list = normalizeList(carTypes)
  return list.length ? list : fallbackCarTypes
}

function defaultFleetStats() {
  return { onlineDriverCount: 2, idleDriverCount: 0, busyDriverCount: 2, serviceDriverCount: 2, offlineDriverCount: 0 }
}

function normalizeFleetStats(data) {
  const fleet = data?.fleet || data?.fleetStats || data?.driverStats || {}
  const hasFleetField = [
    fleet.serviceDriverCount,
    fleet.busyDriverCount,
    fleet.onlineDriverCount,
    fleet.onlineCount,
    data?.serviceDriverCount,
    data?.onlineDriverCount
  ].some((value) => Number.isFinite(Number(value)))
  if (!hasFleetField) return defaultFleetStats()
  const online = firstFiniteNumber([
    fleet.onlineDriverCount,
    fleet.onlineCount,
    fleet.driverOnlineCount,
    data?.onlineDriverCount,
    data?.driverOnlineCount
  ])
  const idle = firstFiniteNumber([fleet.idleDriverCount, fleet.idleCount, fleet.onlineIdleCount])
  const busy = firstFiniteNumber([fleet.serviceDriverCount, fleet.busyDriverCount, fleet.busyCount, fleet.inServiceDriverCount, data?.serviceDriverCount])
  const offline = firstFiniteNumber([fleet.offlineDriverCount, fleet.offlineCount])
  const fallbackOnline = (idle ?? 0) + (busy ?? 0) || defaultFleetStats().onlineDriverCount
  const normalizedOnline = clampFleetCount(online ?? fallbackOnline)
  const normalizedBusy = clampFleetCount(busy ?? 0)
  return {
    onlineDriverCount: normalizedOnline,
    idleDriverCount: clampFleetCount(idle ?? Math.max(0, normalizedOnline - normalizedBusy)),
    busyDriverCount: normalizedBusy,
    serviceDriverCount: normalizedBusy,
    offlineDriverCount: clampFleetCount(offline ?? 0)
  }
}

function firstFiniteNumber(values) {
  const value = values.map(Number).find((item) => Number.isFinite(item))
  return value === undefined ? null : value
}

function clampFleetCount(value) {
  return Math.max(0, Math.min(80, Math.round(Number(value) || 0)))
}

function getCarTypeName(item) {
  return item.name || item.typeName || item.carTypeName || `车型 ${item.id}`
}

function isInternationalPoiCandidate(poi = {}) {
  const text = `${poi.name || ''} ${poi.address || ''} ${(poi.tags || []).join(' ')}`
  return text.includes('国际') || text.includes('香港') || text.includes('澳门') || text.includes('口岸')
}

function getCarTypeTier(item = {}) {
  const text = `${item.name || ''}${item.typeName || ''}${item.carTypeName || ''}`.toLowerCase()
  if (text.includes('商务') || text.includes('business') || Number(item.id) >= 3) return 'business'
  if (text.includes('舒适') || text.includes('comfort') || Number(item.id) === 2) return 'comfort'
  return 'economy'
}

function getCarTypeTierClass(item = {}) {
  return `car-tier-${getCarTypeTier(item)}`
}

function CarTypeIcon({ carType }) {
  const tier = getCarTypeTier(carType)
  const Icon = tier === 'business' ? ShieldCheck : tier === 'comfort' ? Users : CarTaxiFront
  return (
    <span className="booking-car-icon">
      <Icon size={22} strokeWidth={2.35} />
      <i />
    </span>
  )
}

function passengerOrderAction(action, order, token, payload = {}) {
  if (action === 'cancel') return api.cancelOrder(token, order.id, '乘客网页端取消')
  if (action === 'pickup') return api.pickupOrder(token, order.id)
  if (action === 'pay') {
    return api.mockPay(token, order.id, payload.payableAmount || order.payableAmount, payload.payChannel || 'WEB', {
      userCouponId: payload.userCouponId || null,
      couponDiscount: payload.couponDiscount || 0,
      originalAmount: payload.originalAmount || null,
      couponName: payload.couponName || '',
      couponRuleDesc: payload.couponRuleDesc || ''
    })
  }
  if (action === 'evaluate') {
    return api.evaluate(token, {
      orderId: order.id,
      score: Number(payload.score || 5),
      tags: payload.tags || [],
      content: payload.content || '网页端评价：体验顺滑，服务很好。',
      anonymous: Boolean(payload.anonymous)
    })
  }
  if (action === 'complaint') {
    return api.complaint(token, {
      orderId: order.id,
      complaintType: payload.complaintType || 'OTHER',
      contactPhone: payload.contactPhone || '',
      content: payload.content || '网页端提交投诉反馈。'
    })
  }
  return Promise.resolve()
}

async function driverOrderAction(action, order, token) {
  if (action === 'start') {
    const result = await api.driverStart(token, order.id)
    await reportDriverTrackPoint(token, order, action)
    return result
  }
  if (action === 'pickup') {
    const result = await api.driverPickup(token, order.id)
    await reportDriverTrackPoint(token, order, action)
    return result
  }
  if (action === 'finish') {
    const result = await api.driverFinish(token, order.id, {
      actualDistanceKm: order.actualDistanceKm || order.estimatedDistanceKm || 3,
      actualDurationMin: order.actualDurationMin || order.estimatedDurationMin || 15
    })
    await reportDriverTrackPoint(token, order, action)
    return result
  }
  return Promise.resolve()
}

async function reportDriverTrackPoint(token, order = {}, action = '') {
  if (!token || !order?.id) return
  const useEndPoint = action === 'finish'
  const latitude = Number(useEndPoint ? order.endLat : order.startLat)
  const longitude = Number(useEndPoint ? order.endLng : order.startLng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
  try {
    await api.reportTrack(token, order.id, {
      latitude,
      longitude,
      source: 'WEB_DRIVER',
      eventType: action,
      heading: action === 'finish' ? 180 : 0
    })
  } catch (error) {}
}

function resolveDriverWebLocation(profile = {}) {
  const fallback = {
    longitude: Number(profile.lastLongitude || 117.0810),
    latitude: Number(profile.lastLatitude || 39.9820)
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(fallback)
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), 2500)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer)
        resolve({
          longitude: Number(position.coords.longitude),
          latitude: Number(position.coords.latitude)
        })
      },
      () => {
        window.clearTimeout(timer)
        resolve(fallback)
      },
      { enableHighAccuracy: true, timeout: 2200, maximumAge: 30000 }
    )
  })
}

function normalizeDriverTrackMode(value) {
  return value === 'DEMO' ? 'DEMO' : 'REAL'
}

function normalizeDriverVoiceStyle(value) {
  return driverVoiceStyleOptions.some(([optionValue]) => optionValue === value) ? value : 'default'
}

function normalizeDriverSettings(settings = {}) {
  return {
    ...driverDefaultSettings,
    ...(settings || {}),
    listenMode: Boolean(settings.listenMode),
    autoAccept: Boolean(settings.autoAccept),
    voiceBroadcast: settings.voiceBroadcast !== false,
    voiceStyle: normalizeDriverVoiceStyle(settings.voiceStyle),
    trackMode: normalizeDriverTrackMode(settings.trackMode),
    manualResting: Boolean(settings.manualResting),
    listeningSince: Number(settings.listeningSince || 0),
    listeningBaselineReady: Boolean(settings.listeningBaselineReady),
    listeningBaselineOrderIds: normalizeList(settings.listeningBaselineOrderIds).map((item) => String(item)).filter(Boolean)
  }
}

function normalizePassengerSettings(settings = {}) {
  return {
    ...passengerDefaultSettings,
    ...(settings || {}),
    pushEnabled: settings.pushEnabled !== false,
    autoUseCoupon: settings.autoUseCoupon !== false,
    tripRemind: settings.tripRemind !== false,
    invoiceRemind: settings.invoiceRemind !== false,
    privacyMask: settings.privacyMask !== false,
    emergencyShare: Boolean(settings.emergencyShare)
  }
}

function readDriverSettings() {
  if (typeof window === 'undefined') return driverDefaultSettings
  try {
    return normalizeDriverSettings(JSON.parse(window.localStorage.getItem(driverSettingsKey) || 'null') || {})
  } catch (error) {
    window.localStorage.removeItem(driverSettingsKey)
    return driverDefaultSettings
  }
}

function driverTrackModeMeta(value) {
  const mode = normalizeDriverTrackMode(value)
  const option = driverTrackModeOptions.find(([optionValue]) => optionValue === mode) || driverTrackModeOptions[0]
  return { value: option[0], label: option[1], desc: option[2] }
}

function driverVoiceStyleLabel(value) {
  const option = driverVoiceStyleOptions.find(([optionValue]) => optionValue === normalizeDriverVoiceStyle(value))
  return option?.[1] || '播音声音'
}

function resolveDriverDocumentUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(blob:|data:|https?:\/\/)/i.test(text)) return text
  if (text.startsWith('/')) return `${getApiBase()}${text}`
  return text
}

function resolveMediaAssetUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(blob:|data:|https?:\/\/)/i.test(text)) return text
  if (text.startsWith('/')) return `${getApiBase()}${text}`
  return text
}

function isLocalDriverDocumentPath(value) {
  return /^(blob:|data:)/i.test(String(value || '').trim())
}

function buildDocumentPlaceholder(title = '证件图片', value = '') {
  const pathText = String(value || '').trim()
  const subtitle = pathText ? '图片暂不可预览，可重新选择' : '点击上传证件图片'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff7ed"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
      </defs>
      <rect width="640" height="400" rx="28" fill="url(#g)"/>
      <rect x="54" y="52" width="532" height="296" rx="22" fill="#ffffff" stroke="#fed7aa" stroke-width="3"/>
      <rect x="92" y="100" width="184" height="22" rx="11" fill="#ffedd5"/>
      <rect x="92" y="144" width="456" height="18" rx="9" fill="#e2e8f0"/>
      <rect x="92" y="184" width="390" height="18" rx="9" fill="#e2e8f0"/>
      <rect x="92" y="224" width="456" height="92" rx="14" fill="#fff7ed"/>
      <text x="320" y="260" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#9a4a00">${escapeSvgText(title)}</text>
      <text x="320" y="296" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#64748b">${escapeSvgText(subtitle)}</text>
    </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function escapeSvgText(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[char]))
}

function previewDriverDocument(value, title = '证件图片') {
  const url = resolveDriverDocumentUrl(value) || buildDocumentPlaceholder(title)
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  win.document.write(`<!doctype html><title>${escapeSvgText(title)}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111827}img{max-width:96vw;max-height:96vh;border-radius:14px;background:#fff}</style><img src="${escapeSvgText(url)}" alt="${escapeSvgText(title)}">`)
  win.document.close()
}

function buildInternationalForm(profile = {}) {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(9, 0, 0, 0)
  const pad = (value) => String(value).padStart(2, '0')
  const phone = profile?.phone || demoAccounts.USER.phone || ''
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: '09:00',
    passengerCount: 1,
    luggageCount: 1,
    contactName: pickFirstCleanText(profile?.realName, profile?.nickname, '阳光乘客'),
    contactPhone: phone,
    flightNo: '',
    pickupSign: '',
    note: ''
  }
}

function parseMetricNumber(value, fallback = 0) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : fallback
}

function resolveInternationalRouteIds(option = {}) {
  const fallback = internationalRouteFallbacks[option.routeCode] || internationalRouteFallbacks['SZX-HKG']
  const findByName = (name) => {
    const text = String(name || '').trim()
    const shortName = text.split(/[，,]/)[0]
    return poiLibrary.find((item) => item.name === text || item.name === shortName || text.startsWith(item.name) || item.name.startsWith(shortName))
  }
  return {
    startId: findByName(option.startName)?.id || fallback.startId,
    endId: findByName(option.endName)?.id || fallback.endId
  }
}

function resolveInternationalRoutePoints(option = {}) {
  const ids = resolveInternationalRouteIds(option)
  return {
    startPoint: normalizeWebAddressPoint(findPoi(ids.startId), findPoi('poi007')),
    endPoint: normalizeWebAddressPoint(findPoi(ids.endId), findPoi('poi008'))
  }
}

function normalizeInternationalForm(form = {}) {
  return {
    date: String(form.date || '').trim(),
    time: String(form.time || '').trim(),
    passengerCount: Number(form.passengerCount || 0),
    luggageCount: Number(form.luggageCount || 0),
    contactName: String(form.contactName || '').trim(),
    contactPhone: String(form.contactPhone || '').replace(/[^\d+]/g, '').trim(),
    flightNo: String(form.flightNo || '').trim().toUpperCase(),
    pickupSign: String(form.pickupSign || '').trim(),
    note: String(form.note || '').trim()
  }
}

function validateInternationalForm(form = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) {
    return '请选择有效预约日期和时间'
  }
  if (!Number.isFinite(form.passengerCount) || form.passengerCount < 1 || form.passengerCount > 6) {
    return '乘车人数需在 1-6 人之间'
  }
  if (!Number.isFinite(form.luggageCount) || form.luggageCount < 0 || form.luggageCount > 20) {
    return '行李件数需在 0-20 件之间'
  }
  if (!form.contactName || !form.contactPhone) {
    return '请填写联系人和电话'
  }
  if (!/^\+?\d{6,20}$/.test(form.contactPhone)) {
    return '请填写有效联系电话'
  }
  return ''
}

function buildInternationalRemark(option = {}, note = '', form = {}, estimate = {}) {
  const cleanForm = normalizeInternationalForm(form)
  const appointmentTime = cleanForm.date && cleanForm.time ? `${cleanForm.date} ${cleanForm.time}:00` : ''
  const payload = {
    optionId: option.id || '',
    routeCode: option.routeCode || '',
    countryText: option.countryText || '',
    productName: option.titleZh || '',
    productNameEn: option.titleEn || '',
    titleZh: option.titleZh || '',
    titleEn: option.titleEn || '',
    startName: option.startName || '',
    endName: option.endName || '',
    appointmentTime,
    passengerCount: cleanForm.passengerCount,
    contactName: cleanForm.contactName,
    contactPhone: cleanForm.contactPhone,
    flightNo: cleanForm.flightNo,
    luggageCount: cleanForm.luggageCount,
    pickupSign: cleanForm.pickupSign || cleanForm.contactName || '阳光出行',
    languageCode: 'zh-CN',
    basePrice: option.basePrice || 0,
    currencyCode: estimate.currencyCode || 'USD',
    exchangeRate: estimate.exchangeRate || 7.15,
    vehicle: option.vehicle || '',
    serviceItems: option.inclusions || [],
    documents: option.documents || [],
    riskNotice: option.notice || '请提前确认通关证件、航班时间与目的地政策。',
    distanceText: `${estimate.distanceKm || parseMetricNumber(option.distanceText, 0)} km`,
    durationText: `${estimate.durationMin || parseMetricNumber(option.durationText, 0)} min`,
    amountText: formatMoney(estimate.amount || option.basePrice || 0, estimate.currencyCode || 'USD'),
    syncStatus: 'BACKEND_ORDER',
    submitSource: 'WEB_PASSENGER'
  }
  const cleanNote = String(note || '').trim()
  return `[INTERNATIONAL_META]${JSON.stringify(payload)}[/INTERNATIONAL_META]${cleanNote ? ` ${cleanNote}` : ''}`
}

function auditStatusMeta(value) {
  const status = Number(value)
  if (status === 2) return { value: 'APPROVED', label: '已通过' }
  if (status === 1) return { value: 'PENDING', label: '审核中' }
  if (status < 0) return { value: 'REJECTED', label: '已驳回' }
  return { value: 'NONE', label: '待提交' }
}

function actionText(action) {
  return {
    cancel: '订单已取消',
    pickup: '行程状态已更新',
    pay: '支付成功',
    evaluate: '评价成功',
    complaint: '投诉已提交',
    start: '已开始接驾',
    finish: '行程已完成'
  }[action] || '操作成功'
}

function maskBankAccount(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (text.includes('*')) return text
  const normalized = text.replace(/\s+/g, '')
  if (normalized.length <= 8) return normalized
  return `${normalized.slice(0, 4)} **** ${normalized.slice(-4)}`
}

function maskIdCard(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (text.includes('*')) return text
  if (text.length < 8) return text
  return `${text.slice(0, 4)}**********${text.slice(-4)}`
}

function isValidPhone(value) {
  return /^1\d{10}$/.test(String(value || '').trim())
}

function isValidContactPhone(value) {
  const phone = String(value || '').trim()
  return !phone || /^\d{8,16}$/.test(phone)
}

function isValidIdCard(value) {
  return /^[0-9Xx]{15,18}$/.test(String(value || '').trim())
}

function passengerAuthStatusMeta(status) {
  const numeric = Number(status)
  const value = Number.isFinite(numeric) ? numeric : 0
  return {
    value,
    label: passengerAuthStatusText[value] || '未实名',
    verified: value === 2
  }
}

function withdrawBankName(item = {}) {
  return item.bankName || item.bank || item.bank_name || '开户行未记录'
}

function withdrawBankAccount(item = {}) {
  return maskBankAccount(item.bankAccountMasked || item.bankAccount || item.bankCardNo || item.cardNo || item.accountNo)
}

function withdrawStatusText(item = {}) {
  const status = String(item.status || 'PENDING').toUpperCase()
  return item.statusText || item.status_text || {
    PENDING: '待审核',
    APPROVED: '已打款',
    REJECTED: '已驳回'
  }[status] || statusLabel[status] || status
}

function withdrawCreatedAt(item = {}) {
  const value = item.createdAt || item.createTime || item.created_at || item.auditedAt || item.audited_at
  return value ? formatOrderDisplayTime({ createdAt: value }) : '-'
}

function fieldLabel(key) {
  return {
    startName: '起点',
    endName: '终点',
    departTime: '出发时间',
    seatCount: '座位数',
    sharedAmount: '分摊金额',
    baggageRule: '行李规则',
    tripRemark: '备注',
    realName: '真实姓名',
    idCard: '身份证号',
    nickname: '昵称',
    emergencyContact: '紧急联系人',
    emergencyPhone: '紧急电话',
    defaultLanguage: '默认语言',
    cityCode: '服务城市',
    applyAmount: '提现金额',
    bankName: '开户行',
    bankAccount: '银行卡号',
    invoiceTitle: '发票抬头',
    taxNo: '税号',
    buyerPhone: '接收手机',
    remark: '备注',
    licenseNo: '驾驶证号',
    plateNo: '车牌号',
    brand: '品牌',
    modelName: '车型',
    color: '颜色',
    insuranceExpireDate: '保险到期',
    annualInspectExpireDate: '年检到期',
    vehicleLicenseImageUrl: '行驶证图片',
    driverLicenseImageUrl: '驾驶证图片'
  }[key] || key
}

export default App
