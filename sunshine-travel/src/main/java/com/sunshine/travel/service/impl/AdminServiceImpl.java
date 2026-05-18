package com.sunshine.travel.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sunshine.travel.common.AuthStatus;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CouponStatus;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.InvoiceStatus;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.common.PayStatus;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.ServiceType;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.common.WithdrawStatus;
import com.sunshine.travel.dto.AdminCouponStatusRequest;
import com.sunshine.travel.dto.AdminComplaintHandleRequest;
import com.sunshine.travel.dto.AdminDriverUpdateRequest;
import com.sunshine.travel.dto.AdminInvoiceHandleRequest;
import com.sunshine.travel.dto.AdminOrderStatusRequest;
import com.sunshine.travel.dto.AdminRefundRequest;
import com.sunshine.travel.dto.AdminResetPasswordRequest;
import com.sunshine.travel.dto.AdminUserSaveRequest;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.SystemConfigItemRequest;
import com.sunshine.travel.dto.SystemConfigSaveRequest;
import com.sunshine.travel.dto.SystemNoticeSaveRequest;
import com.sunshine.travel.dto.SystemVersionSaveRequest;
import com.sunshine.travel.dto.UserAuditRequest;
import com.sunshine.travel.dto.UserEnableRequest;
import com.sunshine.travel.dto.WithdrawAuditRequest;
import com.sunshine.travel.entity.Complaint;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.CouponOperationLog;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.OperationLog;
import com.sunshine.travel.entity.PaymentRecord;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.SystemConfig;
import com.sunshine.travel.entity.SystemNotice;
import com.sunshine.travel.entity.SystemVersion;
import com.sunshine.travel.entity.TravelTrace;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.entity.Vehicle;
import com.sunshine.travel.entity.WithdrawApplication;
import com.sunshine.travel.mapper.ComplaintMapper;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.CouponOperationLogMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.OperationLogMapper;
import com.sunshine.travel.mapper.PaymentRecordMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.mapper.SystemNoticeMapper;
import com.sunshine.travel.mapper.SystemVersionMapper;
import com.sunshine.travel.mapper.TravelTraceMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.mapper.VehicleMapper;
import com.sunshine.travel.mapper.WithdrawApplicationMapper;
import com.sunshine.travel.service.AdminService;
import com.sunshine.travel.service.CouponService;
import com.sunshine.travel.service.OrderService;
import com.sunshine.travel.service.support.OperationLogSupport;
import com.sunshine.travel.util.PasswordUtil;
import com.sunshine.travel.vo.DashboardVO;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AdminServiceImpl implements AdminService {

    private final PlatformUserMapper platformUserMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final RideOrderMapper rideOrderMapper;
    private final ComplaintMapper complaintMapper;
    private final CouponMapper couponMapper;
    private final WithdrawApplicationMapper withdrawApplicationMapper;
    private final OperationLogMapper operationLogMapper;
    private final VehicleMapper vehicleMapper;
    private final PaymentRecordMapper paymentRecordMapper;
    private final TravelTraceMapper travelTraceMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponOperationLogMapper couponOperationLogMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final SystemNoticeMapper systemNoticeMapper;
    private final SystemVersionMapper systemVersionMapper;
    private final OperationLogSupport operationLogSupport;
    private final CouponService couponService;
    private final OrderService orderService;

    public AdminServiceImpl(PlatformUserMapper platformUserMapper,
                            DriverProfileMapper driverProfileMapper,
                            RideOrderMapper rideOrderMapper,
                            ComplaintMapper complaintMapper,
                            CouponMapper couponMapper,
                            WithdrawApplicationMapper withdrawApplicationMapper,
                            OperationLogMapper operationLogMapper,
                            VehicleMapper vehicleMapper,
                            PaymentRecordMapper paymentRecordMapper,
                            TravelTraceMapper travelTraceMapper,
                            UserCouponMapper userCouponMapper,
                            CouponOperationLogMapper couponOperationLogMapper,
                            SystemConfigMapper systemConfigMapper,
                            SystemNoticeMapper systemNoticeMapper,
                            SystemVersionMapper systemVersionMapper,
                            OperationLogSupport operationLogSupport,
                            CouponService couponService,
                            OrderService orderService) {
        this.platformUserMapper = platformUserMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.rideOrderMapper = rideOrderMapper;
        this.complaintMapper = complaintMapper;
        this.couponMapper = couponMapper;
        this.withdrawApplicationMapper = withdrawApplicationMapper;
        this.operationLogMapper = operationLogMapper;
        this.vehicleMapper = vehicleMapper;
        this.paymentRecordMapper = paymentRecordMapper;
        this.travelTraceMapper = travelTraceMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponOperationLogMapper = couponOperationLogMapper;
        this.systemConfigMapper = systemConfigMapper;
        this.systemNoticeMapper = systemNoticeMapper;
        this.systemVersionMapper = systemVersionMapper;
        this.operationLogSupport = operationLogSupport;
        this.couponService = couponService;
        this.orderService = orderService;
    }

    @Override
    public DashboardVO dashboard(String range) {
        LocalDate today = LocalDate.now();
        LocalDateTime yesterdayStart = today.minusDays(1).atStartOfDay();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime now = LocalDateTime.now();

        List<PlatformUser> users = platformUserMapper.selectList(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getRoleCode, RoleCode.USER));
        List<DriverProfile> drivers = driverProfileMapper.selectList(new LambdaQueryWrapper<DriverProfile>()
                .orderByDesc(DriverProfile::getId));
        List<RideOrder> allOrders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .orderByDesc(RideOrder::getCreatedAt));
        List<Complaint> complaints = complaintMapper.selectList(new LambdaQueryWrapper<Complaint>()
                .orderByDesc(Complaint::getCreatedAt));

        BigDecimal commissionRate = getDecimalConfig("platformCommissionRate", BigDecimal.valueOf(0.20));
        List<RideOrder> paidOrders = allOrders.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .toList();
        List<RideOrder> finishedPaidOrders = paidOrders.stream()
                .filter(item -> OrderStatus.FINISHED.equals(item.getOrderStatus()))
                .toList();

        BigDecimal totalTurnover = sumOrderAmount(paidOrders);
        BigDecimal yesterdayTurnover = sumOrderAmount(paidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart))
                .toList());
        BigDecimal beforeYesterdayTurnover = sumOrderAmount(paidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart.minusDays(1), yesterdayStart))
                .toList());
        BigDecimal totalCommission = finishedPaidOrders.stream()
                .map(item -> safeDecimal(item.getActualAmount()).multiply(commissionRate))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal yesterdayCommission = finishedPaidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart))
                .map(item -> safeDecimal(item.getActualAmount()).multiply(commissionRate))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal beforeYesterdayCommission = finishedPaidOrders.stream()
                .filter(item -> isBetween(item.getCreatedAt(), yesterdayStart.minusDays(1), yesterdayStart))
                .map(item -> safeDecimal(item.getActualAmount()).multiply(commissionRate))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        long verifiedUserTotal = users.stream()
                .filter(item -> Objects.equals(item.getAuthStatus(), AuthStatus.APPROVED))
                .count();
        long unverifiedUserTotal = users.size() - verifiedUserTotal;
        long pendingDriverTotal = drivers.stream()
                .filter(item -> !Objects.equals(item.getAuditStatus(), AuthStatus.APPROVED))
                .count();
        long approvedDriverTotal = drivers.size() - pendingDriverTotal;
        long complaintTotal = complaints.size();
        long resolvedComplaintTotal = complaints.stream()
                .filter(item -> "DONE".equalsIgnoreCase(item.getHandleStatus()))
                .count();
        long unresolvedComplaintTotal = complaintTotal - resolvedComplaintTotal;

        return DashboardVO.builder()
                .range(normalizeRange(range))
                .userTotal((long) users.size())
                .verifiedUserTotal(verifiedUserTotal)
                .unverifiedUserTotal(unverifiedUserTotal)
                .newUserDelta(users.stream().filter(item -> isBetween(item.getCreatedAt(), yesterdayStart, todayStart)).count())
                .driverTotal((long) drivers.size())
                .approvedDriverTotal(approvedDriverTotal)
                .pendingDriverTotal(pendingDriverTotal)
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
                .trend(buildDashboardTrend(normalizeRange(range), allOrders))
                .latestOrders(allOrders.stream().limit(10).map(this::mapOrderRow).toList())
                .businessShare(buildBusinessShare(allOrders, paidOrders))
                .operations(buildOperationsSummary(allOrders, complaints))
                .userCityDistribution(buildUserCityDistribution(users, allOrders))
                .rideRegionDistribution(buildRideRegionDistribution(allOrders))
                .driverScoreDistribution(buildDriverScoreDistribution(drivers))
                .generatedAt(now.toString())
                .build();
    }

    @Override
    public List<Map<String, Object>> importantMessages() {
        List<Map<String, Object>> rows = new ArrayList<>();

        complaintMapper.selectList(new LambdaQueryWrapper<Complaint>()
                        .orderByDesc(Complaint::getCreatedAt))
                .stream()
                .filter(item -> !"DONE".equalsIgnoreCase(item.getHandleStatus()))
                .limit(10)
                .forEach(item -> {
                    Map<String, Object> row = adminMessage(
                            "complaint-" + item.getId(),
                            "COMPLAINT",
                            "投诉待处理",
                            buildComplaintMessage(item),
                            "HIGH",
                            90,
                            "/messages",
                            "处理投诉",
                            item.getCreatedAt()
                    );
                    row.put("complaintId", item.getId());
                    row.put("orderId", item.getOrderId());
                    rows.add(row);
                });

        driverProfileMapper.selectList(new LambdaQueryWrapper<DriverProfile>()
                        .orderByDesc(DriverProfile::getUpdatedAt))
                .stream()
                .filter(item -> Objects.equals(item.getAuditStatus(), AuthStatus.PENDING))
                .limit(10)
                .forEach(item -> {
                    Map<String, Object> row = adminMessage(
                            "driver-audit-" + item.getUserId(),
                            "DRIVER_AUDIT",
                            "司机资料待审核",
                            buildDriverAuditMessage(item),
                            "MEDIUM",
                            70,
                            "/messages",
                            "审核司机",
                            item.getUpdatedAt() == null ? item.getCreatedAt() : item.getUpdatedAt()
                    );
                    row.put("driverId", item.getUserId());
                    rows.add(row);
                });

        vehicleMapper.selectList(new LambdaQueryWrapper<Vehicle>()
                        .orderByDesc(Vehicle::getUpdatedAt))
                .stream()
                .filter(item -> Objects.equals(item.getAuditStatus(), AuthStatus.PENDING))
                .limit(10)
                .forEach(item -> {
                    Map<String, Object> row = adminMessage(
                            "vehicle-audit-" + item.getId(),
                            "VEHICLE_AUDIT",
                            "车辆资料待审核",
                            buildVehicleAuditMessage(item),
                            "MEDIUM",
                            68,
                            "/messages",
                            "审核车辆",
                            item.getUpdatedAt() == null ? item.getCreatedAt() : item.getUpdatedAt()
                    );
                    row.put("vehicleId", item.getId());
                    row.put("driverId", item.getDriverId());
                    rows.add(row);
                });

        withdrawApplicationMapper.selectList(new LambdaQueryWrapper<WithdrawApplication>()
                        .eq(WithdrawApplication::getStatus, WithdrawStatus.PENDING)
                        .orderByDesc(WithdrawApplication::getCreatedAt))
                .stream()
                .limit(10)
                .forEach(item -> {
                    Map<String, Object> row = adminMessage(
                            "withdraw-" + item.getId(),
                            "WITHDRAW",
                            "提现申请待审核",
                            "司机ID " + item.getDriverId() + " 申请提现 " + safeDecimal(item.getApplyAmount()) + " 元",
                            "NORMAL",
                            50,
                            "/messages",
                            "审核提现",
                            item.getCreatedAt()
                    );
                    row.put("withdrawId", item.getId());
                    row.put("driverId", item.getDriverId());
                    row.put("applyAmount", item.getApplyAmount());
                    rows.add(row);
                });

        rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                        .eq(RideOrder::getInvoiceStatus, InvoiceStatus.APPLIED)
                        .orderByDesc(RideOrder::getUpdatedAt))
                .stream()
                .limit(10)
                .forEach(item -> {
                    Map<String, Object> row = adminMessage(
                            "invoice-" + item.getId(),
                            "INVOICE",
                            "发票申请待处理",
                            buildInvoiceMessage(item),
                            "MEDIUM",
                            75,
                            "/messages",
                            "处理发票",
                            item.getUpdatedAt() == null ? item.getCreatedAt() : item.getUpdatedAt()
                    );
                    row.put("orderId", item.getId());
                    row.put("orderNo", item.getOrderNo());
                    rows.add(row);
                });

        rows.sort((left, right) -> {
            int priorityCompare = Integer.compare((Integer) right.get("priority"), (Integer) left.get("priority"));
            if (priorityCompare != 0) {
                return priorityCompare;
            }
            LocalDateTime leftTime = (LocalDateTime) left.get("createdAt");
            LocalDateTime rightTime = (LocalDateTime) right.get("createdAt");
            if (leftTime == null && rightTime == null) {
                return 0;
            }
            if (leftTime == null) {
                return 1;
            }
            if (rightTime == null) {
                return -1;
            }
            return rightTime.compareTo(leftTime);
        });
        return rows.stream().limit(30).toList();
    }

    @Override
    public PageResult<Map<String, Object>> users(long current, long size, String keyword, String roleCode) {
        Page<PlatformUser> page = platformUserMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<PlatformUser>()
                .and(StringUtils.hasText(keyword), q -> q.like(PlatformUser::getNickname, keyword)
                        .or()
                        .like(PlatformUser::getPhone, keyword)
                        .or()
                        .like(PlatformUser::getRealName, keyword))
                .eq(StringUtils.hasText(roleCode), PlatformUser::getRoleCode, roleCode)
                .orderByDesc(PlatformUser::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(this::mapUserRow).toList());
    }

    @Override
    public Map<String, Object> userDetail(Long userId) {
        PlatformUser user = requireUser(userId);
        List<Map<String, Object>> orders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                        .eq(RideOrder::getUserId, userId)
                        .orderByDesc(RideOrder::getId))
                .stream()
                .map(this::mapOrderRow)
                .toList();
        long couponTotal = userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>().eq(UserCoupon::getUserId, userId));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", mapUserRow(user));
        result.put("orders", orders);
        result.put("couponTotal", couponTotal);
        result.put("completedOrderTotal", orders.stream().filter(item -> OrderStatus.FINISHED.equals(item.get("status"))).count());
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> createUser(AdminUserSaveRequest request) {
        if (!RoleCode.isValid(request.getRoleCode())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "角色不合法");
        }
        PlatformUser existing = platformUserMapper.selectOne(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getPhone, request.getPhone())
                .eq(PlatformUser::getRoleCode, request.getRoleCode()));
        if (existing != null) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "该手机号已存在相同角色账号");
        }
        PlatformUser user = new PlatformUser();
        user.setOpenId("admin-create-" + request.getPhone() + "-" + request.getRoleCode());
        user.setPhone(request.getPhone());
        user.setPassword(PasswordUtil.encode(StringUtils.hasText(request.getPassword()) ? request.getPassword() : "123456"));
        user.setNickname(request.getNickname());
        user.setRoleCode(request.getRoleCode());
        user.setRealName(request.getRealName());
        user.setIdCard(request.getIdCard());
        user.setEmergencyContact(request.getEmergencyContact());
        user.setEmergencyPhone(request.getEmergencyPhone());
        user.setEnabled(request.getEnabled());
        user.setAuthStatus(StringUtils.hasText(request.getRealName()) ? AuthStatus.APPROVED : AuthStatus.UNVERIFIED);
        user.setWalletBalance(BigDecimal.valueOf(200));
        user.setDefaultLanguage(StringUtils.hasText(request.getDefaultLanguage()) ? request.getDefaultLanguage() : "zh-CN");
        platformUserMapper.insert(user);
        if (RoleCode.DRIVER.equals(request.getRoleCode())) {
            DriverProfile profile = new DriverProfile();
            profile.setUserId(user.getId());
            profile.setDriverNo("DRV" + String.format("%06d", user.getId()));
            profile.setLicenseNo("待补充");
            profile.setServiceStatus("OFFLINE");
            profile.setAuditStatus(AuthStatus.UNVERIFIED);
            profile.setScore(BigDecimal.valueOf(5));
            profile.setTotalIncome(BigDecimal.ZERO);
            profile.setWithdrawableIncome(BigDecimal.ZERO);
            profile.setCityCode("310100");
            driverProfileMapper.insert(profile);
        }
        operationLogSupport.log("USER", "CREATE", "USER", user.getId(), "管理员新增用户：" + user.getNickname());
        return mapUserRow(user);
    }

    @Override
    @Transactional
    public Map<String, Object> updateUser(Long userId, AdminUserSaveRequest request) {
        PlatformUser user = requireUser(userId);
        PlatformUser duplicate = platformUserMapper.selectOne(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getPhone, request.getPhone())
                .eq(PlatformUser::getRoleCode, request.getRoleCode())
                .ne(PlatformUser::getId, userId)
                .last("limit 1"));
        if (duplicate != null) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "新的手机号与角色组合已存在");
        }
        user.setPhone(request.getPhone());
        user.setNickname(request.getNickname());
        user.setRealName(request.getRealName());
        user.setIdCard(request.getIdCard());
        user.setEmergencyContact(request.getEmergencyContact());
        user.setEmergencyPhone(request.getEmergencyPhone());
        user.setDefaultLanguage(StringUtils.hasText(request.getDefaultLanguage()) ? request.getDefaultLanguage() : user.getDefaultLanguage());
        user.setEnabled(request.getEnabled());
        platformUserMapper.updateById(user);
        operationLogSupport.log("USER", "UPDATE", "USER", userId, "管理员编辑用户资料");
        return mapUserRow(user);
    }

    @Override
    @Transactional
    public void resetUserPassword(Long userId, AdminResetPasswordRequest request) {
        PlatformUser user = requireUser(userId);
        user.setPassword(PasswordUtil.encode(request.getPassword()));
        platformUserMapper.updateById(user);
        operationLogSupport.log("USER", "RESET_PASSWORD", "USER", userId, "管理员重置用户密码");
    }

    @Override
    public PageResult<Map<String, Object>> drivers(long current, long size, String keyword, Integer auditStatus, String serviceStatus) {
        List<Map<String, Object>> rows = driverProfileMapper.selectList(new LambdaQueryWrapper<DriverProfile>()
                        .orderByDesc(DriverProfile::getId))
                .stream()
                .map(this::mapDriverRow)
                .filter(item -> matchesDriverKeyword(item, keyword))
                .filter(item -> auditStatus == null || Objects.equals(item.get("vehicleAuditStatus"), auditStatus))
                .filter(item -> !StringUtils.hasText(serviceStatus) || serviceStatus.equals(item.get("serviceStatus")))
                .toList();
        long totalCount = rows.size();
        int fromIndex = (int) Math.max((current - 1) * size, 0);
        if (fromIndex >= rows.size()) {
            return new PageResult<>(totalCount, current, size, List.of());
        }
        int toIndex = (int) Math.min(fromIndex + size, rows.size());
        return new PageResult<>(totalCount, current, size, rows.subList(fromIndex, toIndex));
    }

    @Override
    public Map<String, Object> driverDetail(Long driverId) {
        PlatformUser user = requireUser(driverId);
        DriverProfile profile = requireDriverProfile(driverId);
        Vehicle vehicle = queryVehicle(driverId);
        List<Map<String, Object>> orders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                        .eq(RideOrder::getDriverId, driverId)
                        .orderByDesc(RideOrder::getId))
                .stream()
                .map(this::mapOrderRow)
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", mapUserRow(user));
        result.put("profile", mapDriverRow(profile));
        result.put("vehicle", vehicle);
        result.put("auditRecords", buildDriverAuditRecords(driverId, vehicle));
        result.put("orders", orders);
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> updateDriver(Long driverId, AdminDriverUpdateRequest request) {
        PlatformUser user = requireUser(driverId);
        DriverProfile profile = requireDriverProfile(driverId);
        user.setNickname(request.getNickname());
        platformUserMapper.updateById(user);
        profile.setCityCode(request.getCityCode());
        profile.setLicenseNo(request.getLicenseNo());
        driverProfileMapper.updateById(profile);
        operationLogSupport.log("DRIVER", "UPDATE", "DRIVER", driverId, "管理员编辑司机基础资料");
        return driverDetail(driverId);
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
        Map<String, Object> runtime = orderService.runtime(orderId);
        PlatformUser user = platformUserMapper.selectById(order.getUserId());
        PlatformUser driver = order.getDriverId() == null ? null : platformUserMapper.selectById(order.getDriverId());
        List<Map<String, Object>> traces = travelTraceMapper.selectList(new LambdaQueryWrapper<TravelTrace>()
                .eq(TravelTrace::getOrderId, orderId)
                .orderByAsc(TravelTrace::getReportedAt))
                .stream()
                .map(this::mapTraceRow)
                .toList();
        List<Map<String, Object>> payments = paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderId, orderId)
                .orderByDesc(PaymentRecord::getId))
                .stream()
                .map(this::mapPaymentRow)
                .toList();
        List<Map<String, Object>> complaints = complaintMapper.selectList(new LambdaQueryWrapper<Complaint>()
                .eq(Complaint::getOrderId, orderId)
                .orderByDesc(Complaint::getId))
                .stream()
                .map(this::mapComplaintRow)
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> orderRow = mapOrderRow(order);
        orderRow.put("runtime", runtime);
        result.put("order", orderRow);
        result.put("rawOrder", order);
        result.put("user", user == null ? null : mapUserRow(user));
        result.put("driver", driver == null ? null : mapUserRow(driver));
        result.put("trackList", traces);
        result.put("payments", payments);
        result.put("complaints", complaints);
        result.put("runtime", runtime);
        result.put("refundAllowed", isRefundAllowed(order));
        return result;
    }

    @Override
    @Transactional
    public void updateOrderStatus(Long orderId, AdminOrderStatusRequest request) {
        RideOrder order = orderService.detail(orderId);
        if (!OrderStatus.isValid(request.getOrderStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "订单状态不合法");
        }
        if (StringUtils.hasText(request.getPayStatus()) && !PayStatus.isValid(request.getPayStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "支付状态不合法");
        }
        order.setOrderStatus(request.getOrderStatus());
        if (OrderStatus.ACCEPTED.equals(request.getOrderStatus()) && order.getAcceptedAt() == null) {
            order.setAcceptedAt(LocalDateTime.now());
        }
        if (OrderStatus.IN_TRIP.equals(request.getOrderStatus()) && order.getStartedAt() == null) {
            order.setStartedAt(LocalDateTime.now());
        }
        if (OrderStatus.FINISHED.equals(request.getOrderStatus())) {
            order.setFinishedAt(LocalDateTime.now());
            BigDecimal commissionRate = getDecimalConfig("platformCommissionRate", BigDecimal.valueOf(0.20));
            BigDecimal actualAmount = safeDecimal(order.getActualAmount()).compareTo(BigDecimal.ZERO) > 0
                    ? safeDecimal(order.getActualAmount())
                    : safeDecimal(order.getPayableAmount());
            order.setActualAmount(actualAmount);
            order.setPlatformCommissionAmount(actualAmount.multiply(commissionRate).setScale(2, RoundingMode.HALF_UP));
            order.setDriverIncomeAmount(actualAmount.subtract(safeDecimal(order.getPlatformCommissionAmount())).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
            order.setSettlementStatus(PayStatus.PAID.equals(order.getPayStatus()) ? "DONE" : "PENDING");
        }
        if (OrderStatus.CANCELLED.equals(request.getOrderStatus())) {
            order.setCancelReason(StringUtils.hasText(request.getRemark()) ? request.getRemark() : "管理员取消订单");
            order.setCancelByRole(RoleCode.ADMIN);
            order.setSettlementStatus("CANCELLED");
        }
        if (StringUtils.hasText(request.getPayStatus())) {
            applyAdminPayStatus(order, request.getPayStatus(), request.getRemark());
        }
        if (StringUtils.hasText(request.getRemark())) {
            order.setRemark(appendAdminRemark(order.getRemark(), request.getRemark()));
        }
        rideOrderMapper.updateById(order);
        releaseDriverIfOrderClosed(order);
        operationLogSupport.log("ORDER", "UPDATE_STATUS", "ORDER", orderId,
                "管理员修改订单状态为：" + request.getOrderStatus()
                        + (StringUtils.hasText(request.getPayStatus()) ? "，支付状态为：" + request.getPayStatus() : ""));
    }

    @Override
    @Transactional
    public void handleInvoice(Long orderId, AdminInvoiceHandleRequest request) {
        RideOrder order = requireOrder(orderId);
        if (!InvoiceStatus.ISSUED.equals(request.getInvoiceStatus())
                && !InvoiceStatus.REJECTED.equals(request.getInvoiceStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "发票处理状态不合法");
        }
        order.setInvoiceStatus(request.getInvoiceStatus());
        String actionText = InvoiceStatus.ISSUED.equals(request.getInvoiceStatus()) ? "已开票" : "已驳回";
        String remark = StringUtils.hasText(request.getRemark()) ? request.getRemark().trim() : "管理员处理发票：" + actionText;
        order.setRemark(appendAdminRemark(order.getRemark(), "发票处理：" + actionText + "，" + remark));
        rideOrderMapper.updateById(order);
        operationLogSupport.log("ORDER", "INVOICE", "ORDER", orderId, "管理员处理发票：" + actionText);
    }

    @Override
    @Transactional
    public void cancelOrder(Long orderId, String reason) {
        orderService.cancelOrder(orderId, reason);
        releaseDriverIfOrderClosed(orderService.detail(orderId));
        operationLogSupport.log("ORDER", "CANCEL", "ORDER", orderId, "管理员取消订单：" + reason);
    }

    @Override
    @Transactional
    public void refundOrder(Long orderId, AdminRefundRequest request) {
        RideOrder order = orderService.detail(orderId);
        if (!PayStatus.PAID.equals(order.getPayStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "仅已支付订单可以退款");
        }
        if (PayStatus.REFUNDED.equals(order.getPayStatus())) {
            return;
        }
        String previousSettlementStatus = order.getSettlementStatus();
        order.setPayStatus(PayStatus.REFUNDED);
        order.setSettlementStatus("REFUNDED");
        order.setRemark((StringUtils.hasText(order.getRemark()) ? order.getRemark() + " | " : "") + "退款原因：" + request.getReason());
        rideOrderMapper.updateById(order);
        paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>().eq(PaymentRecord::getOrderId, orderId))
                .forEach(item -> {
                    item.setPayStatus(PayStatus.REFUNDED);
                    paymentRecordMapper.updateById(item);
                });
        if ("DONE".equals(previousSettlementStatus)) {
            rollbackDriverIncome(order);
        }
        releaseDriverIfOrderClosed(order);
        operationLogSupport.log("ORDER", "REFUND", "ORDER", orderId, "管理员退款：" + request.getReason());
    }

    @Override
    public PageResult<Map<String, Object>> withdraws(long current, long size, String status) {
        Page<WithdrawApplication> page = withdrawApplicationMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<WithdrawApplication>()
                .eq(StringUtils.hasText(status), WithdrawApplication::getStatus, status)
                .orderByDesc(WithdrawApplication::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(item -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("driverId", item.getDriverId());
            row.put("applyAmount", item.getApplyAmount());
            row.put("bankAccount", item.getBankAccount());
            row.put("bankName", item.getBankName());
            row.put("status", item.getStatus());
            row.put("rejectReason", item.getRejectReason());
            row.put("auditedAt", item.getAuditedAt());
            return row;
        }).toList());
    }

    @Override
    public PageResult<Map<String, Object>> coupons(long current, long size, String keyword, Integer status) {
        return couponService.adminCoupons(current, size, keyword, status);
    }

    @Override
    @Transactional
    public Map<String, Object> updateCoupon(Long couponId, CouponCreateRequest request) {
        Coupon coupon = requireCoupon(couponId);
        coupon.setCouponName(request.getCouponName());
        coupon.setCouponType(request.getCouponType());
        coupon.setServiceScope(request.getServiceScope());
        coupon.setThresholdAmount(request.getThresholdAmount());
        coupon.setDiscountAmount(request.getDiscountAmount());
        coupon.setDiscountRate(request.getDiscountRate());
        coupon.setStackable(request.getStackable());
        coupon.setTotalCount(request.getTotalCount());
        coupon.setRemainCount(Math.min(safeInteger(coupon.getRemainCount()), request.getTotalCount()));
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
        Coupon coupon = requireCoupon(couponId);
        coupon.setStatus(request.getStatus());
        couponMapper.updateById(coupon);
        operationLogSupport.log("COUPON", "UPDATE_STATUS", "COUPON", couponId, "管理员修改优惠券状态为：" + request.getStatus());
    }

    @Override
    public PageResult<Map<String, Object>> couponOperationRecords(long current, long size, Long couponId, Long userId) {
        Page<CouponOperationLog> page = couponOperationLogMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<CouponOperationLog>()
                .eq(couponId != null, CouponOperationLog::getCouponId, couponId)
                .eq(userId != null, CouponOperationLog::getUserId, userId)
                .orderByDesc(CouponOperationLog::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(item -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("couponId", item.getCouponId());
            row.put("userId", item.getUserId());
            row.put("userCouponId", item.getUserCouponId());
            row.put("orderId", item.getOrderId());
            row.put("operationType", item.getOperationType());
            row.put("content", item.getContent());
            row.put("createdAt", item.getCreatedAt());
            return row;
        }).toList());
    }

    @Override
    @Transactional
    public void handleComplaint(Long complaintId, AdminComplaintHandleRequest request) {
        Complaint complaint = complaintMapper.selectById(complaintId);
        if (complaint == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "投诉记录不存在");
        }
        complaint.setHandleStatus("DONE");
        complaint.setHandleResult(request.getHandleResult());
        complaint.setHandleTime(LocalDateTime.now());
        complaintMapper.updateById(complaint);
    }

    @Override
    public PageResult<Map<String, Object>> logs(long current, long size, String module) {
        Page<OperationLog> page = operationLogMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<OperationLog>()
                .eq(StringUtils.hasText(module), OperationLog::getBizModule, module)
                .orderByDesc(OperationLog::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(item -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("operatorId", item.getOperatorId());
            row.put("operatorRole", item.getOperatorRole());
            row.put("bizModule", item.getBizModule());
            row.put("bizAction", item.getBizAction());
            row.put("targetType", item.getTargetType());
            row.put("targetId", item.getTargetId());
            row.put("content", item.getContent());
            row.put("createdAt", item.getCreatedAt());
            return row;
        }).toList());
    }

    @Override
    @Transactional
    public void auditUser(Long userId, UserAuditRequest request) {
        PlatformUser user = requireUser(userId);
        user.setAuthStatus(request.getAuthStatus());
        user.setAuthRemark(request.getRemark());
        platformUserMapper.updateById(user);
        operationLogSupport.log("USER", "AUDIT", "USER", userId, "实名认证审核结果：" + request.getAuthStatus());
    }

    @Override
    @Transactional
    public void enableUser(Long userId, UserEnableRequest request) {
        PlatformUser user = requireUser(userId);
        user.setEnabled(request.getEnabled());
        platformUserMapper.updateById(user);
        if (RoleCode.DRIVER.equals(user.getRoleCode())) {
            DriverProfile profile = requireDriverProfile(userId);
            if (!DriverServiceStatus.BUSY.equals(profile.getServiceStatus())) {
                profile.setServiceStatus(DriverServiceStatus.OFFLINE);
                driverProfileMapper.updateById(profile);
            }
        }
        operationLogSupport.log("USER", "ENABLE", "USER", userId, "账号启用状态修改为：" + request.getEnabled());
    }

    @Override
    @Transactional
    public void auditDriver(Long driverId, UserAuditRequest request) {
        if (!List.of(AuthStatus.APPROVED, AuthStatus.REJECTED).contains(request.getAuthStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "车辆审核只支持通过或驳回");
        }
        DriverProfile profile = requireDriverProfile(driverId);
        Vehicle vehicle = queryVehicle(driverId);
        if (vehicle == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "司机尚未提交车辆资料");
        }
        vehicle.setAuditStatus(request.getAuthStatus());
        vehicle.setAuditRemark(request.getRemark());
        vehicleMapper.updateById(vehicle);
        profile.setAuditStatus(request.getAuthStatus());
        profile.setAuditRemark(request.getRemark());
        if (!DriverServiceStatus.BUSY.equals(profile.getServiceStatus())) {
            profile.setServiceStatus(DriverServiceStatus.OFFLINE);
        }
        driverProfileMapper.updateById(profile);
        operationLogSupport.log("DRIVER", "AUDIT", "DRIVER", driverId,
                request.getAuthStatus() == AuthStatus.APPROVED
                        ? "管理员审核通过司机车辆资料"
                        : "管理员驳回司机车辆资料：" + request.getRemark());
    }

    @Override
    @Transactional
    public void auditWithdraw(Long withdrawId, WithdrawAuditRequest request) {
        WithdrawApplication withdraw = withdrawApplicationMapper.selectById(withdrawId);
        if (withdraw == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "提现申请不存在");
        }
        if (!WithdrawStatus.PENDING.equals(withdraw.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前提现申请已审核");
        }
        withdraw.setAuditedAt(LocalDateTime.now());
        withdraw.setAuditedBy(UserContext.userId());
        if ("APPROVE".equalsIgnoreCase(request.getAction())) {
            withdraw.setStatus(WithdrawStatus.APPROVED);
        } else if ("REJECT".equalsIgnoreCase(request.getAction())) {
            withdraw.setStatus(WithdrawStatus.REJECTED);
            withdraw.setRejectReason(request.getRejectReason());
            DriverProfile profile = requireDriverProfile(withdraw.getDriverId());
            profile.setWithdrawableIncome(safeDecimal(profile.getWithdrawableIncome()).add(withdraw.getApplyAmount()));
            driverProfileMapper.updateById(profile);
        } else {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "提现审核动作不合法");
        }
        withdrawApplicationMapper.updateById(withdraw);
        operationLogSupport.log("FINANCE", "WITHDRAW_AUDIT", "WITHDRAW", withdrawId, "提现审核动作：" + request.getAction());
    }

    @Override
    public Map<String, Object> financeSummary() {
        List<RideOrder> paidOrders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getPayStatus, PayStatus.PAID));
        BigDecimal totalRevenue = paidOrders.stream()
                .map(item -> safeDecimal(item.getPayableAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCommission = paidOrders.stream()
                .map(item -> safeDecimal(item.getPlatformCommissionAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDriverIncome = paidOrders.stream()
                .map(item -> safeDecimal(item.getDriverIncomeAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
        return systemConfigMapper.selectList(new LambdaQueryWrapper<SystemConfig>()
                        .orderByAsc(SystemConfig::getConfigGroup)
                        .orderByAsc(SystemConfig::getId))
                .stream()
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", item.getId());
                    row.put("configKey", item.getConfigKey());
                    row.put("configName", item.getConfigName());
                    row.put("configValue", item.getConfigValue());
                    row.put("configType", item.getConfigType());
                    row.put("configGroup", item.getConfigGroup());
                    row.put("remark", item.getRemark());
                    return row;
                })
                .toList();
    }

    @Override
    @Transactional
    public void saveSystemConfigs(SystemConfigSaveRequest request) {
        for (SystemConfigItemRequest item : request.getItems()) {
            SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                    .eq(SystemConfig::getConfigKey, item.getConfigKey())
                    .last("limit 1"));
            if (config == null) {
                throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "配置项不存在：" + item.getConfigKey());
            }
            config.setConfigValue(item.getConfigValue());
            systemConfigMapper.updateById(config);
        }
        operationLogSupport.log("SYSTEM", "SAVE_CONFIG", "SYSTEM_CONFIG", null, "管理员保存系统配置");
    }

    @Override
    public PageResult<Map<String, Object>> notices(long current, long size, String keyword) {
        Page<SystemNotice> page = systemNoticeMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<SystemNotice>()
                .and(StringUtils.hasText(keyword), q -> q.like(SystemNotice::getTitle, keyword)
                        .or()
                        .like(SystemNotice::getContent, keyword))
                .orderByDesc(SystemNotice::getSortNo)
                .orderByDesc(SystemNotice::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(this::mapNoticeRow).toList());
    }

    @Override
    @Transactional
    public Map<String, Object> createNotice(SystemNoticeSaveRequest request) {
        SystemNotice notice = new SystemNotice();
        fillNotice(notice, request);
        systemNoticeMapper.insert(notice);
        operationLogSupport.log("SYSTEM", "CREATE_NOTICE", "NOTICE", notice.getId(), "管理员新增公告");
        return mapNoticeRow(notice);
    }

    @Override
    @Transactional
    public Map<String, Object> updateNotice(Long noticeId, SystemNoticeSaveRequest request) {
        SystemNotice notice = requireNotice(noticeId);
        fillNotice(notice, request);
        systemNoticeMapper.updateById(notice);
        operationLogSupport.log("SYSTEM", "UPDATE_NOTICE", "NOTICE", noticeId, "管理员编辑公告");
        return mapNoticeRow(notice);
    }

    @Override
    public PageResult<Map<String, Object>> versions(long current, long size, String clientType) {
        Page<SystemVersion> page = systemVersionMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<SystemVersion>()
                .eq(StringUtils.hasText(clientType), SystemVersion::getClientType, clientType)
                .orderByDesc(SystemVersion::getId));
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), page.getRecords().stream().map(this::mapVersionRow).toList());
    }

    @Override
    @Transactional
    public Map<String, Object> createVersion(SystemVersionSaveRequest request) {
        SystemVersion version = new SystemVersion();
        fillVersion(version, request);
        systemVersionMapper.insert(version);
        operationLogSupport.log("SYSTEM", "CREATE_VERSION", "VERSION", version.getId(), "管理员新增版本");
        return mapVersionRow(version);
    }

    @Override
    @Transactional
    public Map<String, Object> updateVersion(Long versionId, SystemVersionSaveRequest request) {
        SystemVersion version = requireVersion(versionId);
        fillVersion(version, request);
        systemVersionMapper.updateById(version);
        operationLogSupport.log("SYSTEM", "UPDATE_VERSION", "VERSION", versionId, "管理员编辑版本");
        return mapVersionRow(version);
    }

    private LocalDateTime resolveDashboardStart(String range) {
        LocalDate today = LocalDate.now();
        if ("month".equalsIgnoreCase(range)) {
            return today.withDayOfMonth(1).atStartOfDay();
        }
        if ("week".equalsIgnoreCase(range)) {
            return today.with(DayOfWeek.MONDAY).atStartOfDay();
        }
        return today.atStartOfDay();
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

    private Map<String, Object> mapDriverRow(DriverProfile item) {
        Vehicle vehicle = queryVehicle(item.getUserId());
        PlatformUser user = platformUserMapper.selectById(item.getUserId());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("driverNo", item.getDriverNo());
        row.put("userId", item.getUserId());
        row.put("nickname", user == null ? "" : user.getNickname());
        row.put("phone", user == null ? "" : user.getPhone());
        row.put("enabled", user == null ? 0 : user.getEnabled());
        row.put("auditStatus", item.getAuditStatus());
        row.put("auditRemark", item.getAuditRemark());
        row.put("serviceStatus", resolveDriverServiceStatus(item, user));
        row.put("score", item.getScore());
        row.put("income", item.getTotalIncome());
        row.put("withdrawableIncome", item.getWithdrawableIncome());
        row.put("licenseNo", item.getLicenseNo());
        row.put("cityCode", item.getCityCode());
        row.put("vehicleInfo", buildVehicleInfo(vehicle));
        row.put("vehicleAuditStatus", resolveVehicleAuditStatus(user, vehicle));
        row.put("vehicleAuditRemark", vehicle == null ? "司机暂未提交车辆资料" : vehicle.getAuditRemark());
        row.put("actionState", resolveDriverActionState(user, vehicle));
        row.put("vehicle", vehicle);
        return row;
    }

    private Map<String, Object> mapOrderRow(RideOrder item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("orderNo", item.getOrderNo());
        row.put("serviceType", item.getServiceType());
        row.put("status", item.getOrderStatus());
        row.put("payStatus", item.getPayStatus());
        row.put("invoiceStatus", item.getInvoiceStatus());
        row.put("amount", item.getPayableAmount());
        row.put("startName", item.getStartName());
        row.put("endName", item.getEndName());
        row.put("driverId", item.getDriverId());
        row.put("userId", item.getUserId());
        row.put("settlementStatus", item.getSettlementStatus());
        row.put("currencyCode", item.getCurrencyCode());
        row.put("createdAt", item.getCreatedAt());
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
        return row;
    }

    private Map<String, Object> mapNoticeRow(SystemNotice item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("title", item.getTitle());
        row.put("content", item.getContent());
        row.put("status", item.getStatus());
        row.put("sortNo", item.getSortNo());
        row.put("targetRole", item.getTargetRole());
        row.put("createdAt", item.getCreatedAt());
        return row;
    }

    private Map<String, Object> mapVersionRow(SystemVersion item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("versionNo", item.getVersionNo());
        row.put("clientType", item.getClientType());
        row.put("releaseNote", item.getReleaseNote());
        row.put("forceUpdate", item.getForceUpdate());
        row.put("status", item.getStatus());
        row.put("downloadUrl", item.getDownloadUrl());
        row.put("createdAt", item.getCreatedAt());
        return row;
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

    private void fillNotice(SystemNotice notice, SystemNoticeSaveRequest request) {
        notice.setTitle(request.getTitle());
        notice.setContent(request.getContent());
        notice.setStatus(request.getStatus());
        notice.setSortNo(request.getSortNo());
        notice.setTargetRole(StringUtils.hasText(request.getTargetRole()) ? request.getTargetRole() : "ALL");
    }

    private void fillVersion(SystemVersion version, SystemVersionSaveRequest request) {
        version.setVersionNo(request.getVersionNo());
        version.setClientType(request.getClientType());
        version.setReleaseNote(request.getReleaseNote());
        version.setForceUpdate(request.getForceUpdate());
        version.setStatus(request.getStatus());
        version.setDownloadUrl(request.getDownloadUrl());
    }

    private PlatformUser requireUser(Long userId) {
        PlatformUser user = platformUserMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private DriverProfile requireDriverProfile(Long driverId) {
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, driverId)
                .last("limit 1"));
        if (profile == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "司机资料不存在");
        }
        return profile;
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

    private SystemNotice requireNotice(Long noticeId) {
        SystemNotice notice = systemNoticeMapper.selectById(noticeId);
        if (notice == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "公告不存在");
        }
        return notice;
    }

    private SystemVersion requireVersion(Long versionId) {
        SystemVersion version = systemVersionMapper.selectById(versionId);
        if (version == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "版本记录不存在");
        }
        return version;
    }

    private Vehicle queryVehicle(Long driverId) {
        return vehicleMapper.selectOne(new LambdaQueryWrapper<Vehicle>()
                .eq(Vehicle::getDriverId, driverId)
                .orderByDesc(Vehicle::getId)
                .last("limit 1"));
    }

    private boolean matchesDriverKeyword(Map<String, Object> row, String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        String normalized = keyword.trim().toLowerCase();
        return java.util.stream.Stream.of(
                        row.get("driverNo"),
                        row.get("nickname"),
                        row.get("phone"),
                        row.get("licenseNo"),
                        row.get("vehicleInfo"))
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .map(String::toLowerCase)
                .anyMatch(item -> item.contains(normalized));
    }

    private List<Map<String, Object>> buildDriverAuditRecords(Long driverId, Vehicle vehicle) {
        List<Map<String, Object>> records = new ArrayList<>(operationLogMapper.selectList(new LambdaQueryWrapper<OperationLog>()
                        .eq(OperationLog::getTargetId, driverId)
                        .in(OperationLog::getBizModule, List.of("DRIVER", "USER"))
                        .orderByDesc(OperationLog::getId)
                        .last("limit 20"))
                .stream()
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("action", item.getBizAction());
                    row.put("content", item.getContent());
                    row.put("operatorRole", item.getOperatorRole());
                    row.put("operatorId", item.getOperatorId());
                    row.put("createdAt", item.getCreatedAt());
                    return row;
                })
                .toList());
        if (records.isEmpty() && vehicle != null) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("action", "VEHICLE_STATUS");
            fallback.put("content", StringUtils.hasText(vehicle.getAuditRemark()) ? vehicle.getAuditRemark() : "车辆资料已提交");
            fallback.put("operatorRole", "SYSTEM");
            fallback.put("operatorId", null);
            fallback.put("createdAt", vehicle.getUpdatedAt());
            records.add(fallback);
        }
        return records;
    }

    private String resolveDriverServiceStatus(DriverProfile profile, PlatformUser user) {
        if (user == null || user.getEnabled() == null || user.getEnabled() != 1) {
            return "DISABLED";
        }
        return StringUtils.hasText(profile.getServiceStatus()) ? profile.getServiceStatus() : DriverServiceStatus.OFFLINE;
    }

    private Integer resolveVehicleAuditStatus(PlatformUser user, Vehicle vehicle) {
        if (user == null || user.getEnabled() == null || user.getEnabled() != 1) {
            return -1;
        }
        return vehicle == null ? AuthStatus.UNVERIFIED : safeInteger(vehicle.getAuditStatus());
    }

    private String resolveDriverActionState(PlatformUser user, Vehicle vehicle) {
        if (user == null || user.getEnabled() == null || user.getEnabled() != 1) {
            return "DISABLED";
        }
        if (vehicle == null) {
            return "UNSUBMITTED";
        }
        if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.PENDING)) {
            return "PENDING";
        }
        if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.APPROVED)) {
            return "APPROVED";
        }
        if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.REJECTED)) {
            return "REJECTED";
        }
        return "UNSUBMITTED";
    }

    private String buildVehicleInfo(Vehicle vehicle) {
        if (vehicle == null) {
            return "暂未提交车辆资料";
        }
        String plateNo = StringUtils.hasText(vehicle.getPlateNo()) ? vehicle.getPlateNo() : "未填写车牌";
        String modelName = StringUtils.hasText(vehicle.getModelName()) ? vehicle.getModelName() : "未填写车型";
        return plateNo + " / " + modelName;
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
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("orderCount", scoped.size());
        row.put("turnover", sumOrderAmount(scoped.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .toList()));
        return row;
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
        long totalCoupons = userCouponMapper.selectCount(null);
        long usedCoupons = userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getCouponStatus, "USED"));
        long pendingDrivers = driverProfileMapper.selectCount(new LambdaQueryWrapper<DriverProfile>()
                .ne(DriverProfile::getAuditStatus, AuthStatus.APPROVED));
        long pendingComplaints = complaints.stream()
                .filter(item -> !"DONE".equalsIgnoreCase(item.getHandleStatus()))
                .count();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driverReceiveRate", calcPercent(acceptedTotal, Math.max(dispatchTotal, 1)));
        result.put("couponUseRate", calcPercent(usedCoupons, Math.max(totalCoupons, 1)));
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

    private Map<String, Object> adminMessage(String id,
                                             String type,
                                             String title,
                                             String content,
                                             String level,
                                             int priority,
                                             String actionPath,
                                             String actionText,
                                             LocalDateTime createdAt) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("type", type);
        row.put("title", title);
        row.put("content", content);
        row.put("level", level);
        row.put("priority", priority);
        row.put("actionPath", actionPath);
        row.put("actionText", actionText);
        row.put("createdAt", createdAt);
        return row;
    }

    private String buildComplaintMessage(Complaint item) {
        String type = StringUtils.hasText(item.getComplaintType()) ? item.getComplaintType() : "未分类投诉";
        String content = StringUtils.hasText(item.getContent()) ? truncateText(item.getContent(), 46) : "用户提交了投诉，需要后台核实处理";
        return "订单ID " + item.getOrderId() + "，" + type + "：" + content;
    }

    private String buildDriverAuditMessage(DriverProfile profile) {
        PlatformUser user = platformUserMapper.selectById(profile.getUserId());
        String name = user == null || !StringUtils.hasText(user.getRealName())
                ? (user == null || !StringUtils.hasText(user.getNickname()) ? "司机用户" : user.getNickname())
                : user.getRealName();
        String phone = user == null || !StringUtils.hasText(user.getPhone()) ? "未留手机号" : user.getPhone();
        return name + "（" + phone + "）提交了司机资料，当前状态：" + auditStatusText(profile.getAuditStatus());
    }

    private String buildVehicleAuditMessage(Vehicle vehicle) {
        String plateNo = StringUtils.hasText(vehicle.getPlateNo()) ? vehicle.getPlateNo() : "未填写车牌";
        String model = StringUtils.hasText(vehicle.getModelName()) ? vehicle.getModelName() : "未填写车型";
        return plateNo + " / " + model + " 车辆资料需要审核，当前状态：" + auditStatusText(vehicle.getAuditStatus());
    }

    private String buildInvoiceMessage(RideOrder order) {
        String title = readInvoiceMeta(order.getRemark(), "title");
        String taxNo = readInvoiceMeta(order.getRemark(), "taxNo");
        String displayTitle = StringUtils.hasText(title) ? title : "个人";
        String displayTaxNo = StringUtils.hasText(taxNo) ? "，税号 " + taxNo : "";
        return "订单 " + order.getOrderNo() + " 申请电子发票，抬头 " + displayTitle + displayTaxNo
                + "，金额 " + safeDecimal(order.getPayableAmount()) + " " + (StringUtils.hasText(order.getCurrencyCode()) ? order.getCurrencyCode() : "CNY");
    }

    private void applyAdminPayStatus(RideOrder order, String targetPayStatus, String remark) {
        LocalDateTime now = LocalDateTime.now();
        order.setPayStatus(targetPayStatus);
        if (PayStatus.PAID.equals(targetPayStatus)) {
            order.setPaidAt(order.getPaidAt() == null ? now : order.getPaidAt());
            if (OrderStatus.FINISHED.equals(order.getOrderStatus())) {
                order.setSettlementStatus("DONE");
            }
            ensureAdminPaymentRecord(order);
            return;
        }
        if (PayStatus.REFUNDED.equals(targetPayStatus)) {
            order.setRefundedAt(order.getRefundedAt() == null ? now : order.getRefundedAt());
            order.setRefundAmount(safeDecimal(order.getPayableAmount()));
            order.setRefundReason(StringUtils.hasText(remark) ? remark : "管理员调整支付状态为已退款");
            order.setSettlementStatus("REFUNDED");
            paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>().eq(PaymentRecord::getOrderId, order.getId()))
                    .forEach(item -> {
                        item.setPayStatus(PayStatus.REFUNDED);
                        item.setRefundAmount(safeDecimal(item.getPayAmount()));
                        item.setRefundReason(order.getRefundReason());
                        item.setRefundedAt(order.getRefundedAt());
                        paymentRecordMapper.updateById(item);
                    });
            return;
        }
        order.setSettlementStatus(OrderStatus.CANCELLED.equals(order.getOrderStatus()) ? "CANCELLED" : "PENDING");
        paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>().eq(PaymentRecord::getOrderId, order.getId()))
                .forEach(item -> {
                    item.setPayStatus(PayStatus.UNPAID);
                    paymentRecordMapper.updateById(item);
                });
    }

    private void ensureAdminPaymentRecord(RideOrder order) {
        List<PaymentRecord> records = paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderId, order.getId())
                .orderByDesc(PaymentRecord::getId));
        if (!records.isEmpty()) {
            records.forEach(item -> {
                item.setPayStatus(PayStatus.PAID);
                item.setPaidAt(item.getPaidAt() == null ? order.getPaidAt() : item.getPaidAt());
                item.setPayAmount(safeDecimal(order.getPayableAmount()));
                item.setCurrencyCode(order.getCurrencyCode());
                paymentRecordMapper.updateById(item);
            });
            return;
        }
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setOrderId(order.getId());
        paymentRecord.setPayNo("PAY" + IdUtil.getSnowflakeNextIdStr());
        paymentRecord.setPayChannel("ADMIN");
        paymentRecord.setPayStatus(PayStatus.PAID);
        paymentRecord.setPayAmount(safeDecimal(order.getPayableAmount()));
        paymentRecord.setCurrencyCode(order.getCurrencyCode());
        paymentRecord.setMockTransactionNo("ADMIN-" + IdUtil.fastSimpleUUID());
        paymentRecord.setPaidAt(order.getPaidAt());
        paymentRecordMapper.insert(paymentRecord);
    }

    private String appendAdminRemark(String source, String addition) {
        if (!StringUtils.hasText(addition)) {
            return source;
        }
        if (!StringUtils.hasText(source)) {
            return addition.trim();
        }
        if (source.contains(addition.trim())) {
            return source;
        }
        return source + " | " + addition.trim();
    }

    private String readInvoiceMeta(String remark, String key) {
        if (!StringUtils.hasText(remark) || !StringUtils.hasText(key)) {
            return "";
        }
        int start = remark.indexOf("[INVOICE_META]");
        int end = remark.indexOf("[/INVOICE_META]");
        if (start < 0 || end <= start) {
            return "";
        }
        String meta = remark.substring(start + "[INVOICE_META]".length(), end);
        for (String part : meta.split(";")) {
            String[] pair = part.split("=", 2);
            if (pair.length == 2 && key.equals(pair[0].trim())) {
                return pair[1].trim();
            }
        }
        return "";
    }

    private String auditStatusText(Integer status) {
        if (Objects.equals(status, AuthStatus.PENDING)) {
            return "待审核";
        }
        if (Objects.equals(status, AuthStatus.REJECTED)) {
            return "已驳回待补充";
        }
        if (Objects.equals(status, AuthStatus.UNVERIFIED)) {
            return "未完善";
        }
        return "待处理";
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
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

    private BigDecimal safeDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
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

    private Integer safeInteger(Integer value) {
        return value == null ? 0 : value;
    }
}
