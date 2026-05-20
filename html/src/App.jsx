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
  Flag,
  Globe,
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
const driverSessionKey = 'sunshine-web-driver-session'
const DEFAULT_TENCENT_MAP_KEY = 'NHNBZ-F5FW3-Z4C3Q-R4WUM-ODTPE-DRFDV'

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

function App() {
  usePointerVars()
  const topLoader = useTopLoadBar()
  const [apiMode, setMode] = useState({ mode: 'checking', message: '正在连接后端' })
  const [baseUrl, setBaseUrlState] = useState(getApiBase())
  const [home, setHome] = useState({ carTypes: fallbackCarTypes, couponCenter: [], notices: [], fleet: defaultFleetStats() })
  const [view, setView] = useState('portal')
  const [loginRole, setLoginRole] = useState(null)
  const [passengerSession, setPassengerSession] = usePersistentState(passengerSessionKey, null)
  const [driverSession, setDriverSession] = usePersistentState(driverSessionKey, null)

  useEffect(() => {
    const listener = (event) => setMode(event.detail)
    window.addEventListener('sunshine-api-mode', listener)
    return () => window.removeEventListener('sunshine-api-mode', listener)
  }, [])

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

  useEffect(() => {
    if (driverSession) setView('driver')
    else if (passengerSession) setView('passenger')
  }, [])

  const saveBaseUrl = () => {
    setApiBase(baseUrl)
    refreshHome()
  }

  const handleLogin = async ({ roleCode, phone, password }) => {
    const data = await api.login(roleCode, phone, password)
    if (roleCode === 'DRIVER') {
      setDriverSession(data)
      setView('driver')
    } else {
      setPassengerSession(data)
      setView('passenger')
    }
    setLoginRole(null)
  }

  const handleRegister = async ({ roleCode, phone, password, nickname, defaultLanguage = 'zh-CN' }) => {
    await api.register({ roleCode, phone, password, nickname, defaultLanguage })
    await handleLogin({ roleCode, phone, password })
  }

  const logout = (role) => {
    if (role === 'DRIVER') setDriverSession(null)
    if (role === 'USER') setPassengerSession(null)
    setView('portal')
  }

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
          onEnter={(target) => setView(target)}
          hasPassenger={Boolean(passengerSession)}
          hasDriver={Boolean(driverSession)}
        />
      )}

      {view === 'passenger' && (
        <PassengerDashboard
          session={passengerSession}
          home={home}
          apiMode={apiMode}
          onLogin={() => setLoginRole('USER')}
          onLogout={() => logout('USER')}
          onBack={() => setView('portal')}
          onRefreshHome={refreshHome}
        />
      )}

      {view === 'driver' && (
        <DriverDashboard
          session={driverSession}
          apiMode={apiMode}
          onLogin={() => setLoginRole('DRIVER')}
          onLogout={() => logout('DRIVER')}
          onBack={() => setView('portal')}
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

function PortalPage({ apiMode, baseUrl, setBaseUrl, saveBaseUrl, home, onLogin, onEnter, hasPassenger, hasDriver }) {
  const [booking, setBooking] = useState(defaultBooking)
  const [menu, setMenu] = useState('passenger')
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
        <button className="brand-mark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-icon"><Car size={24} /></span>
          <span>
            <strong>阳光出行 Web</strong>
            <small>Taxi Portal</small>
          </span>
        </button>
        <div className="topbar-actions">
          <ModeChip mode={apiMode.mode} message={apiMode.message} />
          <button className="ghost-button" onClick={() => onLogin('USER')}><User size={17} />乘客登录</button>
          <button className="solid-button" onClick={() => onLogin('DRIVER')}><CarTaxiFront size={17} />司机登录</button>
        </div>
      </nav>

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
            <span><ShieldCheck size={15} /> JWT 同步</span>
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

        <div className="hero-stage cinematic-stage">
          <div className="stage-orbit one" />
          <div className="stage-orbit two" />
          <CityMap booking={booking} estimate={estimate} />
          <BookingPanel
            title="门户叫车"
            booking={booking}
            setBooking={setBooking}
            estimate={estimate}
            carTypes={home.carTypes}
            onPrimary={() => onLogin('USER')}
            primaryText="登录乘客并下单"
          />
          <div className="fleet-feed glass-panel interactive-border">
            <span className="section-kicker">fleet pulse</span>
            <strong>{home.fleet?.serviceDriverCount ?? home.fleet?.busyDriverCount ?? 0} 辆车服务中</strong>
            <p>空闲 {home.fleet?.idleDriverCount ?? 0} 辆 · 在线合计 {home.fleet?.onlineDriverCount ?? 0} 辆</p>
          </div>
        </div>
      </section>

      <section className="portal-strip">
        <FeatureCard icon={Zap} title="数据同步" text="网页端接入现有后端服务，与小程序共用登录态、订单、优惠券、司机状态和顺风车数据。" />
        <FeatureCard icon={ShieldCheck} title="业务覆盖" text="乘客端支持叫车、订单、支付、优惠券、消息、实名与客服；司机端支持听单、行程、提现、资质和资料管理。" />
        <FeatureCard icon={Sparkles} title="交互体验" text="重点场景保持轻量动效和清晰反馈，兼顾页面质感、操作效率与实际使用稳定性。" />
      </section>

      <PortalFeatureMenu
        active={menu}
        setActive={setMenu}
        onPassenger={() => (hasPassenger ? onEnter('passenger') : onLogin('USER'))}
        onDriver={() => (hasDriver ? onEnter('driver') : onLogin('DRIVER'))}
      />

      <section className="quick-entry glass-panel interactive-border">
        <div>
          <span className="section-kicker">Local backend</span>
          <h2>后端连接地址</h2>
          <p>默认使用当前服务地址；未连接后端时页面会显示本地数据，保证基础操作可继续使用。</p>
        </div>
        <div className="api-box">
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          <button onClick={saveBaseUrl}><RefreshCw size={16} />重连</button>
        </div>
      </section>

      <section className="role-cards">
        <RoleCard
          icon={User}
          title="乘客工作台"
          text="叫车、支付、评价、投诉、优惠券、顺风车、消息、资料一体化。"
          active={hasPassenger}
          onClick={() => (hasPassenger ? onEnter('passenger') : onLogin('USER'))}
        />
        <RoleCard
          icon={CarTaxiFront}
          title="司机工作台"
          text="听单、抢单、开始接驾、上车、完单、提现、资质资料同屏操作。"
          active={hasDriver}
          onClick={() => (hasDriver ? onEnter('driver') : onLogin('DRIVER'))}
        />
      </section>
    </main>
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
    title: '后台同步',
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

function PassengerDashboard({ session, home, apiMode, onLogin, onLogout, onBack, onRefreshHome }) {
  const [tab, setTab] = useState('ride')
  const [booking, setBooking] = useState(defaultBooking)
  const [estimate, setEstimate] = useState(null)
  const [orders, setOrders] = useState([])
  const [coupons, setCoupons] = useState([])
  const [couponCenter, setCouponCenter] = useState(home.couponCenter || [])
  const [messages, setMessages] = useState([])
  const [profile, setProfile] = useState(null)
  const [carpool, setCarpool] = useState({ list: [], mine: null })
  const [activeRuntime, setActiveRuntime] = useState(null)
  const [toast, setToast] = useState('')
  const token = session?.token
  const activeRideOrder = useMemo(() => pickActiveRideOrder(orders), [orders])

  const load = useCallback(async () => {
    if (!token) return
    const [profileData, orderData, mineCoupons, centerCoupons, msgData, carpoolList, myCarpool] = await Promise.allSettled([
      api.profile(token),
      api.orders(token),
      api.myCoupons(token),
      api.couponCenter(),
      api.messages(token),
      api.carpoolSearch(''),
      api.carpoolMine(token)
    ])
    if (profileData.status === 'fulfilled') setProfile(profileData.value)
    if (orderData.status === 'fulfilled') setOrders(normalizeList(orderData.value))
    if (mineCoupons.status === 'fulfilled') setCoupons(normalizeList(mineCoupons.value))
    if (centerCoupons.status === 'fulfilled') setCouponCenter(normalizeList(centerCoupons.value))
    if (msgData.status === 'fulfilled') setMessages(normalizeList(msgData.value))
    if (carpoolList.status === 'fulfilled') setCarpool((value) => ({ ...value, list: normalizeList(carpoolList.value) }))
    if (myCarpool.status === 'fulfilled') setCarpool((value) => ({ ...value, mine: myCarpool.value }))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

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
      if (orderData.status === 'fulfilled') setOrders(normalizeList(orderData.value))
      if (runtimeData.status === 'fulfilled') setActiveRuntime(runtimeData.value)
    }

    syncActiveRide()
    const timer = window.setInterval(syncActiveRide, 3500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeRideOrder?.id, token])

  useEffect(() => {
    let cancelled = false
    const route = calcRoute(booking.startId, booking.endId)
    api.estimate({
      carTypeId: booking.carTypeId,
      serviceType: booking.serviceType,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    })
      .catch(() => estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin))
      .then((data) => {
        if (!cancelled) setEstimate(data)
      })
    return () => {
      cancelled = true
    }
  }, [booking.carTypeId, booking.endId, booking.serviceType, booking.startId])

  const run = async (task, successText = '操作成功') => {
    try {
      setToast('正在同步到后台...')
      await task()
      await load()
      await onRefreshHome?.()
      setToast(successText)
      window.setTimeout(() => setToast(''), 2200)
    } catch (error) {
      setToast(error.message || '操作失败')
    }
  }

  const estimateRide = async () => {
    const route = calcRoute(booking.startId, booking.endId)
    const data = await api.estimate({
      carTypeId: booking.carTypeId,
      serviceType: booking.serviceType,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    }).catch(() => estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin))
    setEstimate(data)
    return data
  }

  const createRide = () => run(async () => {
    const priced = estimate || await estimateRide()
    const order = await api.createOrder(token, createOrderPayload(booking, priced))
    setOrders((items) => [order, ...items])
    setTab('ride')
  }, '订单已提交，地图已切换到实时派单状态')

  const createInternationalRide = () => run(async () => {
    const route = calcRoute(booking.startId, booking.endId)
    const internationalBooking = { ...booking, serviceType: SERVICE_TYPE.INTERNATIONAL, endId: booking.endId || 'poi008' }
    const priced = await api.estimate({
      carTypeId: internationalBooking.carTypeId,
      serviceType: SERVICE_TYPE.INTERNATIONAL,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    }).catch(() => estimateLocalFare(internationalBooking.carTypeId, SERVICE_TYPE.INTERNATIONAL, route.distanceKm, route.durationMin))
    const order = await api.createOrder(token, createOrderPayload(internationalBooking, priced))
    setOrders((items) => [order, ...items])
    setTab('orders')
  }, '国际出行订单已提交并同步到订单库')

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
      setTab={setTab}
      onLogout={onLogout}
      onBack={onBack}
      tabs={[
        ['ride', Navigation, '叫车'],
        ['orders', Route, '订单'],
        ['coupons', Ticket, '优惠券'],
        ['carpool', Users, '顺风车'],
        ['international', Globe, '国际'],
        ['wallet', Wallet, '钱包实名'],
        ['support', HelpCircle, '帮助设置'],
        ['messages', Bell, '消息'],
        ['profile', Settings, '我的']
      ]}
    >
      {toast && <Toast text={toast} />}
      {tab === 'ride' && (
        <div className="dashboard-grid ride-workbench real-ride">
          {activeRideOrder ? (
            <ActiveRidePanel
              order={activeRideOrder}
              runtime={activeRuntime}
              onRefresh={load}
              onAction={(action) => run(() => passengerOrderAction(action, activeRideOrder, token), actionText(action))}
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
            />
          )}
          <CityMap booking={booking} estimate={estimate} compact operational activeOrder={activeRideOrder} runtime={activeRuntime} />
        </div>
      )}

      {tab === 'orders' && (
        <OrderBoard
          orders={orders}
          role="USER"
          onRefresh={load}
          onAction={(action, order) => run(() => passengerOrderAction(action, order, token), actionText(action))}
        />
      )}

      {tab === 'coupons' && (
        <CouponBoard
          center={couponCenter}
          mine={coupons}
          onReceive={(coupon) => run(() => api.receiveCoupon(token, coupon.id), '优惠券已领取')}
        />
      )}

      {tab === 'carpool' && (
        <CarpoolBoard
          data={carpool}
          onSearch={(keyword) => run(async () => {
            const list = await api.carpoolSearch(keyword)
            setCarpool((value) => ({ ...value, list: normalizeList(list) }))
          }, '顺风车列表已刷新')}
          onPublish={(form) => run(() => api.carpoolPublish(token, form), '顺风车已发布')}
          onApply={(trip) => run(() => api.carpoolApply(token, { tripId: trip.id, companionCount: 0, note: '网页端申请搭乘' }), '已申请搭乘')}
        />
      )}

      {tab === 'messages' && (
        <MessageBoard
          messages={messages}
          orders={orders}
          onRefresh={load}
          onReadMessage={async (message) => {
            setMessages((list) => list.map((item) => item.id === message.id ? { ...item, unread: false, read: true, isRead: true, readStatus: 'READ' } : item))
            try {
              await api.markMessageRead(token, message.id)
            } catch (error) {}
          }}
        />
      )}
      {tab === 'international' && <InternationalBoard booking={booking} setBooking={setBooking} estimate={estimate} carTypes={home.carTypes} onSubmit={createInternationalRide} />}
      {tab === 'wallet' && (
        <PassengerWalletBoard
          profile={profile || session}
          onProfile={(form) => run(() => api.updateProfile(token, form), '资料已同步')}
          onRealName={(form) => run(() => api.submitRealName(token, form), '实名信息已提交')}
        />
      )}
      {tab === 'support' && (
        <SupportBoard
          orders={orders}
          profile={profile || session}
          onComplaint={(order) => run(() => api.complaint(token, { orderId: order.id, content: '网页端帮助中心提交投诉。' }), '投诉已提交')}
          onEvaluate={(order) => run(() => api.evaluate(token, { orderId: order.id, score: 5, content: '网页端评价：服务顺滑，接驾及时。' }), '评价已提交')}
        />
      )}
      {tab === 'profile' && (
        <ProfileBoard
          profile={profile || session}
          mode="USER"
          onProfile={(form) => run(() => api.updateProfile(token, form), '资料已保存')}
        />
      )}
    </DashboardShell>
  )
}

function DriverDashboard({ session, apiMode, onLogin, onLogout, onBack }) {
  const [tab, setTab] = useState('listen')
  const [dashboard, setDashboard] = useState(null)
  const [waitingOrders, setWaitingOrders] = useState([])
  const [orders, setOrders] = useState([])
  const [messages, setMessages] = useState([])
  const [toast, setToast] = useState('')
  const token = session?.token

  const load = useCallback(async () => {
    if (!token) return
    const [dash, waiting, mine, msg] = await Promise.allSettled([
      api.driverDashboard(token),
      api.driverWaitingOrders(token),
      api.orders(token),
      api.messages(token)
    ])
    if (dash.status === 'fulfilled') setDashboard(dash.value)
    if (waiting.status === 'fulfilled') setWaitingOrders(normalizeList(waiting.value))
    if (mine.status === 'fulfilled') setOrders(normalizeList(mine.value))
    if (msg.status === 'fulfilled') setMessages(normalizeList(msg.value))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const run = async (task, successText = '操作成功') => {
    try {
      setToast('正在同步到后台...')
      await task()
      await load()
      setToast(successText)
      window.setTimeout(() => setToast(''), 2200)
    } catch (error) {
      setToast(error.message || '操作失败')
    }
  }

  if (!session) {
    return <LoginRequired role="DRIVER" onLogin={onLogin} onBack={onBack} />
  }

  const profile = dashboard?.profile || {}
  const user = dashboard?.user || session

  return (
    <DashboardShell
      role="司机端"
      icon={CarTaxiFront}
      apiMode={apiMode}
      profile={user}
      tab={tab}
      setTab={setTab}
      onLogout={onLogout}
      onBack={onBack}
      tabs={[
        ['listen', Radio, '听单'],
        ['orders', Route, '订单'],
        ['wallet', Wallet, '钱包资质'],
        ['profile', Settings, '资料设置'],
        ['messages', Bell, '消息']
      ]}
    >
      {toast && <Toast text={toast} />}
      {tab === 'listen' && (
        <div className="dashboard-grid">
          <section className="glass-panel work-card wide">
            <div className="card-head">
              <div>
                <span className="section-kicker">司机服务</span>
                <h2>听单大厅</h2>
              </div>
              <StatusBadge value={profile.serviceStatus || DRIVER_STATUS.OFFLINE} />
            </div>
            <div className="driver-switch">
              {[DRIVER_STATUS.ONLINE, DRIVER_STATUS.OFFLINE].map((status) => (
                <button
                  key={status}
                  className={profile.serviceStatus === status ? 'active' : ''}
                  onClick={() => run(() => api.driverStatus(token, {
                    serviceStatus: status,
                    longitude: '117.0810',
                    latitude: '39.9820'
                  }), `司机状态已切换为${statusLabel[status]}`)}
                >
                  <Power size={18} />{statusLabel[status]}
                </button>
              ))}
            </div>
            <div className="stat-grid">
              <Metric value={dashboard?.orders?.length || orders.length || 0} label="我的订单" />
              <Metric value={formatMoney(profile.todayIncome || 0)} label="今日收入" />
              <Metric value={formatMoney(profile.withdrawableIncome || 0)} label="可提现" />
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
            <OrderList
              orders={waitingOrders}
              empty="暂无待抢订单，乘客端下单后会出现在这里。"
              footer={(order) => (
                <>
                  <button className="solid-button" onClick={() => run(() => api.driverAccept(token, order.id), '接单成功')}>
                    <CheckCircle size={16} />接单
                  </button>
                  <button className="ghost-button" onClick={() => run(() => api.driverReject(token, order.id, '网页端暂不接单'), '已拒单')}>
                    <XCircle size={16} />拒单
                  </button>
                </>
              )}
            />
          </section>
        </div>
      )}

      {tab === 'orders' && (
        <OrderBoard
          orders={orders}
          role="DRIVER"
          onRefresh={load}
          onAction={(action, order) => run(() => driverOrderAction(action, order, token), actionText(action))}
        />
      )}

      {tab === 'wallet' && (
        <DriverWallet
          dashboard={dashboard}
          onWithdraw={(form) => run(() => api.driverWithdraw(token, form), '提现申请已提交')}
          onCertify={(form) => run(() => api.driverCertify(token, form), '资质信息已提交')}
        />
      )}

      {tab === 'profile' && (
        <DriverProfileBoard
          dashboard={dashboard}
          user={user}
          onProfile={(form) => run(() => api.driverUpdateProfile(token, form), '司机资料已同步')}
        />
      )}

      {tab === 'messages' && (
        <MessageBoard
          messages={messages}
          orders={orders}
          onRefresh={load}
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

function BookingPanel({ title, booking, setBooking, estimate, carTypes, onEstimate, onPrimary, primaryText }) {
  const [busyAction, setBusyAction] = useState('')
  const tilt = useTiltCard({ maxX: 11, maxY: 16 })
  const route = calcRoute(booking.startId, booking.endId)
  const safeEstimate = estimate || estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin)
  const options = normalizeCarTypes(carTypes)

  const update = (patch) => setBooking((value) => ({ ...value, ...patch }))
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
    <section className="booking-card glass-panel refract tilt-card" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <div className="card-head">
        <div>
          <span className="section-kicker">Route composer</span>
          <h2>{title}</h2>
        </div>
        <div className="price-pill">{formatMoney(safeEstimate.amount, safeEstimate.currencyCode)}</div>
      </div>
      <div className="service-tabs">
        {Object.values(SERVICE_TYPE).map((type) => (
          <button
            key={type}
            className={booking.serviceType === type ? 'active' : ''}
            onClick={() => update({ serviceType: type })}
          >
            {statusLabel[type]}
          </button>
        ))}
      </div>
      <div className="field-stack">
        <SelectField
          icon={Locate}
          label="上车点"
          value={booking.startId}
          onChange={(value) => update({ startId: value })}
          options={poiLibrary.map((item) => [item.id, item.name])}
        />
        <SelectField
          icon={Flag}
          label="目的地"
          value={booking.endId}
          onChange={(value) => update({ endId: value })}
          options={poiLibrary.map((item) => [item.id, item.name])}
        />
        <SelectField
          icon={Car}
          label="车型"
          value={String(booking.carTypeId)}
          onChange={(value) => update({ carTypeId: Number(value) })}
          options={options.map((item) => [String(item.id), getCarTypeName(item)])}
        />
      </div>
      <div className="fare-grid">
        <MiniStat label="距离" value={`${safeEstimate.distanceKm || route.distanceKm} km`} />
        <MiniStat label="时间" value={`${safeEstimate.durationMin || route.durationMin} min`} />
        <MiniStat label="币种" value={safeEstimate.currencyCode || 'CNY'} />
      </div>
      <div className="booking-actions">
        {onEstimate && (
          <button className="ghost-button" disabled={busyAction === 'estimate'} onClick={() => runAction('estimate', onEstimate)}>
            <GaugeIcon />{busyAction === 'estimate' ? '试算中' : '重新试算'}
          </button>
        )}
        <MagneticButton className="solid-button fill" disabled={busyAction === 'primary'} onClick={() => runAction('primary', onPrimary)}>
          <Navigation size={17} />{busyAction === 'primary' ? '正在推进' : primaryText}
        </MagneticButton>
      </div>
    </section>
  )
}

function ActiveRidePanel({ order, runtime, onRefresh, onAction }) {
  const copy = getRideStatusCopy(order)
  const timeline = normalizeTimeline(order)
  const canCancel = [ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus)
  const canPickup = order.orderStatus === ORDER_STATUS.PICKING_UP
  const canPay = order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID

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
      <div className="active-route-line">
        <div><span className="address-dot start" /><small>上车点</small><strong>{order.startName}</strong></div>
        <div><span className="address-dot end" /><small>目的地</small><strong>{order.endName}</strong></div>
      </div>
      <div className="active-ride-metrics">
        <MiniStat label="预计接驾" value={`${runtime?.etaMinutes || order.estimatedDurationMin || 8} min`} />
        <MiniStat label="行程距离" value={`${runtime?.distanceKm || order.estimatedDistanceKm || '-'} km`} />
        <MiniStat label="订单金额" value={formatMoney(order.payableAmount || order.actualAmount || order.estimatedAmount, order.currencyCode)} />
      </div>
      <div className="active-driver-card">
        <CarTaxiFront size={20} />
        <div>
          <strong>{order.driverId ? '李师傅已同步接单' : '正在同步附近司机'}</strong>
          <span>{order.driverId ? '车辆位置会从订单 runtime 接口刷新' : '司机端听单大厅接单后这里会自动变化'}</span>
        </div>
      </div>
      <div className="active-timeline">
        {timeline.slice(0, 4).map((item, index) => (
          <span key={`${item.label}-${index}`} className={item.tone || 'waiting'}>{item.label}</span>
        ))}
      </div>
      <div className="active-ride-actions">
        <button className="ghost-button" onClick={onRefresh}><RefreshCw size={16} />刷新同步</button>
        {canCancel && <button className="ghost-button" onClick={() => onAction('cancel')}><XCircle size={16} />取消订单</button>}
        {canPickup && <button className="solid-button" onClick={() => onAction('pickup')}><Navigation size={16} />我已上车</button>}
        {canPay && <button className="solid-button" onClick={() => onAction('pay')}><CreditCard size={16} />支付</button>}
      </div>
    </section>
  )
}

function ActiveMapSheet({ order, runtime, amount, currency, duration, distance }) {
  const copy = getRideStatusCopy(order)
  const timeline = normalizeTimeline(order)
  return (
    <>
      <div className="active-map-sheet">
        <div className="active-map-sheet__head">
          <div>
            <span className="section-kicker">订单同步</span>
            <h3>{copy.title}</h3>
            <p>{copy.desc}</p>
          </div>
          <StatusBadge value={order.orderStatus} />
        </div>
        <div className="active-map-sheet__grid">
          <MiniStat label="订单号" value={order.orderNo || `#${order.id}`} />
          <MiniStat label="司机" value={order.driverId ? '已接单' : '待接单'} />
          <MiniStat label="预估费用" value={formatMoney(amount, currency)} />
          <MiniStat label="ETA" value={`${runtime?.etaMinutes || duration || 8} min`} />
        </div>
        <div className="active-map-sheet__line">
          <div><span className="address-dot start" /><small>从哪里出发</small><strong>{order.startName}</strong></div>
          <div><span className="address-dot end" /><small>去哪里</small><strong>{order.endName}</strong></div>
        </div>
        <div className="active-map-sheet__foot">
          <span><Clock size={14} />{order.updatedAt || order.createdAt || '-'}</span>
          <span><Route size={14} />{distance} km</span>
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
      desc: '订单已写入后台，司机端听单大厅可实时接单。',
      mapLabel: '智能派单中'
    },
    [ORDER_STATUS.ACCEPTED]: {
      title: '司机已接单',
      desc: '司机车辆位置将通过订单 runtime 接口持续同步。',
      mapLabel: '司机已接单'
    },
    [ORDER_STATUS.PICKING_UP]: {
      title: '司机接驾中',
      desc: '请在上车点等待，确认上车后行程会进入进行中。',
      mapLabel: '司机接驾中'
    },
    [ORDER_STATUS.IN_TRIP]: {
      title: '行程进行中',
      desc: '路线和预计到达时间会跟随后台状态刷新。',
      mapLabel: '行程进行中'
    },
    [ORDER_STATUS.FINISHED]: {
      title: '行程已结束',
      desc: '请完成支付，订单状态会同步到小程序和后台。',
      mapLabel: '待支付'
    }
  }
  return map[order.orderStatus] || {
    title: statusLabel[order.orderStatus] || '订单同步中',
    desc: '正在读取订单状态。',
    mapLabel: statusLabel[order.orderStatus] || '订单同步'
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

function CityMap({ booking, estimate, compact = false, operational = false, activeOrder = null, runtime = null }) {
  const tilt = useTiltCard({ maxX: 6, maxY: 9 })
  const route = activeOrder ? buildRouteFromOrder(activeOrder) : calcRoute(booking.startId, booking.endId)
  const fallback = activeOrder
    ? buildEstimateFromOrder(activeOrder, route)
    : estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin)
  const amount = activeOrder ? fallback.amount : (estimate?.amount || fallback.amount)
  const duration = runtime?.etaMinutes || (activeOrder ? fallback.durationMin : (estimate?.durationMin || route.durationMin))
  const distance = runtime?.distanceKm || (activeOrder ? fallback.distanceKm : (estimate?.distanceKm || route.distanceKm))
  const currency = activeOrder?.currencyCode || estimate?.currencyCode || fallback.currencyCode
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
  const mapCardClassName = `city-map map-card-v2 glass-panel ${operational ? '' : 'tilt-card'} ${compact ? 'compact' : ''} ${operational ? 'operational-map' : ''}`.replace(/\s+/g, ' ').trim()
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
        <strong>{formatMoney(amount, currency)}</strong>
      </div>
      {operational ? (
        <TencentRouteMapV2 route={route} amount={amount} currency={currency} duration={duration} distance={distance} serviceType={activeOrder?.serviceType || booking.serviceType} order={activeOrder} runtime={runtime} />
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
          <strong>{duration} min</strong>
          <span>{operational ? '预计行程' : '司机靠近中'}</span>
        </div>
        <div className="map-route-sheet glass-panel">
          <span><Navigation size={15} />{operational ? mapStateText : '智能派单'}</span>
          <strong>{distance} km</strong>
          <small>{statusLabel[booking.serviceType]} · {currency}</small>
        </div>
      </div>
      )}
      <div className="map-bottomline">
        <span><Clock size={15} />预计 {duration} 分钟</span>
        <span><Route size={15} />{distance} km</span>
      </div>
    </section>
  )
}

function TencentRouteMapV2({ route, amount, currency, duration, distance, serviceType, order = null, runtime = null }) {
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

    new TMap.MultiPolyline({
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
    new TMap.MultiMarker({
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
  }, [scriptReady, start, end, runtime?.driverLocation, runtime?.route, routePoints])

  const useNativeMap = Boolean(mapKey && scriptReady && !scriptFailed && window.TMap?.Map)

  return (
    <div className="miniapp-sync-shell">
      <div className="miniapp-sync-map">
        {!useNativeMap && <RealTileRouteMap route={route} runtime={runtime} order={order} routePoints={routePoints} />}
        {mapKey && <div className={`tencent-map-canvas miniapp-map-native ${useNativeMap ? 'is-ready' : ''}`} ref={mapRef} />}
        <div className="miniapp-sync-brand">
          <strong>阳光出行</strong>
          <span>{useNativeMap ? '腾讯地图' : '地图加载中'}</span>
        </div>
      </div>
      <div className="miniapp-sync-panel">
        {order ? (
          <ActiveMapSheet order={order} runtime={runtime} amount={amount} currency={currency} duration={duration} distance={distance} />
        ) : (
          <>
            <div className="miniapp-sync-tabs">
              <button className={serviceType === SERVICE_TYPE.TAXI ? 'active' : ''}>打车</button>
              <button className={serviceType === SERVICE_TYPE.CARPOOL ? 'active' : ''}>顺风车</button>
              <button className={serviceType === SERVICE_TYPE.INTERNATIONAL ? 'active' : ''}>国际出行</button>
            </div>
            <div className="miniapp-sync-addresses">
              <div><span className="address-dot start" /><small>从哪里出发</small><strong>{start.name}</strong></div>
              <div><span className="address-dot end" /><small>去哪里</small><strong>{end.name}</strong></div>
            </div>
            <div className="miniapp-sync-metrics">
              <MiniStat label="预估" value={formatMoney(amount, currency)} />
              <MiniStat label="距离" value={`${distance} km`} />
              <MiniStat label="时间" value={`${duration} min`} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TencentRouteMap({ route, amount, currency, duration, distance, serviceType }) {
  const mapRef = useRef(null)
  const [scriptReady, setScriptReady] = useState(false)
  const start = route.start
  const end = route.end
  const mapKey = getTencentMapKey()

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
          <button className={serviceType === SERVICE_TYPE.TAXI ? 'active' : ''}>打车</button>
          <button className={serviceType === SERVICE_TYPE.CARPOOL ? 'active' : ''}>顺风车</button>
          <button className={serviceType === SERVICE_TYPE.INTERNATIONAL ? 'active' : ''}>国际出行</button>
        </div>
        <div className="miniapp-address-stack">
          <div><span className="address-dot start" /><small>从哪里出发</small><strong>{start.name}</strong></div>
          <div><span className="address-dot end" /><small>去哪里</small><strong>{end.name}</strong></div>
        </div>
        <div className="miniapp-estimate-row">
          <MiniStat label="预估" value={formatMoney(amount, currency)} />
          <MiniStat label="距离" value={`${distance} km`} />
          <MiniStat label="时间" value={`${duration} min`} />
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

function DashboardShell({ role, icon: Icon, apiMode, profile, tabs, tab, setTab, onLogout, onBack, children }) {
  return (
    <main className="dashboard-shell">
      <aside className="side-nav glass-panel">
        <button className="brand-mark" onClick={onBack}>
          <span className="brand-icon"><Icon size={24} /></span>
          <span><strong>{role}</strong><small>业务页面</small></span>
        </button>
        <div className="nav-tabs">
          {tabs.map(([key, TabIcon, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <TabIcon size={18} />{label}
            </button>
          ))}
        </div>
        <button className="ghost-button side-logout" onClick={onLogout}><LogOut size={17} />退出登录</button>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-header glass-panel">
          <div>
            <span className="section-kicker">当前账号</span>
            <h1>{profile?.nickname || profile?.phone || role}</h1>
          </div>
          <div className="header-right">
            <ModeChip mode={apiMode.mode} message={apiMode.message} />
            <button className="ghost-button" onClick={onBack}>门户</button>
          </div>
        </header>
        {children}
      </section>
    </main>
  )
}

function OrderBoard({ orders, role, onAction, onRefresh }) {
  const [listExpanded, setListExpanded] = useState(false)
  const visibleCount = listExpanded ? orders?.length : Math.min(6, orders?.length || 0)
  return (
    <section className="glass-panel work-card order-board-card">
      <div className="card-head">
        <div>
          <span className="section-kicker">订单</span>
          <h2>{role === 'DRIVER' ? '司机订单' : '我的订单'} <small>{orders?.length || 0}</small></h2>
        </div>
        <div className="order-board-actions">
          {(orders?.length || 0) > 6 && (
            <button className="order-list-toggle" onClick={() => setListExpanded((value) => !value)}>
              {listExpanded ? '收起订单' : `展开全部 ${orders.length} 单`} <ChevronRight size={15} />
            </button>
          )}
          <button className="icon-button" onClick={onRefresh}><RefreshCw size={17} /></button>
        </div>
      </div>
      <OrderList
        orders={orders}
        empty="暂无订单。"
        limit={visibleCount}
        footer={(order) => (
          <OrderActions role={role} order={order} onAction={(action) => onAction(action, order)} />
        )}
      />
    </section>
  )
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

function OrderList({ orders, footer, empty, limit }) {
  if (!orders?.length) return <EmptyState text={empty} />
  const visibleOrders = Number.isFinite(limit) ? orders.slice(0, limit) : orders
  return (
    <div className="order-list compact-order-list">
      {visibleOrders.map((order, index) => {
        const key = order.id || order.orderNo || index
        const orderTime = formatOrderDisplayTime(order)
        return (
        <article className="order-card glass-panel compact slim" key={key}>
          <div className="order-line">
            <div>
              <h3>{order.startName} <ChevronRight size={16} /> {order.endName}</h3>
              <p className="order-subline"><span>{order.orderNo || `#${order.id}`}</span><span>{statusLabel[order.serviceType] || order.serviceType}</span><span className="order-time">下单 {orderTime}</span></p>
              <p>{order.orderNo || `#${order.id}`} · {statusLabel[order.serviceType] || order.serviceType} · {order.createdTime || order.createTime || '-'}</p>
            </div>
            <div className="order-badges">
              <StatusBadge value={order.orderStatus} />
              <StatusBadge value={order.payStatus} />
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

function OrderActions({ role, order, onAction }) {
  if (role === 'DRIVER') {
    return (
      <>
        {order.orderStatus === ORDER_STATUS.ACCEPTED && <button className="solid-button" onClick={() => onAction('start')}><Play size={16} />开始接驾</button>}
        {order.orderStatus === ORDER_STATUS.PICKING_UP && <button className="solid-button" onClick={() => onAction('pickup')}><Navigation size={16} />确认上车</button>}
        {order.orderStatus === ORDER_STATUS.IN_TRIP && <button className="solid-button" onClick={() => onAction('finish')}><Flag size={16} />完成行程</button>}
      </>
    )
  }
  return (
    <>
      {[ORDER_STATUS.DISPATCHING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKING_UP].includes(order.orderStatus) && (
        <button className="ghost-button" onClick={() => onAction('cancel')}><XCircle size={16} />取消</button>
      )}
      {order.orderStatus === ORDER_STATUS.PICKING_UP && <button className="solid-button" onClick={() => onAction('pickup')}><Navigation size={16} />我已上车</button>}
      {order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.UNPAID && (
        <button className="solid-button" onClick={() => onAction('pay')}><CreditCard size={16} />支付</button>
      )}
      {order.orderStatus === ORDER_STATUS.FINISHED && order.payStatus === PAY_STATUS.PAID && order.evaluationStatus !== 'DONE' && (
        <button className="ghost-button" onClick={() => onAction('evaluate')}><Star size={16} />评价</button>
      )}
      {order.orderStatus !== ORDER_STATUS.CANCELLED && <button className="ghost-button" onClick={() => onAction('complaint')}><AlertTriangle size={16} />投诉</button>}
    </>
  )
}

function CouponBoard({ center, mine, onReceive }) {
  const [status, setStatus] = useState('ALL')
  const [walletExpanded, setWalletExpanded] = useState(false)
  const [centerExpanded, setCenterExpanded] = useState(false)
  const centerList = center || []
  const templateMap = useMemo(() => new Map(centerList.map((coupon) => [Number(coupon.id), coupon])), [centerList])
  const walletList = (mine || []).map((coupon) => ({ ...templateMap.get(Number(coupon.couponId)), ...coupon }))
  const visibleWallet = status === 'ALL' ? walletList : walletList.filter((coupon) => (coupon.couponStatus || coupon.status || 'UNUSED') === status)
  const walletDisplay = walletExpanded ? visibleWallet : visibleWallet.slice(0, 5)
  const centerDisplay = centerExpanded ? centerList : centerList.slice(0, 5)
  const statusTabs = [
    ['ALL', '全部', walletList.length],
    ['UNUSED', '可用', walletList.filter((coupon) => (coupon.couponStatus || coupon.status || 'UNUSED') === 'UNUSED').length],
    ['USED', '已用', walletList.filter((coupon) => (coupon.couponStatus || coupon.status) === 'USED').length],
    ['EXPIRED', '失效', walletList.filter((coupon) => (coupon.couponStatus || coupon.status) === 'EXPIRED').length]
  ]
  return (
    <div className="dashboard-grid coupon-board">
      <section className="glass-panel work-card wide coupon-wallet">
        <div className="card-head">
          <div><span className="section-kicker">Coupon wallet</span><h2>我的券包</h2></div>
          <Ticket size={22} />
        </div>
        <div className="segmented-row coupon-tabs">
          {statusTabs.map(([key, label, count]) => (
            <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}<span>{count}</span></button>
          ))}
        </div>
        {visibleWallet.length ? (
          <div className="coupon-wallet-list">
            {walletDisplay.map((coupon, index) => <CouponTicket coupon={coupon} key={coupon.id || coupon.userCouponId || `${coupon.couponId}-${index}`} owned />)}
          </div>
        ) : <EmptyState text="暂无对应优惠券。" />}
        {visibleWallet.length > 5 && (
          <button className="coupon-list-toggle" onClick={() => setWalletExpanded((value) => !value)}>
            {walletExpanded ? '收起券包' : `展开全部 ${visibleWallet.length} 张`} <ChevronRight size={14} />
          </button>
        )}
      </section>
      <section className="glass-panel work-card coupon-center-panel">
        <div className="card-head">
          <div><span className="section-kicker">Center</span><h2>券中心</h2></div>
          <Wallet size={21} />
        </div>
        {centerList.length ? (
          <div className="coupon-center-list">
            {centerDisplay.map((coupon) => <CouponTicket coupon={coupon} key={coupon.id} onReceive={() => onReceive(coupon)} />)}
          </div>
        ) : <EmptyState text="当前暂无可领取优惠券。" />}
        {centerList.length > 5 && (
          <button className="coupon-list-toggle" onClick={() => setCenterExpanded((value) => !value)}>
            {centerExpanded ? '收起券中心' : `展开全部 ${centerList.length} 张`} <ChevronRight size={14} />
          </button>
        )}
      </section>
    </div>
  )
}

function CouponTicket({ coupon, owned = false, onReceive }) {
  const discount = getCouponValue(coupon)
  const threshold = coupon.thresholdAmount || coupon.minAmount || coupon.conditionAmount || 0
  const status = coupon.couponStatus || coupon.status || 'UNUSED'
  const rawScope = coupon.serviceType || coupon.scope || coupon.serviceScope
  const scope = statusLabel[rawScope] || rawScope || '全场通用'
  const validity = coupon.validEndTime || coupon.expireTime || coupon.endTime || coupon.validTo || ''
  return (
    <article className={`coupon-ticket ${owned ? 'owned' : ''} ${discount.type === 'rate' ? 'rate' : ''}`}>
      <div className="coupon-ticket-value">
        {discount.type === 'cash' && <small>¥</small>}<strong>{discount.text}</strong>
      </div>
      <div className="coupon-ticket-main">
        <div className="coupon-ticket-title">
          <strong>{coupon.couponName || coupon.name || `优惠券 #${coupon.couponId || coupon.id}`}</strong>
          {owned && <StatusBadge value={status} />}
        </div>
        <p>{coupon.ruleDesc || (Number(threshold) > 0 ? `满 ${threshold} 元可用` : '无门槛可用')}</p>
        <div className="coupon-ticket-meta">
          <span>{scope}</span>
          {validity && <span>有效至 {validity}</span>}
        </div>
      </div>
      {!owned && <button className="coupon-claim" onClick={onReceive}>领取</button>}
    </article>
  )
}

function getCouponValue(coupon = {}) {
  const couponType = coupon.couponType || coupon.type
  const amount = coupon.discountAmount || coupon.amount || coupon.faceValue || coupon.couponAmount || 0
  if (couponType !== 'DISCOUNT' || Number(amount) > 0) {
    return { type: 'cash', text: Number(amount || 0).toString().replace(/\.00$/, '') }
  }
  const rawRate = coupon.discountRate ?? coupon.rate ?? coupon.discount
  const rate = Number(rawRate)
  if (Number.isFinite(rate) && rate > 0 && rate < 1) {
    return { type: 'rate', text: `${Number((rate * 10).toFixed(1)).toString().replace(/\.0$/, '')}折` }
  }
  const match = `${coupon.couponName || ''}${coupon.ruleDesc || ''}`.match(/(\d+(?:\.\d+)?)\s*折/)
  return { type: 'rate', text: match ? `${match[1]}折` : '折扣' }
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

function CarpoolBoard({ data, onSearch, onPublish, onApply }) {
  const [keyword, setKeyword] = useState('')
  const [active, setActive] = useState('search')
  const [form, setForm] = useState({
    startName: '燕京理工学院-南门',
    endName: '天洋广场',
    departDate: '2026-05-15',
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
  const mine = splitCarpoolMine(data.mine)
  const update = (patch) => setForm((draft) => ({ ...draft, ...patch }))
  const swapAddress = () => update({ startName: form.endName, endName: form.startName })
  const submitPublish = () => {
    const luggageLabel = luggageOptions.find(([key]) => key === form.luggageMode)?.[1] || '无行李'
    const tollLabel = tollOptions.find(([key]) => key === form.tollMode)?.[1] || '高速费协商'
    onPublish({
      startName: form.startName,
      endName: form.endName,
      departTime: `${form.departDate} ${form.timeRange.split('-')[0]}:00`,
      seatCount: Number(form.seatCount || form.passengerCount || 1),
      sharedAmount: Number(form.sharedAmount || 0),
      baggageRule: `${luggageLabel} · ${tollLabel}`,
      tripRemark: form.note || '网页端顺风车发布'
    })
  }
  return (
    <div className="dashboard-grid carpool-board">
      <section className="glass-panel work-card wide carpool-main-card">
        <div className="card-head carpool-head">
          <div className="carpool-title-block"><span className="section-kicker">Carpool</span><h2>顺风车</h2></div>
          <div className="search-line carpool-search-line">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索起点或终点" />
            <button onClick={() => onSearch(keyword)}><RefreshCw size={16} />搜索</button>
          </div>
        </div>
        <div className="segmented-row carpool-tabs">
          {[
            ['search', '可搭乘', data.list?.length || 0],
            ['publish', '发布行程', ''],
            ['mine', '我的顺风车', mine.total]
          ].map(([key, label, count]) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}>{label}{count !== '' && <span>{count}</span>}</button>)}
        </div>
        {active === 'search' && (
          <div className="carpool-trip-list">
            {data.list?.length ? data.list.map((trip) => <CarpoolTripCard trip={trip} key={trip.id} onApply={() => onApply(trip)} />) : <EmptyState text="暂无匹配的顺风车。" />}
          </div>
        )}
        {active === 'publish' && (
          <div className="carpool-publish-panel">
            <div className="address-stack web">
              <label><span>从哪里出发</span><input value={form.startName} onChange={(event) => update({ startName: event.target.value })} /></label>
              <button className="address-switch web" onClick={swapAddress}>换</button>
              <label><span>去哪里</span><input value={form.endName} onChange={(event) => update({ endName: event.target.value })} /></label>
            </div>
            <div className="carpool-form-grid">
              <Field label="出发日期" value={form.departDate} onChange={(value) => update({ departDate: value })} />
              <label className="plain-field"><span>时间段</span><select value={form.timeRange} onChange={(event) => update({ timeRange: event.target.value })}>{timeRangeOptions.map((item) => <option key={item} value={item}>{item.replace('-', ' - ')}</option>)}</select></label>
              <label className="plain-field"><span>乘车人数</span><select value={form.passengerCount} onChange={(event) => update({ passengerCount: Number(event.target.value) })}>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>{item} 人</option>)}</select></label>
              <Field label="可提供座位" value={form.seatCount} onChange={(value) => update({ seatCount: value })} />
              <Field label="分摊金额" value={form.sharedAmount} onChange={(value) => update({ sharedAmount: value })} />
            </div>
            <CarpoolOptionGroup title="行李情况" value={form.luggageMode} options={luggageOptions} onChange={(value) => update({ luggageMode: value })} />
            <CarpoolOptionGroup title="高速费方案" value={form.tollMode} options={tollOptions} onChange={(value) => update({ tollMode: value })} />
            <label className="plain-field carpool-note"><span>补充说明</span><textarea value={form.note} maxLength={60} placeholder="上车点细节、是否赶时间等" onChange={(event) => update({ note: event.target.value })} /></label>
            <button className="solid-button fill" onClick={submitPublish}><Send size={16} />发布顺风车</button>
          </div>
        )}
        {active === 'mine' && (
          <div className="carpool-mine-panel">
            <div className="stat-grid">
              <Metric value={mine.published.length} label="我发布的" />
              <Metric value={mine.applied.length} label="我申请的" />
            </div>
            {[...mine.published, ...mine.applied].length ? [...mine.published, ...mine.applied].map((trip, index) => <CarpoolTripCard trip={trip} key={trip.id || index} muted />) : <EmptyState text="暂无顺风车记录。" />}
          </div>
        )}
      </section>
      <section className="glass-panel work-card carpool-side">
        <div className="card-head"><h2>行程偏好</h2><Users size={21} /></div>
        <InfoPanel title="当前草稿" items={[
          ['出发', form.startName],
          ['到达', form.endName],
          ['时间', `${form.departDate} ${form.timeRange}`],
          ['人数', `${form.passengerCount} 人`]
        ]} />
        <InfoPanel title="我的记录" items={[
          ['已发布', `${mine.published.length} 条`],
          ['已申请', `${mine.applied.length} 条`],
          ['可搭乘', `${data.list?.length || 0} 条`]
        ]} />
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

function CarpoolTripCard({ trip, onApply, muted = false }) {
  return (
    <article className={`carpool-trip-card glass-panel ${muted ? 'muted-card' : ''}`}>
      <div className="order-line">
        <div><h3>{trip.startName} <ChevronRight size={16} /> {trip.endName}</h3><p>{trip.departTime || trip.createTime || '-'} · 余座 {trip.seatCount ?? trip.remainingSeatCount ?? '-'}</p></div>
        <strong>{formatMoney(trip.sharedAmount || trip.amount || 0)}</strong>
      </div>
      <div className="carpool-trip-meta">
        <span>{trip.baggageRule || '行李规则待确认'}</span>
        <span>{statusLabel[trip.tripStatus] || trip.tripStatus || '可申请'}</span>
      </div>
      {trip.tripRemark && <p className="muted">{trip.tripRemark}</p>}
      {onApply && <div className="order-actions"><button className="solid-button" onClick={onApply}><Send size={16} />申请搭乘</button></div>}
    </article>
  )
}

function splitCarpoolMine(payload) {
  const source = payload?.data || payload || {}
  const published = normalizeList(source.published || source.publishList || source.ownerTrips || source.trips || source.createdTrips || [])
  const applied = normalizeList(source.applied || source.applyList || source.applications || source.joinedTrips || [])
  return { published, applied, total: published.length + applied.length }
}

function InternationalBoard({ booking, setBooking, estimate, carTypes, onSubmit }) {
  const internationalBooking = { ...booking, serviceType: SERVICE_TYPE.INTERNATIONAL }
  const route = calcRoute(internationalBooking.startId, internationalBooking.endId)
  const safeEstimate = estimateLocalFare(internationalBooking.carTypeId, SERVICE_TYPE.INTERNATIONAL, route.distanceKm, route.durationMin)
  return (
    <div className="dashboard-grid ride-workbench">
      <BookingPanel
        title="国际出行"
        booking={internationalBooking}
        setBooking={setBooking}
        estimate={safeEstimate}
        carTypes={carTypes}
        onPrimary={onSubmit}
        primaryText="提交国际出行订单"
      />
      <CityMap booking={internationalBooking} estimate={safeEstimate} compact />
      <section className="glass-panel work-card">
        <div className="card-head"><h2>当前试算</h2><Globe size={21} /></div>
        <InfoPanel title="行程费用" items={[
          ['服务类型', statusLabel[SERVICE_TYPE.INTERNATIONAL]],
          ['币种', safeEstimate.currencyCode],
          ['汇率', safeEstimate.exchangeRate],
          ['预估金额', formatMoney(safeEstimate.amount, safeEstimate.currencyCode)]
        ]} />
      </section>
    </div>
  )
}

function PassengerWalletBoard({ profile, onProfile, onRealName }) {
  const [editingRealName, setEditingRealName] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [form, setForm] = useState({
    nickname: profile?.nickname || '',
    emergencyContact: profile?.emergencyContact || '',
    emergencyPhone: profile?.emergencyPhone || ''
  })
  const [realName, setRealName] = useState({
    realName: profile?.realName || '阳光乘客',
    idCard: profile?.idCard || '110101199901010011'
  })

  useEffect(() => {
    setForm({
      nickname: profile?.nickname || '',
      emergencyContact: profile?.emergencyContact || '',
      emergencyPhone: profile?.emergencyPhone || ''
    })
    setRealName({
      realName: profile?.realName || '阳光乘客',
      idCard: profile?.idCard || '110101199901010011'
    })
  }, [profile])

  const saveRealName = async () => {
    await onRealName(realName)
    setEditingRealName(false)
  }

  const saveProfile = async () => {
    await onProfile(form)
    setEditingProfile(false)
  }

  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card wallet-board-card">
        <div className="card-head">
          <h2>钱包与实名</h2>
          {editingRealName ? (
            <button className="ghost-button compact-action" onClick={() => setEditingRealName(false)}>取消</button>
          ) : (
            <button className="ghost-button compact-action" onClick={() => setEditingRealName(true)}><BadgeCheck size={14} />编辑实名</button>
          )}
        </div>
        <div className="stat-grid dashboard-stat-grid compact-stats">
          <Metric value={formatMoney(profile?.walletBalance || 0)} label="钱包余额" />
          <Metric value={profile?.authStatus === 2 ? '已认证' : '待认证'} label="实名状态" />
          <Metric value="WEB" label="支付渠道" />
        </div>
        {editingRealName ? (
          <>
            {Object.keys(realName).map((key) => (
              <Field key={key} label={fieldLabel(key)} value={realName[key]} onChange={(value) => setRealName((draft) => ({ ...draft, [key]: value }))} />
            ))}
            <button className="solid-button fill profile-save-button" onClick={saveRealName}><BadgeCheck size={15} />提交实名</button>
          </>
        ) : (
          <div className="profile-view-list wallet-readonly-list">
            {Object.keys(realName).map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{realName[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="glass-panel work-card wide profile-edit-card">
        <div className="card-head">
          <h2>资料与发票入口</h2>
          {editingProfile ? (
            <button className="ghost-button compact-action" onClick={() => setEditingProfile(false)}>取消</button>
          ) : (
            <button className="ghost-button compact-action" onClick={() => setEditingProfile(true)}><Settings size={14} />编辑资料</button>
          )}
        </div>
        {editingProfile ? (
          <>
            <div className="form-grid wallet-profile-form">
              {Object.keys(form).map((key) => (
                <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
              ))}
            </div>
            <button className="solid-button profile-save-button" onClick={saveProfile}><ShieldCheck size={15} />同步资料</button>
          </>
        ) : (
          <div className="profile-view-list wallet-readonly-list">
            {Object.keys(form).map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{form[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="invoice-panel">
          <CreditCard size={18} />
          <div><strong>发票抬头</strong><p>小程序发票页无独立后端接口，网页保留入口与本地表单，订单支付数据仍走订单接口。</p></div>
        </div>
      </section>
    </div>
  )
}

function SupportBoard({ orders, profile, onComplaint, onEvaluate }) {
  const candidates = orders?.length ? orders : []
  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card wide">
        <div className="card-head"><div><span className="section-kicker">服务反馈</span><h2>评价投诉</h2></div><MessageSquare size={21} /></div>
        {candidates.length ? (
          <div className="order-list support-order-list">
            {candidates.slice(0, 4).map((order) => (
              <article className="order-card glass-panel support-order-card" key={order.id || order.orderNo}>
                <div className="order-line">
                  <div>
                    <h3>{order.startName} <ChevronRight size={16} /> {order.endName}</h3>
                    <p>{order.orderNo || `#${order.id}`}</p>
                    <p className="order-time-line"><Clock size={13} />{formatOrderTime(order)}</p>
                  </div>
                  <StatusBadge value={order.orderStatus} />
                </div>
                <div className="order-actions">
                  <button className="ghost-button" onClick={() => onEvaluate(order)}><Star size={16} />评价</button>
                  <button className="ghost-button" onClick={() => onComplaint(order)}><AlertTriangle size={16} />投诉</button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState text="暂无可评价订单，完成一次行程后会出现在这里。" />}
      </section>
      <section className="glass-panel work-card">
        <div className="card-head"><h2>帮助与设置</h2><HelpCircle size={21} /></div>
        <div className="coverage-grid support-grid">
          {['常见问题', '紧急联系人', '隐私设置', '行程安全', '消息通知', '版本信息'].map((item) => <span key={item}><CheckCircle size={15} />{item}</span>)}
        </div>
        <InfoPanel title="当前用户" items={[
          ['昵称', profile?.nickname || '-'],
          ['紧急联系人', profile?.emergencyContact || '-'],
          ['消息通知', '已开启'],
          ['服务语言', profile?.defaultLanguage || 'zh-CN']
        ]} />
      </section>
    </div>
  )
}

function DriverWallet({ dashboard, onWithdraw, onCertify }) {
  const [withdraw, setWithdraw] = useState({ applyAmount: 50, bankName: '中国银行', bankAccount: '6222 **** 2026' })
  const [cert, setCert] = useState({
    licenseNo: dashboard?.profile?.licenseNo || 'DRV20260514001',
    plateNo: dashboard?.vehicle?.plateNo || '冀R·A8888',
    brand: dashboard?.vehicle?.brand || '比亚迪',
    modelName: dashboard?.vehicle?.modelName || '汉 EV',
    color: dashboard?.vehicle?.color || '橙白',
    seatCount: dashboard?.vehicle?.seatCount || 5,
    insuranceExpireDate: '2026-12-31',
    annualInspectExpireDate: '2026-12-31',
    vehicleLicenseImageUrl: dashboard?.vehicle?.vehicleLicenseImageUrl || '/uploads/demo/vehicle.jpg',
    driverLicenseImageUrl: dashboard?.vehicle?.driverLicenseImageUrl || '/uploads/demo/driver.jpg'
  })

  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card">
        <div className="card-head"><h2>钱包提现</h2><DollarSign size={21} /></div>
        <div className="stat-grid dashboard-stat-grid compact-stats">
          <Metric value={formatMoney(dashboard?.profile?.withdrawableIncome || 0)} label="可提现余额" />
          <Metric value={dashboard?.pendingWithdraw?.length || 0} label="待审核提现" />
        </div>
        <Field label="提现金额" value={withdraw.applyAmount} onChange={(value) => setWithdraw((draft) => ({ ...draft, applyAmount: value }))} />
        <Field label="开户行" value={withdraw.bankName} onChange={(value) => setWithdraw((draft) => ({ ...draft, bankName: value }))} />
        <Field label="银行卡号" value={withdraw.bankAccount} onChange={(value) => setWithdraw((draft) => ({ ...draft, bankAccount: value }))} />
        <button className="solid-button fill" onClick={() => onWithdraw(withdraw)}><Wallet size={16} />提交提现</button>
      </section>
      <section className="glass-panel work-card wide">
        <div className="card-head"><h2>司机资质</h2><BadgeCheck size={21} /></div>
        <div className="form-grid">
          {Object.keys(cert).map((key) => (
            <Field key={key} label={fieldLabel(key)} value={cert[key]} onChange={(value) => setCert((draft) => ({ ...draft, [key]: value }))} />
          ))}
        </div>
        <button className="solid-button" onClick={() => onCertify(cert)}><ShieldCheck size={16} />提交资质</button>
      </section>
    </div>
  )
}

function DriverProfileBoard({ dashboard, user, onProfile }) {
  const [form, setForm] = useState({
    nickname: user?.nickname || '',
    cityCode: dashboard?.profile?.cityCode || '310100',
    licenseNo: dashboard?.profile?.licenseNo || 'DRV20260514001'
  })
  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card">
        <div className="card-head"><h2>司机资料</h2><User size={21} /></div>
        {Object.keys(form).map((key) => (
          <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
        ))}
        <button className="solid-button fill" onClick={() => onProfile(form)}><ShieldCheck size={16} />同步司机资料</button>
      </section>
      <section className="glass-panel work-card wide">
        <div className="card-head"><h2>设置与播报</h2><Settings size={21} /></div>
        <div className="coverage-grid">
          {['轨迹上报', '语音播报', '听单提醒', '自动刷新', '服务城市', '版本检查'].map((item) => <span key={item}><CheckCircle size={15} />{item}</span>)}
        </div>
        <InfoPanel title="司机状态" items={[
          ['服务状态', statusLabel[dashboard?.profile?.serviceStatus] || '-'],
          ['今日订单', dashboard?.orders?.length || 0],
          ['资质状态', dashboard?.servicePermission?.message || '-'],
          ['资料接口', 'PUT /driver/profile']
        ]} />
      </section>
    </div>
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

function MessageBoard({ messages, orders = [], onRefresh, onReadMessage }) {
  const [expanded, setExpanded] = useState(false)
  const [readFilter, setReadFilter] = useState('UNREAD')
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [readOverrides, setReadOverrides] = useState({})
  const list = useMemo(
    () => enrichMessagesWithOrders(messages || [], orders || []).map((item, index) => ({
      ...item,
      __isRead: readOverrides[item.id] ?? isMessageRead(item, index)
    })),
    [messages, orders, readOverrides]
  )
  const filteredList = useMemo(() => {
    if (readFilter === 'READ') return list.filter((item) => item.__isRead)
    if (readFilter === 'UNREAD') return list.filter((item) => !item.__isRead)
    return list
  }, [list, readFilter])
  const limit = 4
  const hasMore = filteredList.length > limit
  const visibleMessages = expanded || !hasMore ? filteredList : filteredList.slice(0, limit)
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
            </div>
          </section>
        </div>
      </div>,
      document.body
    )
    : null

  const openMessage = async (item) => {
    const nextItem = item.__isRead ? item : { ...item, __isRead: true, unread: false, read: true, isRead: true, readStatus: 'READ' }
    setSelectedMessage(nextItem)
    if (!item.__isRead) {
      setReadOverrides((value) => ({ ...value, [item.id]: true }))
      try {
        await onReadMessage?.(item)
      } catch (error) {}
    }
  }

  return (
    <section className="glass-panel work-card message-board-card">
      <div className="card-head">
        <div><span className="section-kicker">消息</span><h2>消息中心</h2></div>
        <div className="message-head-actions">
          <div className="message-read-tabs">
            <button className={readFilter === 'UNREAD' ? 'active is-unread' : 'is-unread'} type="button" onClick={() => setReadFilter('UNREAD')}>未读</button>
            <button className={readFilter === 'READ' ? 'active is-read' : 'is-read'} type="button" onClick={() => setReadFilter('READ')}>已读</button>
          </div>
          {hasMore && (
            <button className="message-list-toggle head-toggle" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? '收起' : `展开 ${filteredList.length} 条`}
              <ChevronRight size={12} className={expanded ? 'rotated' : ''} />
            </button>
          )}
          <button className="icon-button" onClick={onRefresh}><RefreshCw size={15} /></button>
        </div>
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
                </div>
              </article>
            ))}
          </div>
        </>
      ) : <EmptyState text="暂无消息。" />}
      {messageDetailModal}
    </section>
  )
}

function ProfileBoard({ profile, mode, onProfile }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    nickname: profile?.nickname || '',
    realName: profile?.realName || '',
    emergencyContact: profile?.emergencyContact || '',
    emergencyPhone: profile?.emergencyPhone || ''
  })

  useEffect(() => {
    setForm({
      nickname: profile?.nickname || '',
      realName: profile?.realName || '',
      emergencyContact: profile?.emergencyContact || '',
      emergencyPhone: profile?.emergencyPhone || ''
    })
  }, [profile])

  const saveProfile = async () => {
    if (!onProfile) return
    await onProfile(form)
    setEditing(false)
  }

  return (
    <div className="dashboard-grid profile-edit-grid">
      <section className="glass-panel work-card profile-edit-card">
        <div className="card-head">
          <h2>资料</h2>
          {editing ? (
            <button className="ghost-button compact-action" onClick={() => setEditing(false)}>取消</button>
          ) : (
            <button className="ghost-button compact-action" onClick={() => setEditing(true)}><Settings size={14} />编辑资料</button>
          )}
        </div>
        <div className="profile-readonly-row">
          <span>手机号</span>
          <strong>{profile?.phone || '-'}</strong>
          <span>语言</span>
          <strong>{profile?.defaultLanguage || 'zh-CN'}</strong>
        </div>
        {editing ? (
          <>
            <div className="profile-form-grid">
              {Object.keys(form).map((key) => (
                <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
              ))}
            </div>
            {onProfile && (
              <button className="solid-button fill profile-save-button" onClick={saveProfile}>
                <ShieldCheck size={15} />保存资料
              </button>
            )}
          </>
        ) : (
          <div className="profile-view-list">
            {Object.keys(form).map((key) => (
              <div className="thin-row profile-view-row" key={key}>
                <span>{fieldLabel(key)}</span>
                <strong>{form[key] || '-'}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="glass-panel work-card wide profile-account-card">
        <div className="card-head"><h2>账户状态</h2><ShieldCheck size={21} /></div>
        <div className="stat-grid profile-status-grid dashboard-stat-grid compact-stats">
          <Metric value={formatMoney(profile?.walletBalance || profile?.withdrawableIncome || 0)} label={mode === 'USER' ? '钱包余额' : '可提现'} />
          <Metric value={profile?.authStatus === 2 ? '已认证' : '待完善'} label="实名状态" />
          <Metric value={profile?.cityCode || '默认'} label="服务城市" />
          <Metric value={profile?.defaultLanguage || 'zh-CN'} label="语言" />
        </div>
      </section>
    </div>
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

function StatusBadge({ value }) {
  const tone = statusTone[value] || 'muted'
  return <span className={`status-badge ${tone}`}>{statusLabel[value] || value || '-'}</span>
}

function ModeChip({ mode, message }) {
  const label = mode === 'backend' ? '后端同步' : mode === 'demo' ? '本地演示' : '连接中'
  return <span className={`mode-chip ${mode}`} title={message}><span />{label}</span>
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>
}

function MiniStat({ label, value }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>
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

function passengerOrderAction(action, order, token) {
  if (action === 'cancel') return api.cancelOrder(token, order.id, '乘客网页端取消')
  if (action === 'pickup') return api.pickupOrder(token, order.id)
  if (action === 'pay') return api.mockPay(token, order.id, order.payableAmount)
  if (action === 'evaluate') return api.evaluate(token, { orderId: order.id, score: 5, content: '网页端评价：体验顺滑，服务很好。' })
  if (action === 'complaint') return api.complaint(token, { orderId: order.id, content: '网页端提交投诉测试。' })
  return Promise.resolve()
}

function driverOrderAction(action, order, token) {
  if (action === 'start') return api.driverStart(token, order.id)
  if (action === 'pickup') return api.driverPickup(token, order.id)
  if (action === 'finish') return api.driverFinish(token, order.id, {
    actualDistanceKm: order.estimatedDistanceKm || 3,
    actualDurationMin: order.estimatedDurationMin || 15
  })
  return Promise.resolve()
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
    defaultLanguage: '语言',
    cityCode: '服务城市',
    applyAmount: '提现金额',
    bankName: '开户行',
    bankAccount: '银行卡号',
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
