<script setup lang="ts">
import { computed } from 'vue'
import {
  Activity,
  BadgeCheck,
  Banknote,
  Clock3,
  Database,
  FileCheck2,
  Flag,
  ListChecks,
  MapPinned,
  Megaphone,
  Minus,
  Plus,
  RadioTower,
  ReceiptText,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  TicketPercent,
  UserCheck,
  WalletCards,
  Workflow,
  XCircle
} from '@lucide/vue'
import DataTable, { type DataColumn } from '@/components/DataTable.vue'
import FeaturePanel from '@/components/FeaturePanel.vue'
import StatCard from '@/components/StatCard.vue'
import { authStatusLabel, orderStatusLabel, payStatusLabel, serviceTypeLabel } from '@/data/mockData'
import type { DesktopStore } from '@/composables/useDesktopState'
import type {
  AuditEvent,
  ComplaintCase,
  Coupon,
  CurrencyRate,
  DispatchRule,
  DriverDocument,
  DriverProfile,
  InternationalOrder,
  InvoiceRecord,
  MessageItem,
  OperationChecklist,
  RideOrder,
  SystemConfig,
  SystemNotice,
  SystemVersion,
  UserAccount,
  WithdrawTicket
} from '@/types'

const props = defineProps<{
  desktop: DesktopStore
}>()

const desktop = props.desktop

const opsSignals = computed(() => [
  { label: '待处理', value: desktop.importantMessages.value.length },
  { label: '开放投诉', value: desktop.openComplaintCount.value },
  { label: '提现审核', value: desktop.pendingWithdrawCount.value },
  { label: '在线司机', value: desktop.dataset.drivers.filter((driver) => driver.serviceStatus !== 'OFFLINE').length }
])

const dispatchCoverage = computed(() =>
  Math.round(
    (desktop.dataset.dispatchRules.filter((rule) => rule.enabled).length / Math.max(desktop.dataset.dispatchRules.length, 1)) * 100
  )
)

const messageColumns: DataColumn<MessageItem>[] = [
  { key: 'title', label: '事项', width: '24%' },
  { key: 'source', label: '来源', width: '14%' },
  { key: 'content', label: '内容', width: '42%' },
  { key: 'createdAt', label: '时间', width: '12%' }
]

const userColumns: DataColumn<UserAccount>[] = [
  { key: 'name', label: '姓名', width: '15%' },
  { key: 'phone', label: '手机号', width: '17%' },
  { key: 'roleCode', label: '角色', width: '10%' },
  { key: 'authStatus', label: '实名', width: '12%', format: (row) => authStatusLabel[row.authStatus] },
  { key: 'enabled', label: '状态', width: '10%', format: (row) => (row.enabled ? '启用' : '禁用') },
  { key: 'lastLoginAt', label: '最后登录', width: '18%' }
]

const driverColumns: DataColumn<DriverProfile>[] = [
  { key: 'name', label: '司机', width: '14%' },
  { key: 'phone', label: '手机号', width: '16%' },
  { key: 'vehicleNo', label: '车牌', width: '13%' },
  { key: 'vehicleModel', label: '车型', width: '18%' },
  { key: 'serviceStatus', label: '服务', width: '11%' },
  { key: 'authStatus', label: '认证', width: '12%', format: (row) => authStatusLabel[row.authStatus] }
]

const orderColumns: DataColumn<RideOrder>[] = [
  { key: 'orderNo', label: '订单号', width: '16%' },
  { key: 'passengerName', label: '乘客', width: '10%' },
  { key: 'driverName', label: '司机', width: '10%', format: (row) => row.driverName || '未派单' },
  { key: 'serviceType', label: '类型', width: '11%', format: (row) => serviceTypeLabel[row.serviceType] },
  { key: 'amount', label: '金额', width: '10%', align: 'right', format: (row) => `${row.currencyCode === 'USD' ? '$' : '¥'}${row.amount.toFixed(2)}` },
  { key: 'status', label: '订单', width: '12%', format: (row) => orderStatusLabel[row.status] },
  { key: 'payStatus', label: '支付', width: '10%', format: (row) => payStatusLabel[row.payStatus] }
]

const couponColumns: DataColumn<Coupon>[] = [
  { key: 'name', label: '券名', width: '28%' },
  { key: 'scope', label: '范围', width: '13%', format: (row) => (row.scope === 'ALL' ? '全场' : serviceTypeLabel[row.scope]) },
  { key: 'amount', label: '权益', width: '12%', align: 'right', format: (row) => (row.type === 'DISCOUNT' ? `${row.amount} 折` : `¥${row.amount}`) },
  { key: 'received', label: '领取', width: '11%', align: 'right' },
  { key: 'used', label: '核销', width: '11%', align: 'right' },
  { key: 'status', label: '状态', width: '12%' }
]

const internationalColumns: DataColumn<InternationalOrder>[] = [
  { key: 'route', label: '路线', width: '30%' },
  { key: 'passengerName', label: '乘客', width: '12%' },
  { key: 'flightNo', label: '航班/船班', width: '18%' },
  { key: 'materialStatus', label: '资料', width: '16%' },
  { key: 'status', label: '状态', width: '12%', format: (row) => orderStatusLabel[row.status] }
]

const withdrawColumns: DataColumn<WithdrawTicket>[] = [
  { key: 'driverName', label: '司机', width: '18%' },
  { key: 'amount', label: '金额', width: '14%', align: 'right', format: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'channel', label: '渠道', width: '26%' },
  { key: 'status', label: '状态', width: '16%' },
  { key: 'createdAt', label: '时间', width: '16%' }
]

const complaintColumns: DataColumn<ComplaintCase>[] = [
  { key: 'orderNo', label: '订单', width: '22%' },
  { key: 'passengerName', label: '乘客', width: '14%' },
  { key: 'level', label: '等级', width: '10%' },
  { key: 'content', label: '内容', width: '34%' },
  { key: 'status', label: '状态', width: '12%' }
]

const invoiceColumns: DataColumn<InvoiceRecord>[] = [
  { key: 'orderNo', label: '订单', width: '20%' },
  { key: 'title', label: '抬头', width: '30%' },
  { key: 'kind', label: '类型', width: '10%' },
  { key: 'amount', label: '金额', width: '12%', align: 'right', format: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'status', label: '状态', width: '14%' }
]

const documentColumns: DataColumn<DriverDocument>[] = [
  { key: 'documentType', label: '资料', width: '18%' },
  { key: 'status', label: '状态', width: '16%' },
  { key: 'remark', label: '说明', width: '42%' },
  { key: 'updatedAt', label: '更新时间', width: '16%' }
]

const noticeColumns: DataColumn<SystemNotice>[] = [
  { key: 'title', label: '公告', width: '34%' },
  { key: 'clientType', label: '客户端', width: '20%' },
  { key: 'displayTimeRange', label: '展示时间', width: '20%' },
  { key: 'enabled', label: '状态', width: '12%', format: (row) => (row.enabled ? '启用' : '停用') }
]

const versionColumns: DataColumn<SystemVersion>[] = [
  { key: 'clientType', label: '客户端', width: '24%' },
  { key: 'version', label: '版本', width: '18%' },
  { key: 'forceUpdate', label: '强更', width: '14%', format: (row) => (row.forceUpdate ? '是' : '否') },
  { key: 'publishedAt', label: '发布时间', width: '22%' }
]

const configColumns: DataColumn<SystemConfig>[] = [
  { key: 'group', label: '分组', width: '12%' },
  { key: 'label', label: '参数', width: '20%' },
  { key: 'value', label: '说明', width: '42%' },
  { key: 'enabled', label: '状态', width: '12%', format: (row) => (row.enabled ? '启用' : '停用') }
]

const checklistColumns: DataColumn<OperationChecklist>[] = [
  { key: 'title', label: '事项', width: '42%' },
  { key: 'owner', label: '负责人', width: '14%' },
  { key: 'due', label: '时限', width: '16%' },
  { key: 'status', label: '状态', width: '14%' }
]

const dispatchRuleColumns: DataColumn<DispatchRule>[] = [
  { key: 'label', label: '规则', width: '20%' },
  { key: 'weight', label: '权重', width: '12%', align: 'right' },
  { key: 'desc', label: '说明', width: '42%' },
  { key: 'enabled', label: '状态', width: '12%', format: (row) => (row.enabled ? '启用' : '停用') }
]

const currencyColumns: DataColumn<CurrencyRate>[] = [
  { key: 'code', label: '币种', width: '18%' },
  { key: 'rate', label: '汇率', width: '18%', align: 'right', format: (row) => row.rate.toFixed(2) },
  { key: 'updatedAt', label: '更新时间', width: '24%' },
  { key: 'enabled', label: '状态', width: '18%', format: (row) => (row.enabled ? '启用' : '停用') }
]

const auditColumns: DataColumn<AuditEvent>[] = [
  { key: 'createdAt', label: '时间', width: '16%' },
  { key: 'actor', label: '操作者', width: '18%' },
  { key: 'action', label: '动作', width: '20%' },
  { key: 'target', label: '对象', width: '26%' },
  { key: 'result', label: '结果', width: '14%' }
]
</script>

<template>
  <div class="workspace-grid">
    <section v-show="desktop.activeView.value === 'admin-dashboard'" class="hero-surface admin-hero">
      <div class="hero-surface__copy">
        <span class="soft-label">Operations</span>
        <h2>运营后台不只在浏览器里，桌面端也能完整闭环。</h2>
        <p>大盘、待办、审核、资金、投诉、营销、跨境、公告、版本和参数都收束到一个稳定的 Windows 工作台。</p>
        <div class="hero-chips">
          <span><Activity :size="15" />待办 {{ desktop.importantMessages.value.length }}</span>
          <span><Flag :size="15" />投诉 {{ desktop.openComplaintCount.value }}</span>
          <span><Banknote :size="15" />提现 {{ desktop.pendingWithdrawCount.value }}</span>
          <span><Database :size="15" />{{ desktop.health.mode === 'live' ? '接口在线' : '离线演示' }}</span>
        </div>
      </div>
      <div class="ops-stack">
        <span class="status-chip">待办 {{ desktop.importantMessages.value.length }}</span>
        <strong>实时运营闭环</strong>
        <small>{{ desktop.health.mode === 'live' ? '业务接口在线' : '离线数据可演示' }}</small>
        <div class="ops-stack__meter" aria-label="运营链路状态">
          <span :style="{ '--value': `${dispatchCoverage}%` }"></span>
        </div>
        <div class="ops-stack__mini">
          <span v-for="item in opsSignals" :key="item.label">
            <b>{{ item.value }}</b>
            <small>{{ item.label }}</small>
          </span>
        </div>
        <button class="soft-button" type="button" @click="desktop.broadcastMessage">
          <Send :size="16" /> 发送广播
        </button>
      </div>
    </section>

    <div v-show="desktop.activeView.value === 'admin-dashboard'" class="stat-row">
      <StatCard v-for="metric in desktop.dataset.metrics" :key="metric.label" :metric="metric" />
    </div>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-dashboard'"
      title="运营大盘"
      subtitle="订单、资金、司机在线和风险队列在同一屏联动。"
    >
      <template #actions>
        <button class="soft-button" type="button" @click="desktop.refreshAdminDashboard">
          <RotateCcw :size="16" /> 刷新大盘
        </button>
      </template>
      <div class="dashboard-split">
        <div class="ops-command-map" aria-label="运营调度态势">
          <span class="ops-command-map__road ops-command-map__road--a"></span>
          <span class="ops-command-map__road ops-command-map__road--b"></span>
          <span class="ops-command-map__route"></span>
          <span class="ops-command-map__driver ops-command-map__driver--a"><MapPinned :size="15" /></span>
          <span class="ops-command-map__driver ops-command-map__driver--b"><MapPinned :size="15" /></span>
          <div class="ops-command-map__panel">
            <small>Fleet Pulse</small>
            <strong>{{ desktop.dataset.drivers.length }} 辆车纳管</strong>
            <span><Clock3 :size="14" />派单规则 {{ dispatchCoverage }}%</span>
          </div>
        </div>
        <div class="chart-card" aria-label="订单趋势图">
          <span class="chart-card__bar" style="height: 56%"></span>
          <span class="chart-card__bar" style="height: 72%"></span>
          <span class="chart-card__bar" style="height: 48%"></span>
          <span class="chart-card__bar" style="height: 86%"></span>
          <span class="chart-card__bar" style="height: 64%"></span>
          <span class="chart-card__bar" style="height: 92%"></span>
        </div>
        <div class="log-list">
          <strong>资金与操作流</strong>
          <span v-for="log in desktop.dataset.financeLogs" :key="log">{{ log }}</span>
        </div>
      </div>
      <div class="section-title-inline">
        <ListChecks :size="18" />
        <strong>运营检查项</strong>
      </div>
      <DataTable :rows="desktop.dataset.operationChecklist" :columns="checklistColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.completeChecklist(Number(row.id))">完成</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-workbench'"
      title="重要消息"
      subtitle="投诉、提现、司机认证和发票处理统一进入待办。"
    >
      <template #actions>
        <button class="soft-button" type="button" @click="desktop.markAllMessagesRead">全部处理</button>
      </template>
      <DataTable :rows="desktop.importantMessages.value" :columns="messageColumns" empty-text="当前没有待处理事项">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.handleImportantMessage(Number(row.id))">处理</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-workbench'"
      title="用户与司机审核"
      subtitle="实名、司机资料、账号启停和密码重置都可以直接处理。"
    >
      <DataTable :rows="desktop.visibleUsers.value" :columns="userColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.auditUser(Number(row.id), true)">
            <ShieldCheck :size="15" /> 通过
          </button>
          <button class="text-button" type="button" @click="desktop.auditUser(Number(row.id), false)">驳回</button>
          <button class="text-button" type="button" @click="desktop.resetUserPassword(Number(row.id))">重置密码</button>
          <button class="text-button danger-text" type="button" @click="desktop.toggleUserEnabled(Number(row.id))">
            {{ row.enabled ? '禁用' : '启用' }}
          </button>
        </template>
      </DataTable>
      <div class="section-title-inline">
        <UserCheck :size="18" />
        <strong>司机资料</strong>
      </div>
      <DataTable :rows="desktop.dataset.drivers" :columns="driverColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.auditUser(Number(row.userId), true)">通过认证</button>
        </template>
      </DataTable>
      <div class="section-title-inline">
        <FileCheck2 :size="18" />
        <strong>证件审核</strong>
      </div>
      <DataTable :rows="desktop.dataset.driverDocuments" :columns="documentColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.reviewDriverDocument(Number(row.id), true)">通过</button>
          <button class="text-button danger-text" type="button" @click="desktop.reviewDriverDocument(Number(row.id), false)">驳回</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-workbench'"
      title="资金、投诉与发票"
      subtitle="高风险事项按照资金、服务、票据三条队列处理。"
    >
      <div class="tabular-stack">
        <div class="section-title-inline">
          <WalletCards :size="18" />
          <strong>提现审核</strong>
        </div>
        <DataTable :rows="desktop.visibleWithdraws.value" :columns="withdrawColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.resolveWithdraw(Number(row.id), true)">通过</button>
            <button class="text-button danger-text" type="button" @click="desktop.resolveWithdraw(Number(row.id), false)">驳回</button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <Flag :size="18" />
          <strong>投诉处理</strong>
        </div>
        <DataTable :rows="desktop.visibleComplaints.value" :columns="complaintColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.handleComplaintCase(Number(row.id), false)">跟进</button>
            <button class="text-button" type="button" @click="desktop.handleComplaintCase(Number(row.id), true)">关闭</button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <ReceiptText :size="18" />
          <strong>发票审核</strong>
        </div>
        <DataTable :rows="desktop.dataset.invoices" :columns="invoiceColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.processInvoice(Number(row.id), true)">开具</button>
            <button class="text-button danger-text" type="button" @click="desktop.processInvoice(Number(row.id), false)">驳回</button>
          </template>
        </DataTable>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-orders'"
      title="订单管理"
      subtitle="订单状态调整、退款、发票和投诉处理保留即时结果。"
    >
      <DataTable :rows="desktop.visibleOrders.value" :columns="orderColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.advanceOrder(Number(row.id))">
            <BadgeCheck :size="15" /> 推进
          </button>
          <button class="text-button danger-text" type="button" @click="desktop.refundOrder(Number(row.id))">退款</button>
          <button class="text-button" type="button" @click="desktop.applyInvoice(Number(row.id))">
            <ReceiptText :size="15" /> 开票
          </button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-orders'"
      title="营销中心"
      subtitle="优惠券模板、发放、启停和核销数据集中管理。"
    >
      <template #actions>
        <button class="soft-button" type="button" @click="desktop.createCoupon">
          <Plus :size="16" /> 新建券
        </button>
      </template>
      <DataTable :rows="desktop.visibleCoupons.value" :columns="couponColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.toggleCoupon(Number(row.id))">
            <TicketPercent :size="15" /> {{ row.status === 'ACTIVE' ? '暂停' : '启用' }}
          </button>
          <button class="text-button" type="button" @click="desktop.grantCoupon(Number(row.id))">发放</button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-orders'"
      title="跨境与派单规则"
      subtitle="跨境订单资料、汇率开关和派单权重在同一运营面板调节。"
    >
      <div class="tabular-stack">
        <div class="section-title-inline">
          <RadioTower :size="18" />
          <strong>跨境订单</strong>
        </div>
        <DataTable :rows="desktop.visibleInternationalOrders.value" :columns="internationalColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.syncInternationalOrder(Number(row.id))">更新</button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <Workflow :size="18" />
          <strong>派单规则</strong>
        </div>
        <DataTable :rows="desktop.dataset.dispatchRules" :columns="dispatchRuleColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.tuneDispatchWeight(Number(row.id), -5)">
              <Minus :size="14" /> 5
            </button>
            <button class="text-button" type="button" @click="desktop.tuneDispatchWeight(Number(row.id), 5)">
              <Plus :size="14" /> 5
            </button>
            <button class="text-button" type="button" @click="desktop.toggleDispatchRule(Number(row.id))">
              {{ row.enabled ? '停用' : '启用' }}
            </button>
          </template>
        </DataTable>

        <div class="section-title-inline">
          <Banknote :size="18" />
          <strong>外币汇率</strong>
        </div>
        <DataTable :rows="desktop.dataset.currencyRates" :columns="currencyColumns">
          <template #actions="{ row }">
            <button class="text-button" type="button" @click="desktop.toggleCurrencyRate(String(row.code))">
              {{ row.enabled ? '停用' : '启用' }}
            </button>
          </template>
        </DataTable>
      </div>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-system'"
      title="系统配置"
      subtitle="公告、版本、开关参数和桌面端离线队列统一维护。"
    >
      <div class="system-grid">
        <div>
          <div class="section-title-inline">
            <Megaphone :size="18" />
            <strong>系统公告</strong>
          </div>
          <DataTable :rows="desktop.dataset.notices" :columns="noticeColumns">
            <template #actions="{ row }">
              <button class="text-button" type="button" @click="desktop.saveSystemNotice(Number(row.id))">
                {{ row.enabled ? '停用' : '启用' }}
              </button>
            </template>
          </DataTable>
        </div>
        <div>
          <div class="section-title-inline">
            <ReceiptText :size="18" />
            <strong>版本发布</strong>
          </div>
          <DataTable :rows="desktop.dataset.versions" :columns="versionColumns">
            <template #actions="{ row }">
              <button class="text-button" type="button" @click="desktop.publishVersion(Number(row.id))">发布</button>
            </template>
          </DataTable>
          <button class="soft-button system-inline-action" type="button" @click="desktop.createVersionPlan">
            <Plus :size="16" /> 新建版本计划
          </button>
        </div>
      </div>
      <div class="section-title-inline">
        <SlidersHorizontal :size="18" />
        <strong>系统参数</strong>
      </div>
      <DataTable :rows="desktop.dataset.configs" :columns="configColumns">
        <template #actions="{ row }">
          <button class="text-button" type="button" @click="desktop.toggleSystemConfig(String(row.key))">
            {{ row.enabled ? '停用' : '启用' }}
          </button>
        </template>
      </DataTable>
    </FeaturePanel>

    <FeaturePanel
      v-show="desktop.activeView.value === 'admin-system'"
      title="操作审计"
      subtitle="关键动作按操作者、对象和结果保留追踪记录。"
    >
      <DataTable :rows="desktop.dataset.auditEvents" :columns="auditColumns">
        <template #actions>
          <span class="status-chip"><XCircle :size="13" /> 已记录</span>
        </template>
      </DataTable>
    </FeaturePanel>
  </div>
</template>
