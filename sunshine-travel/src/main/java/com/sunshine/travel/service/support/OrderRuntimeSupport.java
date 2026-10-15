package com.sunshine.travel.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.ServiceType;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.TravelTrace;
import com.sunshine.travel.mapper.TravelTraceMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class OrderRuntimeSupport {

    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Shanghai");
    private static final BigDecimal DRIVER_ARRIVED_THRESHOLD_KM = BigDecimal.valueOf(0.05D);

    private final TravelTraceMapper travelTraceMapper;

    public OrderRuntimeSupport(TravelTraceMapper travelTraceMapper) {
        this.travelTraceMapper = travelTraceMapper;
    }

    public Map<String, Object> buildRuntimeSummary(RideOrder order) {
        return buildRuntimeInternal(order, queryTraces(order), false);
    }

    /**
     * 使用预先批量查询好的轨迹构建摘要，供列表页避免逐单查询轨迹。
     */
    public Map<String, Object> buildRuntimeSummary(RideOrder order, List<TravelTrace> traces) {
        return buildRuntimeInternal(order, traces == null ? List.of() : traces, false);
    }

    public Map<String, Object> buildRuntime(RideOrder order) {
        return buildRuntimeInternal(order, queryTraces(order), true);
    }

    /**
     * 一次性查询多个订单的轨迹并按订单分组，替代列表页逐单查询。
     */
    public Map<Long, List<TravelTrace>> queryTracesByOrderIds(java.util.Collection<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return Map.of();
        }
        return travelTraceMapper.selectList(new LambdaQueryWrapper<TravelTrace>()
                        .in(TravelTrace::getOrderId, orderIds)
                        .orderByAsc(TravelTrace::getOrderId)
                        .orderByAsc(TravelTrace::getReportedAt)
                        .orderByAsc(TravelTrace::getId))
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(TravelTrace::getOrderId,
                        LinkedHashMap::new,
                        java.util.stream.Collectors.toList()));
    }

    public void warmUpRoutes(RideOrder order) {
        // Runtime is now based on miniapp-reported trace rows, not generated routes.
    }

    private Map<String, Object> buildRuntimeInternal(RideOrder order, List<TravelTrace> traces, boolean includeTracePoints) {
        String status = Objects.toString(order.getOrderStatus(), "");
        // 顺风车车主接单后、点击“开始接驾”前，行程尚未开始：
        // 此时上报的（模拟）轨迹不代表真实行程，直接返回“待出发”快照，避免进度被算成 100%/接驾中。
        if (ServiceType.CARPOOL.equals(order.getServiceType()) && OrderStatus.ACCEPTED.equals(status)) {
            return buildCarpoolPendingRuntime(order, includeTracePoints);
        }
        boolean finished = OrderStatus.FINISHED.equals(status);
        boolean cancelled = OrderStatus.CANCELLED.equals(status);
        String phase = resolvePhase(status);
        // 多端同时上报演示轨迹时（网页司机工作台 + 小程序司机端各自持有一套本地模拟），
        // “最新一条”会在两个模拟器的位置之间来回交替，乘客端车辆因此前后瞬移。
        // 这里做领先者仲裁：取窗口内最先进阶段（trip > approach）里进度百分比最高的一条作为展示基准，
        // 保证进度单调不回退、位置与进度一致；单司机端上报时行为与原来完全一致。
        TravelTrace latestTrace = traces.isEmpty() ? null : traces.get(traces.size() - 1);
        TravelTrace leaderTrace = selectLeadingTrace(traces, latestTrace);
        GeoPoint currentPoint = resolveCurrentPoint(order, leaderTrace, finished, cancelled);
        BigDecimal traveledDistanceKm = resolveTraveledDistance(order, traces, finished, cancelled);
        BigDecimal totalDistanceKm = resolveTotalDistance(order, traveledDistanceKm);
        BigDecimal remainDistanceKm = finished || cancelled
                ? BigDecimal.ZERO
                : totalDistanceKm.subtract(traveledDistanceKm).max(BigDecimal.ZERO);
        long usedSeconds = resolveUsedSeconds(order, traces, phase, finished, cancelled);
        long totalSeconds = resolveTotalSeconds(order, usedSeconds, finished, cancelled);
        long remainingSeconds = finished || cancelled ? 0L : Math.max(0L, totalSeconds - usedSeconds);
        int percent = resolvePercent(status, traveledDistanceKm, totalDistanceKm);
        boolean demoTrace = isDemoTrace(leaderTrace);
        BigDecimal speedKmh = leaderTrace != null && leaderTrace.getSpeedKmh() != null
                ? leaderTrace.getSpeedKmh()
                : resolveSpeedKmh(traces);
        boolean waitingRedLight = leaderTrace != null && Boolean.TRUE.equals(leaderTrace.getWaitingRedLight());
        long waitSeconds = leaderTrace == null ? 0L : safeLong(leaderTrace.getWaitSeconds());
        long currentWaitSeconds = leaderTrace == null ? 0L : safeLong(leaderTrace.getCurrentWaitSeconds());
        String trafficText = leaderTrace == null ? "" : firstText(leaderTrace.getTrafficText(), demoTrace ? "规划轨迹更新中" : "实时轨迹更新中");
        String waitingText = leaderTrace == null ? "" : firstText(leaderTrace.getWaitingText(), waitingRedLight ? "红灯等待中" : "");
        Map<String, String> traceMetrics = parseTraceRemarkMetrics(leaderTrace);
        BigDecimal reportedDistanceKm = decimalMetric(traceMetrics, "distance");
        BigDecimal reportedRemainKm = decimalMetric(traceMetrics, "remain");
        Integer reportedPercent = intMetric(traceMetrics, "percent");
        Long reportedElapsedSeconds = longMetric(traceMetrics, "elapsed");
        Long reportedTotalSeconds = longMetric(traceMetrics, "total");
        if (reportedDistanceKm != null) {
            traveledDistanceKm = reportedDistanceKm;
        }
        if (reportedRemainKm != null) {
            remainDistanceKm = reportedRemainKm;
            totalDistanceKm = traveledDistanceKm.add(reportedRemainKm);
        }
        if (reportedElapsedSeconds != null) {
            usedSeconds = Math.max(0L, reportedElapsedSeconds);
        }
        if (reportedTotalSeconds != null) {
            totalSeconds = Math.max(usedSeconds, reportedTotalSeconds);
            remainingSeconds = finished || cancelled ? 0L : Math.max(0L, totalSeconds - usedSeconds);
        }
        if (reportedPercent != null) {
            percent = clampPercent(reportedPercent);
        }
        // 行程阶段剩余时间兜底：演示模拟器刚切入 trip（进度很小）时，其本地路线总时长可能远大于
        // 订单预估时长，会把“预计到达”撑出 50+ 分钟的怪值。用订单预估时长按剩余进度比例封顶；
        // 模拟器总时长比预估更短时封顶不生效，收敛后行为与原来完全一致。
        if (!finished && !cancelled && OrderStatus.IN_TRIP.equals(status) && order.getEstimatedDurationMin() != null) {
            long estimateSeconds = order.getEstimatedDurationMin()
                    .multiply(BigDecimal.valueOf(60))
                    .setScale(0, RoundingMode.HALF_UP)
                    .max(BigDecimal.ZERO)
                    .longValue();
            double remainRatio = Math.max(0d, 1d - percent / 100d);
            long capSeconds = Math.round(estimateSeconds * remainRatio);
            if (capSeconds > 0 && remainingSeconds > capSeconds) {
                remainingSeconds = capSeconds;
            }
        }
        boolean driverArrived = !traces.isEmpty() && resolveDriverArrived(order, phase, currentPoint, remainDistanceKm);
        String phaseText = resolvePhaseText(status, driverArrived);
        String displayText = resolveDisplayText(status, waitingRedLight, trafficText, waitingText, phaseText);
        if (finished || cancelled) {
            trafficText = displayText;
            waitingText = "暂无等待";
            waitingRedLight = false;
            waitSeconds = 0L;
            currentWaitSeconds = 0L;
        }

        Map<String, Object> runtime = new LinkedHashMap<>();
        runtime.put("phase", phase);
        runtime.put("phaseText", phaseText);
        runtime.put("stateText", phaseText);
        runtime.put("displayText", displayText);
        runtime.put("percent", percent);
        runtime.put("progress", BigDecimal.valueOf(percent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        runtime.put("currentPoint", pointMap(currentPoint));
        runtime.put("heading", latestTrace != null && latestTrace.getHeading() != null ? latestTrace.getHeading() : 0);
        runtime.put("speedKmh", speedKmh);
        runtime.put("traveledDistanceKm", scale(traveledDistanceKm));
        runtime.put("remainDistanceKm", scale(remainDistanceKm));
        runtime.put("elapsedSeconds", usedSeconds);
        runtime.put("usedSeconds", usedSeconds);
        runtime.put("remainingSeconds", remainingSeconds);
        runtime.put("totalSeconds", totalSeconds);
        runtime.put("waitingRedLight", waitingRedLight);
        runtime.put("waitSeconds", waitSeconds);
        runtime.put("currentWaitSeconds", currentWaitSeconds);
        runtime.put("trafficText", trafficText);
        runtime.put("waitingText", waitingText);
        runtime.put("phaseComplete", finished);
        runtime.put("terminal", finished || cancelled);
        runtime.put("driverArrived", driverArrived);
        runtime.put("tripAutoFinishReady", false);
        runtime.put("approachTotalSeconds", OrderStatus.IN_TRIP.equals(status) || finished ? 0 : totalSeconds);
        runtime.put("tripTotalSeconds", OrderStatus.IN_TRIP.equals(status) || finished ? totalSeconds : 0);
        runtime.put("approachDistanceKm", OrderStatus.IN_TRIP.equals(status) || finished ? BigDecimal.ZERO : scale(totalDistanceKm));
        runtime.put("tripDistanceKm", OrderStatus.IN_TRIP.equals(status) || finished ? scale(totalDistanceKm) : BigDecimal.ZERO);
        runtime.put("driverStartPoint", pointMap(resolveDriverStartPoint(order, traces)));
        runtime.put("routeSource", traces.isEmpty() ? "order_record" : (demoTrace ? "demo_trace" : "travel_trace"));
        runtime.put("routeReal", !traces.isEmpty() && !demoTrace);
        runtime.put("traceMode", traces.isEmpty() ? "NONE" : (demoTrace ? "DEMO" : "REAL"));
        runtime.put("traceCount", traces.size());
        runtime.put("lastReportedAt", traces.isEmpty() ? null : traces.get(traces.size() - 1).getReportedAt());

        if (includeTracePoints) {
            // /runtime is polled by both miniapps every few seconds. Keep it as a small latest-state
            // snapshot; full history belongs to /track/history. Returning all trace rows here made
            // clients fall back to stale local runtime and caused driver/passenger progress drift.
            runtime.put("approachRoutePoints", List.of());
            runtime.put("tripRoutePoints", List.of());
            runtime.put("traveledPoints", List.of());
            runtime.put("remainPoints", List.of());
        }
        return runtime;
    }

    /**
     * 顺风车“车主已接单、待出发”状态的运行快照：忽略提前上报的轨迹，进度归零。
     */
    private Map<String, Object> buildCarpoolPendingRuntime(RideOrder order, boolean includeTracePoints) {
        BigDecimal totalDistanceKm = positive(order.getEstimatedDistanceKm()) ? order.getEstimatedDistanceKm() : BigDecimal.ZERO;
        long totalSeconds = positive(order.getEstimatedDurationMin())
                ? order.getEstimatedDurationMin().multiply(BigDecimal.valueOf(60)).longValue()
                : 0L;
        Map<String, Object> runtime = new LinkedHashMap<>();
        runtime.put("phase", "approach");
        runtime.put("phaseText", "车主待出发");
        runtime.put("stateText", "车主待出发");
        runtime.put("displayText", "车主已接单，等待出发");
        runtime.put("percent", 10);
        runtime.put("progress", BigDecimal.valueOf(0.10).setScale(2, RoundingMode.HALF_UP));
        runtime.put("currentPoint", pointMap(resolveStartPoint(order)));
        runtime.put("heading", 0);
        runtime.put("speedKmh", BigDecimal.ZERO);
        runtime.put("traveledDistanceKm", scale(BigDecimal.ZERO));
        runtime.put("remainDistanceKm", scale(totalDistanceKm));
        runtime.put("elapsedSeconds", 0L);
        runtime.put("usedSeconds", 0L);
        runtime.put("remainingSeconds", totalSeconds);
        runtime.put("totalSeconds", totalSeconds);
        runtime.put("waitingRedLight", false);
        runtime.put("waitSeconds", 0L);
        runtime.put("currentWaitSeconds", 0L);
        runtime.put("trafficText", "车主已接单，等待出发");
        runtime.put("waitingText", "");
        runtime.put("phaseComplete", false);
        runtime.put("terminal", false);
        runtime.put("driverArrived", false);
        runtime.put("tripAutoFinishReady", false);
        runtime.put("approachTotalSeconds", totalSeconds);
        runtime.put("tripTotalSeconds", 0L);
        runtime.put("approachDistanceKm", scale(totalDistanceKm));
        runtime.put("tripDistanceKm", BigDecimal.ZERO);
        runtime.put("driverStartPoint", pointMap(resolveStartPoint(order)));
        runtime.put("routeSource", "order_record");
        runtime.put("routeReal", false);
        runtime.put("traceMode", "NONE");
        runtime.put("traceCount", 0);
        runtime.put("lastReportedAt", null);
        if (includeTracePoints) {
            runtime.put("approachRoutePoints", List.of());
            runtime.put("tripRoutePoints", List.of());
            runtime.put("traveledPoints", List.of());
            runtime.put("remainPoints", List.of());
        }
        return runtime;
    }

    private List<TravelTrace> queryTraces(RideOrder order) {
        if (order == null || order.getId() == null) {
            return List.of();
        }
        return travelTraceMapper.selectList(new LambdaQueryWrapper<TravelTrace>()
                .eq(TravelTrace::getOrderId, order.getId())
                .orderByAsc(TravelTrace::getReportedAt)
                .orderByAsc(TravelTrace::getId));
    }

    private boolean isDemoTrace(TravelTrace trace) {
        return trace != null
                && StringUtils.hasText(trace.getRemark())
                && trace.getRemark().toUpperCase().startsWith("DEMO_ROUTE");
    }

    private GeoPoint resolveDriverStartPoint(RideOrder order, List<TravelTrace> traces) {
        if (!traces.isEmpty()) {
            TravelTrace first = traces.get(0);
            return geoPoint(first.getLatitude(), first.getLongitude());
        }
        return resolveStartPoint(order);
    }

    private String resolvePhase(String status) {
        if (OrderStatus.FINISHED.equals(status)) {
            return "trip";
        }
        if (OrderStatus.CANCELLED.equals(status)) {
            return "terminal";
        }
        if (OrderStatus.IN_TRIP.equals(status)) {
            return "trip";
        }
        return "approach";
    }

    private String resolvePhaseText(String status, boolean driverArrived) {
        if (OrderStatus.FINISHED.equals(status)) {
            return "已完成";
        }
        if (OrderStatus.CANCELLED.equals(status)) {
            return "已取消";
        }
        if (OrderStatus.IN_TRIP.equals(status)) {
            return "行程中";
        }
        if (driverArrived) {
            return "司机已到达";
        }
        if (OrderStatus.ACCEPTED.equals(status) || OrderStatus.PICKING_UP.equals(status)) {
            return "接驾中";
        }
        return "等待派单";
    }

    private String resolveDisplayText(String status, boolean waitingRedLight, String trafficText, String waitingText, String phaseText) {
        if (OrderStatus.FINISHED.equals(status)) {
            return "行程已完成";
        }
        if (OrderStatus.CANCELLED.equals(status)) {
            return "订单已取消";
        }
        if (waitingRedLight) {
            return firstText(waitingText, "红灯等待中");
        }
        return firstText(trafficText, phaseText);
    }

    private GeoPoint resolveCurrentPoint(RideOrder order, TravelTrace leaderTrace, boolean finished, boolean cancelled) {
        if (leaderTrace != null) {
            return geoPoint(leaderTrace.getLatitude(), leaderTrace.getLongitude());
        }
        if (finished) {
            return resolveEndPoint(order);
        }
        return cancelled ? resolveStartPoint(order) : resolveStartPoint(order);
    }

    /** 从 remark 的 DEMO_ROUTE:phase 头部解析轨迹阶段（approach/trip），非演示轨迹返回空串。 */
    private String tracePhase(TravelTrace trace) {
        String remark = trace == null ? null : trace.getRemark();
        if (!StringUtils.hasText(remark) || !remark.toUpperCase().startsWith("DEMO_ROUTE")) {
            return "";
        }
        String head = remark.split(";")[0];
        int index = head.indexOf(':');
        return index >= 0 ? head.substring(index + 1).trim().toLowerCase() : "";
    }

    /**
     * 领先者仲裁：在最近的轨迹窗口内，取最先进阶段（trip 优先于 approach）中进度百分比最高的一条。
     * 两个司机端同时上报时，各自的模拟器进度不同且交替写入，取“最新”会让展示在两组坐标间跳动；
     * 取“领先”则展示单调向前，且两个模拟器的路线端点一致（接驾终于上车点、行程终于目的地），收敛后位置稳定。
     */
    private TravelTrace selectLeadingTrace(List<TravelTrace> traces, TravelTrace latestTrace) {
        if (traces.isEmpty() || latestTrace == null) {
            return latestTrace;
        }
        int windowStart = Math.max(0, traces.size() - 60);
        List<TravelTrace> window = traces.subList(windowStart, traces.size());
        String displayPhase = "";
        for (TravelTrace trace : window) {
            String phase = tracePhase(trace);
            if ("trip".equals(phase)) {
                displayPhase = "trip";
                break;
            }
            if ("approach".equals(phase) && !"trip".equals(displayPhase)) {
                displayPhase = "approach";
            }
        }
        if (!StringUtils.hasText(displayPhase)) {
            return latestTrace;
        }
        TravelTrace leader = null;
        int leaderPercent = -1;
        for (TravelTrace trace : window) {
            if (!displayPhase.equals(tracePhase(trace))) {
                continue;
            }
            Integer percent = intMetric(parseTraceRemarkMetrics(trace), "percent");
            int value = percent == null ? -1 : percent;
            if (value >= leaderPercent) {
                // 同进度取更新的一条，保证等待恢复后位置继续前进
                leader = trace;
                leaderPercent = value;
            }
        }
        return leader == null ? latestTrace : leader;
    }

    private BigDecimal resolveTraveledDistance(RideOrder order, List<TravelTrace> traces, boolean finished, boolean cancelled) {
        if (cancelled) {
            return BigDecimal.ZERO;
        }
        if (finished && positive(order.getActualDistanceKm())) {
            return order.getActualDistanceKm();
        }
        BigDecimal traceDistance = traceDistanceKm(traces);
        if (traceDistance.compareTo(BigDecimal.ZERO) > 0) {
            return traceDistance;
        }
        if (finished) {
            return safeDistance(order.getEstimatedDistanceKm());
        }
        return positive(order.getActualDistanceKm()) ? order.getActualDistanceKm() : BigDecimal.ZERO;
    }

    private BigDecimal resolveTotalDistance(RideOrder order, BigDecimal traveledDistanceKm) {
        if (positive(order.getActualDistanceKm())) {
            return order.getActualDistanceKm().max(traveledDistanceKm);
        }
        if (positive(order.getEstimatedDistanceKm())) {
            return order.getEstimatedDistanceKm().max(traveledDistanceKm);
        }
        return traveledDistanceKm;
    }

    private long resolveUsedSeconds(RideOrder order, List<TravelTrace> traces, String phase, boolean finished, boolean cancelled) {
        if (cancelled) {
            return 0L;
        }
        if (finished && positive(order.getActualDurationMin())) {
            return order.getActualDurationMin().multiply(BigDecimal.valueOf(60)).longValue();
        }
        if (finished && order.getStartedAt() != null && order.getFinishedAt() != null) {
            return Math.max(0L, Duration.between(order.getStartedAt(), order.getFinishedAt()).getSeconds());
        }
        if (!traces.isEmpty()) {
            LocalDateTime first = traces.get(0).getReportedAt();
            LocalDateTime last = traces.get(traces.size() - 1).getReportedAt();
            if (first != null && last != null && !last.isBefore(first)) {
                return Duration.between(first, last).getSeconds();
            }
        }
        LocalDateTime start = "trip".equals(phase) ? order.getStartedAt() : order.getAcceptedAt();
        if (start == null) {
            start = order.getCreatedAt();
        }
        return start == null ? 0L : Math.max(0L, Duration.between(start, LocalDateTime.now(DEFAULT_ZONE_ID)).getSeconds());
    }

    private long resolveTotalSeconds(RideOrder order, long usedSeconds, boolean finished, boolean cancelled) {
        if (cancelled) {
            return 0L;
        }
        if (finished) {
            return usedSeconds;
        }
        if (positive(order.getActualDurationMin())) {
            return Math.max(usedSeconds, order.getActualDurationMin().multiply(BigDecimal.valueOf(60)).longValue());
        }
        if (positive(order.getEstimatedDurationMin())) {
            return Math.max(usedSeconds, order.getEstimatedDurationMin().multiply(BigDecimal.valueOf(60)).longValue());
        }
        return usedSeconds;
    }

    private int resolvePercent(String status, BigDecimal traveledDistanceKm, BigDecimal totalDistanceKm) {
        if (OrderStatus.FINISHED.equals(status)) {
            return 100;
        }
        if (OrderStatus.CANCELLED.equals(status)) {
            return 0;
        }
        if (totalDistanceKm.compareTo(BigDecimal.ZERO) > 0 && traveledDistanceKm.compareTo(BigDecimal.ZERO) > 0) {
            return clampPercent(traveledDistanceKm
                    .multiply(BigDecimal.valueOf(100))
                    .divide(totalDistanceKm, 0, RoundingMode.HALF_UP)
                    .intValue());
        }
        if (OrderStatus.IN_TRIP.equals(status)) {
            return 50;
        }
        if (OrderStatus.PICKING_UP.equals(status)) {
            return 35;
        }
        if (OrderStatus.ACCEPTED.equals(status)) {
            return 20;
        }
        return 0;
    }

    private boolean resolveDriverArrived(RideOrder order, String phase, GeoPoint currentPoint, BigDecimal remainDistanceKm) {
        if (!"approach".equals(phase)) {
            return false;
        }
        BigDecimal distanceToStart = BigDecimal.valueOf(geoDistanceKm(currentPoint, resolveStartPoint(order)));
        return distanceToStart.compareTo(DRIVER_ARRIVED_THRESHOLD_KM) <= 0
                || remainDistanceKm.compareTo(DRIVER_ARRIVED_THRESHOLD_KM) <= 0;
    }

    private BigDecimal resolveSpeedKmh(List<TravelTrace> traces) {
        if (traces.size() < 2) {
            return BigDecimal.ZERO;
        }
        TravelTrace previous = traces.get(traces.size() - 2);
        TravelTrace latest = traces.get(traces.size() - 1);
        if (previous.getReportedAt() == null || latest.getReportedAt() == null) {
            return BigDecimal.ZERO;
        }
        long seconds = Duration.between(previous.getReportedAt(), latest.getReportedAt()).getSeconds();
        if (seconds <= 0) {
            return BigDecimal.ZERO;
        }
        double distanceKm = geoDistanceKm(
                geoPoint(previous.getLatitude(), previous.getLongitude()),
                geoPoint(latest.getLatitude(), latest.getLongitude()));
        return BigDecimal.valueOf(distanceKm * 3600D / seconds).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal traceDistanceKm(List<TravelTrace> traces) {
        if (traces.size() < 2) {
            return BigDecimal.ZERO;
        }
        double distanceKm = 0D;
        for (int index = 1; index < traces.size(); index += 1) {
            distanceKm += geoDistanceKm(
                    geoPoint(traces.get(index - 1).getLatitude(), traces.get(index - 1).getLongitude()),
                    geoPoint(traces.get(index).getLatitude(), traces.get(index).getLongitude()));
        }
        return BigDecimal.valueOf(distanceKm).setScale(2, RoundingMode.HALF_UP);
    }

    private GeoPoint resolveStartPoint(RideOrder order) {
        return geoPoint(order.getStartLat(), order.getStartLng());
    }

    private GeoPoint resolveEndPoint(RideOrder order) {
        return geoPoint(order.getEndLat(), order.getEndLng());
    }

    private GeoPoint geoPoint(String latitude, String longitude) {
        return new GeoPoint(parse(latitude), parse(longitude));
    }

    private double parse(String value) {
        try {
            return Double.parseDouble(Objects.toString(value, "0"));
        } catch (Exception exception) {
            return 0D;
        }
    }

    private double geoDistanceKm(GeoPoint start, GeoPoint end) {
        double earthRadius = 6371D;
        double deltaLat = Math.toRadians(end.latitude() - start.latitude());
        double deltaLng = Math.toRadians(end.longitude() - start.longitude());
        double a = Math.sin(deltaLat / 2D) * Math.sin(deltaLat / 2D)
                + Math.cos(Math.toRadians(start.latitude())) * Math.cos(Math.toRadians(end.latitude()))
                * Math.sin(deltaLng / 2D) * Math.sin(deltaLng / 2D);
        return earthRadius * 2D * Math.atan2(Math.sqrt(a), Math.sqrt(1D - a));
    }

    private BigDecimal safeDistance(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private boolean positive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private int clampPercent(int value) {
        return Math.min(100, Math.max(0, value));
    }

    private BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private long safeLong(Long value) {
        return value == null ? 0L : Math.max(0L, value);
    }

    private String firstText(String first, String fallback) {
        return StringUtils.hasText(first) ? first : Objects.toString(fallback, "");
    }

    private Map<String, String> parseTraceRemarkMetrics(TravelTrace trace) {
        Map<String, String> metrics = new LinkedHashMap<>();
        if (trace == null || !StringUtils.hasText(trace.getRemark())) {
            return metrics;
        }
        String[] parts = trace.getRemark().split(";");
        for (String part : parts) {
            int index = part.indexOf('=');
            if (index <= 0 || index >= part.length() - 1) {
                continue;
            }
            metrics.put(part.substring(0, index).trim(), part.substring(index + 1).trim());
        }
        return metrics;
    }

    private BigDecimal decimalMetric(Map<String, String> metrics, String key) {
        try {
            String value = metrics.get(key);
            return StringUtils.hasText(value) ? new BigDecimal(value).setScale(2, RoundingMode.HALF_UP) : null;
        } catch (Exception exception) {
            return null;
        }
    }

    private Long longMetric(Map<String, String> metrics, String key) {
        try {
            String value = metrics.get(key);
            return StringUtils.hasText(value) ? Math.max(0L, Math.round(Double.parseDouble(value))) : null;
        } catch (Exception exception) {
            return null;
        }
    }

    private Integer intMetric(Map<String, String> metrics, String key) {
        Long value = longMetric(metrics, key);
        return value == null ? null : value.intValue();
    }

    private Map<String, Object> pointMap(GeoPoint point) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("latitude", BigDecimal.valueOf(point.latitude()).setScale(6, RoundingMode.HALF_UP));
        row.put("longitude", BigDecimal.valueOf(point.longitude()).setScale(6, RoundingMode.HALF_UP));
        return row;
    }

    private List<Map<String, Object>> pointMapList(List<TravelTrace> traces) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (TravelTrace trace : traces) {
            rows.add(pointMap(geoPoint(trace.getLatitude(), trace.getLongitude())));
        }
        return rows;
    }

    public record GeoPoint(double latitude, double longitude) {
    }
}
