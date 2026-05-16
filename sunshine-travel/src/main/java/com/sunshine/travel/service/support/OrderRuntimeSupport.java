package com.sunshine.travel.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.OrderStatus;
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
        return buildRuntimeInternal(order, false);
    }

    public Map<String, Object> buildRuntime(RideOrder order) {
        return buildRuntimeInternal(order, true);
    }

    public void warmUpRoutes(RideOrder order) {
        // Runtime is now based on miniapp-reported trace rows, not generated routes.
    }

    private Map<String, Object> buildRuntimeInternal(RideOrder order, boolean includeTracePoints) {
        List<TravelTrace> traces = queryTraces(order);
        String status = Objects.toString(order.getOrderStatus(), "");
        boolean finished = OrderStatus.FINISHED.equals(status);
        boolean cancelled = OrderStatus.CANCELLED.equals(status);
        String phase = resolvePhase(status);
        GeoPoint currentPoint = resolveCurrentPoint(order, traces, finished, cancelled);
        BigDecimal traveledDistanceKm = resolveTraveledDistance(order, traces, finished, cancelled);
        BigDecimal totalDistanceKm = resolveTotalDistance(order, traveledDistanceKm);
        BigDecimal remainDistanceKm = finished || cancelled
                ? BigDecimal.ZERO
                : totalDistanceKm.subtract(traveledDistanceKm).max(BigDecimal.ZERO);
        long usedSeconds = resolveUsedSeconds(order, traces, phase, finished, cancelled);
        long totalSeconds = resolveTotalSeconds(order, usedSeconds, finished, cancelled);
        long remainingSeconds = finished || cancelled ? 0L : Math.max(0L, totalSeconds - usedSeconds);
        int percent = resolvePercent(status, traveledDistanceKm, totalDistanceKm);
        TravelTrace latestTrace = traces.isEmpty() ? null : traces.get(traces.size() - 1);
        boolean demoTrace = isDemoTrace(latestTrace);
        BigDecimal speedKmh = latestTrace != null && latestTrace.getSpeedKmh() != null
                ? latestTrace.getSpeedKmh()
                : resolveSpeedKmh(traces);
        boolean waitingRedLight = latestTrace != null && Boolean.TRUE.equals(latestTrace.getWaitingRedLight());
        long waitSeconds = latestTrace == null ? 0L : safeLong(latestTrace.getWaitSeconds());
        long currentWaitSeconds = latestTrace == null ? 0L : safeLong(latestTrace.getCurrentWaitSeconds());
        String trafficText = latestTrace == null ? "" : firstText(latestTrace.getTrafficText(), demoTrace ? "演示轨迹同步中" : "实时轨迹同步中");
        String waitingText = latestTrace == null ? "" : firstText(latestTrace.getWaitingText(), waitingRedLight ? "红灯等待中" : "");
        Map<String, String> traceMetrics = parseTraceRemarkMetrics(latestTrace);
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
        boolean driverArrived = !traces.isEmpty() && resolveDriverArrived(order, phase, currentPoint, remainDistanceKm);

        Map<String, Object> runtime = new LinkedHashMap<>();
        runtime.put("phase", phase);
        runtime.put("phaseText", resolvePhaseText(status, driverArrived));
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
            List<Map<String, Object>> tracePoints = pointMapList(traces);
            runtime.put("approachRoutePoints", OrderStatus.IN_TRIP.equals(status) || finished ? List.of() : tracePoints);
            runtime.put("tripRoutePoints", OrderStatus.IN_TRIP.equals(status) || finished ? tracePoints : List.of());
            runtime.put("traveledPoints", tracePoints);
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

    private GeoPoint resolveCurrentPoint(RideOrder order, List<TravelTrace> traces, boolean finished, boolean cancelled) {
        if (!traces.isEmpty()) {
            TravelTrace latest = traces.get(traces.size() - 1);
            return geoPoint(latest.getLatitude(), latest.getLongitude());
        }
        if (finished) {
            return resolveEndPoint(order);
        }
        return cancelled ? resolveStartPoint(order) : resolveStartPoint(order);
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
