<template>
  <section class="page dashboard-page">
    <article class="panel toolbar">
      <div>
        <span class="panel-kicker">运营总览</span>
        <h3 class="panel-title">阳光出行运营数据大盘</h3>
        <p class="panel-subtitle">实时业务数据看板，所有指标、趋势和画像数据均来自后端数据库真实业务表。</p>
      </div>
      <div class="toolbar-actions">
        <el-segmented v-model="range" :options="rangeOptions" />
        <el-switch
          v-model="autoRefresh"
          inline-prompt
          active-text="自动刷新"
          inactive-text="手动"
        />
        <el-button :loading="loading" type="primary" @click="loadDashboard">手动刷新数据</el-button>
      </div>
    </article>

    <div class="metrics-grid">
      <article
        v-for="card in metricCards"
        :key="card.key"
        class="panel metric-card"
        :style="{ '--metric-accent': card.accent, '--metric-bg': card.bg }"
        @click="card.action && card.action()"
      >
        <div class="metric-top">
          <span class="metric-icon">{{ card.icon }}</span>
          <span v-if="card.warn" class="pulse-dot"></span>
        </div>
        <div class="metric-value">{{ card.value }}</div>
        <div class="metric-label">{{ card.label }}</div>
        <div class="metric-meta">
          <span>{{ card.metaLeft }}</span>
          <span>{{ card.metaRight }}</span>
        </div>
      </article>
    </div>

    <div class="two-column dashboard-live-row">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">趋势分析</span>
            <h3 class="panel-title">订单量与交易额趋势</h3>
            <p class="panel-subtitle">按 {{ rangeLabel }} 维度联动刷新，支持图例开关和悬浮查看明细。</p>
          </div>
        </div>
        <div ref="trendChartRef" class="chart-box chart-box-lg"></div>
      </article>

      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">业务结构</span>
            <h3 class="panel-title">业务类型占比</h3>
            <p class="panel-subtitle">即时打车、顺风车、国际出行占比一屏可见。</p>
          </div>
          <el-radio-group v-model="shareDimension" size="small">
            <el-radio-button label="orderCountDimension">订单量</el-radio-button>
            <el-radio-button label="turnoverDimension">交易额</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="pieChartRef" class="chart-box"></div>
      </article>
    </div>

    <div class="two-column">
      <article class="panel live-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">实时运营</span>
            <h3 class="panel-title">实时订单流</h3>
            <p class="panel-subtitle">最新 10 条真实订单，点击即可跳转到订单详情抽屉。</p>
          </div>
          <el-button class="live-toggle" text type="primary" @click="liveOrdersExpanded = !liveOrdersExpanded">
            {{ liveOrdersExpanded ? '收起' : '展开' }}
            <span class="toggle-caret" :class="{ expanded: liveOrdersExpanded }"></span>
          </el-button>
        </div>

        <div v-if="latestOrders.length" class="live-compact">
          <div v-if="!liveOrdersExpanded" class="live-summary" @click="liveOrdersExpanded = true">
            <div>
              <strong>{{ latestOrder.orderNo }}</strong>
              <span>{{ latestOrder.startName }} → {{ latestOrder.endName }}</span>
            </div>
            <div class="live-summary-meta">
              <el-tag size="small" :type="getOrderStatusType(latestOrder)">{{ getOrderStatusLabel(latestOrder) }}</el-tag>
              <span>{{ latestOrders.length }} 条</span>
            </div>
          </div>
          <div v-else class="live-list">
            <div
              v-for="order in latestOrders"
              :key="order.id"
              class="live-item"
              @click="goOrder(order)"
            >
              <div class="live-main">
                <strong>{{ order.orderNo }}</strong>
                <span>{{ textOf(serviceTypeMap, order.serviceType) }}</span>
              </div>
              <div class="live-route">{{ order.startName }} → {{ order.endName }}</div>
              <div class="live-meta">
                <el-tag size="small" :type="getOrderStatusType(order)">{{ getOrderStatusLabel(order) }}</el-tag>
                <span>{{ formatMoney(order.amount, order.currencyCode) }}</span>
                <span>{{ formatDateTime(order.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-block">
          <el-empty description="暂无实时订单数据" />
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">运营明细</span>
            <h3 class="panel-title">关键运营指标</h3>
            <p class="panel-subtitle">实时监控接单率、优惠券核销、待审核司机与待处理投诉。</p>
          </div>
        </div>
        <div class="ops-grid">
          <div class="ops-card">
            <span>司机平均接单率</span>
            <strong>{{ formatPercent(operations.driverReceiveRate) }}</strong>
            <el-progress
              :percentage="Number(operations.driverReceiveRate || 0)"
              :color="Number(operations.driverReceiveRate || 0) < 80 ? '#ef4444' : '#16a34a'"
            />
          </div>
          <div class="ops-card">
            <span>优惠券核销率</span>
            <strong>{{ formatPercent(operations.couponUseRate) }}</strong>
            <el-progress
              :percentage="Number(operations.couponUseRate || 0)"
              :color="Number(operations.couponUseRate || 0) < 20 ? '#f59e0b' : '#0ea5e9'"
            />
          </div>
          <div class="ops-card clickable" @click="router.push('/drivers')">
            <div class="ops-headline">
              <span>待审核司机数</span>
              <span v-if="Number(operations.pendingDriverCount || 0) > 0" class="pulse-dot"></span>
            </div>
            <strong>{{ operations.pendingDriverCount || 0 }}</strong>
            <el-button text type="primary">前往司机管理处理</el-button>
          </div>
          <div class="ops-card clickable" @click="router.push('/orders')">
            <div class="ops-headline">
              <span>待处理投诉数</span>
              <span v-if="Number(operations.pendingComplaintCount || 0) > 0" class="pulse-dot"></span>
            </div>
            <strong>{{ operations.pendingComplaintCount || 0 }}</strong>
            <el-button text type="primary">前往订单管理处理</el-button>
          </div>
        </div>
      </article>
    </div>

    <div class="two-column">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">出行画像</span>
            <h3 class="panel-title">打车地域分布热力图</h3>
            <p class="panel-subtitle">基于真实订单出发地聚合，可切换查看打车、顺风车与综合分布。</p>
          </div>
          <el-radio-group v-model="regionDimension" size="small">
            <el-radio-button label="ALL">综合</el-radio-button>
            <el-radio-button label="TAXI">打车</el-radio-button>
            <el-radio-button label="CARPOOL">顺风车</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="mapChartRef" class="chart-box"></div>
      </article>

      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">司机画像</span>
            <h3 class="panel-title">司机评分分布</h3>
            <p class="panel-subtitle">按评分区间统计司机数量，高分司机与待提升司机分布直观展示。</p>
          </div>
        </div>
        <div ref="scoreChartRef" class="chart-box"></div>
      </article>
    </div>
  </section>
</template>

<script setup>
import * as echarts from 'echarts'
import chinaJson from '../assets/china.json'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/http'
import {
  formatDateTime,
  formatMoney,
  formatPercent,
  getOrderStatusLabel,
  getOrderStatusType,
  serviceTypeMap,
  textOf
} from '../utils/admin'

echarts.registerMap('china', chinaJson)

const router = useRouter()
const loading = ref(false)
const autoRefresh = ref(true)
const range = ref('day')
const shareDimension = ref('orderCountDimension')
const regionDimension = ref('ALL')
const liveOrdersExpanded = ref(false)
const dashboard = ref({})
const animated = reactive({
  userTotal: 0,
  driverTotal: 0,
  orderTotal: 0,
  turnoverTotal: 0,
  commissionTotal: 0,
  complaintResolveRate: 0
})

const rangeOptions = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' }
]

const rangeLabel = computed(() => rangeOptions.find((item) => item.value === range.value)?.label || '按日')
const latestOrders = computed(() => dashboard.value.latestOrders || [])
const latestOrder = computed(() => latestOrders.value[0] || {})
const operations = computed(() => dashboard.value.operations || {})

const trendChartRef = ref()
const pieChartRef = ref()
const mapChartRef = ref()
const scoreChartRef = ref()

let trendChart
let pieChart
let mapChart
let scoreChart
let refreshTimer

const provinceCenterMap = Object.fromEntries(
  (chinaJson.features || [])
    .map((feature) => [feature.properties?.name, feature.properties?.center])
    .filter((item) => item[0] && item[1])
)

function collectCoordinateBounds(coordinates, bounds = {
  minLng: Infinity,
  maxLng: -Infinity,
  minLat: Infinity,
  maxLat: -Infinity
}) {
  if (!Array.isArray(coordinates)) return bounds
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    const [lng, lat] = coordinates
    bounds.minLng = Math.min(bounds.minLng, lng)
    bounds.maxLng = Math.max(bounds.maxLng, lng)
    bounds.minLat = Math.min(bounds.minLat, lat)
    bounds.maxLat = Math.max(bounds.maxLat, lat)
    return bounds
  }
  coordinates.forEach((item) => collectCoordinateBounds(item, bounds))
  return bounds
}

const provinceGeoFeatures = (chinaJson.features || [])
  .filter((feature) => feature.properties?.name && feature.geometry?.coordinates)
  .map((feature) => ({
    name: feature.properties.name,
    geometry: feature.geometry,
    bounds: collectCoordinateBounds(feature.geometry.coordinates)
  }))

const regionAliasMap = {
  上海: '上海市',
  北京: '北京市',
  天津: '天津市',
  重庆: '重庆市',
  深圳: '广东省',
  广州: '广东省',
  东莞: '广东省',
  佛山: '广东省',
  珠海: '广东省',
  惠州: '广东省',
  石家庄: '河北省',
  唐山: '河北省',
  秦皇岛: '河北省',
  邯郸: '河北省',
  邢台: '河北省',
  保定: '河北省',
  张家口: '河北省',
  承德: '河北省',
  沧州: '河北省',
  廊坊: '河北省',
  衡水: '河北省',
  苏州: '江苏省',
  南京: '江苏省',
  无锡: '江苏省',
  杭州: '浙江省',
  宁波: '浙江省',
  温州: '浙江省',
  成都: '四川省',
  武汉: '湖北省',
  长沙: '湖南省',
  西安: '陕西省',
  郑州: '河南省',
  青岛: '山东省',
  济南: '山东省',
  厦门: '福建省',
  福州: '福建省',
  南宁: '广西壮族自治区',
  桂林: '广西壮族自治区',
  海口: '海南省',
  三亚: '海南省',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区',
  虹桥站: '上海市',
  虹桥机场: '上海市',
  虹桥机场T2: '上海市',
  人民广场: '上海市',
  陆家嘴: '上海市',
  静安寺: '上海市',
  上海大学: '上海市',
  上海交通大学闵行校区: '上海市',
  上海迪士尼度假区: '上海市',
  苏州工业园区: '江苏省',
  深圳湾口岸: '广东省',
  香港国际机场: '香港特别行政区',
  澳门渔人码头: '澳门特别行政区',
  石家庄学院: '河北省',
  石家庄学院北校区: '河北省',
  石家庄裕华万达广场: '河北省',
  裕华万达广场: '河北省',
  燕达医院: '河北省',
  燕达医院公交站: '河北省',
  燕京理工学院: '河北省',
  燕郊: '河北省',
  三河: '河北省',
  沧州西客站: '河北省',
  沧州市人民公园: '河北省'
}

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function isPointInBounds(point, bounds = {}) {
  const [lng, lat] = point
  return lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat
}

function isPointInRing(point, ring = []) {
  const [lng, lat] = point
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLng, currentLat] = ring[current] || []
    const [previousLng, previousLat] = ring[previous] || []
    const intersects = ((currentLat > lat) !== (previousLat > lat)) &&
      (lng < ((previousLng - currentLng) * (lat - currentLat)) / ((previousLat - currentLat) || 1) + currentLng)
    if (intersects) inside = !inside
  }
  return inside
}

function isPointInPolygon(point, polygon = []) {
  if (!polygon.length || !isPointInRing(point, polygon[0])) return false
  return !polygon.slice(1).some((hole) => isPointInRing(point, hole))
}

function isPointInGeometry(point, geometry = {}) {
  if (geometry.type === 'Polygon') {
    return isPointInPolygon(point, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon))
  }
  return false
}

function getOrderPoint(order = {}, type = 'start') {
  const lng = toFiniteNumber(order[`${type}Lng`] ?? order[`${type}Longitude`])
  const lat = toFiniteNumber(order[`${type}Lat`] ?? order[`${type}Latitude`])
  if (lng === null || lat === null) return null
  return [lng, lat]
}

function getProvinceByCoordinate(point) {
  if (!point) return '未知'
  const matched = provinceGeoFeatures.find((feature) =>
    isPointInBounds(point, feature.bounds) && isPointInGeometry(point, feature.geometry)
  )
  return matched?.name || '未知'
}

function getProvinceFromOrderCoordinates(order = {}) {
  const startProvince = getProvinceByCoordinate(getOrderPoint(order, 'start'))
  if (startProvince !== '未知') return startProvince
  return getProvinceByCoordinate(getOrderPoint(order, 'end'))
}

function normalizeRegionName(name = '') {
  const raw = `${name || ''}`.trim()
  if (!raw) return '未知'
  if (provinceCenterMap[raw]) return raw
  if (cityCoordinateMap[raw]) return raw
  if (regionAliasMap[raw]) return regionAliasMap[raw]

  const normalized = raw.replace(/省|市|自治区|特别行政区|地区|盟|自治州|州/g, '')
  if (regionAliasMap[normalized]) return regionAliasMap[normalized]
  if (cityCoordinateMap[normalized]) return normalized

  const provinceName = Object.keys(provinceCenterMap).find((item) => item.includes(normalized) || normalized.includes(item.replace(/省|市|自治区|特别行政区/g, '')))
  if (provinceName) return provinceName

  const cityName = Object.keys(cityCoordinateMap).find((item) => item.includes(normalized) || normalized.includes(item))
  if (cityName) return cityName

  return raw
}

function getRegionCoordinate(name = '') {
  return cityCoordinateMap[name] || provinceCenterMap[name] || cityCoordinateMap.未知
}

const cityCoordinateMap = {
  上海: [121.4737, 31.2304],
  深圳: [114.0579, 22.5431],
  香港: [114.1694, 22.3193],
  澳门: [113.5491, 22.1987],
  苏州: [120.5853, 31.2989],
  未知: [112.9388, 28.2282]
}

Object.entries(provinceCenterMap).forEach(([name, center]) => {
  if (!cityCoordinateMap[name]) {
    cityCoordinateMap[name] = center
  }
})

function normalizeDashboardRegionDistribution(rawList = []) {
  const regionMap = new Map()

  rawList.forEach((item) => {
    const rawName = item.city || item.region || item.province || item.name || ''
    const regionName = normalizeRegionName(rawName)
    const count = Number(item.count || item.userCount || item.value || 0)
    regionMap.set(regionName, (regionMap.get(regionName) || 0) + count)
  })

  return Array.from(regionMap.entries()).map(([city, count]) => ({ city, count }))
}

function normalizeRideRegionDistribution(rawDistribution = {}) {
  const fallback = { ALL: [], TAXI: [], CARPOOL: [] }
  return Object.fromEntries(
    Object.entries({ ...fallback, ...rawDistribution }).map(([key, list]) => [
      key,
      normalizeDashboardRegionDistribution(Array.isArray(list) ? list : [])
    ])
  )
}

function extractRegionFromLocation(text = '') {
  const raw = `${text || ''}`.trim()
  if (!raw) return '未知'

  const segments = raw.split(/[，,·\s]/).filter(Boolean)
  const candidates = [raw, ...segments]

  for (const candidate of candidates) {
    const normalized = normalizeRegionName(candidate)
    if (normalized !== candidate || provinceCenterMap[normalized] || cityCoordinateMap[normalized]) {
      return normalized
    }
  }

  const aliasKeys = Object.keys(regionAliasMap).sort((left, right) => right.length - left.length)
  const matchedAlias = aliasKeys.find((item) => raw.includes(item))
  if (matchedAlias) {
    return normalizeRegionName(matchedAlias)
  }

  return '未知'
}

function aggregateRideRegionDistribution(orderList = []) {
  const mapGroup = {
    ALL: new Map(),
    TAXI: new Map(),
    CARPOOL: new Map()
  }

  orderList.forEach((order) => {
    if (!['TAXI', 'CARPOOL'].includes(order.serviceType)) return
    const coordinateRegion = getProvinceFromOrderCoordinates(order)
    const startRegion = coordinateRegion === '未知'
      ? extractRegionFromLocation(order.startName)
      : coordinateRegion
    const region = startRegion === '未知' ? extractRegionFromLocation(order.endName) : startRegion
    mapGroup.ALL.set(region, (mapGroup.ALL.get(region) || 0) + 1)
    mapGroup[order.serviceType].set(region, (mapGroup[order.serviceType].get(region) || 0) + 1)
  })

  return Object.fromEntries(
    Object.entries(mapGroup).map(([key, regionMap]) => ([
      key,
      Array.from(regionMap.entries()).map(([city, count]) => ({ city, count }))
    ]))
  )
}

const metricCards = computed(() => [
  {
    key: 'userTotal',
    icon: '客',
    label: '累计用户总量',
    value: `${Math.round(animated.userTotal || 0)}`,
    metaLeft: `实名用户 ${dashboard.value.verifiedUserTotal || 0} 人`,
    metaRight: `昨日新增 ${dashboard.value.newUserDelta || 0} 人`,
    accent: '#16a34a',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 62%)',
    action: () => router.push('/users')
  },
  {
    key: 'driverTotal',
    icon: '司',
    label: '累计司机总量',
    value: `${Math.round(animated.driverTotal || 0)}`,
    metaLeft: `已审核 ${dashboard.value.approvedDriverTotal || 0} 人`,
    metaRight: `待审核 ${dashboard.value.pendingDriverTotal || 0} 人`,
    accent: '#2563eb',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 62%)',
    warn: Number(dashboard.value.pendingDriverTotal || 0) > 0,
    action: () => router.push('/drivers')
  },
  {
    key: 'orderTotal',
    icon: '单',
    label: '累计订单总量',
    value: `${Math.round(animated.orderTotal || 0)}`,
    metaLeft: `打车 ${dashboard.value.taxiOrderTotal || 0} 单`,
    metaRight: `顺风 ${dashboard.value.carpoolOrderTotal || 0} 单 / 国际 ${dashboard.value.internationalOrderTotal || 0} 单`,
    accent: '#f97316',
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 62%)',
    action: () => router.push('/orders')
  },
  {
    key: 'turnoverTotal',
    icon: '额',
    label: '累计交易总额',
    value: formatMoney(animated.turnoverTotal, 'CNY'),
    metaLeft: `昨日交易额 ${formatMoney(dashboard.value.yesterdayTurnover)}`,
    metaRight: `环比 ${formatPercent(dashboard.value.turnoverDeltaRate)}`,
    accent: '#7c3aed',
    bg: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 62%)'
  },
  {
    key: 'commissionTotal',
    icon: '佣',
    label: '平台累计佣金',
    value: formatMoney(animated.commissionTotal, 'CNY'),
    metaLeft: `昨日佣金 ${formatMoney(dashboard.value.yesterdayCommission)}`,
    metaRight: `环比 ${formatPercent(dashboard.value.commissionDeltaRate)}`,
    accent: '#d97706',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 62%)'
  },
  {
    key: 'complaintResolveRate',
    icon: '诉',
    label: '投诉解决率',
    value: formatPercent(animated.complaintResolveRate),
    metaLeft: `已处理 ${dashboard.value.resolvedComplaintTotal || 0} 单`,
    metaRight: `未解决 ${dashboard.value.unresolvedComplaintTotal || 0} 单`,
    accent: '#dc2626',
    bg: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 62%)',
    warn: Number(dashboard.value.unresolvedComplaintTotal || 0) > 0,
    action: () => router.push('/orders')
  }
])

async function loadDashboard() {
  loading.value = true
  try {
    const dashboardData = await http.get('/admin/dashboard', { params: { range: range.value } })
    dashboard.value = dashboardData || {}
    dashboard.value.userCityDistribution = normalizeDashboardRegionDistribution(
      dashboard.value.userCityDistribution || dashboard.value.userRegionDistribution || []
    )
    dashboard.value.rideRegionDistribution = normalizeRideRegionDistribution(
      dashboard.value.rideRegionDistribution || aggregateRideRegionDistribution(dashboard.value.latestOrders || [])
    )
    animateMetrics()
    await nextTick()
    renderCharts()
  } catch (error) {
    ElMessage.error(error.message || '数据大盘加载失败')
  } finally {
    loading.value = false
  }
}

function animateMetrics() {
  animateValue('userTotal', dashboard.value.userTotal || 0)
  animateValue('driverTotal', dashboard.value.driverTotal || 0)
  animateValue('orderTotal', dashboard.value.orderTotal || 0)
  animateValue('turnoverTotal', dashboard.value.turnoverTotal || 0)
  animateValue('commissionTotal', dashboard.value.commissionTotal || 0)
  animateValue('complaintResolveRate', dashboard.value.complaintResolveRate || 0)
}

function animateValue(key, target) {
  const start = Number(animated[key] || 0)
  const end = Number(target || 0)
  const startTime = performance.now()
  const duration = 520

  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1)
    animated[key] = start + (end - start) * progress
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

function renderCharts() {
  initCharts()
  renderTrendChart()
  renderPieChart()
  renderMapChart()
  renderScoreChart()
}

function initCharts() {
  if (!trendChart && trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (!pieChart && pieChartRef.value) pieChart = echarts.init(pieChartRef.value)
  if (!mapChart && mapChartRef.value) mapChart = echarts.init(mapChartRef.value)
  if (!scoreChart && scoreChartRef.value) scoreChart = echarts.init(scoreChartRef.value)
}

function renderTrendChart() {
  if (!trendChart) return
  const trend = dashboard.value.trend || []
  trendChart.setOption({
    color: ['#ff7a18', '#2563eb'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#475569' } },
    grid: { left: 50, right: 56, top: 44, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trend.map((item) => item.label),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: [
      {
        type: 'value',
        name: '订单量',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
        axisLabel: { color: '#64748b' }
      },
      {
        type: 'value',
        name: '交易额',
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#64748b',
          formatter: (value) => `¥${value}`
        }
      }
    ],
    series: [
      {
        name: '订单量',
        type: 'line',
        smooth: true,
        symbolSize: 10,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,122,24,0.38)' },
            { offset: 1, color: 'rgba(255,122,24,0.04)' }
          ])
        },
        data: trend.map((item) => item.orderCount)
      },
      {
        name: '交易额',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbolSize: 10,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37,99,235,0.32)' },
            { offset: 1, color: 'rgba(37,99,235,0.04)' }
          ])
        },
        data: trend.map((item) => Number(item.turnover || 0))
      }
    ]
  })
}

function renderPieChart() {
  if (!pieChart) return
  const share = dashboard.value.businessShare || {}
  const source = share[shareDimension.value] || []
  const total = shareDimension.value === 'orderCountDimension'
    ? Number(share.totalOrderCount || 0)
    : Number(share.totalTurnover || 0)

  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#475569' } },
    series: [
      {
        name: '业务占比',
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 12, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { scale: true },
        data: source.map((item) => ({ name: item.name, value: Number(item.value || 0) }))
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: shareDimension.value === 'orderCountDimension'
            ? `${Math.round(total)}\n总订单`
            : `${formatMoney(total)}\n总交易额`,
          textAlign: 'center',
          fill: '#0f172a',
          fontSize: 18,
          fontWeight: 700
        }
      }
    ]
  })
}

function renderMapChart() {
  if (!mapChart) return
  const distribution = dashboard.value.rideRegionDistribution || {}
  const rawSource = distribution[regionDimension.value]?.length
    ? distribution[regionDimension.value]
    : (regionDimension.value === 'ALL' ? dashboard.value.userCityDistribution || [] : [])
  const source = rawSource.map((item) => ({
    name: item.city,
    value: [...getRegionCoordinate(item.city), Number(item.count || 0)]
  }))
  const dimensionLabel = regionDimension.value === 'TAXI'
    ? '打车订单数'
    : regionDimension.value === 'CARPOOL'
      ? '顺风车订单数'
      : '综合订单数'

  mapChart.setOption({
    tooltip: {
      formatter: (params) => params.data ? `${params.name}<br/>${dimensionLabel}：${params.data.value[2]}` : params.name
    },
    visualMap: {
      min: 0,
      max: Math.max(...source.map((item) => Number(item.value?.[2] || 0)), 1),
      left: 'left',
      bottom: 10,
      text: ['高', '低'],
      inRange: {
        color: ['#fde68a', '#fb923c', '#dc2626']
      }
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.08,
      itemStyle: {
        areaColor: '#fff7ed',
        borderColor: '#fdba74'
      },
      emphasis: {
        itemStyle: {
          areaColor: '#fed7aa'
        }
      }
    },
    series: [
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        rippleEffect: { scale: 4 },
        symbolSize: (value) => 10 + Number(value[2] || 0) * 2,
        itemStyle: {
          color: '#f97316'
        },
        data: source
      }
    ]
  })
}

function renderScoreChart() {
  if (!scoreChart) return
  const source = dashboard.value.driverScoreDistribution || []
  scoreChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 20, top: 20, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } }
    },
    yAxis: {
      type: 'category',
      data: source.map((item) => item.label),
      axisLabel: { color: '#475569' }
    },
    series: [
      {
        type: 'bar',
        data: source.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: ['#16a34a', '#65a30d', '#f59e0b', '#ef4444'][index]
          }
        })),
        barWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: '#475569'
        }
      }
    ]
  })
}

function goOrder(order) {
  router.push('/orders')
  ElMessage.info(`已定位到订单模块，可查看订单 ${order.orderNo} 的详情`)
}

function handleResize() {
  trendChart?.resize()
  pieChart?.resize()
  mapChart?.resize()
  scoreChart?.resize()
}

watch([range, shareDimension], async () => {
  await loadDashboard()
})

watch(regionDimension, () => {
  renderMapChart()
})

watch(autoRefresh, (value) => {
  clearInterval(refreshTimer)
  if (value) {
    refreshTimer = setInterval(loadDashboard, 30000)
  }
}, { immediate: true })

onMounted(async () => {
  await loadDashboard()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
  mapChart?.dispose()
  scoreChart?.dispose()
})
</script>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 18px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px;
}

.metric-card {
  min-height: 182px;
  color: #172033;
  cursor: pointer;
  background: var(--metric-bg, #ffffff);
  border-color: rgba(226, 232, 240, 0.96);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 122, 24, 0.28);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
}

.metric-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 122, 24, 0.08);
  color: var(--metric-accent, #ff7a18);
  font-size: 18px;
  font-weight: 800;
}

.metric-value {
  color: #111827;
}

.metric-label {
  margin: 8px 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #475569;
}

.metric-card .metric-meta {
  color: #7b8495;
}

.chart-panel {
  min-height: 420px;
}

.chart-box {
  height: 320px;
}

.chart-box-lg {
  height: 360px;
}

.dashboard-live-row {
  align-items: start;
}

.dashboard-live-row > .panel {
  align-self: start;
}

.live-panel::after {
  display: none;
}

.live-panel .panel-head {
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.live-panel .panel-title {
  font-size: 21px;
  line-height: 1.25;
}

.live-panel .panel-subtitle {
  margin-top: 6px;
  font-size: 13px;
}

.live-toggle {
  flex-shrink: 0;
}

.toggle-caret {
  width: 7px;
  height: 7px;
  margin-left: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.18s ease;
}

.toggle-caret.expanded {
  transform: rotate(225deg) translateY(-1px);
}

.live-compact {
  display: grid;
  gap: 10px;
}

.live-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.8);
  cursor: pointer;
}

.live-summary strong {
  display: block;
  margin-bottom: 4px;
  color: #334155;
  font-size: 14px;
}

.live-summary span {
  color: #64748b;
  font-size: 13px;
}

.live-summary-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.live-list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  padding-right: 4px;
  overflow-y: auto;
}

.live-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.live-item:hover {
  transform: translateX(2px);
  border-color: rgba(255, 122, 24, 0.36);
  box-shadow: 0 10px 24px rgba(255, 122, 24, 0.1);
}

.live-main,
.live-meta,
.ops-headline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.live-main strong {
  color: #334155;
  font-size: 13px;
}

.live-main span,
.live-meta span {
  font-size: 12px;
}

.live-main span,
.live-meta span,
.live-route {
  color: #64748b;
}

.live-route {
  margin: 6px 0;
  font-size: 13px;
  line-height: 1.35;
}

.ops-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ops-card {
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.92);
  display: grid;
  gap: 12px;
}

.ops-card span {
  color: #64748b;
}

.ops-card strong {
  font-size: 30px;
}

.ops-card.clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ops-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
}

@media (max-width: 1400px) {
  .metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .metrics-grid,
  .ops-grid {
    grid-template-columns: 1fr;
  }
}
</style>
