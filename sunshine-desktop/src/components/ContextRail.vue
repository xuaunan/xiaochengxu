<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CircleDollarSign,
  Clock3,
  Database,
  Gauge,
  History,
  MapPinned,
  Navigation,
  ReceiptText,
  RefreshCw,
  Route,
  ShieldCheck,
  Wifi,
  WifiOff
} from '@lucide/vue'
import { computed } from 'vue'
import { useDispatchDecision } from '@/composables/useDispatchDecision'
import { orderStatusLabel, payStatusLabel, serviceTypeLabel } from '@/data/mockData'
import type { DesktopStore } from '@/composables/useDesktopState'

const props = defineProps<{
  desktop: DesktopStore
}>()

const modeCopy = computed(() => {
  if (props.desktop.mode.value === 'passenger') {
    return {
      title: '乘客链路',
      desc: '下单、接驾、支付、发票、评价和投诉保持一条连续状态线。',
      cue: 'Passenger'
    }
  }
  if (props.desktop.mode.value === 'driver') {
    return {
      title: '司机链路',
      desc: '关注听单、接单、接驾、完单和提现审核的实时闭环。',
      cue: 'Driver'
    }
  }
  return {
    title: '运营链路',
    desc: '把订单、资金、审核、公告和版本发布收束到可处理队列。',
    cue: 'Operations'
  }
})

const selectedOrder = computed(() => props.desktop.selectedOrder.value)

const selectedOrderFare = computed(() => {
  const order = selectedOrder.value
  return `${order.currencyCode === 'USD' ? '$' : '¥'}${order.amount.toFixed(2)}`
})

const liveSummary = computed(() => {
  if (props.desktop.mode.value === 'driver') {
    return [
      { label: '可接订单', value: props.desktop.driverAvailableOrders.value.length },
      { label: '今日行程', value: props.desktop.dataset.driver.todayOrders },
      { label: '提现队列', value: props.desktop.visibleWithdraws.value.length }
    ]
  }
  if (props.desktop.mode.value === 'admin') {
    return [
      { label: '待办消息', value: props.desktop.importantMessages.value.length },
      { label: '开放投诉', value: props.desktop.openComplaintCount.value },
      { label: '派单规则', value: props.desktop.dataset.dispatchRules.filter((item) => item.enabled).length }
    ]
  }
  return [
    { label: '我的订单', value: props.desktop.dataset.orders.filter((order) => order.passengerPhone === props.desktop.dataset.passenger.phone).length },
    { label: '可用券', value: props.desktop.dataset.coupons.filter((coupon) => coupon.status === 'ACTIVE').length },
    { label: '客服单', value: props.desktop.passengerHelpTickets.value.length }
  ]
})

const healthItems = computed(() => [
  { key: 'backend', label: '业务接口', ok: props.desktop.health.backend, icon: Database },
  { key: 'database', label: '数据状态', ok: props.desktop.health.database, icon: Gauge },
  { key: 'web', label: '网页端', ok: props.desktop.health.web, icon: Wifi },
  { key: 'admin', label: '管理端', ok: props.desktop.health.admin, icon: ShieldCheck }
])

const riskQueue = computed(() => [
  { label: '待办消息', value: props.desktop.unreadMessageCount.value, tone: props.desktop.unreadMessageCount.value ? 'danger' : 'calm' },
  { label: '实名审核', value: props.desktop.pendingReviewCount.value, tone: props.desktop.pendingReviewCount.value ? 'warning' : 'calm' },
  { label: '待支付订单', value: props.desktop.pendingPaymentCount.value, tone: props.desktop.pendingPaymentCount.value ? 'warning' : 'calm' }
])

const recentAuditEvents = computed(() => props.desktop.dataset.auditEvents.slice(0, 4))
const dispatchDecision = useDispatchDecision(props.desktop)

const quickActions = computed(() => {
  if (props.desktop.mode.value === 'passenger') {
    return [
      { label: '推进当前行程', icon: ArrowRight, action: () => props.desktop.advanceOrder(selectedOrder.value.id) },
      { label: '完成支付', icon: CircleDollarSign, action: () => props.desktop.payOrder(selectedOrder.value.id) },
      { label: '申请发票', icon: ReceiptText, action: () => props.desktop.applyInvoice(selectedOrder.value.id) }
    ]
  }
  if (props.desktop.mode.value === 'driver') {
    return [
      { label: props.desktop.dataset.driver.serviceStatus === 'ONLINE' ? '暂停听单' : '开始听单', icon: BellRing, action: props.desktop.toggleDriverService },
      { label: '出发接驾', icon: MapPinned, action: () => props.desktop.advanceOrder(selectedOrder.value.id, 'PICKING_UP') },
      { label: '完成行程', icon: BadgeCheck, action: () => props.desktop.advanceOrder(selectedOrder.value.id, 'FINISHED') }
    ]
  }
  return [
    { label: '刷新大盘', icon: RefreshCw, action: props.desktop.refreshAdminDashboard },
    { label: '处理待办', icon: BadgeCheck, action: () => props.desktop.handleImportantMessage(props.desktop.dataset.messages.find((item) => !item.read)?.id || 0) },
    { label: '更新公告', icon: BellRing, action: () => props.desktop.saveSystemNotice(props.desktop.dataset.notices[0]?.id || 0) }
  ]
})
</script>

<template>
  <aside class="context-rail" aria-label="当前工作上下文">
    <section class="context-card context-card--hero">
      <span class="soft-label">{{ modeCopy.cue }}</span>
      <h2>{{ modeCopy.title }}</h2>
      <p>{{ modeCopy.desc }}</p>
      <div class="rail-live-grid" aria-label="当前角色关键数据">
        <span v-for="item in liveSummary" :key="item.label">
          <b>{{ item.value }}</b>
          <small>{{ item.label }}</small>
        </span>
      </div>
      <div class="connection-pill" :class="{ 'is-live': desktop.health.mode === 'live' }">
        <component :is="desktop.health.mode === 'live' ? Wifi : WifiOff" :size="15" />
        <span>{{ desktop.health.mode === 'live' ? '真实服务在线' : '离线数据模式' }}</span>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>调度决策</strong>
        <span>{{ dispatchDecision.statusCopy }}</span>
      </div>
      <div class="dispatch-decision">
        <div class="dispatch-decision__meter" aria-label="当前调度置信度">
          <span :style="{ width: `${dispatchDecision.confidence}%` }"></span>
        </div>
        <div class="dispatch-decision__score">
          <strong>{{ dispatchDecision.confidence }}%</strong>
          <small>匹配置信度</small>
        </div>
        <div class="dispatch-decision__grid">
          <span v-for="item in dispatchDecision.rows" :key="item.label">
            <small>{{ item.label }}</small>
            <b>{{ item.value }}</b>
          </span>
        </div>
        <p>{{ dispatchDecision.note }}</p>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>当前订单</strong>
        <span>{{ selectedOrderFare }}</span>
      </div>
      <div class="rail-route-map" aria-label="当前路线小地图">
        <span class="rail-route-map__road rail-route-map__road--one"></span>
        <span class="rail-route-map__road rail-route-map__road--two"></span>
        <span class="rail-route-map__path"></span>
        <span class="rail-route-map__pin rail-route-map__pin--start"></span>
        <span class="rail-route-map__pin rail-route-map__pin--end"></span>
        <span class="rail-route-map__cab">
          <Navigation :size="13" />
        </span>
      </div>
      <div class="focus-order">
        <div>
          <small>订单号</small>
          <strong>{{ selectedOrder.orderNo }}</strong>
        </div>
        <div>
          <small>路线</small>
          <span>{{ selectedOrder.startName }} -> {{ selectedOrder.endName }}</span>
        </div>
        <div class="focus-order__grid">
          <span>
            <small>订单</small>
            <b>{{ orderStatusLabel[selectedOrder.status] }}</b>
          </span>
          <span>
            <small>支付</small>
            <b>{{ payStatusLabel[selectedOrder.payStatus] }}</b>
          </span>
          <span>
            <small>司机</small>
            <b>{{ selectedOrder.driverName || '匹配中' }}</b>
          </span>
          <span>
            <small>预计</small>
            <b>{{ selectedOrder.pickupEta }}</b>
          </span>
        </div>
        <div class="rail-route-meta">
          <span>
            <Route :size="14" />
            {{ serviceTypeLabel[selectedOrder.serviceType] }}
          </span>
          <span>{{ selectedOrder.distanceKm }} km / {{ selectedOrder.durationMin }} 分钟</span>
        </div>
        <ol class="rail-mini-timeline" aria-label="当前订单进度">
          <li
            v-for="step in desktop.selectedTimeline.value"
            :key="step.key"
            :class="{ 'is-done': step.done, 'is-current': step.current }"
          >
            <i aria-hidden="true"></i>
            <span>{{ step.label }}</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>快捷操作</strong>
        <span>即时反馈</span>
      </div>
      <div class="rail-actions">
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="rail-action"
          type="button"
          :disabled="desktop.busy.value"
          @click="action.action"
        >
          <component :is="action.icon" :size="16" />
          <span>{{ action.label }}</span>
        </button>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>风险队列</strong>
        <Clock3 :size="16" />
      </div>
      <div class="risk-list">
        <div v-for="item in riskQueue" :key="item.label" class="risk-item" :class="`risk-item--${item.tone}`">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>最近操作</strong>
        <History :size="16" />
      </div>
      <div class="recent-activity-list">
        <div v-for="event in recentAuditEvents" :key="event.id" class="recent-activity-item">
          <span>
            <b>{{ event.action }}</b>
            <small>{{ event.target }}</small>
          </span>
          <em>{{ event.result }}</em>
        </div>
      </div>
    </section>

    <section class="context-card">
      <div class="context-card__header">
        <strong>服务健康</strong>
        <span>{{ desktop.health.checkedAt }}</span>
      </div>
      <div class="health-list">
        <div v-for="item in healthItems" :key="item.key" class="health-item" :class="{ 'is-ok': item.ok }">
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
          <b>{{ item.ok ? '正常' : '离线' }}</b>
        </div>
      </div>
      <div v-if="desktop.health.mode !== 'live'" class="context-note">
        <AlertTriangle :size="15" />
        <span>业务服务不可用时，所有操作先保留在离线状态。</span>
      </div>
    </section>
  </aside>
</template>
