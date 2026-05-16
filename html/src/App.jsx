import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

  const logout = (role) => {
    if (role === 'DRIVER') setDriverSession(null)
    if (role === 'USER') setPassengerSession(null)
    setView('portal')
  }

  return (
    <div className="app-shell">
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
          <div className="eyebrow"><Sparkles size={16} /> live taxi dispatch portal</div>
          <AnimatedHeadline text="橙色城市调度舱。" />
          <p>
            打开就是叫车现场：3D 城市道路在背景中流动，车辆沿路线靠近。乘客下单、司机听单、接驾、完单、支付、评价、优惠券、顺风车、实名和提现全部优先对齐项目现有接口。
          </p>
          <div className="dispatch-rail glass-panel">
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
            <Metric value="60fps" label="丝滑动效" />
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
          <div className="fleet-feed glass-panel">
            <span className="section-kicker">fleet pulse</span>
            <strong>{home.fleet?.serviceDriverCount ?? home.fleet?.busyDriverCount ?? 0} 辆车服务中</strong>
            <p>空闲 {home.fleet?.idleDriverCount ?? 0} 辆 · 在线合计 {home.fleet?.onlineDriverCount ?? 0} 辆</p>
          </div>
        </div>
      </section>

      <section className="portal-strip">
        <FeatureCard icon={Zap} title="真实同步" text="后端启动时直接连接 127.0.0.1:8080，同小程序共用订单、优惠券、司机状态、顺风车和鉴权。" />
        <FeatureCard icon={ShieldCheck} title="功能补齐" text="乘客端覆盖叫车、国际出行、钱包实名、评价投诉、优惠券、消息、帮助设置；司机端覆盖听单、行程、提现、资质、资料设置。" />
        <FeatureCard icon={Sparkles} title="高级动效" text="吸附式名片、3D 城市道路背景、文本入场动画、鼠标小车本体撞击和云块尾气。" />
      </section>

      <PortalFeatureMenu
        active={menu}
        setActive={setMenu}
        onPassenger={() => (hasPassenger ? onEnter('passenger') : onLogin('USER'))}
        onDriver={() => (hasDriver ? onEnter('driver') : onLogin('DRIVER'))}
      />

      <section className="quick-entry glass-panel">
        <div>
          <span className="section-kicker">Local backend</span>
          <h2>后端连接地址</h2>
          <p>默认对齐小程序配置。后端没启动也能用本地演示模式先看完整交互。</p>
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

function AnimatedHeadline({ text }) {
  return (
    <h1 className="animated-headline" aria-label={text} data-text={text}>
      {Array.from(text).map((char, index) => (
        <span key={`${char}-${index}`} style={{ '--d': `${index * 36}ms` }}>{char}</span>
      ))}
    </h1>
  )
}

const portalMenus = {
  passenger: {
    icon: User,
    title: '乘客功能',
    text: '小程序乘客端页面已拆成网页工作台：叫车、国际出行、订单、支付、评价、投诉、优惠券、钱包实名、顺风车、消息、帮助设置。',
    chips: ['叫车', '国际出行', '支付评价', '发票入口', '实名资料', '帮助设置']
  },
  driver: {
    icon: CarTaxiFront,
    title: '司机功能',
    text: '司机端同步听单、抢单、拒单、接驾、上车、完单、提现、资质提交、资料设置、消息与行程管理。',
    chips: ['听单大厅', '抢单拒单', '行程流转', '提现资质', '资料设置', '消息中心']
  },
  backend: {
    icon: ShieldCheck,
    title: '后台同步',
    text: '网页优先走 Spring Boot 后端：/auth、/orders、/coupons、/carpool、/driver、/messages；后端不可达时才进入本地演示。',
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
  const [toast, setToast] = useState('')
  const token = session?.token

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
    setTab('orders')
  }, '订单已提交，司机端听单大厅会同步出现')

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
          <CityMap booking={booking} estimate={estimate} compact operational />
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

      {tab === 'messages' && <MessageBoard messages={messages} onRefresh={load} />}
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
      {tab === 'profile' && <ProfileBoard profile={profile || session} mode="USER" />}
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
                <span className="section-kicker">Driver cockpit</span>
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
                <span className="section-kicker">Waiting orders</span>
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

      {tab === 'messages' && <MessageBoard messages={messages} onRefresh={load} />}
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

function CityMap({ booking, estimate, compact = false, operational = false }) {
  const tilt = useTiltCard({ maxX: 6, maxY: 9 })
  const route = calcRoute(booking.startId, booking.endId)
  const fallback = estimateLocalFare(booking.carTypeId, booking.serviceType, route.distanceKm, route.durationMin)
  const amount = estimate?.amount || fallback.amount
  const duration = estimate?.durationMin || route.durationMin
  const distance = estimate?.distanceKm || route.distanceKm
  const currency = estimate?.currencyCode || fallback.currencyCode
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
  return (
    <section className={`city-map map-card-v2 glass-panel tilt-card ${compact ? 'compact' : ''} ${operational ? 'operational-map' : ''}`} ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <div className="map-topline map-header-v2">
        <div>
          <span><MapPin size={15} />{route.start.name}</span>
          <small>{operational ? '腾讯地图' : '实时调度地图'}</small>
        </div>
        <strong>{formatMoney(amount, currency)}</strong>
      </div>
      {operational ? (
        <TencentRouteMap route={route} amount={amount} currency={currency} duration={duration} distance={distance} serviceType={booking.serviceType} />
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
          <span><Navigation size={15} />{operational ? '等待提交订单' : '智能派单'}</span>
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
  const start = route.start
  const end = route.end
  return (
    <div className="miniapp-map-fallback">
      <div className="miniapp-map-grid" />
      <div className="miniapp-map-water" />
      <div className="miniapp-map-road main"><span>迎宾路</span></div>
      <div className="miniapp-map-road cross"><span>学院大街</span></div>
      <div className="miniapp-map-road slim one" />
      <div className="miniapp-map-road slim two" />
      <div className="miniapp-map-poi hospital">三河妇幼</div>
      <div className="miniapp-map-poi mall">天洋广场</div>
      <svg className="miniapp-route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M28 60 L44 60 L44 48 L60 48 L72 40" />
      </svg>
      <div className="miniapp-map-pin start"><span>起</span><strong>{start.name}</strong></div>
      <div className="miniapp-map-pin end"><span>终</span><strong>{end.name}</strong></div>
      <div className="miniapp-map-scale">100 米</div>
    </div>
  )
}

function getTencentMapKey() {
  return import.meta.env?.VITE_TENCENT_MAP_KEY || localStorage.getItem('sunshine-tencent-map-key') || ''
}

function DashboardShell({ role, icon: Icon, apiMode, profile, tabs, tab, setTab, onLogout, onBack, children }) {
  return (
    <main className="dashboard-shell">
      <aside className="side-nav glass-panel">
        <button className="brand-mark" onClick={onBack}>
          <span className="brand-icon"><Icon size={24} /></span>
          <span><strong>{role}</strong><small>Sunshine Web</small></span>
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
            <span className="section-kicker">Live workspace</span>
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
          <span className="section-kicker">Orders</span>
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

function OrderList({ orders, footer, empty, limit }) {
  if (!orders?.length) return <EmptyState text={empty} />
  const visibleOrders = Number.isFinite(limit) ? orders.slice(0, limit) : orders
  return (
    <div className="order-list compact-order-list">
      {visibleOrders.map((order, index) => {
        const key = order.id || order.orderNo || index
        return (
        <article className="order-card glass-panel compact slim" key={key}>
          <div className="order-line">
            <div>
              <h3>{order.startName} <ChevronRight size={16} /> {order.endName}</h3>
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
  const scope = statusLabel[coupon.serviceType] || coupon.scope || coupon.serviceScope || '全场通用'
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
      <section className="glass-panel work-card wide">
        <div className="card-head">
          <div><span className="section-kicker">Carpool</span><h2>顺风车</h2></div>
          <div className="search-line">
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
  const [form, setForm] = useState({
    nickname: profile?.nickname || '',
    emergencyContact: profile?.emergencyContact || '',
    emergencyPhone: profile?.emergencyPhone || ''
  })
  const [realName, setRealName] = useState({
    realName: profile?.realName || '阳光乘客',
    idCard: profile?.idCard || '110101199901010011'
  })
  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card">
        <div className="card-head"><h2>钱包与实名</h2><Wallet size={21} /></div>
        <div className="stat-grid">
          <Metric value={formatMoney(profile?.walletBalance || 0)} label="钱包余额" />
          <Metric value={profile?.authStatus === 2 ? '已认证' : '待认证'} label="实名状态" />
          <Metric value="WEB" label="支付渠道" />
        </div>
        {Object.keys(realName).map((key) => (
          <Field key={key} label={fieldLabel(key)} value={realName[key]} onChange={(value) => setRealName((draft) => ({ ...draft, [key]: value }))} />
        ))}
        <button className="solid-button fill" onClick={() => onRealName(realName)}><BadgeCheck size={16} />提交实名</button>
      </section>
      <section className="glass-panel work-card wide">
        <div className="card-head"><h2>资料编辑与发票入口</h2><Settings size={21} /></div>
        <div className="form-grid">
          {Object.keys(form).map((key) => (
            <Field key={key} label={fieldLabel(key)} value={form[key]} onChange={(value) => setForm((draft) => ({ ...draft, [key]: value }))} />
          ))}
        </div>
        <button className="solid-button" onClick={() => onProfile(form)}><ShieldCheck size={16} />同步资料</button>
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
        <div className="card-head"><div><span className="section-kicker">reviews / complaint</span><h2>评价投诉</h2></div><MessageSquare size={21} /></div>
        {candidates.length ? (
          <div className="order-list">
            {candidates.slice(0, 4).map((order) => (
              <article className="order-card glass-panel" key={order.id || order.orderNo}>
                <div className="order-line">
                  <div><h3>{order.startName} <ChevronRight size={16} /> {order.endName}</h3><p>{order.orderNo || `#${order.id}`}</p></div>
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
        <div className="stat-grid">
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

function MessageBoard({ messages, onRefresh }) {
  return (
    <section className="glass-panel work-card">
      <div className="card-head">
        <div><span className="section-kicker">Messages</span><h2>消息中心</h2></div>
        <button className="icon-button" onClick={onRefresh}><RefreshCw size={17} /></button>
      </div>
      {messages?.length ? messages.map((item) => (
        <article className="message-card" key={item.id}>
          <Bell size={18} />
          <div><strong>{item.title}</strong><p>{item.content}</p><small>{item.time}</small></div>
        </article>
      )) : <EmptyState text="暂无消息。" />}
    </section>
  )
}

function ProfileBoard({ profile, mode }) {
  return (
    <div className="dashboard-grid">
      <section className="glass-panel work-card">
        <div className="card-head"><h2>资料</h2><User size={21} /></div>
        <InfoPanel title={mode === 'USER' ? '乘客信息' : '司机信息'} items={[
          ['昵称', profile?.nickname || '-'],
          ['手机号', profile?.phone || '-'],
          ['角色', profile?.roleCode || mode],
          ['认证状态', statusLabel[profile?.authStatus] || profile?.authStatus || '已认证']
        ]} />
      </section>
      <section className="glass-panel work-card wide">
        <div className="card-head"><h2>账户状态</h2><ShieldCheck size={21} /></div>
        <div className="stat-grid profile-status-grid">
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

function LoginModal({ roleCode, onClose, onSwitch, onLogin }) {
  const [form, setForm] = useState({ phone: roleMeta[roleCode].phone, password: '123456' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const Icon = roleMeta[roleCode].icon

  useEffect(() => {
    setForm({ phone: roleMeta[roleCode].phone, password: '123456' })
    setError('')
  }, [roleCode])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin({ roleCode, ...form })
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <form className="login-modal glass-panel refract" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><XCircle size={20} /></button>
        <div className="login-orb"><Icon size={34} /></div>
        <span className="section-kicker">Sunshine account</span>
        <h2>{roleMeta[roleCode].label}</h2>
        <div className="role-switch">
          {Object.keys(roleMeta).map((role) => (
            <button type="button" key={role} className={roleCode === role ? 'active' : ''} onClick={() => onSwitch(role)}>
              {roleMeta[role].label.replace('登录', '')}
            </button>
          ))}
        </div>
        <label className="input-field"><Phone size={17} /><input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} /></label>
        <label className="input-field"><Lock size={17} /><input type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="solid-button fill" disabled={busy}>{busy ? '登录中...' : '进入工作台'}</button>
        <p className="modal-note">默认演示账号：{roleMeta[roleCode].phone} / 123456</p>
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
        <p>请选择对应身份进入完整网页工作台。</p>
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
      if (speed > 10 && now - lastSmoke > 52) {
        lastSmoke = now
        spawnSmoke(speed)
      }
      if (ref.current) {
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`
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
  return <article className="feature-card glass-panel"><Icon size={22} /><h3>{title}</h3><p>{text}</p></article>
}

function RoleCard({ icon: Icon, title, text, active, onClick }) {
  const tilt = useTiltCard({ maxX: 8, maxY: 10 })
  return (
    <button className="role-card glass-panel tilt-card" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} onClick={onClick}>
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
