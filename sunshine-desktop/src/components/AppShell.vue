<script setup lang="ts">
import {
  Activity,
  Bell,
  Car,
  ChevronRight,
  CloudSun,
  Command,
  Compass,
  Database,
  Gauge,
  LayoutDashboard,
  LogIn,
  MapPinned,
  Minus,
  MonitorCog,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  TicketPercent,
  UserRound,
  WalletCards,
  Wifi,
  X
} from '@lucide/vue'
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, type Component } from 'vue'
import ContextRail from '@/components/ContextRail.vue'
import { useDispatchDecision } from '@/composables/useDispatchDecision'
import type { ActiveView, AppMode, HealthStatus } from '@/types'
import type { DesktopStore } from '@/composables/useDesktopState'

const props = defineProps<{
  desktop: DesktopStore
}>()

const modeItems: Array<{ key: AppMode; label: string; desc: string }> = [
  { key: 'passenger', label: '乘客', desc: '叫车、支付、发票、评价' },
  { key: 'driver', label: '司机', desc: '听单、接驾、行程、提现' },
  { key: 'admin', label: '运营', desc: '用户、订单、营销、系统' }
]

const navItems = computed<Array<{ key: ActiveView; label: string; desc: string; icon: Component }>>(() => {
  if (props.desktop.mode.value === 'passenger') {
    return [
      { key: 'passenger-booking', label: '出行下单', desc: '地址、估价、派单', icon: UserRound },
      { key: 'passenger-trip', label: '行程订单', desc: '接驾、支付、发票', icon: Car },
      { key: 'passenger-services', label: '服务中心', desc: '顺风车、跨境、优惠', icon: TicketPercent },
      { key: 'passenger-profile', label: '我的账户', desc: '钱包、实名、消息', icon: WalletCards }
    ]
  }
  if (props.desktop.mode.value === 'driver') {
    return [
      { key: 'driver-dashboard', label: '听单工作台', desc: '在线状态、附近订单', icon: Gauge },
      { key: 'driver-trip', label: '行程执行', desc: '接驾、上车、完单', icon: Car },
      { key: 'driver-wallet', label: '收益钱包', desc: '收入、提现、结算', icon: WalletCards },
      { key: 'driver-profile', label: '资料消息', desc: '认证、车辆、提醒', icon: Bell }
    ]
  }
  return [
    { key: 'admin-dashboard', label: '运营大盘', desc: '指标、健康、资金流', icon: LayoutDashboard },
    { key: 'admin-workbench', label: '待办审核', desc: '消息、用户、司机', icon: MonitorCog },
    { key: 'admin-orders', label: '订单营销', desc: '订单、优惠、跨境', icon: TicketPercent },
    { key: 'admin-system', label: '系统配置', desc: '公告、版本、开关', icon: Settings }
  ]
})

const activeNavItem = computed(() =>
  navItems.value.find((item) => item.key === props.desktop.activeView.value)
)

const shellModeClass = computed(() => `app-shell--${props.desktop.mode.value}`)
const commandOpen = shallowRef(false)

const roleMeta = computed(() => {
  if (props.desktop.mode.value === 'passenger') {
    return {
      cue: 'Passenger Desk',
      title: '乘客服务驾驶舱',
      desc: '把叫车、接驾、支付、发票、评价和售后串成一条桌面级服务链路。',
      primary: props.desktop.passengerBalance.value,
      primaryLabel: '钱包余额',
      secondary: String(props.desktop.passengerRideStats.value[0]?.value || 0),
      secondaryLabel: '累计行程',
      icon: UserRound
    }
  }
  if (props.desktop.mode.value === 'driver') {
    return {
      cue: 'Driver Cockpit',
      title: '司机听单驾驶舱',
      desc: '在线、派单、接驾、完单、收益和资料审核集中到稳定的桌面操作台。',
      primary: `¥${props.desktop.dataset.driver.todayIncome.toFixed(2)}`,
      primaryLabel: '今日收入',
      secondary: props.desktop.dataset.driver.rating.toFixed(2),
      secondaryLabel: '服务评分',
      icon: Car
    }
  }
  return {
    cue: 'Operations Center',
    title: '运营调度驾驶舱',
    desc: '订单、司机、资金、风控、营销和系统配置保持同屏可见、可处理、可追踪。',
    primary: props.desktop.dataset.metrics[1]?.value || '¥0',
    primaryLabel: '实时流水',
    secondary: String(props.desktop.riskChecklistCount.value),
    secondaryLabel: '风险事项',
    icon: LayoutDashboard
  }
})

const livePulseCopy = computed(() => {
  if (props.desktop.health.mode === 'live') return '真实服务在线'
  return '离线演示可操作'
})

const dispatchDecision = useDispatchDecision(props.desktop)

const healthLabels: Partial<Record<keyof HealthStatus, string>> = {
  backend: '业务接口',
  database: '数据状态',
  web: '网页端',
  admin: '管理端',
  frontend: '客户端'
}

const offlineItems = computed(() =>
  Object.entries(props.desktop.health)
    .filter(([key, value]) => key !== 'mode' && key !== 'checkedAt' && value === false)
    .map(([key]) => healthLabels[key as keyof HealthStatus] || key)
)

const searchInput = useTemplateRef<HTMLInputElement>('searchInput')

type CommandAction = {
  id: string
  section: string
  label: string
  desc: string
  icon: Component
  disabled?: boolean
  run: () => void
}

const roleLabelMap: Record<AppMode, string> = {
  passenger: '乘客',
  driver: '司机',
  admin: '运营'
}

const currentModeLabel = computed(() => roleLabelMap[props.desktop.mode.value])

const commandActions = computed<CommandAction[]>(() => {
  const firstDispatchOrder = props.desktop.dataset.orders.find(
    (order) => ['CREATED', 'DISPATCHING'].includes(order.status) && !order.driverName
  )
  const firstUnreadMessage = props.desktop.dataset.messages.find((item) => !item.read)

  const roleCommands: CommandAction[] = modeItems.map((item) => ({
    id: `role-${item.key}`,
    section: '角色',
    label: `切换到${item.label}`,
    desc: item.desc,
    icon: item.key === 'passenger' ? UserRound : item.key === 'driver' ? Car : LayoutDashboard,
    run: () => props.desktop.setMode(item.key)
  }))

  const viewCommands: CommandAction[] = navItems.value.map((item) => ({
    id: `view-${item.key}`,
    section: `${currentModeLabel.value}视图`,
    label: item.label,
    desc: item.desc,
    icon: item.icon,
    run: () => props.desktop.setView(item.key)
  }))

  const baseCommands: CommandAction[] = [
    {
      id: 'refresh-health',
      section: '连接',
      label: '刷新业务连接',
      desc: props.desktop.health.mode === 'live' ? '重新检查接口和数据状态' : `当前离线：${offlineItems.value.join('、') || '业务接口'}`,
      icon: RefreshCw,
      disabled: props.desktop.busy.value,
      run: () => void props.desktop.refreshHealth()
    },
    {
      id: 'login-role',
      section: '连接',
      label: `登录${currentModeLabel.value}角色`,
      desc: props.desktop.backendBaseUrl.value,
      icon: LogIn,
      disabled: props.desktop.busy.value,
      run: () => void props.desktop.loginRole(props.desktop.mode.value)
    }
  ]

  if (props.desktop.mode.value === 'passenger') {
    return [
      ...roleCommands,
      ...viewCommands,
      ...baseCommands,
      {
        id: 'passenger-advance',
        section: '乘客动作',
        label: '推进当前行程',
        desc: props.desktop.selectedOrder.value.orderNo,
        icon: Activity,
        run: () => props.desktop.advanceOrder(props.desktop.selectedOrder.value.id)
      },
      {
        id: 'passenger-pay',
        section: '乘客动作',
        label: '完成当前订单支付',
        desc: props.desktop.selectedOrder.value.payStatus === 'PAID' ? '订单已支付' : '写入钱包与资金流水',
        icon: WalletCards,
        run: () => props.desktop.payOrder(props.desktop.selectedOrder.value.id)
      },
      {
        id: 'passenger-invoice',
        section: '乘客动作',
        label: '申请当前订单发票',
        desc: props.desktop.selectedOrder.value.invoiceStatus || '待申请',
        icon: TicketPercent,
        run: () => props.desktop.applyInvoice(props.desktop.selectedOrder.value.id)
      }
    ]
  }

  if (props.desktop.mode.value === 'driver') {
    return [
      ...roleCommands,
      ...viewCommands,
      ...baseCommands,
      {
        id: 'driver-toggle-service',
        section: '司机动作',
        label: props.desktop.dataset.driver.serviceStatus === 'ONLINE' ? '暂停听单' : '开始听单',
        desc: `${props.desktop.dataset.driver.currentLocation} / ${props.desktop.dataset.driver.vehicleNo}`,
        icon: Gauge,
        run: props.desktop.toggleDriverService
      },
      {
        id: 'driver-accept-first',
        section: '司机动作',
        label: '接收派单池首单',
        desc: firstDispatchOrder ? `${firstDispatchOrder.startName} -> ${firstDispatchOrder.endName}` : '当前没有可接订单',
        icon: Car,
        disabled: !firstDispatchOrder,
        run: () => {
          if (firstDispatchOrder) props.desktop.driverAccept(firstDispatchOrder.id)
        }
      },
      {
        id: 'driver-report-location',
        section: '司机动作',
        label: '上报当前位置',
        desc: props.desktop.dataset.driver.currentLocation,
        icon: MapPinned,
        run: props.desktop.reportDriverLocation
      }
    ]
  }

  return [
    ...roleCommands,
    ...viewCommands,
    ...baseCommands,
    {
      id: 'admin-refresh-dashboard',
      section: '运营动作',
      label: '刷新运营大盘',
      desc: '同步订单、流水、在线司机',
      icon: LayoutDashboard,
      disabled: props.desktop.busy.value,
      run: props.desktop.refreshAdminDashboard
    },
    {
      id: 'admin-handle-message',
      section: '运营动作',
      label: '处理第一条待办',
      desc: firstUnreadMessage?.title || '当前没有未读待办',
      icon: MonitorCog,
      disabled: !firstUnreadMessage,
      run: () => {
        if (firstUnreadMessage) props.desktop.handleImportantMessage(firstUnreadMessage.id)
      }
    },
    {
      id: 'admin-broadcast',
      section: '运营动作',
      label: '发送平台广播',
      desc: '写入全端消息与审计记录',
      icon: ShieldCheck,
      run: props.desktop.broadcastMessage
    }
  ]
})

const filteredCommands = computed(() => {
  const query = props.desktop.query.value.trim().toLowerCase()
  const commands = commandActions.value.filter((item) => {
    if (!query) return true
    return [item.label, item.desc, item.section].some((field) => field.toLowerCase().includes(query))
  })
  return commands.slice(0, 12)
})

const commandSections = computed(() => {
  const sections: Array<{ name: string; items: CommandAction[] }> = []
  filteredCommands.value.forEach((item) => {
    let section = sections.find((entry) => entry.name === item.section)
    if (!section) {
      section = { name: item.section, items: [] }
      sections.push(section)
    }
    section.items.push(item)
  })
  return sections
})

const latestAudit = computed(() => props.desktop.dataset.auditEvents[0])

function runCommand(command: CommandAction) {
  if (command.disabled) return
  command.run()
  props.desktop.query.value = ''
  commandOpen.value = false
}

function handleSearchFocus() {
  commandOpen.value = true
}

function handleCommandFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget)) return
  commandOpen.value = false
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    const command = filteredCommands.value.find((item) => !item.disabled)
    if (command && commandOpen.value) {
      event.preventDefault()
      runCommand(command)
    }
  }
  if (event.key === 'Escape') {
    commandOpen.value = false
  }
}

function controlWindow(action: 'minimize' | 'maximize' | 'close') {
  void window.sunshineDesktop?.controlWindow(action)
}

function handleKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault()
    commandOpen.value = true
    searchInput.value?.focus()
  }
  if ((event.ctrlKey || event.metaKey) && key === 'r') {
    event.preventDefault()
    void props.desktop.refreshHealth()
  }
  if (event.altKey && ['1', '2', '3'].includes(event.key)) {
    event.preventDefault()
    props.desktop.setMode(event.key === '1' ? 'passenger' : event.key === '2' ? 'driver' : 'admin')
  }
  if (event.key === 'Escape' && props.desktop.confirmation.open) {
    props.desktop.cancelConfirmation()
  }
  if (event.key === 'Escape' && commandOpen.value) {
    commandOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-shell" :class="shellModeClass">
    <div class="ambient-road-network" aria-hidden="true">
      <span class="ambient-road-network__route"></span>
      <span class="ambient-road-network__node ambient-road-network__node--a"></span>
      <span class="ambient-road-network__node ambient-road-network__node--b"></span>
    </div>

    <header class="titlebar">
      <div class="titlebar__drag">
        <div class="traffic-copy">
          <span class="traffic-copy__mark"></span>
          <strong>阳光出行桌面端</strong>
          <small>{{ roleMeta.cue }}</small>
        </div>
      </div>
      <div class="window-actions">
        <button class="icon-button" aria-label="最小化窗口" type="button" @click="controlWindow('minimize')">
          <Minus :size="15" />
        </button>
        <button class="icon-button" aria-label="最大化窗口" type="button" @click="controlWindow('maximize')">
          <Square :size="13" />
        </button>
        <button class="icon-button icon-button--danger" aria-label="关闭窗口" type="button" @click="controlWindow('close')">
          <X :size="16" />
        </button>
      </div>
    </header>

    <aside class="sidebar">
      <div class="brand-block">
        <span class="brand-block__kicker">
          <CloudSun :size="14" />
          SUNSHINE TRAVEL
        </span>
        <div class="brand-block__heading">
          <component :is="roleMeta.icon" :size="26" />
          <h1>{{ roleMeta.title }}</h1>
        </div>
        <p>{{ roleMeta.desc }}</p>
        <div class="brand-metrics" aria-label="当前角色摘要">
          <span>
            <strong>{{ roleMeta.primary }}</strong>
            <small>{{ roleMeta.primaryLabel }}</small>
          </span>
          <span>
            <strong>{{ roleMeta.secondary }}</strong>
            <small>{{ roleMeta.secondaryLabel }}</small>
          </span>
        </div>
      </div>

      <div class="mode-switch" role="tablist" aria-label="角色切换">
        <button
          v-for="item in modeItems"
          :key="item.key"
          class="mode-switch__item"
          :class="{ 'is-active': desktop.mode.value === item.key }"
          type="button"
          role="tab"
          :aria-selected="desktop.mode.value === item.key"
          @click="desktop.setMode(item.key)"
        >
          <span>
            <i class="role-dot" aria-hidden="true"></i>
            {{ item.label }}
          </span>
          <small>{{ item.desc }}</small>
        </button>
      </div>

      <nav class="side-nav" aria-label="功能导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="side-nav__item"
          :class="{ 'is-active': desktop.activeView.value === item.key }"
          type="button"
          :aria-current="desktop.activeView.value === item.key ? 'page' : undefined"
          @click="desktop.setView(item.key)"
        >
          <component :is="item.icon" :size="18" />
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.desc }}</small>
          </span>
          <ChevronRight :size="16" class="side-nav__chevron" />
        </button>
      </nav>

      <div class="connection-card" :class="{ 'is-live': desktop.health.mode === 'live' }">
        <div class="connection-card__head">
          <span class="status-light" :class="{ 'is-live': desktop.health.mode === 'live' }"></span>
          <strong>{{ livePulseCopy }}</strong>
        </div>
        <p>
          {{
            desktop.health.mode === 'live'
              ? '已连接业务服务与数据状态。'
              : `未连接：${offlineItems.join('、') || 'backend'}`
          }}
        </p>
        <small>上次检查：{{ desktop.health.checkedAt }}</small>
        <div class="connection-card__grid" aria-label="服务连接状态">
          <span :class="{ 'is-ok': desktop.health.backend }"><Database :size="13" />接口</span>
          <span :class="{ 'is-ok': desktop.health.database }"><Activity :size="13" />数据</span>
          <span :class="{ 'is-ok': desktop.health.web }"><Wifi :size="13" />网页</span>
          <span :class="{ 'is-ok': desktop.health.admin }"><ShieldCheck :size="13" />后台</span>
        </div>
      </div>
    </aside>

    <main class="workspace">
      <div v-if="desktop.busy.value" class="workspace-busy-bar" aria-hidden="true"></div>
      <div class="workspace-toolbar">
        <div class="toolbar-title" aria-live="polite">
          <span class="toolbar-title__icon">
            <component :is="activeNavItem?.icon || Compass" :size="16" />
          </span>
          <strong>{{ activeNavItem?.label }}</strong>
          <small>{{ activeNavItem?.desc }}</small>
        </div>
        <div class="command-search" @focusout="handleCommandFocusOut">
          <label class="search-box" :class="{ 'is-command-open': commandOpen }">
            <Search :size="18" />
            <input
              ref="searchInput"
              v-model="desktop.query.value"
              type="search"
              placeholder="搜索订单、用户、司机、功能..."
              aria-label="搜索订单、用户、司机、功能"
              aria-haspopup="listbox"
              :aria-expanded="commandOpen"
              @focus="handleSearchFocus"
              @keydown="handleSearchKeydown"
            />
          </label>
          <Transition name="command-menu">
            <div v-if="commandOpen" class="command-menu" role="listbox" aria-label="桌面命令中心">
              <div class="command-menu__summary">
                <span>
                  <Command :size="14" />
                  {{ currentModeLabel }}命令中心
                </span>
                <small v-if="latestAudit">{{ latestAudit.action }} / {{ latestAudit.result }}</small>
              </div>
              <div v-if="commandSections.length" class="command-menu__groups">
                <section v-for="section in commandSections" :key="section.name" class="command-group">
                  <strong>{{ section.name }}</strong>
                  <button
                    v-for="command in section.items"
                    :key="command.id"
                    class="command-item"
                    :class="{ 'is-disabled': command.disabled }"
                    type="button"
                    role="option"
                    :disabled="command.disabled"
                    @click="runCommand(command)"
                  >
                    <span class="command-item__icon">
                      <component :is="command.icon" :size="16" />
                    </span>
                    <span class="command-item__copy">
                      <b>{{ command.label }}</b>
                      <small>{{ command.desc }}</small>
                    </span>
                  </button>
                </section>
              </div>
              <div v-else class="command-menu__empty">没有匹配的命令</div>
            </div>
          </Transition>
        </div>
        <div class="toolbar-actions">
          <span class="command-pill">
            <Command :size="14" />
            {{ desktop.mode.value === 'admin' ? '调度' : desktop.mode.value === 'driver' ? '听单' : '叫车' }}
          </span>
          <input
            class="base-url-input"
            :value="desktop.backendBaseUrl.value"
            aria-label="业务服务地址"
            @change="desktop.updateBaseUrl(($event.target as HTMLInputElement).value)"
          />
          <button class="soft-button" type="button" :disabled="desktop.busy.value" @click="desktop.refreshHealth">
            <RefreshCw :size="16" /> 刷新连接
          </button>
          <button class="primary-button" type="button" :disabled="desktop.busy.value" @click="desktop.loginRole(desktop.mode.value)">
            <LogIn :size="16" /> 登录当前角色
          </button>
        </div>
      </div>

      <div class="workspace-status-strip" aria-label="桌面端实时状态">
        <span class="workspace-status-strip__item workspace-status-strip__item--decision">
          <Gauge :size="15" />
          <b>调度决策 {{ dispatchDecision.confidence }}%</b>
          <small>{{ dispatchDecision.rows[3]?.value || '等待调度' }} / {{ dispatchDecision.statusCopy }}</small>
          <i class="workspace-status-strip__meter" aria-hidden="true">
            <em :style="{ width: `${dispatchDecision.confidence}%` }"></em>
          </i>
        </span>
        <span class="workspace-status-strip__item">
          <MapPinned :size="15" />
          <b>{{ desktop.selectedOrder.value.startName }} -> {{ desktop.selectedOrder.value.endName }}</b>
        </span>
        <span class="workspace-status-strip__item">
          <Activity :size="15" />
          <b>{{ desktop.selectedTimeline.value.find((item) => item.current)?.label || '准备中' }}</b>
        </span>
        <span class="workspace-status-strip__item">
          <ShieldCheck :size="15" />
          <b>{{ livePulseCopy }}</b>
        </span>
      </div>

      <slot />
    </main>

    <ContextRail :desktop="desktop" />

    <Transition name="toast">
      <div v-if="desktop.toast.value" class="toast" role="status">
        {{ desktop.toast.value }}
      </div>
    </Transition>

    <Transition name="modal-fade">
      <div
        v-if="desktop.confirmation.open"
        class="modal-backdrop"
        role="presentation"
        @click.self="desktop.cancelConfirmation"
      >
        <section class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="desktop.confirmation.title">
          <span class="soft-label" :class="{ 'soft-label--danger': desktop.confirmation.tone === 'danger' }">
            {{ desktop.confirmation.tone === 'danger' ? '需要确认' : '确认操作' }}
          </span>
          <h2>{{ desktop.confirmation.title }}</h2>
          <p>{{ desktop.confirmation.body }}</p>
          <div class="confirm-dialog__actions">
            <button class="soft-button" type="button" @click="desktop.cancelConfirmation">取消</button>
            <button
              class="primary-button"
              :class="{ 'primary-button--danger': desktop.confirmation.tone === 'danger' }"
              type="button"
              @click="desktop.runConfirmation"
            >
              {{ desktop.confirmation.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </div>
</template>
