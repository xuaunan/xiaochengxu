package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sunshine.travel.common.AuthStatus;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CouponType;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.common.PayStatus;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.ServiceType;
import com.sunshine.travel.common.WithdrawStatus;
import com.sunshine.travel.dto.AdminComplaintHandleRequest;
import com.sunshine.travel.dto.AdminCouponStatusRequest;
import com.sunshine.travel.dto.AdminDriverUpdateRequest;
import com.sunshine.travel.dto.AdminInvoiceHandleRequest;
import com.sunshine.travel.dto.AdminOrderStatusRequest;
import com.sunshine.travel.dto.AdminRefundRequest;
import com.sunshine.travel.dto.AdminResetPasswordRequest;
import com.sunshine.travel.dto.AdminUserSaveRequest;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.SystemConfigSaveRequest;
import com.sunshine.travel.dto.SystemNoticeSaveRequest;
import com.sunshine.travel.dto.SystemVersionSaveRequest;
import com.sunshine.travel.dto.UserAuditRequest;
import com.sunshine.travel.dto.UserEnableRequest;
import com.sunshine.travel.dto.WithdrawAuditRequest;
import com.sunshine.travel.entity.Complaint;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PaymentRecord;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.SystemConfig;
import com.sunshine.travel.entity.TravelTrace;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.entity.WithdrawApplication;
import com.sunshine.travel.mapper.ComplaintMapper;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PaymentRecordMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.mapper.TravelTraceMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.mapper.WithdrawApplicationMapper;
import com.sunshine.travel.service.AdminService;
import com.sunshine.travel.service.OrderService;
import com.sunshine.travel.service.support.OperationLogSupport;
import com.sunshine.travel.vo.DashboardVO;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Primary
@Service
public class AdminServiceFacade implements AdminService {

    private static final BigDecimal DEFAULT_COMMISSION_RATE = BigDecimal.valueOf(0.20);

    private final AdminServiceImpl delegate;
    private final PlatformUserMapper platformUserMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final RideOrderMapper rideOrderMapper;
    private final ComplaintMapper complaintMapper;
    private final PaymentRecordMapper paymentRecordMapper;
    private final TravelTraceMapper travelTraceMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponMapper couponMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final WithdrawApplicationMapper withdrawApplicationMapper;
    private final OperationLogSupport operationLogSupport;
    private final OrderService orderService;

    public AdminServiceFacade(AdminServiceImpl delegate,
                              PlatformUserMapper platformUserMapper,
                              DriverProfileMapper driverProfileMapper,
                              RideOrderMapper rideOrderMapper,
                              ComplaintMapper complaintMapper,
                              PaymentRecordMapper paymentRecordMapper,
                              TravelTraceMapper travelTraceMapper,
                              UserCouponMapper userCouponMapper,
                              CouponMapper couponMapper,
                              SystemConfigMapper systemConfigMapper,
                              WithdrawApplicationMapper withdrawApplicationMapper,
                              OperationLogSupport operationLogSupport,
                              OrderService orderService) {
        this.delegate = delegate;
        this.platformUserMapper = platformUserMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.rideOrderMapper = rideOrderMapper;
        this.complaintMapper = complaintMapper;
        this.paymentRecordMapper = paymentRecordMapper;
        this.travelTraceMapper = travelTraceMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponMapper = couponMapper;
        this.systemConfigMapper = systemConfigMapper;
        this.withdrawApplicationMapper = withdrawApplicationMapper;
        this.operationLogSupport = operationLogSupport;
        this.orderService = orderService;
    }

    @Override
    public DashboardVO dashboard(String range) {
        String normalizedRange = normalizeRange(range);
        LocalDate today = LocalDate.now();
        LocalDateTime yesterdayStart = today.minusDays(1).atStartOfDay();
        LocalDateTime todayStart = today.atStartOfDay();
        List<PlatformUser> users = platformUserMapper.selectList(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getRoleCode, RoleCode.USER));
        List<DriverProfile> drivers = driverProfileMapper.selectList(new LambdaQueryWrapper<DriverProfile>()
                .orderByDesc(DriverProfile::getId));
        List<RideOrder> allOrders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .orderByDesc(RideOrder::getCreatedAt));
        List<Complaint> complaints = complaintMapper.selectList(new LambdaQueryWrapper<Complaint>()
                .orderByDesc(Complaint::getCreatedAt));
        List<RideOrder> paidOrders = allOrders.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .toList();
        List<RideOrder> finishedPaidOrders = paidOrders.stream()
                .filter(item -> OrderStatus.FINISHED.equals(item.getOrderStatus()))
                .toList();

        BigDecimal commissionRate = getDecimalConfig("platformCommissionRate", DEFAULT_COMMISSION_RATE);
        BigDecimal totalTurnover = sumOrderAmount(paidOrders);
        BigDecimal yesterdayTurnover = sumOrderAmount(paidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart))
                .toList());
        BigDecimal beforeYesterdayTurnover = sumOrderAmount(paidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart.minusDays(1), yesterdayStart))
                .toList());
        BigDecimal totalCommission = sumCommission(finishedPaidOrders, commissionRate);
        BigDecimal yesterdayCommission = sumCommission(finishedPaidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart))
                .toList(), commissionRate);
        BigDecimal beforeYesterdayCommission = sumCommission(finishedPaidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart.minusDays(1), yesterdayStart))
                .toList(), commissionRate);
        long complaintTotal = complaints.size();
        long resolvedComplaintTotal = complaints.stream()
                .filter(item -> "DONE".equalsIgnoreCase(item.getHandleStatus()))
                .count();
        long unresolvedComplaintTotal = complaintTotal - resolvedComplaintTotal;
        List<RideOrder> scopedOrders = filterOrdersByRange(allOrders, normalizedRange);
        BigDecimal scopedTurnover = sumOrderAmount(scopedOrders.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .toList());

        return DashboardVO.builder()
                .range(normalizedRange)
                .todayOrderTotal((long) scopedOrders.size())
                .todayTurnover(scopedTurnover)
                .activeUserTotal(scopedOrders.stream().map(RideOrder::getUserId).filter(Objects::nonNull).distinct().count())
                .complaintRate(calcPercent(resolvedComplaintTotal, Math.max(complaintTotal, 1)))
                .userTotal((long) users.size())
                .verifiedUserTotal(users.stream().filter(item -> Objects.equals(item.getAuthStatus(), AuthStatus.APPROVED)).count())
                .unverifiedUserTotal(users.stream().filter(item -> !Objects.equals(item.getAuthStatus(), AuthStatus.APPROVED)).count())
                .newUserDelta(users.stream().filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart)).count())
                .driverTotal((long) drivers.size())
                .approvedDriverTotal(drivers.stream().filter(item -> Objects.equals(item.getAuditStatus(), AuthStatus.APPROVED)).count())
                .pendingDriverTotal(drivers.stream().filter(item -> !Objects.equals(item.getAuditStatus(), AuthStatus.APPROVED)).count())
                .newDriverDelta(drivers.stream().filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart)).count())
                .orderTotal((long) allOrders.size())
                .taxiOrderTotal(allOrders.stream().filter(item -> ServiceType.TAXI.equals(item.getServiceType())).count())
                .carpoolOrderTotal(allOrders.stream().filter(item -> ServiceType.CARPOOL.equals(item.getServiceType())).count())
                .internationalOrderTotal(allOrders.stream().filter(item -> ServiceType.INTERNATIONAL.equals(item.getServiceType())).count())
                .newOrderDelta(allOrders.stream().filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart)).count())
                .turnoverTotal(totalTurnover)
                .yesterdayTurnover(yesterdayTurnover)
                .turnoverDeltaRate(calcDeltaRate(yesterdayTurnover, beforeYesterdayTurnover))
                .taxiTurnover(sumOrderAmountByService(paidOrders, ServiceType.TAXI))
                .carpoolTurnover(sumOrderAmountByService(paidOrders, ServiceType.CARPOOL))
                .internationalTurnover(sumOrderAmountByService(paidOrders, ServiceType.INTERNATIONAL))
                .commissionTotal(totalCommission)
                .yesterdayCommission(yesterdayCommission)
                .commissionDeltaRate(calcDeltaRate(yesterdayCommission, beforeYesterdayCommission))
                .complaintTotal(complaintTotal)
                .resolvedComplaintTotal(resolvedComplaintTotal)
                .unresolvedComplaintTotal(unresolvedComplaintTotal)
                .complaintResolveRate(calcPercent(resolvedComplaintTotal, Math.max(complaintTotal, 1)))
                .trend(buildDashboardTrend(normalizedRange, allOrders))
                .latestOrders(allOrders.stream().limit(10).map(this::mapOrderRow).toList())
                .businessShare(buildBusinessShare(allOrders, paidOrders))
                .operations(buildOperationsSummary(allOrders, complaints))
                .userCityDistribution(buildUserCityDistribution(users, allOrders))
                .rideRegionDistribution(buildRideRegionDistribution(allOrders))
                .driverScoreDistribution(buildDriverScoreDistribution(drivers))
                .generatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                .build();
    }

    @Override
    public List<Map<String, Object>> importantMessages() {
        return delegate.importantMessages();
    }

    @Override
    public PageResult<Map<String, Object>> users(long current, long size, String keyword, String roleCode) {
        return delegate.users(current, size, keyword, roleCode);
    }

    @Override
    public Map<String, Object> userDetail(Long userId) {
        return delegate.userDetail(userId);
    }

    @Override
    public Map<String, Object> createUser(AdminUserSaveRequest request) {
        return delegate.createUser(request);
    }

    @Override
    public Map<String, Object> updateUser(Long userId, AdminUserSaveRequest request) {
        return delegate.updateUser(userId, request);
    }

    @Override
    public void resetUserPassword(Long userId, AdminResetPasswordRequest request) {
        delegate.resetUserPassword(userId, request);
    }

    @Override
    public PageResult<Map<String, Object>> drivers(long current, long size, String keyword, Integer auditStatus, String serviceStatus) {
        return delegate.drivers(current, size, keyword, auditStatus, serviceStatus);
    }

    @Override
    public Map<String, Object> driverDetail(Long driverId) {
        return delegate.driverDetail(driverId);
    }

    @Override
    public Map<String, Object> updateDriver(Long driverId, AdminDriverUpdateRequest request) {
        return delegate.updateDriver(driverId, request);
    }

    @Override
    public PageResult<Map<String, Object>> orders(long current, long size, String keyword, String status, String serviceType) {
        Page<RideOrder> page = rideOrderMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<RideOrder>()
                .and(StringUtils.hasText(keyword), q -> q.like(RideOrder::getOrderNo, keyword)
                        .or()
                        .like(RideOrder::getStartName, keyword)
                        .or()
                        .like(RideOrder::getEndName, keyword))
                .eq(StringUtils.hasText(status), RideOrder::getOrderStatus, status)
                .eq(StringUtils.hasText(serviceType), RideOrder::getServiceType, serviceType)
                .orderByDesc(RideOrder::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(item -> {
            RideOrder synced = orderService.detail(item.getId());
            Map<String, Object> row = mapOrderRow(synced);
            row.put("runtime", orderService.runtime(synced.getId()));
            return row;
        }).toList());
    }

    @Override
    public Map<String, Object> orderDetail(Long orderId) {
        RideOrder order = orderService.detail(orderId);
        PlatformUser user = platformUserMapper.selectById(order.getUserId());
        PlatformUser driver = order.getDriverId() == null ? null : platformUserMapper.selectById(order.getDriverId());
        Map<String, Object> runtime = orderService.runtime(orderId);
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> orderRow = mapOrderRow(order);
        orderRow.put("runtime", runtime);
        result.put("order", orderRow);
        result.put("rawOrder", order);
        result.put("user", user == null ? null : mapUserRow(user));
        result.put("driver", driver == null ? null : mapUserRow(driver));
        result.put("trackList", travelTraceMapper.selectList(new LambdaQueryWrapper<TravelTrace>()
                        .eq(TravelTrace::getOrderId, orderId)
                        .orderByAsc(TravelTrace::getReportedAt))
                .stream()
                .map(this::mapTraceRow)
                .toList());
        result.put("payments", paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                        .eq(PaymentRecord::getOrderId, orderId)
                        .orderByDesc(PaymentRecord::getId))
                .stream()
                .map(this::mapPaymentRow)
                .toList());
        result.put("complaints", complaintMapper.selectList(new LambdaQueryWrapper<Complaint>()
                        .eq(Complaint::getOrderId, orderId)
                        .orderByDesc(Complaint::getId))
                .stream()
                .map(this::mapComplaintRow)
                .toList());
        result.put("runtime", runtime);
        result.put("refundAllowed", isRefundAllowed(order));
        return result;
    }

    @Override
    public void updateOrderStatus(Long orderId, AdminOrderStatusRequest request) {
        delegate.updateOrderStatus(orderId, request);
    }

    @Override
    public void cancelOrder(Long orderId, String reason) {
        delegate.cancelOrder(orderId, reason);
    }

    @Override
    @Transactional
    public void refundOrder(Long orderId, AdminRefundRequest request) {
        RideOrder order = orderService.detail(orderId);
        if (PayStatus.REFUNDED.equals(order.getPayStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "订单已退款");
        }
        if (OrderStatus.CANCELLED.equals(order.getOrderStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "已取消订单不支持退款");
        }
        if (!isRefundAllowed(order)) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "仅待支付或已完成订单支持退款");
        }
        LocalDateTime now = LocalDateTime.now();
        BigDecimal refundAmount = PayStatus.PAID.equals(order.getPayStatus()) ? safeDecimal(order.getPayableAmount()) : BigDecimal.ZERO;
        String previousSettlementStatus = order.getSettlementStatus();
        order.setPayStatus(PayStatus.REFUNDED);
        order.setSettlementStatus("REFUNDED");
        order.setRefundAmount(refundAmount);
        order.setRefundReason(request.getReason());
        order.setRefundedAt(now);
        order.setPlatformCommissionAmount(BigDecimal.ZERO);
        order.setDriverIncomeAmount(BigDecimal.ZERO);
        if (!OrderStatus.FINISHED.equals(order.getOrderStatus())) {
            order.setOrderStatus(OrderStatus.CANCELLED);
            order.setCancelReason(request.getReason());
            order.setCancelByRole(RoleCode.ADMIN);
        }
        order.setRemark((StringUtils.hasText(order.getRemark()) ? order.getRemark() + " | " : "") + "退款原因：" + request.getReason());
        rideOrderMapper.updateById(order);
        paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>().eq(PaymentRecord::getOrderId, orderId))
                .forEach(item -> {
                    item.setPayStatus(PayStatus.REFUNDED);
                    item.setRefundAmount(safeDecimal(item.getPayAmount()));
                    item.setRefundReason(request.getReason());
                    item.setRefundedAt(now);
                    paymentRecordMapper.updateById(item);
                });
        if ("DONE".equals(previousSettlementStatus)) {
            rollbackDriverIncome(order);
        }
        restoreRefundCoupon(order);
        releaseDriverIfOrderClosed(order);
        operationLogSupport.log("ORDER", "REFUND", "ORDER", orderId, "管理员退款：" + request.getReason());
    }

    @Override
    public PageResult<Map<String, Object>> withdraws(long current, long size, String status) {
        return delegate.withdraws(current, size, status);
    }

    @Override
    public PageResult<Map<String, Object>> coupons(long current, long size, String keyword, Integer status) {
        return delegate.coupons(current, size, keyword, status);
    }

    @Override
    @Transactional
    public Map<String, Object> updateCoupon(Long couponId, CouponCreateRequest request) {
        validateCouponRequest(request);
        Coupon coupon = requireCoupon(couponId);
        int issuedCount = Math.max(safeInteger(coupon.getTotalCount()) - safeInteger(coupon.getRemainCount()), 0);
        if (request.getTotalCount() < issuedCount) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "总库存不能小于已发放数量");
        }
        coupon.setCouponName(request.getCouponName());
        coupon.setCouponType(request.getCouponType());
        coupon.setServiceScope(request.getServiceScope());
        coupon.setThresholdAmount(request.getThresholdAmount());
        coupon.setDiscountAmount(CouponType.CASH.equals(request.getCouponType()) ? request.getDiscountAmount() : null);
        coupon.setDiscountRate(CouponType.DISCOUNT.equals(request.getCouponType()) ? request.getDiscountRate() : null);
        coupon.setStackable(request.getStackable());
        coupon.setTotalCount(request.getTotalCount());
        coupon.setRemainCount(request.getTotalCount() - issuedCount);
        coupon.setReceiveLimitPerUser(request.getReceiveLimitPerUser());
        coupon.setValidStartTime(request.getValidStartTime());
        coupon.setValidEndTime(request.getValidEndTime());
        coupon.setRuleDesc(request.getRuleDesc());
        couponMapper.updateById(coupon);
        operationLogSupport.log("COUPON", "UPDATE", "COUPON", couponId, "管理员编辑优惠券模板");
        return mapCouponRow(coupon);
    }

    @Override
    @Transactional
    public void updateCouponStatus(Long couponId, AdminCouponStatusRequest request) {
        if (!List.of(0, 1).contains(request.getStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "优惠券状态不合法");
        }
        delegate.updateCouponStatus(couponId, request);
    }

    @Override
    public PageResult<Map<String, Object>> couponOperationRecords(long current, long size, Long couponId, Long userId) {
        return delegate.couponOperationRecords(current, size, couponId, userId);
    }

    @Override
    @Transactional
    public void handleComplaint(Long complaintId, AdminComplaintHandleRequest request) {
        Complaint complaint = complaintMapper.selectById(complaintId);
        if (complaint == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "投诉记录不存在");
        }
        complaint.setHandleStatus("DONE");
        complaint.setHandleResult(request.getHandleResult().trim());
        complaint.setHandleTime(LocalDateTime.now());
        complaintMapper.updateById(complaint);

        RideOrder order = rideOrderMapper.selectById(complaint.getOrderId());
        if (order != null) {
            long pendingCount = complaintMapper.selectCount(new LambdaQueryWrapper<Complaint>()
                    .eq(Complaint::getOrderId, order.getId())
                    .ne(Complaint::getHandleStatus, "DONE"));
            order.setComplaintStatus(pendingCount > 0 ? "PENDING" : "DONE");
            rideOrderMapper.updateById(order);
        }
        operationLogSupport.log("COMPLAINT", "HANDLE", "COMPLAINT", complaintId, "管理员处理投诉");
    }

    @Override
    public void handleInvoice(Long orderId, AdminInvoiceHandleRequest request) {
        delegate.handleInvoice(orderId, request);
    }

    @Override
    public PageResult<Map<String, Object>> logs(long current, long size, String module) {
        return delegate.logs(current, size, module);
    }

    @Override
    public void auditUser(Long userId, UserAuditRequest request) {
        delegate.auditUser(userId, request);
    }

    @Override
    public void enableUser(Long userId, UserEnableRequest request) {
        delegate.enableUser(userId, request);
    }

    @Override
    public void auditDriver(Long driverId, UserAuditRequest request) {
        delegate.auditDriver(driverId, request);
    }

    @Override
    public void auditWithdraw(Long withdrawId, WithdrawAuditRequest request) {
        delegate.auditWithdraw(withdrawId, request);
    }

    @Override
    public Map<String, Object> financeSummary() {
        BigDecimal commissionRate = getDecimalConfig("platformCommissionRate", DEFAULT_COMMISSION_RATE);
        List<RideOrder> paidOrders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getPayStatus, PayStatus.PAID));
        BigDecimal totalRevenue = sumOrderAmount(paidOrders);
        BigDecimal totalCommission = sumCommission(paidOrders.stream()
                .filter(item -> OrderStatus.FINISHED.equals(item.getOrderStatus()))
                .toList(), commissionRate);
        BigDecimal totalDriverIncome = paidOrders.stream()
                .map(item -> safeDecimal(item.getActualAmount()).subtract(safeDecimal(item.getActualAmount()).multiply(commissionRate)))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal pendingWithdrawAmount = withdrawApplicationMapper.selectList(new LambdaQueryWrapper<WithdrawApplication>()
                        .eq(WithdrawApplication::getStatus, WithdrawStatus.PENDING))
                .stream()
                .map(WithdrawApplication::getApplyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("totalRevenue", totalRevenue);
        map.put("totalCommission", totalCommission);
        map.put("totalDriverIncome", totalDriverIncome);
        map.put("pendingWithdrawAmount", pendingWithdrawAmount);
        map.put("pendingWithdrawCount", withdrawApplicationMapper.selectCount(new LambdaQueryWrapper<WithdrawApplication>()
                .eq(WithdrawApplication::getStatus, WithdrawStatus.PENDING)));
        map.put("paidOrderCount", paidOrders.size());
        return map;
    }

    @Override
    public List<Map<String, Object>> systemConfigs() {
        return delegate.systemConfigs();
    }

    @Override
    @Transactional
    public void saveSystemConfigs(SystemConfigSaveRequest request) {
        request.getItems().forEach(item -> validateSystemConfigValue(item.getConfigKey(), item.getConfigValue()));
        delegate.saveSystemConfigs(request);
    }

    @Override
    public PageResult<Map<String, Object>> notices(long current, long size, String keyword) {
        return delegate.notices(current, size, keyword);
    }

    @Override
    public Map<String, Object> createNotice(SystemNoticeSaveRequest request) {
        return delegate.createNotice(request);
    }

    @Override
    public Map<String, Object> updateNotice(Long noticeId, SystemNoticeSaveRequest request) {
        return delegate.updateNotice(noticeId, request);
    }

    @Override
    public PageResult<Map<String, Object>> versions(long current, long size, String clientType) {
        return delegate.versions(current, size, clientType);
    }

    @Override
    public Map<String, Object> createVersion(SystemVersionSaveRequest request) {
        return delegate.createVersion(request);
    }

    @Override
    public Map<String, Object> updateVersion(Long versionId, SystemVersionSaveRequest request) {
        return delegate.updateVersion(versionId, request);
    }

    private String normalizeRange(String range) {
        if ("week".equalsIgnoreCase(range)) {
            return "week";
        }
        if ("month".equalsIgnoreCase(range)) {
            return "month";
        }
        return "day";
    }

    private List<RideOrder> filterOrdersByRange(List<RideOrder> orders, String range) {
        LocalDateTime start = switch (range) {
            case "month" -> LocalDate.now().withDayOfMonth(1).atStartOfDay();
            case "week" -> LocalDate.now().with(DayOfWeek.MONDAY).atStartOfDay();
            default -> LocalDate.now().atStartOfDay();
        };
        return orders.stream()
                .filter(item -> item.getCreatedAt() != null && !item.getCreatedAt().isBefore(start))
                .toList();
    }

    private List<Map<String, Object>> buildDashboardTrend(String range, List<RideOrder> orders) {
        List<Map<String, Object>> trend = new ArrayList<>();
        LocalDate today = LocalDate.now();
        if ("week".equals(range)) {
            for (int i = 7; i >= 0; i--) {
                LocalDate startDay = today.with(DayOfWeek.MONDAY).minusWeeks(i);
                LocalDateTime start = startDay.atStartOfDay();
                LocalDateTime end = start.plusWeeks(1);
                trend.add(buildTrendItem(startDay.format(DateTimeFormatter.ofPattern("MM-dd")), orders, start, end));
            }
            return trend;
        }
        if ("month".equals(range)) {
            for (int i = 5; i >= 0; i--) {
                LocalDate startDay = today.withDayOfMonth(1).minusMonths(i);
                LocalDateTime start = startDay.atStartOfDay();
                LocalDateTime end = start.plusMonths(1);
                trend.add(buildTrendItem(startDay.format(DateTimeFormatter.ofPattern("yyyy-MM")), orders, start, end));
            }
            return trend;
        }
        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            LocalDateTime start = day.atStartOfDay();
            LocalDateTime end = start.plusDays(1);
            trend.add(buildTrendItem(day.format(DateTimeFormatter.ofPattern("MM-dd")), orders, start, end));
        }
        return trend;
    }

    private Map<String, Object> buildTrendItem(String label, List<RideOrder> orders, LocalDateTime start, LocalDateTime end) {
        List<RideOrder> scoped = orders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), start, end))
                .toList();
        BigDecimal turnover = scoped.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .map(item -> safeDecimal(item.getPayableAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("label", label);
        item.put("orderCount", scoped.size());
        item.put("turnover", turnover);
        return item;
    }

    private Map<String, Object> buildBusinessShare(List<RideOrder> orders, List<RideOrder> paidOrders) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderCountDimension", List.of(
                shareRow("即时打车", orders.stream().filter(item -> ServiceType.TAXI.equals(item.getServiceType())).count()),
                shareRow("顺风车", orders.stream().filter(item -> ServiceType.CARPOOL.equals(item.getServiceType())).count()),
                shareRow("国际出行", orders.stream().filter(item -> ServiceType.INTERNATIONAL.equals(item.getServiceType())).count())
        ));
        result.put("turnoverDimension", List.of(
                shareAmountRow("即时打车", sumOrderAmountByService(paidOrders, ServiceType.TAXI)),
                shareAmountRow("顺风车", sumOrderAmountByService(paidOrders, ServiceType.CARPOOL)),
                shareAmountRow("国际出行", sumOrderAmountByService(paidOrders, ServiceType.INTERNATIONAL))
        ));
        result.put("totalOrderCount", orders.size());
        result.put("totalTurnover", sumOrderAmount(paidOrders));
        return result;
    }

    private Map<String, Object> buildOperationsSummary(List<RideOrder> orders, List<Complaint> complaints) {
        long dispatchTotal = orders.stream().filter(item -> !OrderStatus.CANCELLED.equals(item.getOrderStatus())).count();
        long acceptedTotal = orders.stream().filter(item -> item.getDriverId() != null).count();
        long totalUserCoupons = userCouponMapper.selectCount(null);
        long usedUserCoupons = userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getCouponStatus, "USED"));
        long pendingDrivers = driverProfileMapper.selectCount(new LambdaQueryWrapper<DriverProfile>()
                .ne(DriverProfile::getAuditStatus, AuthStatus.APPROVED));
        long pendingComplaints = complaints.stream()
                .filter(item -> !"DONE".equalsIgnoreCase(item.getHandleStatus()))
                .count();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driverReceiveRate", calcPercent(acceptedTotal, Math.max(dispatchTotal, 1)));
        result.put("couponUseRate", calcPercent(usedUserCoupons, Math.max(totalUserCoupons, 1)));
        result.put("pendingDriverCount", pendingDrivers);
        result.put("pendingComplaintCount", pendingComplaints);
        return result;
    }

    private List<Map<String, Object>> buildUserCityDistribution(List<PlatformUser> users, List<RideOrder> orders) {
        Map<String, Long> cityCounter = new LinkedHashMap<>();
        users.forEach(user -> {
            String city = orders.stream()
                    .filter(item -> Objects.equals(item.getUserId(), user.getId()))
                    .findFirst()
                    .map(item -> inferCityName(item.getStartName()))
                    .orElse("未知");
            cityCounter.put(city, cityCounter.getOrDefault(city, 0L) + 1);
        });
        return cityCounter.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("city", entry.getKey());
                    row.put("count", entry.getValue());
                    return row;
                })
                .toList();
    }

    private Map<String, List<Map<String, Object>>> buildRideRegionDistribution(List<RideOrder> orders) {
        Map<String, Long> allCounter = new LinkedHashMap<>();
        Map<String, Long> taxiCounter = new LinkedHashMap<>();
        Map<String, Long> carpoolCounter = new LinkedHashMap<>();

        orders.stream()
                .filter(item -> ServiceType.TAXI.equals(item.getServiceType()) || ServiceType.CARPOOL.equals(item.getServiceType()))
                .forEach(item -> {
                    String locationName = StringUtils.hasText(item.getStartName()) ? item.getStartName() : item.getEndName();
                    String city = inferCityName(locationName);
                    allCounter.put(city, allCounter.getOrDefault(city, 0L) + 1);
                    if (ServiceType.TAXI.equals(item.getServiceType())) {
                        taxiCounter.put(city, taxiCounter.getOrDefault(city, 0L) + 1);
                    }
                    if (ServiceType.CARPOOL.equals(item.getServiceType())) {
                        carpoolCounter.put(city, carpoolCounter.getOrDefault(city, 0L) + 1);
                    }
                });

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        result.put("ALL", mapRegionRows(allCounter));
        result.put("TAXI", mapRegionRows(taxiCounter));
        result.put("CARPOOL", mapRegionRows(carpoolCounter));
        return result;
    }

    private List<Map<String, Object>> mapRegionRows(Map<String, Long> counter) {
        return counter.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("city", entry.getKey());
                    row.put("count", entry.getValue());
                    return row;
                })
                .toList();
    }

    private List<Map<String, Object>> buildDriverScoreDistribution(List<DriverProfile> drivers) {
        return List.of(
                scoreRow("5.0分", drivers.stream().filter(item -> safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(5)) >= 0).count()),
                scoreRow("4.0-4.9分", drivers.stream().filter(item -> safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(4)) >= 0
                        && safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(5)) < 0).count()),
                scoreRow("3.0-3.9分", drivers.stream().filter(item -> safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(3)) >= 0
                        && safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(4)) < 0).count()),
                scoreRow("3分以下", drivers.stream().filter(item -> safeDecimal(item.getScore()).compareTo(BigDecimal.valueOf(3)) < 0).count())
        );
    }

    private Map<String, Object> mapOrderRow(RideOrder item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("orderNo", item.getOrderNo());
        row.put("serviceType", item.getServiceType());
        row.put("status", item.getOrderStatus());
        row.put("displayStatus", PayStatus.REFUNDED.equals(item.getPayStatus()) ? "REFUNDED" : item.getOrderStatus());
        row.put("payStatus", item.getPayStatus());
        row.put("invoiceStatus", item.getInvoiceStatus());
        row.put("amount", item.getPayableAmount());
        row.put("actualAmount", item.getActualAmount());
        row.put("refundAmount", item.getRefundAmount());
        row.put("refundReason", item.getRefundReason());
        row.put("refundedAt", item.getRefundedAt());
        row.put("couponDiscount", item.getCouponDiscount());
        row.put("startName", item.getStartName());
        row.put("endName", item.getEndName());
        row.put("driverId", item.getDriverId());
        row.put("userId", item.getUserId());
        row.put("settlementStatus", item.getSettlementStatus());
        row.put("currencyCode", item.getCurrencyCode());
        row.put("platformCommissionAmount", item.getPlatformCommissionAmount());
        row.put("driverIncomeAmount", item.getDriverIncomeAmount());
        row.put("createdAt", item.getCreatedAt());
        row.put("remark", item.getRemark());
        row.put("refundAllowed", isRefundAllowed(item));
        return row;
    }

    private Map<String, Object> mapUserRow(PlatformUser item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("nickname", item.getNickname());
        row.put("phone", item.getPhone());
        row.put("roleCode", item.getRoleCode());
        row.put("enabled", item.getEnabled());
        row.put("authStatus", item.getAuthStatus());
        row.put("authRemark", item.getAuthRemark());
        row.put("realName", item.getRealName());
        row.put("idCard", item.getIdCard());
        row.put("avatar", item.getAvatar());
        row.put("emergencyContact", item.getEmergencyContact());
        row.put("emergencyPhone", item.getEmergencyPhone());
        row.put("walletBalance", item.getWalletBalance());
        row.put("defaultLanguage", item.getDefaultLanguage());
        row.put("createdAt", item.getCreatedAt());
        return row;
    }

    private Map<String, Object> mapPaymentRow(PaymentRecord item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("payNo", item.getPayNo());
        row.put("payChannel", item.getPayChannel());
        row.put("payStatus", item.getPayStatus());
        row.put("payAmount", item.getPayAmount());
        row.put("currencyCode", item.getCurrencyCode());
        row.put("paidAt", item.getPaidAt());
        row.put("refundAmount", item.getRefundAmount());
        row.put("refundReason", item.getRefundReason());
        row.put("refundedAt", item.getRefundedAt());
        row.put("displayTime", item.getRefundedAt() != null ? item.getRefundedAt() : item.getPaidAt());
        return row;
    }

    private Map<String, Object> mapComplaintRow(Complaint item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("complaintType", item.getComplaintType());
        row.put("content", item.getContent());
        row.put("handleStatus", item.getHandleStatus());
        row.put("handleResult", item.getHandleResult());
        row.put("handleTime", item.getHandleTime());
        row.put("createdAt", item.getCreatedAt());
        return row;
    }

    private Map<String, Object> mapTraceRow(TravelTrace item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("reportedAt", item.getReportedAt());
        row.put("bizRole", item.getBizRole());
        row.put("waitingRedLight", item.getWaitingRedLight());
        row.put("waitSeconds", item.getWaitSeconds());
        row.put("currentWaitSeconds", item.getCurrentWaitSeconds());
        row.put("trafficText", item.getTrafficText());
        row.put("waitingText", item.getWaitingText());
        row.put("speedKmh", item.getSpeedKmh());
        row.put("heading", item.getHeading());
        row.put("remark", item.getRemark());
        return row;
    }

    private Map<String, Object> mapCouponRow(Coupon item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("couponName", item.getCouponName());
        row.put("couponType", item.getCouponType());
        row.put("serviceScope", item.getServiceScope());
        row.put("thresholdAmount", item.getThresholdAmount());
        row.put("discountAmount", item.getDiscountAmount());
        row.put("discountRate", item.getDiscountRate());
        row.put("remainCount", item.getRemainCount());
        row.put("totalCount", item.getTotalCount());
        row.put("status", item.getStatus());
        row.put("receiveLimitPerUser", item.getReceiveLimitPerUser());
        row.put("validStartTime", item.getValidStartTime());
        row.put("validEndTime", item.getValidEndTime());
        row.put("ruleDesc", item.getRuleDesc());
        row.put("receivedCount", Math.max(safeInteger(item.getTotalCount()) - safeInteger(item.getRemainCount()), 0));
        row.put("usedCount", userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getCouponId, item.getId())
                .eq(UserCoupon::getCouponStatus, "USED")));
        return row;
    }

    private void restoreRefundCoupon(RideOrder order) {
        if (order.getUserCouponId() == null) {
            return;
        }
        UserCoupon userCoupon = userCouponMapper.selectById(order.getUserCouponId());
        if (userCoupon == null) {
            return;
        }
        userCoupon.setCouponStatus("UNUSED");
        userCoupon.setBindOrderId(null);
        userCoupon.setUsedAt(null);
        userCouponMapper.updateById(userCoupon);
    }

    private void rollbackDriverIncome(RideOrder order) {
        if (order.getDriverId() == null) {
            return;
        }
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, order.getDriverId())
                .last("limit 1"));
        if (profile == null) {
            return;
        }
        BigDecimal driverIncome = safeDecimal(order.getDriverIncomeAmount());
        profile.setTotalIncome(safeDecimal(profile.getTotalIncome()).subtract(driverIncome).max(BigDecimal.ZERO));
        profile.setWithdrawableIncome(safeDecimal(profile.getWithdrawableIncome()).subtract(driverIncome).max(BigDecimal.ZERO));
        driverProfileMapper.updateById(profile);
    }

    private void releaseDriverIfOrderClosed(RideOrder order) {
        if (order == null || order.getDriverId() == null) {
            return;
        }
        if (!OrderStatus.isTerminal(order.getOrderStatus()) && !PayStatus.REFUNDED.equals(order.getPayStatus())) {
            return;
        }
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, order.getDriverId())
                .last("limit 1"));
        if (profile == null || !DriverServiceStatus.BUSY.equals(profile.getServiceStatus())) {
            return;
        }
        Long activeCount = rideOrderMapper.selectCount(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getDriverId, order.getDriverId())
                .in(RideOrder::getOrderStatus, List.of(OrderStatus.ACCEPTED, OrderStatus.PICKING_UP, OrderStatus.IN_TRIP)));
        if (activeCount != null && activeCount > 0) {
            return;
        }
        profile.setServiceStatus(DriverServiceStatus.ONLINE);
        driverProfileMapper.updateById(profile);
    }

    private void validateCouponRequest(CouponCreateRequest request) {
        if (!CouponType.isValid(request.getCouponType())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "优惠券类型不合法");
        }
        if (request.getValidStartTime() == null || request.getValidEndTime() == null) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "生效时间不能为空");
        }
        if (request.getValidEndTime().isBefore(request.getValidStartTime())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "结束时间必须晚于开始时间");
        }
        if (request.getThresholdAmount() != null && request.getThresholdAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "门槛金额不能为负数");
        }
        if (request.getTotalCount() == null || request.getTotalCount() <= 0) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "库存必须大于0");
        }
        if (request.getReceiveLimitPerUser() == null || request.getReceiveLimitPerUser() <= 0) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "领取上限必须大于0");
        }
        if (CouponType.CASH.equals(request.getCouponType())) {
            if (request.getDiscountAmount() == null || request.getDiscountAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "满减券减免金额必须大于0");
            }
            if (request.getThresholdAmount() != null && request.getDiscountAmount().compareTo(request.getThresholdAmount()) > 0) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "满减券减免金额不能大于门槛金额");
            }
        }
        if (CouponType.DISCOUNT.equals(request.getCouponType())) {
            if (request.getDiscountRate() == null
                    || request.getDiscountRate().compareTo(BigDecimal.ZERO) <= 0
                    || request.getDiscountRate().compareTo(BigDecimal.ONE) > 0) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "折扣券折扣必须在0到10折之间");
            }
        }
    }

    private void validateSystemConfigValue(String configKey, String value) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "配置值不能为空");
        }
        String normalized = value.trim();
        try {
            switch (configKey) {
                case "platformCommissionRate" -> {
                    BigDecimal rate = new BigDecimal(normalized);
                    if (rate.compareTo(BigDecimal.ZERO) < 0 || rate.compareTo(BigDecimal.ONE) > 0) {
                        throw new BusinessException(ErrorCode.PARAM_ERROR, "平台佣金比例必须在0到1之间");
                    }
                }
                case "intlExchangeRate" -> {
                    BigDecimal rate = new BigDecimal(normalized);
                    if (rate.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new BusinessException(ErrorCode.PARAM_ERROR, "国际汇率必须大于0");
                    }
                }
                case "freeCancelMinutes" -> {
                    int minutes = Integer.parseInt(normalized);
                    if (minutes < 0) {
                        throw new BusinessException(ErrorCode.PARAM_ERROR, "免费取消时长不能为负数");
                    }
                }
                case "nightTimeRange" -> {
                    String[] parts = normalized.split("-");
                    if (parts.length != 2) {
                        throw new BusinessException(ErrorCode.PARAM_ERROR, "夜间附加费时段格式应为 HH:mm-HH:mm");
                    }
                    LocalTime.parse(parts[0].trim());
                    LocalTime.parse(parts[1].trim());
                }
                default -> {
                }
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "配置值格式不正确");
        }
    }

    private boolean isRefundAllowed(RideOrder order) {
        if (order == null || PayStatus.REFUNDED.equals(order.getPayStatus()) || OrderStatus.CANCELLED.equals(order.getOrderStatus())) {
            return false;
        }
        return PayStatus.UNPAID.equals(order.getPayStatus())
                || (PayStatus.PAID.equals(order.getPayStatus()) && OrderStatus.FINISHED.equals(order.getOrderStatus()));
    }

    private boolean isBetween(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null && !value.isBefore(start) && value.isBefore(end);
    }

    private BigDecimal sumOrderAmount(List<RideOrder> orders) {
        return orders.stream()
                .map(item -> safeDecimal(item.getPayableAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal sumOrderAmountByService(List<RideOrder> orders, String serviceType) {
        return sumOrderAmount(orders.stream()
                .filter(item -> serviceType.equals(item.getServiceType()))
                .toList());
    }

    private BigDecimal sumCommission(List<RideOrder> orders, BigDecimal commissionRate) {
        return orders.stream()
                .map(item -> safeDecimal(item.getActualAmount()).multiply(commissionRate))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calcPercent(long part, long total) {
        return BigDecimal.valueOf(part)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(Math.max(total, 1)), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calcDeltaRate(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            return current != null && current.compareTo(BigDecimal.ZERO) > 0 ? BigDecimal.valueOf(100) : BigDecimal.ZERO;
        }
        return current.subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous, 2, RoundingMode.HALF_UP);
    }

    private Map<String, Object> shareRow(String name, long value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("value", value);
        return row;
    }

    private Map<String, Object> shareAmountRow(String name, BigDecimal value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("value", value);
        return row;
    }

    private Map<String, Object> scoreRow(String label, long count) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("count", count);
        return row;
    }

    private String inferCityName(String locationName) {
        if (!StringUtils.hasText(locationName)) {
            return "未知";
        }
        String normalized = locationName.trim();
        if (normalized.contains("上海")) {
            return "上海";
        }
        if (normalized.contains("深圳")) {
            return "深圳";
        }
        if (normalized.contains("香港")) {
            return "香港";
        }
        if (normalized.contains("澳门")) {
            return "澳门";
        }
        if (normalized.contains("苏州")) {
            return "苏州";
        }
        return normalized.length() > 6 ? normalized.substring(0, 6) : normalized;
    }

    private RideOrder requireOrder(Long orderId) {
        RideOrder order = rideOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "订单不存在");
        }
        return order;
    }

    private Coupon requireCoupon(Long couponId) {
        Coupon coupon = couponMapper.selectById(couponId);
        if (coupon == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "优惠券不存在");
        }
        return coupon;
    }

    private BigDecimal getDecimalConfig(String key, BigDecimal defaultValue) {
        SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                .eq(SystemConfig::getConfigKey, key)
                .last("limit 1"));
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            return defaultValue;
        }
        try {
            return new BigDecimal(config.getConfigValue().trim());
        } catch (Exception ex) {
            return defaultValue;
        }
    }

    private BigDecimal safeDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Integer safeInteger(Integer value) {
        return value == null ? 0 : value;
    }
}
