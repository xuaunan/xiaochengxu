<template>
  <section class="page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">订单中心</span>
        <h3 class="panel-title">订单管理</h3>
        <p class="panel-subtitle">统一查看订单状态、行程进度和顺风车补充信息。</p>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="query.keyword"
          placeholder="搜索订单号、起点或终点"
          clearable
          style="width: 260px"
          @keyup.enter="loadOrders"
        />
        <el-select v-model="query.status" clearable placeholder="订单状态" style="width: 150px">
          <el-option label="待派单" value="DISPATCHING" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="接驾中" value="PICKING_UP" />
          <el-option label="行程中" value="IN_TRIP" />
          <el-option label="已完成" value="FINISHED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-select v-model="query.serviceType" clearable placeholder="业务类型" style="width: 150px">
          <el-option label="即时打车" value="TAXI" />
          <el-option label="顺风车" value="CARPOOL" />
          <el-option label="国际出行" value="INTERNATIONAL" />
        </el-select>
        <el-button @click="loadOrders">查询</el-button>
      </div>
    </article>

    <article class="panel">
      <el-table v-loading="loading" :data="list" stripe row-key="id">
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column label="业务类型" width="120">
          <template #default="{ row }">{{ textOf(serviceTypeMap, row.serviceType) }}</template>
        </el-table-column>
        <el-table-column label="订单状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getOrderStatusType(row)">{{ getOrderStatusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getOrderPayStatusType(row)">{{ getOrderPayStatusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="130">
          <template #default="{ row }">{{ formatMoney(row.amount, row.currencyCode) }}</template>
        </el-table-column>
        <el-table-column label="行程时长" width="120">
          <template #default="{ row }">{{ row.runtime.elapsedText }}</template>
        </el-table-column>
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.runtime.percent" :stroke-width="10" :show-text="true" />
          </template>
        </el-table-column>
        <el-table-column prop="startName" label="起点" min-width="180" />
        <el-table-column prop="endName" label="终点" min-width="180" />
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
              <el-button link type="warning" @click="openStatusDialog(row)">改状态</el-button>
              <el-button
                v-if="row.displayStatus !== 'REFUNDED' && row.orderStatus !== 'CANCELLED' && row.status !== 'CANCELLED'"
                link
                type="danger"
                @click="cancelOrder(row)"
              >
                取消
              </el-button>
              <el-button
                v-if="row.refundAllowed"
                link
                type="success"
                @click="refundOrder(row)"
              >
                退款
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">
            <el-empty description="暂无订单数据" />
          </div>
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :current-page="query.current"
          :page-size="query.size"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </article>

    <el-dialog v-model="statusVisible" title="更新订单状态" width="420px">
      <el-form label-width="90px">
        <el-form-item label="状态">
          <el-select v-model="statusForm.orderStatus" style="width: 100%">
            <el-option label="待派单" value="DISPATCHING" />
            <el-option label="已接单" value="ACCEPTED" />
            <el-option label="接驾中" value="PICKING_UP" />
            <el-option label="行程中" value="IN_TRIP" />
            <el-option label="已完成" value="FINISHED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="statusForm.remark" type="textarea" :rows="3" maxlength="120" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusVisible = false">关闭</el-button>
        <el-button :loading="statusSubmitting" type="primary" @click="submitStatus">确认</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="订单详情" size="860px" destroy-on-close>
      <div v-if="detail.order" class="drawer-stack">
        <div class="stat-grid">
          <div class="stat-card">
            <span>订单状态</span>
            <strong>{{ getOrderStatusLabel(detail.order) }}</strong>
          </div>
          <div class="stat-card">
            <span>支付状态</span>
            <strong>{{ getOrderPayStatusLabel(detail.order) }}</strong>
          </div>
          <div class="stat-card">
            <span>行程时长</span>
            <strong>{{ detail.runtime.elapsedText }}</strong>
          </div>
          <div class="stat-card">
            <span>进度</span>
            <strong>{{ detail.runtime.percent }}%</strong>
          </div>
        </div>

        <el-descriptions title="基础信息" :column="2" border>
          <el-descriptions-item label="订单号">{{ detail.order.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{ textOf(serviceTypeMap, detail.order.serviceType) }}</el-descriptions-item>
          <el-descriptions-item label="乘客">{{ detail.user?.nickname || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="司机">{{ detail.driver?.nickname || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="起点">{{ detail.order.startName }}</el-descriptions-item>
          <el-descriptions-item label="终点">{{ detail.order.endName }}</el-descriptions-item>
          <el-descriptions-item label="已用时长">{{ detail.runtime.elapsedText }}</el-descriptions-item>
          <el-descriptions-item label="已行驶">{{ detail.runtime.distanceText }}</el-descriptions-item>
          <el-descriptions-item label="剩余距离">{{ detail.runtime.remainingText }}</el-descriptions-item>
          <el-descriptions-item label="阶段">{{ detail.runtime.phaseText }}</el-descriptions-item>
          <el-descriptions-item label="轨迹模式">{{ detail.runtime.traceModeText }}</el-descriptions-item>
          <el-descriptions-item label="等待信息">{{ detail.runtime.waitingText }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ stripOrderMetaRemark(detail.order.remark) || '无' }}</el-descriptions-item>
        </el-descriptions>

        <el-descriptions v-if="detailCarpoolMeta" title="顺风车信息" :column="2" border>
          <el-descriptions-item label="出发时段">{{ detailCarpoolMeta.timeText || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="乘车人数">{{ detailCarpoolMeta.passengerText }}</el-descriptions-item>
          <el-descriptions-item label="行李情况">{{ detailCarpoolMeta.luggageText }}</el-descriptions-item>
          <el-descriptions-item label="高速费方案">{{ detailCarpoolMeta.tollText }}</el-descriptions-item>
          <el-descriptions-item label="原价">{{ detailCarpoolMeta.originalAmountText }}</el-descriptions-item>
          <el-descriptions-item label="优惠后">{{ detailCarpoolMeta.payableAmountText }}</el-descriptions-item>
          <el-descriptions-item label="优惠金额">{{ detailCarpoolMeta.discountAmountText }}</el-descriptions-item>
          <el-descriptions-item label="补充备注">{{ stripOrderMetaRemark(detail.order.remark) || '无' }}</el-descriptions-item>
        </el-descriptions>

        <el-descriptions v-if="detailInternationalMeta" title="国际出行信息" :column="2" border>
          <el-descriptions-item label="产品">{{ detailInternationalMeta.productName }}</el-descriptions-item>
          <el-descriptions-item label="英文名">{{ detailInternationalMeta.productNameEn || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="预约时间">{{ detailInternationalMeta.appointmentTime || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detailInternationalMeta.contactName || '未填写' }} {{ detailInternationalMeta.contactPhone || '' }}</el-descriptions-item>
          <el-descriptions-item label="乘车人数">{{ detailInternationalMeta.passengerCount }} 人</el-descriptions-item>
          <el-descriptions-item label="行李">{{ detailInternationalMeta.luggageCount }} 件</el-descriptions-item>
          <el-descriptions-item label="航班/编号">{{ detailInternationalMeta.flightNo || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="接机牌">{{ detailInternationalMeta.pickupSign || '阳光出行' }}</el-descriptions-item>
          <el-descriptions-item label="汇率快照">1 USD ≈ {{ detailInternationalMeta.exchangeRate }} CNY</el-descriptions-item>
          <el-descriptions-item label="服务项">{{ detailInternationalMeta.serviceItemsText }}</el-descriptions-item>
          <el-descriptions-item label="材料">{{ detailInternationalMeta.documentsText }}</el-descriptions-item>
          <el-descriptions-item label="提示">{{ detailInternationalMeta.riskNotice }}</el-descriptions-item>
        </el-descriptions>

        <div>
          <h4 class="sub-title">轨迹记录</h4>
          <el-table v-if="detail.trackList?.length" :data="detail.trackList" stripe>
            <el-table-column label="上报时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.reportedAt) }}</template>
            </el-table-column>
            <el-table-column prop="bizRole" label="角色" width="110" />
            <el-table-column label="行驶进度" width="110">
              <template #default="{ row }">{{ parseTraceRemark(row.remark).percentText }}</template>
            </el-table-column>
            <el-table-column label="已行驶" width="110">
              <template #default="{ row }">{{ parseTraceRemark(row.remark).distanceText }}</template>
            </el-table-column>
            <el-table-column label="行驶时长" width="110">
              <template #default="{ row }">{{ parseTraceRemark(row.remark).elapsedText }}</template>
            </el-table-column>
            <el-table-column label="等待/路况" min-width="150">
              <template #default="{ row }">
                {{ row.waitingRedLight ? (row.waitingText || '红灯等待中') : (row.trafficText || '实时轨迹') }}
              </template>
            </el-table-column>
            <el-table-column label="等待秒数" width="110">
              <template #default="{ row }">{{ row.currentWaitSeconds || row.waitSeconds || 0 }}s</template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-block">
            <el-empty description="暂无轨迹数据：只有小程序在接驾或行程中上报定位后才会出现" />
          </div>
        </div>

        <div>
          <h4 class="sub-title">支付记录</h4>
          <el-table v-if="detail.payments?.length" :data="detail.payments" stripe>
            <el-table-column prop="payNo" label="支付单号" min-width="190" />
            <el-table-column prop="payChannel" label="渠道" width="130" />
            <el-table-column label="Status" width="120">
              <template #default="{ row }">
                <el-tag :type="getPayStatusType(row.payStatus)">{{ textOf(payStatusMap, row.payStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.payAmount, row.currencyCode) }}</template>
            </el-table-column>
            <el-table-column label="支付/退款时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.displayTime) }}</template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-block">
            <el-empty description="暂无支付记录" />
          </div>
        </div>

        <div>
          <div class="complaint-head">
            <h4 class="sub-title">投诉记录</h4>
            <el-tag v-if="pendingComplaintCount > 0" type="danger">待处理 {{ pendingComplaintCount }}</el-tag>
          </div>
          <el-table v-if="detail.complaints?.length" :data="detail.complaints" stripe>
            <el-table-column prop="complaintType" label="类型" width="120" />
            <el-table-column prop="content" label="内容" min-width="220" />
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="处理状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.handleStatus === 'DONE' ? 'success' : 'warning'">
                  {{ row.handleStatus === 'DONE' ? '已处理' : '待处理' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="handleResult" label="处理结果" min-width="220">
              <template #default="{ row }">{{ row.handleResult || '等待管理员处理' }}</template>
            </el-table-column>
            <el-table-column label="处理时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.handleTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.handleStatus !== 'DONE'"
                  link
                  type="primary"
                  @click="handleComplaint(row)"
                >
                  标记完成
                </el-button>
                <span v-else>已完成</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-block">
            <el-empty description="暂无投诉记录" />
          </div>
        </div>
      </div>
    </el-drawer>
  </section>
</template>
<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '../api/http'
import {
  formatDateTime,
  formatMoney,
  getOrderStatusLabel,
  getOrderStatusType,
  getPayStatusType,
  payStatusMap,
  serviceTypeMap,
  textOf
} from '../utils/admin'

const loading = ref(false)
const statusSubmitting = ref(false)
const total = ref(0)
const list = ref([])
const detail = ref({})
const detailVisible = ref(false)
const statusVisible = ref(false)
const currentOrderId = ref(null)
let detailTimer = null

const query = reactive({
  current: 1,
  size: 10,
  keyword: '',
  status: '',
  serviceType: ''
})

const statusForm = reactive({
  orderStatus: 'DISPATCHING',
  remark: ''
})

const pendingComplaintCount = computed(() => (detail.value.complaints || []).filter((item) => item.handleStatus !== 'DONE').length)
const detailCarpoolMeta = computed(() => parseCarpoolMeta(detail.value.order))
const detailInternationalMeta = computed(() => parseInternationalMeta(detail.value.order))

function parseTraceRemark(remark = '') {
  const meta = `${remark || ''}`.split(';').reduce((result, part) => {
    const [key, value] = part.split('=')
    if (key && value !== undefined) {
      result[key.trim()] = value.trim()
    }
    return result
  }, {})
  const elapsedSeconds = Number(meta.elapsed || 0)
  const distanceKm = Number(meta.distance || 0)
  const percent = Number(meta.percent)
  return {
    elapsedText: elapsedSeconds > 0 ? `${Math.round(elapsedSeconds / 60)} min` : '--',
    distanceText: distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '--',
    percentText: Number.isFinite(percent) ? `${Math.min(100, Math.max(0, Math.round(percent)))}%` : '--'
  }
}

const runtimePercentFallbackMap = {
  DISPATCHING: 8,
  ACCEPTED: 20,
  PICKING_UP: 45,
  IN_TRIP: 75,
  FINISHED: 100,
  REFUNDED: 100,
  CANCELLED: 0
}

function normalizeDateValue(value) {
  if (!Array.isArray(value)) return value
  const [year, month, day, hour = 0, minute = 0, second = 0] = value
  return `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function normalizeOrderDateFields(order = {}) {
  const nextOrder = { ...order }
  ;[
    'createdAt',
    'updatedAt',
    'acceptedAt',
    'startedAt',
    'finishedAt',
    'paidAt',
    'refundedAt'
  ].forEach((key) => {
    if (key in nextOrder) {
      nextOrder[key] = normalizeDateValue(nextOrder[key])
    }
  })
  return nextOrder
}

function clampPercent(value, fallback = 0) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return fallback
  return Math.min(100, Math.max(0, Math.round(numeric)))
}

function pickRuntimeSummary(runtime = {}) {
  const source = runtime && typeof runtime === 'object' ? runtime : {}
  return {
    phase: source.phase,
    percent: source.percent,
    progress: source.progress,
    elapsedSeconds: source.elapsedSeconds,
    usedSeconds: source.usedSeconds,
    remainingSeconds: source.remainingSeconds,
    totalSeconds: source.totalSeconds,
    traveledDistanceKm: source.traveledDistanceKm,
    distanceKm: source.distanceKm,
    remainDistanceKm: source.remainDistanceKm,
    remainingDistanceKm: source.remainingDistanceKm,
    waitingRedLight: source.waitingRedLight,
    waitSeconds: source.waitSeconds,
    currentWaitSeconds: source.currentWaitSeconds,
    waitingText: source.waitingText,
    trafficText: source.trafficText,
    routeSource: source.routeSource,
    routeReal: source.routeReal,
    traceMode: source.traceMode,
    phaseText: source.phaseText
  }
}

function getTraceModeText(runtime = {}) {
  if (runtime.traceMode === 'DEMO' || runtime.routeSource === 'demo_trace') return '演示轨迹'
  if (runtime.traceMode === 'REAL' || runtime.routeReal) return '真实定位'
  return '暂无轨迹'
}

function buildRuntimePhaseText(status, runtime = {}) {
  if (status === 'DISPATCHING' || status === 'CREATED') return '等待派单'
  if (status === 'ACCEPTED' || status === 'PICKING_UP') return '接驾中'
  if (status === 'IN_TRIP') return '行程中'
  if (status === 'FINISHED' || status === 'REFUNDED') return '已完成'
  if (status === 'CANCELLED') return '已取消'
  return runtime.phase === 'trip' ? '行程中' : '接驾中'
}

function getOrderPayStatusLabel(order = {}) {
  if (order.orderStatus === 'CANCELLED') {
    const cancelFee = Number(order.cancelFee ?? order.payableAmount ?? 0)
    if (!Number.isNaN(cancelFee) && cancelFee <= 0) {
      return '无需支付'
    }
  }
  return textOf(payStatusMap, order.payStatus)
}

function getOrderPayStatusType(order = {}) {
  if (order.orderStatus === 'CANCELLED') {
    const cancelFee = Number(order.cancelFee ?? order.payableAmount ?? 0)
    if (!Number.isNaN(cancelFee) && cancelFee <= 0) {
      return 'info'
    }
  }
  return getPayStatusType(order.payStatus)
}

function hasRuntimeSnapshot(runtime = {}) {
  if (!runtime || typeof runtime !== 'object') return false
  return Object.values(runtime).some((value) => value !== undefined && value !== null && value !== '')
}

async function fetchOrderRuntimeSnapshot(orderId) {
  if (!orderId) return {}

  try {
    const runtime = await http.get(`/orders/${orderId}/runtime`)
    return pickRuntimeSummary(runtime || {})
  } catch (error) {
    return {}
  }
}

function buildRuntimeBase(order = {}, runtime = {}) {
  const status = order.displayStatus || order.orderStatus || order.status || ''
  const isFinished = status === 'FINISHED' || status === 'REFUNDED'
  const isTerminal = isFinished || status === 'CANCELLED'
  const actualSeconds = Number(order.actualDurationMin || 0) * 60
  const usedSeconds = Number(runtime.usedSeconds ?? runtime.elapsedSeconds ?? (isFinished ? actualSeconds : 0))
  const phasePercent = clampPercent(runtime.percent ?? runtime.progressPercent ?? runtimePercentFallbackMap[status] ?? 0)
  const percent = isFinished
    ? 100
    : status === 'CANCELLED'
      ? 0
      : phasePercent
  const traveledDistanceKm = Number(runtime.traveledDistanceKm ?? runtime.distanceKm ?? (isFinished ? order.actualDistanceKm || order.estimatedDistanceKm || 0 : 0))
  const remainDistanceKm = Number(runtime.remainDistanceKm ?? runtime.remainingDistanceKm ?? Math.max(0, Number(order.actualDistanceKm || order.estimatedDistanceKm || 0) - traveledDistanceKm))
  let waitingText = runtime.waitingText || ''

  if (isTerminal) {
    waitingText = '暂无等待'
  } else if (!waitingText) {
    waitingText = runtime.trafficText || (runtime.routeReal ? '实时轨迹同步中' : (status === 'DISPATCHING' ? '等待派单' : '暂无等待'))
  }

  return {
    ...runtime,
    waitingRedLight: false,
    currentWaitSeconds: 0,
    phasePercent,
    percent,
    usedSeconds,
    traveledDistanceKm,
    remainDistanceKm: isFinished ? 0 : remainDistanceKm,
    elapsedText: `${Math.max(0, Math.round(usedSeconds / 60))} min`,
    distanceText: `${traveledDistanceKm.toFixed(1)} km`,
    remainingText: `${(isFinished ? 0 : remainDistanceKm).toFixed(1)} km`,
    phaseText: buildRuntimePhaseText(status, runtime),
    traceModeText: getTraceModeText(runtime),
    waitingText
  }
}

function buildRuntimeFromOrder(order = {}) {
  const normalizedOrder = normalizeOrderDateFields(order)
  const status = normalizedOrder.displayStatus || normalizedOrder.orderStatus || normalizedOrder.status || ''
  const runtime = {
    phase: status === 'IN_TRIP' || status === 'FINISHED' ? 'trip' : 'approach',
    percent: runtimePercentFallbackMap[status] ?? 0,
    traveledDistanceKm: 0,
    remainDistanceKm: Number(normalizedOrder.actualDistanceKm || normalizedOrder.estimatedDistanceKm || 0),
    usedSeconds: 0,
    waitingRedLight: false,
    waitSeconds: 0,
    currentWaitSeconds: 0,
    routeReal: false,
    routeSource: 'order_record'
  }

  if (status === 'FINISHED' && Number(normalizedOrder.actualDurationMin || 0) > 0) {
    runtime.usedSeconds = Number(normalizedOrder.actualDurationMin || 0) * 60
    runtime.percent = 100
    runtime.traveledDistanceKm = Number(normalizedOrder.actualDistanceKm || normalizedOrder.estimatedDistanceKm || runtime.traveledDistanceKm || 0)
    runtime.remainDistanceKm = 0
    runtime.phase = 'trip'
  }

  if (status === 'CANCELLED') {
    runtime.percent = 0
    runtime.remainDistanceKm = Number(normalizedOrder.estimatedDistanceKm || runtime.remainDistanceKm || 0)
    runtime.traveledDistanceKm = Number(runtime.traveledDistanceKm || 0)
    runtime.phase = 'approach'
  }

  return buildRuntimeBase(normalizedOrder, runtime)
}

function enrichOrderRuntime(order = {}) {
  const status = order.displayStatus || order.orderStatus || order.status || ''
  const runtimeSource = hasRuntimeSnapshot(order.runtime)
    ? buildRuntimeBase(order.rawOrder || order, order.runtime)
    : buildRuntimeFromOrder(order.rawOrder || order)
  return {
    ...order,
    orderStatus: status,
    status,
    runtime: runtimeSource
  }
}

function parseCarpoolMeta(order = {}) {
  if ((order.serviceType || '') !== 'CARPOOL') return null
  const remark = `${order.remark || ''}`
  const matched = remark.match(/\[CARPOOL_META\]([\s\S]*?)\[\/CARPOOL_META\]/)
  if (!matched || !matched[1]) return null

  try {
    const meta = JSON.parse(matched[1])
    const passengerCount = Math.max(1, Number(meta.passengerCount || 1))
    const luggageText = meta.hasLuggage === true || meta.hasLuggage === 'HAS_LUGGAGE' ? '有行李' : '无行李'
    const tollText = meta.tollMode === 'PASSENGER_PAYS' ? '乘客承担高速费' : '高速费协商'
    return {
      timeText: [meta.departDate, meta.timeRange].filter(Boolean).join(' '),
      passengerText: `${passengerCount} 人`,
      luggageText,
      tollText,
      originalAmountText: formatMoney(meta.originalAmount || order.estimatedAmount || 0, order.currencyCode),
      discountAmountText: formatMoney(meta.discountAmount || order.couponDiscount || 0, order.currencyCode),
      payableAmountText: formatMoney(meta.payableAmount || order.payableAmount || 0, order.currencyCode)
    }
  } catch (error) {
    return null
  }
}

function parseInternationalMeta(order = {}) {
  if ((order.serviceType || '') !== 'INTERNATIONAL') return null
  const remark = `${order.remark || ''}`
  const matched = remark.match(/\[INTERNATIONAL_META\]([\s\S]*?)\[\/INTERNATIONAL_META\]/)
  if (!matched || !matched[1]) return null

  try {
    const meta = JSON.parse(matched[1])
    const serviceItems = Array.isArray(meta.serviceItems) ? meta.serviceItems : []
    const documents = Array.isArray(meta.documents) ? meta.documents : []
    return {
      ...meta,
      passengerCount: Math.max(1, Number(meta.passengerCount || 1)),
      luggageCount: Math.max(0, Number(meta.luggageCount || 0)),
      exchangeRate: Number(meta.exchangeRate || order.exchangeRate || 7.15).toFixed(2),
      serviceItemsText: serviceItems.length ? serviceItems.join(' · ') : '中文客服 · 跨境接送',
      documentsText: documents.length ? documents.join('、') : '按目的地要求携带有效证件',
      riskNotice: meta.riskNotice || '请提前确认通关证件、航班时间与目的地政策。'
    }
  } catch (error) {
    return null
  }
}

function stripOrderMetaRemark(remark = '') {
  return `${remark || ''}`
    .replace(/\[CARPOOL_META\][\s\S]*?\[\/CARPOOL_META\]/g, '')
    .replace(/\[INTERNATIONAL_META\][\s\S]*?\[\/INTERNATIONAL_META\]/g, '')
    .trim()
}

function normalizeDetailPayload(payload = {}, runtime = {}) {
  const order = enrichOrderRuntime({
    ...(payload.order || payload),
    rawOrder: normalizeOrderDateFields(payload.rawOrder || payload.order || payload),
    runtime: runtime || payload.runtime || payload.order?.runtime || {}
  })
  return {
    ...payload,
    order,
    runtime: order.runtime
  }
}

async function loadOrders() {
  loading.value = true
  try {
    const response = await http.get('/admin/orders', { params: query })
    const records = response?.records || []
    list.value = records.map((item) => enrichOrderRuntime({
      ...item,
      rawOrder: normalizeOrderDateFields(item),
      runtime: item.runtime || {}
    }))
    total.value = response?.total || 0
  } finally {
    loading.value = false
  }
}

async function openDetail(orderId) {
  currentOrderId.value = orderId
  const [payload, runtime] = await Promise.all([
    http.get(`/admin/orders/${orderId}`),
    fetchOrderRuntimeSnapshot(orderId)
  ])
  detail.value = normalizeDetailPayload(payload, runtime)
  detailVisible.value = true
}

function openStatusDialog(row) {
  currentOrderId.value = row.id
  statusForm.orderStatus = row.orderStatus || row.status
  statusForm.remark = row.remark || ''
  statusVisible.value = true
}

async function submitStatus() {
  statusSubmitting.value = true
  try {
    await http.post(`/admin/orders/${currentOrderId.value}/status`, { ...statusForm })
    ElMessage.success('订单状态已更新')
    statusVisible.value = false
    await refreshPageData()
  } finally {
    statusSubmitting.value = false
  }
}

async function cancelOrder(row) {
  await ElMessageBox.confirm(
    `确认取消订单 ${row.orderNo} 吗？`,
    '取消订单',
    { type: 'warning' }
  )
  await http.post(`/admin/orders/${row.id}/cancel`, { reason: '管理员取消订单' })
  ElMessage.success('订单已取消')
  await refreshPageData(row.id)
}

async function refundOrder(row) {
  await ElMessageBox.confirm(
    `确认退款订单 ${row.orderNo} 吗？`,
    '订单退款',
    { type: 'warning' }
  )
  await http.post(`/admin/orders/${row.id}/refund`, { reason: '管理员发起退款' })
  ElMessage.success('订单已退款')
  await refreshPageData(row.id)
}

async function handleComplaint(row) {
  const prompt = await ElMessageBox.prompt('请输入投诉处理结果', '处理投诉', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '请输入处理说明',
    inputValidator: (value) => (value && value.trim() ? true : '请输入处理结果')
  })
  await http.post(`/admin/complaints/${row.id}/handle`, {
    handleResult: prompt.value.trim()
  })
  ElMessage.success('投诉已处理')
  await refreshPageData(currentOrderId.value)
}

async function refreshPageData(orderId = currentOrderId.value) {
  await loadOrders()
  if (detailVisible.value && orderId) {
    const [payload, runtime] = await Promise.all([
      http.get(`/admin/orders/${orderId}`),
      fetchOrderRuntimeSnapshot(orderId)
    ])
    detail.value = normalizeDetailPayload(payload, runtime)
  }
}

function handlePageChange(current) {
  query.current = current
  loadOrders()
}

function startDetailPolling() {
  stopDetailPolling()
  if (!currentOrderId.value) return
  detailTimer = window.setInterval(() => {
    refreshPageData(currentOrderId.value).catch(() => {})
  }, 3000)
}

function stopDetailPolling() {
  if (detailTimer) {
    window.clearInterval(detailTimer)
    detailTimer = null
  }
}

watch(detailVisible, (visible) => {
  if (visible) {
    startDetailPolling()
  } else {
    stopDetailPolling()
  }
})

onMounted(loadOrders)
onUnmounted(stopDetailPolling)
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel {
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(31, 36, 50, 0.08);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.panel-kicker {
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
  color: #8b96a9;
}

.panel-title {
  margin: 8px 0 6px;
  font-size: 26px;
  color: #1f2432;
}

.panel-subtitle {
  margin: 0;
  color: #667085;
}

.toolbar-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.table-actions {
  display: flex;
  gap: 10px;
}

.empty-block {
  padding: 24px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.drawer-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  border-radius: 16px;
  padding: 18px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%);
}

.stat-card span {
  display: block;
  color: #667085;
  margin-bottom: 8px;
}

.stat-card strong {
  font-size: 20px;
  color: #1f2432;
}

.sub-title {
  margin: 0 0 12px;
  font-size: 18px;
  color: #1f2432;
}

.complaint-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
</style>
