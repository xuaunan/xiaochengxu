import { computed } from 'vue'
import type { DesktopStore } from '@/composables/useDesktopState'

const terminalOrderStatuses = ['FINISHED', 'CANCELLED', 'REFUNDED']

export function useDispatchDecision(desktop: DesktopStore) {
  return computed(() => {
    const order = desktop.selectedOrder.value
    const activeRules = desktop.dataset.dispatchRules.filter((item) => item.enabled)
    const onlineDrivers = desktop.dataset.drivers.filter((driver) => driver.enabled && driver.serviceStatus !== 'OFFLINE')
    const hasDriver = Boolean(order.driverName)
    const isFinished = terminalOrderStatuses.includes(order.status)
    const confidence = isFinished
      ? 100
      : hasDriver
        ? order.status === 'IN_TRIP'
          ? 96
          : 91
        : order.serviceType === 'INTERNATIONAL'
          ? 78
          : onlineDrivers.length > 0
            ? 84
            : 42
    const statusCopy = desktop.health.mode === 'live' ? '实时写入' : '离线队列'
    const queueCount =
      desktop.health.mode === 'live'
        ? desktop.unreadMessageCount.value + desktop.pendingWithdrawCount.value
        : desktop.dataset.auditEvents.length + desktop.unreadMessageCount.value
    const ruleCopy =
      order.serviceType === 'INTERNATIONAL'
        ? '跨境资质 + 汇率开关'
        : order.serviceType === 'CARPOOL'
          ? '路线重合 + 座位空余'
          : '距离优先 + 评分加权'
    const nextAction =
      desktop.mode.value === 'passenger'
        ? order.payStatus === 'UNPAID'
          ? '优先完成支付'
          : order.invoiceStatus === '待申请'
            ? '可申请电子发票'
            : '继续跟踪售后'
        : desktop.mode.value === 'driver'
          ? desktop.dataset.driver.serviceStatus === 'ONLINE'
            ? hasDriver
              ? '按节点推进履约'
              : '等待派单池首单'
            : '先恢复在线听单'
          : desktop.unreadMessageCount.value
            ? '先处理未读待办'
            : '保持大盘刷新'

    return {
      confidence,
      statusCopy,
      queueCount,
      rows: [
        { label: '匹配规则', value: ruleCopy },
        { label: '可用运力', value: `${onlineDrivers.length} 位司机` },
        { label: 'SLA 目标', value: isFinished ? '已闭环' : `${order.pickupEta} / ${order.durationMin} 分钟` },
        { label: '下一步', value: nextAction }
      ],
      note: `${activeRules.length} 条派单规则启用，${statusCopy} ${queueCount} 项。`
    }
  })
}
