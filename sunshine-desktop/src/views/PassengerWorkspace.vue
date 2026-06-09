<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import {
  BadgeCheck,
  Banknote,
  CarTaxiFront,
  Clock3,
  CreditCard,
  FileText,
  HeartPulse,
  HelpCircle,
  History,
  Landmark,
  LifeBuoy,
  MapPin,
  MessageSquareWarning,
  Navigation,
  PhoneCall,
  ReceiptText,
  Route,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
  UsersRound,
  WalletCards,
  XCircle
} from '@lucide/vue'
import DataTable, { type DataColumn } from '@/components/DataTable.vue'
import FeaturePanel from '@/components/FeaturePanel.vue'
import FlowTimeline from '@/components/FlowTimeline.vue'
import StatCard from '@/components/StatCard.vue'
import { authStatusLabel, orderStatusLabel, payStatusLabel, serviceTypeLabel } from '@/data/mockData'
import type { DesktopStore } from '@/composables/useDesktopState'
import type {
  AddressFavorite,
  Coupon,
  HelpTicket,
  InvoiceRecord,
  ReviewRecord,
  RideOrder,
  ServiceType,
  WalletTransaction
} from '@/types'

const props = defineProps<{
  desktop: DesktopStore
}>()

const form = reactive({
  startName: '深圳北站',
  endName: '腾讯滨海大厦',
  serviceType: 'TAXI' as ServiceType
})

const rechargeAmount = shallowRef(200)
const supportTicketTitle = shallowRef('企业发票抬头需要人工校验')

const serviceOptions: Array<{ key: ServiceType; label: string }> = [
  { key: 'TAXI', label: serviceTypeLabel.TAXI },
  { key: 'CARPOOL', label: serviceTypeLabel.CARPOOL },
  { key: 'INTERNATIONAL', label: serviceTypeLabel.INTERNATIONAL }
]

const estimate = computed(() => {
  const base = form.serviceType === 'INTERNATIONAL' ? 86 : form.serviceType === 'CARPOOL' ? 42 : 58
  return {
    amount: base,
    distance: form.serviceType === 'INTERNATIONAL' ? '52.8 km' : form.serviceType === 'CARPOOL' ? '103.2 km' : '18.6 km',
    duration: form.serviceType === 'INTERNATIONAL' ? '70 分钟' : form.serviceType === 'CARPOOL' ? '96 分钟' : '34 分钟',
    currency: form.serviceType === 'INTERNATIONAL' ? 'USD' : 'CNY'
  }
})

const passengerStats = computed(() => props.desktop.passengerRideStats.value)

const serviceBrief = computed(() => {
  if (form.serviceType === 'INTERNATIONAL') {
    return {
      label: '跨境专车',
      desc: '资料校验、外币账单和跨境司机资质一起进入调度规则。',
      eta: '约 70 分钟',
      match: '跨境资质优先'
    }
  }
  if (form.serviceType === 'CARPOOL') {
    return {
      label: '顺风车',
      desc: '按路线重合度、座位和出发时间匹配可同行车主。',
      eta: '约 96 分钟',
      match: '顺路优先'
    }
  }
  return {
    label: '即时打车',
    desc: '按距离、评分和在线状态匹配附近司机。',
    eta: '约 34 分钟',
    match: '距离优先'
  }
})

const bookingSignals = computed(() => [
  { label: '派单策略', value: serviceBrief.value.match },
  { label: '预计时间', value: serviceBrief.value.eta },
  { label: '支付币种', value: estimate.value.currency },
  { label: '售后状态', value: props.desktop.selectedOrder.value.complaintStatus || '可追踪' }
])

const orderColumns: DataColumn<RideOrder>[] = [
  { key: 'orderNo', label: '订单号', width: '18%' },
  { key: 'serviceType', label: '类型', width: '12%', format: (row) => serviceTypeLabel[row.serviceType] },
  { key: 'startName', label: '起点', width: '16%' },
  { key: 'endName', label: '终点', width: '16%' },
  { key: 'amount', label: '金额', width: '10%', align: 'right', format: (row) => `${row.currencyCode === 'USD' ? '$' : '¥'}${row.amount.toFixed(2)}` },
  { key: 'status', label: '订单', width: '10%', format: (row) => orderStatusLabel[row.status] },
  { key: 'payStatus', label: '支付', width: '10%', format: (row) => payStatusLabel[row.payStatus] }
]

const couponColumns: DataColumn<Coupon>[] = [
  { key: 'name', label: '优惠券', width: '30%' },
  { key: 'scope', label: '范围', width: '16%', format: (row) => (row.scope === 'ALL' ? '全场通用' : serviceTypeLabel[row.scope]) },
  { key: 'threshold', label: '门槛', width: '12%', align: 'right', format: (row) => (row.threshold ? `¥${row.threshold}` : '无门槛') },
  { key: 'amount', label: '权益', width: '14%', align: 'right', format: (row) => (row.type === 'DISCOUNT' ? `${row.amount} 折` : `¥${row.amount}`) },
  { key: 'status', label: '状态', width: '12%' },
  { key: 'expiresAt', label: '有效期', width: '16%' }
]

const transactionColumns: DataColumn<WalletTransaction>[] = [
  { key: 'title', label: '流水', width: '42%' },
  { key: 'type', label: '类型', width: '14%' },
  { key: 'amount', label: '金额', width: '14%', align: 'right', format: (row) => `${row.amount >= 0 ? '+' : '-'}¥${Math.abs(row.amount).toFixed(2)}` },
  { key: 'status', label: '状态', width: '14%' },
  { key: 'createdAt', label: '时间', width: '16%' }
]

const invoiceColumns: DataColumn<InvoiceRecord>[] = [
  { key: 'orderNo', label: '订单', width: '24%' },
  { key: 'title', label: '抬头', width: '28%' },
  { key: 'kind', label: '类型', width: '12%' },
  { key: 'amount', label: '金额', width: '12%', align: 'right', format: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'status', label: '状态', width: '14%' }
]

const reviewColumns: DataColumn<ReviewRecord>[] = [
  { key: 'orderNo', label: '订单', width: '24%' },
  { key: 'targetName', label: '对象', width: '20%' },
  { key: 'rating', label: '评分', width: '12%', align: 'right', format: (row) => row.rating.toFixed(1) },
  { key: 'content', label: '内容', width: '34%' }
]

const helpColumns: DataColumn<HelpTicket>[] = [
  { key: 'category', label: '分类', width: '16%' },
  { key: 'title', label: '问题', width: '42%' },
  { key: 'status', label: '状态', width: '18%' },
  { key: 'createdAt', label: '时间', width: '18%' }
]

const favoriteColumns: DataColumn<AddressFavorite>[] = [
  { key: 'name', label: '地点', width: '24%' },
  { key: 'address', label: '地址', width: '42%' },
  { key: 'tag', label: '标签', width: '12%' },
  { key: 'lastUsedAt', label: '最近使用', width: '18%' }
]
</script>

<template>
  <div class="workspace-grid">
    <section v-show="desktop.activeView.value === 'passenger-booking'" class="hero-surface passenger-hero">
      <div class="hero-surface__copy">
        <span class="soft-label">Passenger Flow</span>
        <h2>乘客从下单到开票，全链路集中处理。</h2>
        <p>地址、预估价、派单、接驾、支付、发票、评价、投诉、钱包和客服状态保持在同一个桌面工作台里。</p>
        <div class="hero-chips">
          <span><CarTaxiFront :size="15" />{{ serviceBrief.label }}</span>
          <span><Route :size="15" />{{ serviceBrief.match }}</span>
          <span><Clock3 :size="15" />{{ estimate.duration }}</span>
          <span><ShieldCheck :size="15" />售后可追踪</span>
        </div>
      </div>
      <div class="route-card" aria-label="路线预览">
        <div class="route-card__chrome" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="route-card__map">
          <span class="route-card__road route-card__road--one"></span>
          <span class="route-card__road route-card__road--two"></span>
          <span class="route-card__road route-card__road--three"></span>
          <span class="route-line"></span>
          <span class="route-card__cab">
            <Navigation :size="16" />
          </span>
          <span class="route-point route-point--start"></span>
          <span class="route-point route-point--end"></span>
          <span class="route-card__eta">
            <b>{{ estimate.duration }}</b>
            <small>预计到达</small>
          </span>
        </div>
        <div class="route-card__stops">
          <span>
            <i class="route-card__pin route-card__pin--start"></i>
            <b>{{ form.startName }}</b>
            <small>上车点</small>
          </span>
          <span>
            <i class="route-card__pin route-card__pin--end"></i>
            <b>{{ form.endName }}</b>
            <small>目的地</small>
          </span>
        </div>
        <div class="route-card__meta">
          <strong>{{ estimate.currency === 'USD' ? '$' : '¥' }}{{ estimate.amount }}</strong>
          <span>{{ estimate.distance }} / {{ estimate.duration }}</span>
        </div>
        <div class="route-card__signals">
          <span v-for="item in bookingSignals" :key="item.label">
            <small>{{ item.label }}</small>
            <b>{{ item.value }}</b>
          </span>
        </div>
      </div>
    </section>

    <div v-show="desktop.activeView.value === 'passenger-booking'" class="stat-row">
      <StatCard v-for="metric in desktop.dataset.metrics" :key="metric.label" :metric="metric" />
    </div>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-booking'"
      title="即时叫车"
      subtitle="输入起终点后生成预估费用，并把订单直接送入派单链路。"
    >
      <div class="booking-command">
        <div>
          <span class="soft-label">{{ serviceBrief.label }}</span>
          <h3>{{ form.startName }} -> {{ form.endName }}</h3>
          <p>{{ serviceBrief.desc }}</p>
        </div>
        <div class="booking-command__fare">
          <small>预估费用</small>
          <strong>{{ estimate.currency === 'USD' ? '$' : '¥' }}{{ estimate.amount }}</strong>
          <span>{{ estimate.distance }} / {{ estimate.duration }}</span>
        </div>
      </div>
      <div class="booking-form">
        <label>
          <span>出发地</span>
          <input v-model="form.startName" type="text" />
        </label>
        <label>
          <span>目的地</span>
          <input v-model="form.endName" type="text" />
        </label>
        <div class="segmented">
          <button
            v-for="item in serviceOptions"
            :key="item.key"
            type="button"
            :class="{ 'is-active': form.serviceType === item.key }"
            @click="form.serviceType = item.key"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="booking-form__summary">
          <MapPin :size="18" />
          <span>{{ estimate.distance }}，预计 {{ estimate.duration }}，费用 {{ estimate.currency === 'USD' ? '$' : '¥' }}{{ estimate.amount }}</span>
        </div>
        <button class="primary-button" type="button" @click="desktop.createPassengerOrder(form)">立即叫车</button>
      </div>
      <div class="section-title-inline">
        <History :size="18" />
        <strong>常用地址</strong>
      </div>
      <DataTable :rows="desktop.dataset.favorites" :columns="favoriteColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="form.startName = String(row.name)">设为出发地</button>
          <button class="text-button" type="button" @click="form.endName = String(row.name)">设为目的地</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-trip'"
      title="当前行程"
      subtitle="接驾、行程、结算和售后动作会即时改变右侧订单状态。"
    >
      <div class="current-trip">
        <div>
          <span class="soft-label">{{ serviceTypeLabel[desktop.selectedOrder.value.serviceType] }}</span>
          <h3>{{ desktop.selectedOrder.value.startName }} -> {{ desktop.selectedOrder.value.endName }}</h3>
          <p>
            {{ orderStatusLabel[desktop.selectedOrder.value.status] }} /
            {{ payStatusLabel[desktop.selectedOrder.value.payStatus] }} /
            司机 {{ desktop.selectedOrder.value.driverName || '匹配中' }}
          </p>
        </div>
        <FlowTimeline :steps="desktop.selectedTimeline.value" />
        <div class="action-strip">
          <button class="soft-button" type="button" @click="desktop.advanceOrder(desktop.selectedOrder.value.id)">推进状态</button>
          <button class="soft-button" type="button" @click="desktop.payOrder(desktop.selectedOrder.value.id)">
            <CreditCard :size="16" /> 支付
          </button>
          <button class="soft-button" type="button" @click="desktop.applyInvoice(desktop.selectedOrder.value.id)">
            <FileText :size="16" /> 发票
          </button>
          <button class="soft-button" type="button" @click="desktop.submitReview(desktop.selectedOrder.value.id)">
            <Star :size="16" /> 评价
          </button>
          <button class="soft-button danger-text" type="button" @click="desktop.submitComplaint(desktop.selectedOrder.value.id)">
            <MessageSquareWarning :size="16" /> 投诉
          </button>
          <button class="soft-button danger-text" type="button" @click="desktop.cancelOrder(desktop.selectedOrder.value.id)">
            <XCircle :size="16" /> 取消
          </button>
        </div>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-trip'"
      title="订单与历史"
      subtitle="订单、支付、退款、发票和售后状态在一张表里连续跟进。"
    >
      <DataTable :rows="desktop.visibleOrders.value" :columns="orderColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.selectOrder(Number(row.id))">查看</button>
          <button class="text-button" type="button" @click="desktop.payOrder(Number(row.id))">支付</button>
          <button class="text-button danger-text" type="button" @click="desktop.cancelOrder(Number(row.id))">取消</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-services'"
      title="优惠券中心"
      subtitle="优惠券领取、核销和适用范围可以直接在桌面端核对。"
    >
      <DataTable :rows="desktop.visibleCoupons.value" :columns="couponColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.receiveCoupon(Number(row.id))">
            <Ticket :size="15" /> 领取
          </button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-services'"
      title="顺风车与国际出行"
      subtitle="城际拼车和跨境订单的报名、资料和履约状态集中展示。"
    >
      <div class="service-grid">
        <article v-for="trip in desktop.dataset.carpoolTrips" :key="trip.id" class="object-card">
          <UsersRound :size="20" />
          <strong>{{ trip.startName }} -> {{ trip.endName }}</strong>
          <span>{{ trip.departTime }} / {{ trip.seats }} 座 / ¥{{ trip.price }} / {{ trip.applications }} 人申请</span>
          <button class="soft-button" type="button" @click="desktop.applyCarpool(trip.id)">申请同行</button>
        </article>
        <article v-for="order in desktop.visibleInternationalOrders.value" :key="order.id" class="object-card">
          <MapPin :size="20" />
          <strong>{{ order.route }}</strong>
          <span>{{ order.flightNo }} / {{ order.materialStatus }} / ${{ order.amount }}</span>
          <button class="soft-button" type="button" @click="desktop.syncInternationalOrder(order.id)">更新资料</button>
        </article>
        <button class="primary-button" type="button" @click="desktop.publishCarpool">发布顺风车</button>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-profile'"
      title="我的账户"
      subtitle="钱包、实名、安全、发票、评价和客服单统一沉淀到个人账户。"
    >
      <div class="insight-strip">
        <article v-for="item in passengerStats" :key="item.label" class="insight-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </article>
      </div>

      <div class="profile-grid">
        <div class="profile-card">
          <UserRound :size="22" />
          <strong>{{ desktop.dataset.passenger.name }}</strong>
          <span>{{ desktop.dataset.passenger.phone }}</span>
          <small>实名状态：{{ authStatusLabel[desktop.dataset.passenger.authStatus] }}</small>
        </div>
        <div class="profile-card">
          <WalletCards :size="22" />
          <strong>{{ desktop.passengerBalance.value }}</strong>
          <span>钱包余额</span>
          <small>{{ desktop.dataset.passenger.points }} 积分</small>
        </div>
        <div class="profile-card">
          <ShieldCheck :size="22" />
          <strong>{{ desktop.dataset.passenger.emergencyContact }}</strong>
          <span>紧急联系人</span>
          <button class="text-button" type="button" @click="desktop.addEmergencyContact">切换联系人</button>
        </div>
        <div class="profile-card">
          <HelpCircle :size="22" />
          <strong>{{ desktop.unreadMessageCount.value }}</strong>
          <span>未读通知</span>
          <small>订单、优惠券、公告提醒</small>
        </div>
      </div>

      <div class="ledger-grid">
        <section class="ledger-card">
          <div class="section-title-inline">
            <Banknote :size="18" />
            <strong>钱包充值</strong>
          </div>
          <label class="inline-field">
            <span>充值金额</span>
            <input v-model.number="rechargeAmount" type="number" min="1" />
          </label>
          <button class="primary-button" type="button" @click="desktop.rechargeWallet(rechargeAmount)">充值到余额</button>
        </section>
        <section class="ledger-card">
          <div class="section-title-inline">
            <LifeBuoy :size="18" />
            <strong>客服工单</strong>
          </div>
          <label class="inline-field">
            <span>问题标题</span>
            <input v-model="supportTicketTitle" type="text" />
          </label>
          <button class="soft-button" type="button" @click="desktop.submitHelpTicket('PASSENGER', '发票', supportTicketTitle)">提交工单</button>
        </section>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'passenger-profile'"
      title="账户记录"
      subtitle="资金、发票、评价和客服进度都能追溯到具体订单。"
    >
      <div class="tabular-stack">
        <div class="section-title-inline">
          <Landmark :size="18" />
          <strong>钱包流水</strong>
        </div>
        <DataTable :rows="desktop.activePassengerWallet.value" :columns="transactionColumns" />

        <div class="section-title-inline">
          <ReceiptText :size="18" />
          <strong>发票记录</strong>
        </div>
        <DataTable :rows="desktop.passengerInvoices.value" :columns="invoiceColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.processInvoice(Number(row.id), true)">
              <BadgeCheck :size="15" /> 标记开具
            </button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <Star :size="18" />
          <strong>评价记录</strong>
        </div>
        <DataTable :rows="desktop.passengerReviews.value" :columns="reviewColumns" />

        <div class="section-title-inline">
          <HeartPulse :size="18" />
          <strong>帮助与安全</strong>
        </div>
        <DataTable :rows="desktop.passengerHelpTickets.value" :columns="helpColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.resolveHelpTicket(Number(row.id))">解决</button>
            <button class="text-button" type="button" @click="desktop.submitHelpTicket('PASSENGER', '安全', '夜间行程安全确认')">
              <PhoneCall :size="15" /> 安全回访
            </button>
          </template>
        </DataTable>
      </div>
    </FeaturePanel>
  </div>
</template>
