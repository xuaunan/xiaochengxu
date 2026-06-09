<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import {
  Activity,
  BadgeCheck,
  BellRing,
  Clock3,
  CircleDollarSign,
  FileCheck2,
  LifeBuoy,
  LocateFixed,
  MapPinned,
  Navigation,
  Power,
  RadioTower,
  Route,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  WalletCards
} from '@lucide/vue'
import DataTable, { type DataColumn } from '@/components/DataTable.vue'
import FeaturePanel from '@/components/FeaturePanel.vue'
import FlowTimeline from '@/components/FlowTimeline.vue'
import StatCard from '@/components/StatCard.vue'
import { authStatusLabel, orderStatusLabel, serviceTypeLabel } from '@/data/mockData'
import type { DesktopStore } from '@/composables/useDesktopState'
import type {
  DriverDocument,
  HelpTicket,
  Metric,
  RideOrder,
  WalletTransaction,
  WithdrawTicket
} from '@/types'

const props = defineProps<{
  desktop: DesktopStore
}>()

const withdrawAmount = shallowRef(500)
const driverTicketTitle = shallowRef('行驶证补传后需要加急审核')

const waitingOrders = computed(() => props.desktop.driverAvailableOrders.value)

const myOrders = computed(() =>
  props.desktop.dataset.orders.filter((order) => order.driverName === props.desktop.dataset.driver.name)
)

const driverMetrics = computed<Metric[]>(() => [
  { label: '今日收入', value: `¥${props.desktop.dataset.driver.todayIncome.toFixed(2)}`, delta: `${props.desktop.dataset.driver.todayOrders} 单`, tone: 'green' },
  { label: '账户余额', value: `¥${props.desktop.dataset.driver.balance.toFixed(2)}`, delta: '可提现', tone: 'orange' },
  { label: '服务评分', value: props.desktop.dataset.driver.rating.toFixed(2), delta: '近 30 天', tone: 'blue' },
  { label: '认证状态', value: authStatusLabel[props.desktop.dataset.driver.authStatus], delta: props.desktop.dataset.driver.enabled ? '账号正常' : '已禁用', tone: 'neutral' }
])

const serviceStatusLabel = computed(() => {
  if (props.desktop.dataset.driver.serviceStatus === 'ONLINE') return '在线听单'
  if (props.desktop.dataset.driver.serviceStatus === 'BUSY') return '服务中'
  return '暂停接单'
})

const driverSignals = computed(() => [
  { label: '派单池', value: `${waitingOrders.value.length} 单` },
  { label: '当前位置', value: props.desktop.dataset.driver.currentLocation },
  { label: '车辆', value: props.desktop.dataset.driver.vehicleNo },
  { label: '提现', value: `${props.desktop.visibleWithdraws.value.length} 笔` }
])

const orderColumns: DataColumn<RideOrder>[] = [
  { key: 'orderNo', label: '订单号', width: '18%' },
  { key: 'serviceType', label: '类型', width: '12%', format: (row) => serviceTypeLabel[row.serviceType] },
  { key: 'startName', label: '上车点', width: '18%' },
  { key: 'endName', label: '目的地', width: '18%' },
  { key: 'amount', label: '预计收入', width: '12%', align: 'right', format: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'status', label: '状态', width: '12%', format: (row) => orderStatusLabel[row.status] }
]

const transactionColumns: DataColumn<WalletTransaction>[] = [
  { key: 'title', label: '流水', width: '42%' },
  { key: 'type', label: '类型', width: '14%' },
  { key: 'amount', label: '金额', width: '14%', align: 'right', format: (row) => `${row.amount >= 0 ? '+' : '-'}¥${Math.abs(row.amount).toFixed(2)}` },
  { key: 'status', label: '状态', width: '14%' },
  { key: 'createdAt', label: '时间', width: '16%' }
]

const withdrawColumns: DataColumn<WithdrawTicket>[] = [
  { key: 'driverName', label: '司机', width: '20%' },
  { key: 'amount', label: '金额', width: '18%', align: 'right', format: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'channel', label: '渠道', width: '26%' },
  { key: 'status', label: '状态', width: '18%' },
  { key: 'createdAt', label: '时间', width: '16%' }
]

const documentColumns: DataColumn<DriverDocument>[] = [
  { key: 'documentType', label: '资料', width: '20%' },
  { key: 'status', label: '状态', width: '18%' },
  { key: 'remark', label: '说明', width: '42%' },
  { key: 'updatedAt', label: '更新时间', width: '16%' }
]

const helpColumns: DataColumn<HelpTicket>[] = [
  { key: 'category', label: '分类', width: '16%' },
  { key: 'title', label: '问题', width: '44%' },
  { key: 'status', label: '状态', width: '18%' },
  { key: 'createdAt', label: '时间', width: '18%' }
]
</script>

<template>
  <div class="workspace-grid">
    <section v-show="desktop.activeView.value === 'driver-dashboard'" class="hero-surface driver-hero">
      <div class="hero-surface__copy">
        <span class="soft-label">Driver Console</span>
        <h2>听单、接驾、送达、提现，司机侧闭环集中操作。</h2>
        <p>服务状态、派单池、当前行程、位置上报、收益结算、证件资料和提醒设置保持同步。</p>
        <div class="hero-chips">
          <span><RadioTower :size="15" />{{ serviceStatusLabel }}</span>
          <span><MapPinned :size="15" />{{ desktop.dataset.driver.currentLocation }}</span>
          <span><Clock3 :size="15" />{{ desktop.selectedOrder.value.pickupEta }}</span>
          <span><CircleDollarSign :size="15" />{{ desktop.dataset.driver.todayOrders }} 单</span>
        </div>
      </div>
      <div class="driver-card">
        <span class="driver-card__status" :class="{ 'is-online': desktop.dataset.driver.serviceStatus === 'ONLINE' }">
          {{ serviceStatusLabel }}
        </span>
        <span class="driver-card__avatar">{{ desktop.dataset.driver.avatarText }}</span>
        <strong>{{ desktop.dataset.driver.name }}</strong>
        <small>{{ desktop.dataset.driver.vehicleNo }} / {{ desktop.dataset.driver.vehicleModel }}</small>
        <div class="driver-card__route">
          <span>{{ desktop.selectedOrder.value.startName }}</span>
          <i></i>
          <span>{{ desktop.selectedOrder.value.endName }}</span>
        </div>
        <div class="driver-card__metrics">
          <span>
            <b>{{ desktop.dataset.driver.todayOrders }}</b>
            <small>今日单</small>
          </span>
          <span>
            <b>{{ desktop.dataset.driver.rating.toFixed(2) }}</b>
            <small>评分</small>
          </span>
        </div>
        <button class="primary-button" type="button" @click="desktop.toggleDriverService">
          <Power :size="16" />
          {{ desktop.dataset.driver.serviceStatus === 'ONLINE' ? '暂停听单' : '开始听单' }}
        </button>
      </div>
    </section>

    <div v-show="desktop.activeView.value === 'driver-dashboard'" class="stat-row">
      <StatCard v-for="metric in driverMetrics" :key="metric.label" :metric="metric" />
    </div>

    <FeaturePanel
      v-show="desktop.activeView.value === 'driver-dashboard'"
      title="听单工作台"
      subtitle="可接订单按搜索条件和司机可服务状态实时筛选。"
    >
      <div class="dispatch-console">
        <div>
          <span class="soft-label">Live Dispatch</span>
          <h3>{{ desktop.dataset.driver.name }} / {{ desktop.dataset.driver.vehicleModel }}</h3>
          <p>接单前看清路线、时间、金额和服务类型；接单后自动进入接驾执行页。</p>
        </div>
        <div class="dispatch-console__signals">
          <span v-for="item in driverSignals" :key="item.label">
            <small>{{ item.label }}</small>
            <b>{{ item.value }}</b>
          </span>
        </div>
      </div>
      <div class="driver-grid">
        <article v-for="order in waitingOrders" :key="order.id" class="dispatch-card">
          <div class="dispatch-card__top">
            <span class="status-chip">{{ serviceTypeLabel[order.serviceType] }}</span>
            <strong>{{ order.pickupEta }}</strong>
          </div>
          <h3>{{ order.startName }} -> {{ order.endName }}</h3>
          <p>{{ order.distanceKm }} km / {{ order.durationMin }} 分钟 / ¥{{ order.amount.toFixed(2) }}</p>
          <div class="dispatch-card__map" aria-label="订单路线预览">
            <span></span>
            <i></i>
            <b></b>
            <Activity :size="15" />
          </div>
          <div class="action-strip">
            <button class="primary-button" type="button" @click="desktop.driverAccept(order.id)">接单</button>
            <button class="soft-button danger-text" type="button" @click="desktop.driverReject(order.id)">拒单</button>
          </div>
        </article>
        <article v-if="!waitingOrders.length" class="dispatch-card dispatch-card--empty">
          <BellRing :size="22" />
          <h3>当前没有新的派单</h3>
          <p>保持在线后，新订单会进入这里。</p>
        </article>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'driver-trip'"
      title="当前行程执行"
      subtitle="接驾、上车、到达、完单和轨迹上报会写入审计记录。"
    >
      <div class="current-trip">
        <div class="trip-heading-row">
          <Navigation :size="22" />
          <div>
            <h3>{{ desktop.selectedOrder.value.startName }} -> {{ desktop.selectedOrder.value.endName }}</h3>
            <p>{{ orderStatusLabel[desktop.selectedOrder.value.status] }} / 乘客 {{ desktop.selectedOrder.value.passengerName }}</p>
          </div>
        </div>
        <FlowTimeline :steps="desktop.selectedTimeline.value" />
        <div class="driver-location-card">
          <MapPinned :size="19" />
          <span>{{ desktop.dataset.driver.currentLocation }}</span>
          <small>{{ desktop.dataset.driver.longitude.toFixed(4) }}, {{ desktop.dataset.driver.latitude.toFixed(4) }}</small>
          <button class="soft-button" type="button" @click="desktop.reportDriverLocation">
            <LocateFixed :size="16" /> 上报位置
          </button>
        </div>
        <div class="action-strip">
          <button class="soft-button" type="button" @click="desktop.advanceOrder(desktop.selectedOrder.value.id, 'PICKING_UP')">出发接驾</button>
          <button class="soft-button" type="button" @click="desktop.advanceOrder(desktop.selectedOrder.value.id, 'IN_TRIP')">乘客上车</button>
          <button class="primary-button" type="button" @click="desktop.advanceOrder(desktop.selectedOrder.value.id, 'FINISHED')">完成行程</button>
        </div>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'driver-trip'"
      title="我的行程"
      subtitle="司机当前与历史订单可直接跟进状态。"
    >
      <DataTable :rows="myOrders" :columns="orderColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.selectOrder(Number(row.id))">
            <Route :size="15" /> 跟进
          </button>
          <button class="text-button" type="button" @click="desktop.advanceOrder(Number(row.id))">推进</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'driver-wallet'"
      title="收益与提现"
      subtitle="司机收入、提现申请和审核结果形成一条资金闭环。"
    >
      <div class="wallet-panel">
        <WalletCards :size="28" />
        <div>
          <span>可提现余额</span>
          <strong>¥{{ desktop.dataset.driver.balance.toFixed(2) }}</strong>
        </div>
        <label>
          <span>提现金额</span>
          <input v-model.number="withdrawAmount" type="number" min="1" />
        </label>
        <button class="primary-button" type="button" @click="desktop.submitWithdraw(withdrawAmount)">提交提现</button>
      </div>
      <div class="tabular-stack">
        <div class="section-title-inline">
          <CircleDollarSign :size="18" />
          <strong>司机流水</strong>
        </div>
        <DataTable :rows="desktop.driverTransactions.value" :columns="transactionColumns" />
        <div class="section-title-inline">
          <BadgeCheck :size="18" />
          <strong>提现单</strong>
        </div>
        <DataTable :rows="desktop.visibleWithdraws.value" :columns="withdrawColumns" />
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'driver-profile'"
      title="资料认证与消息"
      subtitle="证件、车辆、服务偏好、位置和客服问题都可直接维护。"
    >
      <div class="service-grid">
        <article class="object-card object-card--wide">
          <FileCheck2 :size="20" />
          <strong>资料完整度</strong>
          <span>{{ authStatusLabel[desktop.dataset.driver.authStatus] }} / {{ desktop.dataset.driver.enabled ? '账号正常' : '账号禁用' }}</span>
          <button class="soft-button" type="button" @click="desktop.submitHelpTicket('DRIVER', '认证', driverTicketTitle)">
            <LifeBuoy :size="16" /> 催办审核
          </button>
        </article>
        <article class="object-card object-card--wide">
          <Settings2 :size="20" />
          <strong>服务设置</strong>
          <span>{{ desktop.dataset.driver.serviceStatus }} / {{ desktop.dataset.driver.currentLocation }}</span>
          <button class="soft-button" type="button" @click="desktop.toggleDriverService">切换听单</button>
        </article>
      </div>

      <div class="tabular-stack">
        <div class="section-title-inline">
          <UploadCloud :size="18" />
          <strong>证件资料</strong>
        </div>
        <DataTable :rows="desktop.dataset.driverDocuments" :columns="documentColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.submitDriverDocument(Number(row.id))">提交</button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <SlidersHorizontal :size="18" />
          <strong>接单偏好</strong>
        </div>
        <div class="settings-grid">
          <button
            v-for="setting in desktop.dataset.driverSettings"
            :key="setting.key"
            class="setting-row"
            type="button"
            :class="{ 'is-enabled': setting.enabled }"
            @click="desktop.toggleDriverSetting(setting.key)"
          >
            <span>
              <strong>{{ setting.label }}</strong>
              <small>{{ setting.desc }}</small>
            </span>
            <b>{{ setting.enabled ? '开' : '关' }}</b>
          </button>
        </div>

        <div class="section-title-inline">
          <ShieldCheck :size="18" />
          <strong>司机客服单</strong>
        </div>
        <label class="inline-field">
          <span>工单标题</span>
          <input v-model="driverTicketTitle" type="text" />
        </label>
        <DataTable :rows="desktop.driverHelpTickets.value" :columns="helpColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.resolveHelpTicket(Number(row.id))">解决</button>
          </template>
        </DataTable>
      </div>
    </FeaturePanel>
  </div>
</template>
