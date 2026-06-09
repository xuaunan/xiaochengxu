package com.sunshine.travel.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CouponStatus;
import com.sunshine.travel.common.CouponType;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.InvoiceStatus;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.PayStatus;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.ServiceType;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.ComplaintRequest;
import com.sunshine.travel.dto.EvaluationRequest;
import com.sunshine.travel.dto.InvoiceApplyRequest;
import com.sunshine.travel.dto.MockPayRequest;
import com.sunshine.travel.dto.OrderCreateRequest;
import com.sunshine.travel.dto.OrderFinishRequest;
import com.sunshine.travel.dto.TrackReportRequest;
import com.sunshine.travel.entity.CarType;
import com.sunshine.travel.entity.Complaint;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.CouponOperationLog;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PaymentRecord;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.SystemConfig;
import com.sunshine.travel.entity.TravelTrace;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.entity.Vehicle;
import com.sunshine.travel.mapper.CarTypeMapper;
import com.sunshine.travel.mapper.ComplaintMapper;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.CouponOperationLogMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PaymentRecordMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.mapper.TravelTraceMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.mapper.VehicleMapper;
import com.sunshine.travel.service.OrderService;
import com.sunshine.travel.service.support.CacheSupport;
import com.sunshine.travel.service.support.MessagePushSupport;
import com.sunshine.travel.service.support.OrderRuntimeSupport;
import com.sunshine.travel.util.InternationalMetaUtil;
import com.sunshine.travel.util.InvoiceMetaUtil;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
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
public class OrderServiceImpl implements OrderService {

    private static final BigDecimal DEFAULT_EXCHANGE_RATE = BigDecimal.valueOf(7.15);
    private static final BigDecimal DEFAULT_PLATFORM_COMMISSION_RATE = BigDecimal.valueOf(0.20);
    private static final BigDecimal ACCEPTED_CANCEL_RATE_PER_STEP = BigDecimal.valueOf(0.05);
    private static final BigDecimal ACCEPTED_CANCEL_RATE_CAP = BigDecimal.valueOf(0.20);
    private static final BigDecimal PICKING_UP_CANCEL_RATE_PER_STEP = BigDecimal.valueOf(0.08);
    private static final BigDecimal PICKING_UP_CANCEL_RATE_CAP = BigDecimal.valueOf(0.35);
    private static final int DEFAULT_FREE_CANCEL_MINUTES = 3;
    private static final int CANCEL_FEE_STEP_MINUTES = 5;
    private static final String DEFAULT_NIGHT_TIME_RANGE = "23:00-06:00";
    private static final String INVOICE_SELLER_NAME = "北京阳光出行有限公司";
    private static final String INVOICE_SELLER_TAX_NO = "91110105MA01SUN8X9";
    private static final String INVOICE_SELLER_PHONE = "400-100-0101";
    private static final DateTimeFormatter INVOICE_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter INVOICE_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final RideOrderMapper rideOrderMapper;
    private final CarTypeMapper carTypeMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponMapper couponMapper;
    private final PaymentRecordMapper paymentRecordMapper;
    private final ComplaintMapper complaintMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final PlatformUserMapper platformUserMapper;
    private final TravelTraceMapper travelTraceMapper;
    private final CouponOperationLogMapper couponOperationLogMapper;
    private final VehicleMapper vehicleMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final MessagePushSupport messagePushSupport;
    private final CacheSupport cacheSupport;
    private final OrderRuntimeSupport orderRuntimeSupport;

    public OrderServiceImpl(RideOrderMapper rideOrderMapper,
                            CarTypeMapper carTypeMapper,
                            UserCouponMapper userCouponMapper,
                            CouponMapper couponMapper,
                            PaymentRecordMapper paymentRecordMapper,
                            ComplaintMapper complaintMapper,
                            DriverProfileMapper driverProfileMapper,
                            PlatformUserMapper platformUserMapper,
                            TravelTraceMapper travelTraceMapper,
                            CouponOperationLogMapper couponOperationLogMapper,
                            VehicleMapper vehicleMapper,
                            SystemConfigMapper systemConfigMapper,
                            MessagePushSupport messagePushSupport,
                            CacheSupport cacheSupport,
                            OrderRuntimeSupport orderRuntimeSupport) {
        this.rideOrderMapper = rideOrderMapper;
        this.carTypeMapper = carTypeMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponMapper = couponMapper;
        this.paymentRecordMapper = paymentRecordMapper;
        this.complaintMapper = complaintMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.platformUserMapper = platformUserMapper;
        this.travelTraceMapper = travelTraceMapper;
        this.couponOperationLogMapper = couponOperationLogMapper;
        this.vehicleMapper = vehicleMapper;
        this.systemConfigMapper = systemConfigMapper;
        this.messagePushSupport = messagePushSupport;
        this.cacheSupport = cacheSupport;
        this.orderRuntimeSupport = orderRuntimeSupport;
    }

    @Override
    public Map<String, Object> estimate(Long carTypeId, String serviceType, BigDecimal distanceKm, BigDecimal durationMin) {
        if (!ServiceType.isValid(serviceType)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Invalid service type");
        }
        CarType carType = requireCarType(carTypeId);
        PricingResult pricing = calcAmount(carType, serviceType, distanceKm, durationMin);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("distanceKm", distanceKm);
        data.put("durationMin", durationMin);
        data.put("baseAmount", pricing.baseAmount());
        data.put("nightSurchargeAmount", pricing.nightSurchargeAmount());
        data.put("longDistanceSurchargeAmount", pricing.longDistanceSurchargeAmount());
        data.put("amount", pricing.finalAmount());
        data.put("currencyCode", pricing.currencyCode());
        data.put("exchangeRate", pricing.exchangeRate());
        return data;
    }

    @Override
    @Transactional
    public RideOrder createOrder(OrderCreateRequest request) {
        Long userId = requireLoginUserId();
        if (!RoleCode.USER.equals(UserContext.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only users can create orders");
        }
        if (!ServiceType.isValid(request.getServiceType())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Invalid service type");
        }
        validateAddress(request.getServiceType(), request.getStartName(), request.getEndName());
        ensureNoDuplicateOpenOrder(userId, request);
        CarType carType = requireCarType(request.getCarTypeId());
        PricingResult pricing = calcAmount(carType, request.getServiceType(), request.getEstimatedDistanceKm(), request.getEstimatedDurationMin());
        CouponUseResult couponUseResult = useCouponIfNeeded(request.getUserCouponId(), pricing.finalAmount(), request.getServiceType());

        RideOrder order = new RideOrder();
        order.setOrderNo("ORD" + IdUtil.getSnowflakeNextIdStr());
        order.setUserId(userId);
        order.setCarTypeId(request.getCarTypeId());
        order.setServiceType(request.getServiceType());
        order.setOrderStatus(OrderStatus.DISPATCHING);
        order.setStartName(request.getStartName());
        order.setStartLng(request.getStartLng());
        order.setStartLat(request.getStartLat());
        order.setEndName(request.getEndName());
        order.setEndLng(request.getEndLng());
        order.setEndLat(request.getEndLat());
        order.setEstimatedDistanceKm(request.getEstimatedDistanceKm());
        order.setEstimatedDurationMin(request.getEstimatedDurationMin());
        order.setEstimatedAmount(pricing.finalAmount());
        order.setCouponDiscount(couponUseResult.discountAmount());
        order.setUserCouponId(couponUseResult.userCouponId());
        order.setPayableAmount(pricing.finalAmount().subtract(couponUseResult.discountAmount()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        order.setActualAmount(order.getPayableAmount());
        order.setNightSurchargeAmount(pricing.nightSurchargeAmount());
        order.setLongDistanceSurchargeAmount(pricing.longDistanceSurchargeAmount());
        order.setExchangeRate(pricing.exchangeRate());
        order.setCurrencyCode(pricing.currencyCode());
        order.setDispatchMode(StringUtils.hasText(request.getDispatchMode()) ? request.getDispatchMode() : "SMART");
        order.setPayStatus(PayStatus.UNPAID);
        order.setInvoiceStatus("NONE");
        order.setEvaluationStatus("PENDING");
        order.setComplaintStatus("NONE");
        order.setSettlementStatus("PENDING");
        order.setLanguageCode(StringUtils.hasText(request.getLanguageCode()) ? request.getLanguageCode() : "zh-CN");
        order.setRemark(buildDispatchRemark(request.getDispatchMode(), request.getRemark()));
        rideOrderMapper.insert(order);
        bindCouponIfNecessary(order);
        messagePushSupport.push(userId, "ORDER", "ORDER_CREATED", "订单已创建", "订单已提交，正在等待司机接单。", order.getLanguageCode());
        return order;
    }

    @Override
    public RideOrder detail(Long orderId) {
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        assertOrderReadable(order);
        return order;
    }

    @Override
    public Map<String, Object> detailView(Long orderId) {
        return mapOrderView(detail(orderId));
    }

    @Override
    public Map<String, Object> runtime(Long orderId) {
        RideOrder order = detail(orderId);
        return orderRuntimeSupport.buildRuntime(order);
    }

    @Override
    @Transactional
    public void cancelOrder(Long orderId, String reason) {
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        assertOrderWritable(order);
        if (OrderStatus.isTerminal(order.getOrderStatus()) || OrderStatus.IN_TRIP.equals(order.getOrderStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Current order cannot be cancelled");
        }
        BigDecimal cancelFee = calcCancelFee(order);
        order.setOrderStatus(OrderStatus.CANCELLED);
        order.setCancelReason(reason);
        order.setCancelByRole(UserContext.role());
        order.setCancelFee(cancelFee);
        order.setActualAmount(order.getCancelFee());
        order.setPayableAmount(order.getCancelFee());
        order.setSettlementStatus("CANCELLED");
        rideOrderMapper.updateById(order);
        releaseCouponIfUnused(order);
        restoreDriverStatus(order.getDriverId());
        messagePushSupport.push(order.getUserId(), "ORDER", "ORDER_CANCELLED", "订单已取消", "订单已取消，取消费用：" + order.getCancelFee(), order.getLanguageCode());
        messagePushSupport.push(order.getDriverId(), "ORDER", "ORDER_CANCELLED", "乘客取消订单", "乘客已取消订单，请留意大厅新订单。", order.getLanguageCode());
    }

    @Override
    @Transactional
    public void acceptOrder(Long orderId) {
        if (!RoleCode.DRIVER.equals(UserContext.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only drivers can accept orders");
        }
        Long driverId = requireLoginUserId();
        String lockKey = "order:accept:" + orderId;
        if (!cacheSupport.setIfAbsent(lockKey, String.valueOf(driverId), Duration.ofSeconds(5))) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "Order is being accepted by another driver");
        }
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        DriverProfile profile = requireDriverProfile(driverId);
        assertDriverCanReceiveOrders(driverId, profile);
        if (!DriverServiceStatus.ONLINE.equals(profile.getServiceStatus())) {
            throw new BusinessException(ErrorCode.DRIVER_INVALID, "Driver is offline");
        }
        if (!OrderStatus.DISPATCHING.equals(order.getOrderStatus())) {
            if (Objects.equals(order.getDriverId(), driverId) && OrderStatus.ACCEPTED.equals(order.getOrderStatus())) {
                return;
            }
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Current order status does not allow accepting");
        }
        order.setDriverId(driverId);
        order.setOrderStatus(OrderStatus.ACCEPTED);
        order.setAcceptedAt(LocalDateTime.now());
        rideOrderMapper.updateById(order);
        orderRuntimeSupport.warmUpRoutes(order);
        profile.setServiceStatus(DriverServiceStatus.BUSY);
        driverProfileMapper.updateById(profile);
        PlatformUser driver = platformUserMapper.selectById(driverId);
        messagePushSupport.push(order.getUserId(), "ORDER", "DRIVER_ACCEPTED", "司机已接单",
                (driver == null ? "司机" : driver.getNickname()) + "已接单，请准备上车。", order.getLanguageCode());
    }

    @Override
    public void rejectOrder(Long orderId, String reason) {
        if (!RoleCode.DRIVER.equals(UserContext.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only drivers can reject orders");
        }
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        if (!OrderStatus.DISPATCHING.equals(order.getOrderStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Current order cannot be rejected");
        }
        cacheSupport.set(buildRejectCacheKey(UserContext.userId(), orderId),
                StringUtils.hasText(reason) ? reason : "Driver is temporarily unavailable",
                Duration.ofMinutes(30));
    }

    @Override
    @Transactional
    public void startOrder(Long orderId) {
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        assertDriverOwnsOrder(order);
        transferStatus(order, OrderStatus.PICKING_UP);
        rideOrderMapper.updateById(order);
        messagePushSupport.push(order.getUserId(), "ORDER", "DRIVER_ON_THE_WAY", "司机接驾中", "司机正在前往上车点，请保持电话畅通。", order.getLanguageCode());
    }

    @Override
    @Transactional
    public void pickupOrder(Long orderId) {
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        assertPickupAllowed(order);
        if (OrderStatus.IN_TRIP.equals(order.getOrderStatus())) {
            return;
        }
        transferStatus(order, OrderStatus.IN_TRIP);
        order.setStartedAt(LocalDateTime.now());
        rideOrderMapper.updateById(order);
        orderRuntimeSupport.warmUpRoutes(order);
        messagePushSupport.push(order.getUserId(), "ORDER", "TRIP_STARTED", "行程已开始", "乘客已上车，行程已开始。", order.getLanguageCode());
    }

    @Override
    @Transactional
    public void finishOrder(Long orderId, OrderFinishRequest request) {
        RideOrder order = syncAutoProgress(requireOrder(orderId));
        assertDriverOwnsOrder(order);
        completeOrder(order, request.getActualDistanceKm(), request.getActualDurationMin(), LocalDateTime.now());
    }

    @Override
    @Transactional
    public RideOrder mockPay(MockPayRequest request) {
        Long orderId = request.getOrderId();
        RideOrder order = requireOrder(orderId);
        if (!RoleCode.ADMIN.equals(UserContext.role()) && !Objects.equals(order.getUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to pay this order");
        }
        if (!OrderStatus.FINISHED.equals(order.getOrderStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Only finished orders can be paid");
        }
        if (!PayStatus.UNPAID.equals(order.getPayStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Only unpaid orders can be paid");
        }
        applyMockPaymentAdjustments(order, request);
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setOrderId(orderId);
        paymentRecord.setPayNo("PAY" + IdUtil.getSnowflakeNextIdStr());
        paymentRecord.setPayAmount(order.getPayableAmount());
        paymentRecord.setCurrencyCode(order.getCurrencyCode());
        paymentRecord.setPayChannel(StringUtils.hasText(request.getPayChannel()) ? request.getPayChannel() : "WECHAT_MOCK");
        paymentRecord.setPayStatus(PayStatus.PAID);
        paymentRecord.setMockTransactionNo("MOCK-" + IdUtil.fastSimpleUUID());
        paymentRecord.setPaidAt(LocalDateTime.now());
        paymentRecordMapper.insert(paymentRecord);
        order.setPayStatus(PayStatus.PAID);
        order.setPaidAt(paymentRecord.getPaidAt());
        rideOrderMapper.updateById(order);
        settleIfPossible(order);
        messagePushSupport.push(order.getUserId(), "PAYMENT", "PAY_SUCCESS", "支付成功", "订单已完成支付，可查看订单详情。", order.getLanguageCode());
        return requireOrder(orderId);
    }

    @Override
    public List<RideOrder> currentUserOrders(String roleCode) {
        LambdaQueryWrapper<RideOrder> wrapper = new LambdaQueryWrapper<>();
        if (RoleCode.DRIVER.equals(roleCode)) {
            wrapper.eq(RideOrder::getDriverId, UserContext.userId());
        } else if (RoleCode.ADMIN.equals(roleCode)) {
            wrapper.orderByDesc(RideOrder::getId);
            return rideOrderMapper.selectList(wrapper).stream().map(this::syncAutoProgress).toList();
        } else {
            wrapper.eq(RideOrder::getUserId, UserContext.userId());
        }
        wrapper.orderByDesc(RideOrder::getId);
        return rideOrderMapper.selectList(wrapper).stream().map(this::syncAutoProgress).toList();
    }

    @Override
    public List<Map<String, Object>> currentUserOrderViews(String roleCode) {
        return currentUserOrders(roleCode).stream()
                .map(this::mapOrderView)
                .toList();
    }

    @Override
    public List<RideOrder> waitingOrders() {
        if (!List.of(RoleCode.DRIVER, RoleCode.ADMIN).contains(UserContext.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to view waiting orders");
        }
        List<RideOrder> orders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getOrderStatus, OrderStatus.DISPATCHING)
                .orderByDesc(RideOrder::getCreatedAt));
        if (!RoleCode.DRIVER.equals(UserContext.role())) {
            return orders;
        }
        Long driverId = UserContext.userId();
        if (!hasDriverOrderPermission(driverId)) {
            return List.of();
        }
        return orders.stream()
                .filter(item -> cacheSupport.get(buildRejectCacheKey(driverId, item.getId())).isEmpty())
                .toList();
    }

    @Override
    public List<Map<String, Object>> waitingOrderViews() {
        return waitingOrders().stream()
                .map(this::mapOrderView)
                .toList();
    }

    @Override
    @Transactional
    public void submitEvaluation(EvaluationRequest request) {
        RideOrder order = requireOrder(request.getOrderId());
        if (!Objects.equals(order.getUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "You can only evaluate your own order");
        }
        if (!OrderStatus.FINISHED.equals(order.getOrderStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "Only finished orders can be evaluated");
        }
        if (!"PENDING".equals(order.getEvaluationStatus())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "Order already evaluated");
        }
        order.setEvaluationStatus("DONE:" + request.getScore() + ":" + (request.getContent() == null ? "" : request.getContent()));
        rideOrderMapper.updateById(order);
    }

    @Override
    @Transactional
    public void submitComplaint(ComplaintRequest request) {
        RideOrder order = requireOrder(request.getOrderId());
        if (!Objects.equals(order.getUserId(), UserContext.userId()) && !RoleCode.ADMIN.equals(UserContext.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to complain about this order");
        }
        if (!"NONE".equals(order.getComplaintStatus())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "Order already complained");
        }
        Complaint complaint = new Complaint();
        complaint.setOrderId(request.getOrderId());
        complaint.setUserId(UserContext.userId());
        complaint.setComplaintType(request.getComplaintType());
        complaint.setContent(request.getContent());
        complaint.setHandleStatus("PENDING");
        complaintMapper.insert(complaint);
        order.setComplaintStatus("PENDING");
        rideOrderMapper.updateById(order);
    }

    @Override
    @Transactional
    public RideOrder applyInvoice(Long orderId, InvoiceApplyRequest request) {
        RideOrder order = requireOrder(orderId);
        assertOrderReadable(order);
        if (!Objects.equals(order.getUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只能为自己的订单申请发票");
        }
        if (!OrderStatus.FINISHED.equals(order.getOrderStatus()) || !PayStatus.PAID.equals(order.getPayStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "仅已完成且已支付订单可以申请发票");
        }
        if (InvoiceStatus.APPLIED.equals(order.getInvoiceStatus())) {
            return order;
        }
        if (InvoiceStatus.ISSUED.equals(order.getInvoiceStatus())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "该订单已开票");
        }
        order.setInvoiceStatus(InvoiceStatus.APPLIED);
        InvoiceApplyRequest safeRequest = request == null ? new InvoiceApplyRequest() : request;
        order.setRemark(rewriteInvoiceMeta(order, safeRequest, InvoiceStatus.APPLIED, "乘客端提交电子发票申请"));
        rideOrderMapper.updateById(order);
        messagePushSupport.push(
                order.getUserId(),
                "INVOICE",
                "INVOICE_APPLIED",
                "发票申请已提交",
                "订单 " + order.getOrderNo() + " 的电子发票申请已提交，处理后可在发票中心查看。",
                order.getLanguageCode());
        return order;
    }

    @Override
    public List<Map<String, Object>> homeBanners() {
        return List.of(
                Map.of("title", "New user gift pack", "subtitle", "Auto-matched coupons for new users", "type", "COUPON"),
                Map.of("title", "Weekend carpool discount", "subtitle", "Publish trip and confirm both sides", "type", "CARPOOL"),
                Map.of("title", "International airport transfer", "subtitle", "Cross-border order and multi-currency demo", "type", "INTERNATIONAL"));
    }

    @Override
    @Transactional
    public void reportTrack(Long orderId, TrackReportRequest request) {
        RideOrder order = requireOrder(orderId);
        assertOrderReadable(order);
        TravelTrace trace = new TravelTrace();
        trace.setOrderId(orderId);
        trace.setUserId(order.getUserId());
        trace.setDriverId(order.getDriverId());
        trace.setBizRole(UserContext.role());
        trace.setLongitude(request.getLongitude());
        trace.setLatitude(request.getLatitude());
        trace.setWaitingRedLight(Boolean.TRUE.equals(request.getWaitingRedLight()));
        trace.setWaitSeconds(request.getWaitSeconds());
        trace.setCurrentWaitSeconds(request.getCurrentWaitSeconds());
        trace.setTrafficText(request.getTrafficText());
        trace.setWaitingText(request.getWaitingText());
        trace.setSpeedKmh(request.getSpeedKmh());
        trace.setHeading(request.getHeading());
        trace.setRemark(normalizeTraceRemark(request));
        trace.setReportedAt(LocalDateTime.now());
        travelTraceMapper.insert(trace);
        if (RoleCode.DRIVER.equals(UserContext.role()) && order.getDriverId() != null) {
            DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                    .eq(DriverProfile::getUserId, order.getDriverId()));
            if (profile != null) {
                profile.setLastLongitude(request.getLongitude());
                profile.setLastLatitude(request.getLatitude());
                driverProfileMapper.updateById(profile);
            }
        }
    }

    private String normalizeTraceRemark(TrackReportRequest request) {
        String traceMode = StringUtils.hasText(request.getTraceMode()) ? request.getTraceMode().trim().toUpperCase() : "";
        String remark = StringUtils.hasText(request.getRemark()) ? request.getRemark().trim() : "";
        if ("DEMO".equals(traceMode) && !remark.startsWith("DEMO_ROUTE")) {
            return "DEMO_ROUTE" + (StringUtils.hasText(remark) ? ":" + remark : "");
        }
        if ("REAL".equals(traceMode) && !remark.startsWith("REAL_GPS")) {
            return "REAL_GPS" + (StringUtils.hasText(remark) ? ":" + remark : "");
        }
        return remark;
    }

    @Override
    public List<TravelTrace> trackHistory(Long orderId) {
        RideOrder order = requireOrder(orderId);
        assertOrderReadable(order);
        return travelTraceMapper.selectList(new LambdaQueryWrapper<TravelTrace>()
                .eq(TravelTrace::getOrderId, orderId)
                .orderByAsc(TravelTrace::getReportedAt));
    }

    private Long requireLoginUserId() {
        Long userId = UserContext.userId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }

    private CarType requireCarType(Long carTypeId) {
        CarType carType = carTypeMapper.selectById(carTypeId);
        if (carType == null || carType.getEnabled() == null || carType.getEnabled() != 1) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "Car type not found or disabled");
        }
        return carType;
    }

    private RideOrder requireOrder(Long orderId) {
        RideOrder order = rideOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "Order not found");
        }
        return order;
    }

    private DriverProfile requireDriverProfile(Long userId) {
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, userId));
        if (profile == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "Driver profile not found");
        }
        return profile;
    }

    private CouponUseResult useCouponIfNeeded(Long userCouponId, BigDecimal amount, String serviceType) {
        if (userCouponId == null) {
            return new CouponUseResult(null, BigDecimal.ZERO);
        }
        UserCoupon userCoupon = userCouponMapper.selectById(userCouponId);
        if (userCoupon == null
                || !Objects.equals(userCoupon.getUserId(), UserContext.userId())
                || !CouponStatus.UNUSED.equals(userCoupon.getCouponStatus())) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Coupon is invalid");
        }
        if (userCoupon.getValidEndTime() != null && userCoupon.getValidEndTime().isBefore(LocalDateTime.now())) {
            markCouponExpired(userCoupon);
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Coupon expired");
        }
        if (!"ALL".equals(userCoupon.getServiceScope()) && !serviceType.equals(userCoupon.getServiceScope())) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Coupon is not applicable to this service");
        }
        Coupon coupon = couponMapper.selectById(userCoupon.getCouponId());
        if (coupon == null || coupon.getStatus() == null || coupon.getStatus() != 1) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Coupon config is invalid");
        }
        if (coupon.getThresholdAmount() != null && amount.compareTo(coupon.getThresholdAmount()) < 0) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Coupon threshold not met");
        }
        if (CouponType.DISCOUNT.equals(coupon.getCouponType())
                && (coupon.getDiscountRate() == null || coupon.getDiscountRate().compareTo(BigDecimal.ZERO) <= 0 || coupon.getDiscountRate().compareTo(BigDecimal.ONE) >= 0)) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "Discount coupon config is invalid");
        }
        BigDecimal discount = CouponType.DISCOUNT.equals(coupon.getCouponType())
                ? amount.multiply(BigDecimal.ONE.subtract(coupon.getDiscountRate())).setScale(2, RoundingMode.HALF_UP)
                : coupon.getDiscountAmount();
        userCoupon.setCouponStatus(CouponStatus.USED);
        userCoupon.setUsedAt(LocalDateTime.now());
        userCouponMapper.updateById(userCoupon);
        writeCouponLog(userCoupon, userCoupon.getCouponId(), "USE", "Coupon used and bound to order", null);
        return new CouponUseResult(userCoupon.getId(), discount.min(amount));
    }

    private void markCouponExpired(UserCoupon userCoupon) {
        userCoupon.setCouponStatus(CouponStatus.EXPIRED);
        userCouponMapper.updateById(userCoupon);
        writeCouponLog(userCoupon, userCoupon.getCouponId(), "EXPIRE", "Coupon expired", null);
    }

    private void releaseCouponIfUnused(RideOrder order) {
        if (order.getUserCouponId() == null) {
            return;
        }
        UserCoupon userCoupon = userCouponMapper.selectById(order.getUserCouponId());
        if (userCoupon == null || !CouponStatus.USED.equals(userCoupon.getCouponStatus())) {
            return;
        }
        userCoupon.setCouponStatus(CouponStatus.UNUSED);
        userCoupon.setBindOrderId(null);
        userCoupon.setUsedAt(null);
        userCouponMapper.updateById(userCoupon);
        writeCouponLog(userCoupon, userCoupon.getCouponId(), "ROLLBACK", "Coupon returned after order cancellation", order.getId());
    }

    private void bindCouponIfNecessary(RideOrder order) {
        if (order.getUserCouponId() == null) {
            return;
        }
        UserCoupon userCoupon = userCouponMapper.selectById(order.getUserCouponId());
        if (userCoupon == null) {
            return;
        }
        userCoupon.setBindOrderId(order.getId());
        userCouponMapper.updateById(userCoupon);
        writeCouponLog(userCoupon, userCoupon.getCouponId(), "BIND_ORDER", "Coupon bound to order", order.getId());
    }

    private PricingResult calcAmount(CarType carType, String serviceType, BigDecimal distanceKm, BigDecimal durationMin) {
        BigDecimal baseAmount = ServiceType.INTERNATIONAL.equals(serviceType)
                ? safeDecimal(carType.getCrossBorderBasePrice())
                : safeDecimal(carType.getStartPrice());
        BigDecimal extraDistance = distanceKm.subtract(safeDecimal(carType.getStartDistanceKm())).max(BigDecimal.ZERO);
        BigDecimal distanceAmount = extraDistance.multiply(safeDecimal(carType.getDistancePrice()));
        BigDecimal durationAmount = durationMin.multiply(safeDecimal(carType.getDurationPrice()));
        BigDecimal longDistanceAmount = BigDecimal.ZERO;
        if (distanceKm.compareTo(BigDecimal.valueOf(30)) > 0) {
            longDistanceAmount = distanceKm.subtract(BigDecimal.valueOf(30))
                    .multiply(safeDecimal(carType.getLongDistancePrice()));
        }
        BigDecimal nightAmount = isNightPeriod() ? safeDecimal(carType.getNightSurcharge()) : BigDecimal.ZERO;
        BigDecimal total = baseAmount.add(distanceAmount).add(durationAmount).add(longDistanceAmount).add(nightAmount);
        if (ServiceType.CARPOOL.equals(serviceType)) {
            total = total.multiply(BigDecimal.valueOf(0.85));
        }
        BigDecimal exchangeRate = ServiceType.INTERNATIONAL.equals(serviceType)
                ? getDecimalConfig("intlExchangeRate", DEFAULT_EXCHANGE_RATE)
                : BigDecimal.ONE;
        String currencyCode = ServiceType.INTERNATIONAL.equals(serviceType) ? "USD" : "CNY";
        if (ServiceType.INTERNATIONAL.equals(serviceType)) {
            total = total.divide(exchangeRate, 2, RoundingMode.HALF_UP);
            baseAmount = baseAmount.divide(exchangeRate, 2, RoundingMode.HALF_UP);
            longDistanceAmount = longDistanceAmount.divide(exchangeRate, 2, RoundingMode.HALF_UP);
            nightAmount = nightAmount.divide(exchangeRate, 2, RoundingMode.HALF_UP);
        }
        return new PricingResult(baseAmount.setScale(2, RoundingMode.HALF_UP),
                nightAmount.setScale(2, RoundingMode.HALF_UP),
                longDistanceAmount.setScale(2, RoundingMode.HALF_UP),
                total.setScale(2, RoundingMode.HALF_UP),
                currencyCode,
                exchangeRate);
    }

    private void transferStatus(RideOrder order, String targetStatus) {
        if (!OrderStatus.canTransfer(order.getOrderStatus(), targetStatus)) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繘鏌熼幆鏉啃撻柍閿嬫⒒閳ь剙绠嶉崕閬嵥囬鐐插瀭闁稿瞼鍋為悡鐔兼煟閺冨偆鐒炬い銉ヮ儔閺岋繝宕遍鐘垫殼闂佸搫鐭夌紞浣割嚕椤掑嫬鍨傛い鏃囨閳ь剦鍨跺铏圭矙濞嗘儳鍓遍梺鍛婃⒐閻熲晛顕ｆ繝姘у璺猴梗缁卞爼姊洪棃娑辨▓闁哥姵顨呰鐎光偓閸曨兘鎷虹紓浣割儐椤戞瑩宕曢幇鐗堢厵缂佸顑欓悡鍏碱殽閻愯尙绠荤€规洏鍔戦、姘跺川椤斝板洦鐓欓柤鍦瑜把呯磼閺屻儳鐣虹€规洑鍗抽獮鎺懳旀担鍙夊濠电偠鎻徊鑲╂媰閿曞倹鍊块柛鎾楀懐锛滈柣鐘叉搐濡﹪宕曡箛娑欘梿濠㈣埖鍔栭悡鏇㈡煏婢舵ê鏋涘褍顭烽弻鈩冩媴闂堚晞鍚梺缁樻惄閸嬪﹤鐣烽崼鏇炍╅柨鏃傝檸濡蹭即鏌ｆ惔銈庢綈婵炲弶鐗犺棟闁汇垻顭堢粻鏍ㄤ繆閵堝懏鍣归柟纭呭煐閵囧嫰骞樼捄琛″亾椤愶附鏅查柛銉㈡櫇閿涙粍绻涢幘纾嬪婵炲眰鍊曢埢宥咁吋婢跺鍘?" + targetStatus);
        }
        order.setOrderStatus(targetStatus);
    }

    private void assertOrderWritable(RideOrder order) {
        if (RoleCode.ADMIN.equals(UserContext.role())) {
            return;
        }
        if (Objects.equals(order.getUserId(), UserContext.userId()) || Objects.equals(order.getDriverId(), UserContext.userId())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to access this order");
    }

    private void assertOrderReadable(RideOrder order) {
        assertOrderWritable(order);
    }

    private void assertDriverOwnsOrder(RideOrder order) {
        if (!RoleCode.DRIVER.equals(UserContext.role()) || !Objects.equals(order.getDriverId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the assigned driver can operate this order");
        }
    }

    private void assertPickupAllowed(RideOrder order) {
        if (RoleCode.DRIVER.equals(UserContext.role()) && Objects.equals(order.getDriverId(), UserContext.userId())) {
            return;
        }
        if (RoleCode.USER.equals(UserContext.role()) && Objects.equals(order.getUserId(), UserContext.userId())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Current account cannot confirm boarding");
    }

    private RideOrder syncPaymentStatus(RideOrder order) {
        if (order == null || order.getId() == null) {
            return order;
        }
        List<PaymentRecord> records = paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderId, order.getId())
                .orderByDesc(PaymentRecord::getId));
        if (records.isEmpty()) {
            return order;
        }

        PaymentRecord refundedRecord = records.stream()
                .filter(item -> PayStatus.REFUNDED.equals(item.getPayStatus()))
                .findFirst()
                .orElse(null);
        PaymentRecord paidRecord = records.stream()
                .filter(item -> PayStatus.PAID.equals(item.getPayStatus()))
                .findFirst()
                .orElse(null);
        boolean changed = false;

        if (refundedRecord != null) {
            if (!PayStatus.REFUNDED.equals(order.getPayStatus())) {
                order.setPayStatus(PayStatus.REFUNDED);
                order.setSettlementStatus("REFUNDED");
                changed = true;
            }
            if (refundedRecord.getRefundedAt() != null && !Objects.equals(order.getRefundedAt(), refundedRecord.getRefundedAt())) {
                order.setRefundedAt(refundedRecord.getRefundedAt());
                changed = true;
            }
            if (refundedRecord.getRefundAmount() != null && !Objects.equals(order.getRefundAmount(), refundedRecord.getRefundAmount())) {
                order.setRefundAmount(refundedRecord.getRefundAmount());
                changed = true;
            }
            if (StringUtils.hasText(refundedRecord.getRefundReason()) && !Objects.equals(order.getRefundReason(), refundedRecord.getRefundReason())) {
                order.setRefundReason(refundedRecord.getRefundReason());
                changed = true;
            }
        } else if (paidRecord != null) {
            if (!PayStatus.PAID.equals(order.getPayStatus())) {
                order.setPayStatus(PayStatus.PAID);
                changed = true;
            }
            LocalDateTime paidAt = paidRecord.getPaidAt() != null ? paidRecord.getPaidAt() : paidRecord.getCreatedAt();
            if (paidAt != null && !Objects.equals(order.getPaidAt(), paidAt)) {
                order.setPaidAt(paidAt);
                changed = true;
            }
        }

        if (changed) {
            rideOrderMapper.updateById(order);
        }
        if (PayStatus.PAID.equals(order.getPayStatus()) && OrderStatus.FINISHED.equals(order.getOrderStatus())) {
            settleIfPossible(order);
        }
        return changed ? requireOrder(order.getId()) : order;
    }

    private RideOrder syncAutoProgress(RideOrder order) {
        return syncPaymentStatus(order);
    }

    private void completeOrder(RideOrder order, BigDecimal actualDistanceKm, BigDecimal actualDurationMin, LocalDateTime finishedAt) {
        transferStatus(order, OrderStatus.FINISHED);
        CarType carType = requireCarType(order.getCarTypeId());
        PricingResult pricing = calcAmount(carType, order.getServiceType(), actualDistanceKm, actualDurationMin);
        BigDecimal discount = order.getCouponDiscount() == null ? BigDecimal.ZERO : order.getCouponDiscount();
        BigDecimal actualAmount = pricing.finalAmount().subtract(discount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        order.setActualDistanceKm(actualDistanceKm);
        order.setActualDurationMin(actualDurationMin);
        order.setNightSurchargeAmount(pricing.nightSurchargeAmount());
        order.setLongDistanceSurchargeAmount(pricing.longDistanceSurchargeAmount());
        order.setActualAmount(actualAmount);
        order.setPayableAmount(actualAmount);
        order.setFinishedAt(finishedAt);
        BigDecimal platformCommissionRate = getDecimalConfig("platformCommissionRate", DEFAULT_PLATFORM_COMMISSION_RATE);
        order.setPlatformCommissionAmount(actualAmount.multiply(platformCommissionRate).setScale(2, RoundingMode.HALF_UP));
        order.setDriverIncomeAmount(actualAmount.subtract(order.getPlatformCommissionAmount()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        rideOrderMapper.updateById(order);
        settleIfPossible(order);
        restoreDriverStatus(order.getDriverId());
        messagePushSupport.push(order.getUserId(), "ORDER", "TRIP_FINISHED", "行程已结束", "行程已结束，请完成支付并评价。", order.getLanguageCode());
    }

    private void validateAddress(String serviceType, String startName, String endName) {
        if (startName.equals(endName)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Start and end cannot be the same");
        }
        if (ServiceType.INTERNATIONAL.equals(serviceType)) {
            if (!startName.contains(",") || !endName.contains(",")) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "International address must include country or city");
            }
        }
    }

    private void ensureNoDuplicateOpenOrder(Long userId, OrderCreateRequest request) {
        RideOrder latest = rideOrderMapper.selectOne(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getUserId, userId)
                .in(RideOrder::getOrderStatus, List.of(OrderStatus.DISPATCHING, OrderStatus.ACCEPTED, OrderStatus.PICKING_UP, OrderStatus.IN_TRIP))
                .orderByDesc(RideOrder::getId)
                .last("limit 1"));
        if (latest != null) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "An active order already exists");
        }
    }

    private BigDecimal calcCancelFee(RideOrder order) {
        String status = order.getOrderStatus();
        if (order.getDriverId() == null || OrderStatus.CREATED.equals(status) || OrderStatus.DISPATCHING.equals(status)) {
            return BigDecimal.ZERO;
        }
        int freeCancelMinutes = getIntegerConfig("freeCancelMinutes", DEFAULT_FREE_CANCEL_MINUTES);
        LocalDateTime feeStartAt = order.getAcceptedAt() != null ? order.getAcceptedAt() : order.getCreatedAt();
        long elapsedMinutes = feeStartAt == null ? freeCancelMinutes : Math.max(0, Duration.between(feeStartAt, LocalDateTime.now()).toMinutes());
        long timeoutMinutes = Math.max(0, elapsedMinutes - freeCancelMinutes);
        if (timeoutMinutes <= 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal orderAmount = firstPositiveAmount(order.getPayableAmount(), order.getEstimatedAmount(), order.getActualAmount());
        if (orderAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        long chargeSteps = Math.max(1, (timeoutMinutes + CANCEL_FEE_STEP_MINUTES - 1) / CANCEL_FEE_STEP_MINUTES);
        BigDecimal ratePerStep = OrderStatus.PICKING_UP.equals(status)
                ? PICKING_UP_CANCEL_RATE_PER_STEP
                : ACCEPTED_CANCEL_RATE_PER_STEP;
        BigDecimal rateCap = OrderStatus.PICKING_UP.equals(status)
                ? PICKING_UP_CANCEL_RATE_CAP
                : ACCEPTED_CANCEL_RATE_CAP;
        BigDecimal feeRate = ratePerStep.multiply(BigDecimal.valueOf(chargeSteps)).min(rateCap);
        return orderAmount.multiply(feeRate)
                .min(orderAmount)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal firstPositiveAmount(BigDecimal... values) {
        for (BigDecimal value : values) {
            BigDecimal decimal = safeDecimal(value);
            if (decimal.compareTo(BigDecimal.ZERO) > 0) {
                return decimal;
            }
        }
        return BigDecimal.ZERO;
    }

    private void settleIfPossible(RideOrder order) {
        if (!OrderStatus.FINISHED.equals(order.getOrderStatus()) || !PayStatus.PAID.equals(order.getPayStatus())) {
            return;
        }
        if ("DONE".equals(order.getSettlementStatus())) {
            return;
        }
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, order.getDriverId()));
        if (profile != null) {
            profile.setTotalIncome(safeDecimal(profile.getTotalIncome()).add(safeDecimal(order.getDriverIncomeAmount())));
            profile.setWithdrawableIncome(safeDecimal(profile.getWithdrawableIncome()).add(safeDecimal(order.getDriverIncomeAmount())));
            driverProfileMapper.updateById(profile);
        }
        order.setSettlementStatus("DONE");
        rideOrderMapper.updateById(order);
    }

    private void restoreDriverStatus(Long driverId) {
        if (driverId == null) {
            return;
        }
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, driverId));
        if (profile != null) {
            profile.setServiceStatus(hasDriverOrderPermission(driverId) ? DriverServiceStatus.ONLINE : DriverServiceStatus.OFFLINE);
            driverProfileMapper.updateById(profile);
        }
    }

    private void applyMockPaymentAdjustments(RideOrder order, MockPayRequest request) {
        if (request == null) {
            return;
        }
        BigDecimal originalAmount = safeDecimal(request.getOriginalAmount());
        BigDecimal payableAmount = safeDecimal(request.getPayableAmount());
        BigDecimal couponDiscount = safeDecimal(request.getCouponDiscount());
        if (originalAmount.compareTo(BigDecimal.ZERO) > 0) {
            order.setActualAmount(originalAmount.setScale(2, RoundingMode.HALF_UP));
        }
        if (payableAmount.compareTo(BigDecimal.ZERO) >= 0 && request.getPayableAmount() != null) {
            order.setPayableAmount(payableAmount.setScale(2, RoundingMode.HALF_UP));
        }
        if (request.getCouponDiscount() != null) {
            order.setCouponDiscount(couponDiscount.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        if (request.getUserCouponId() != null) {
            UserCoupon userCoupon = userCouponMapper.selectById(request.getUserCouponId());
            if (userCoupon != null && Objects.equals(userCoupon.getUserId(), order.getUserId())) {
                order.setUserCouponId(userCoupon.getId());
                userCoupon.setCouponStatus(CouponStatus.USED);
                userCoupon.setBindOrderId(order.getId());
                if (userCoupon.getUsedAt() == null) {
                    userCoupon.setUsedAt(LocalDateTime.now());
                }
                userCouponMapper.updateById(userCoupon);
                writeCouponLog(userCoupon, userCoupon.getCouponId(), "USE", "Coupon used during payment", order.getId());
            }
        }
        BigDecimal settlementAmount = safeDecimal(order.getPayableAmount()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformCommissionRate = getDecimalConfig("platformCommissionRate", DEFAULT_PLATFORM_COMMISSION_RATE);
        order.setPlatformCommissionAmount(settlementAmount.multiply(platformCommissionRate).setScale(2, RoundingMode.HALF_UP));
        order.setDriverIncomeAmount(settlementAmount.subtract(safeDecimal(order.getPlatformCommissionAmount())).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
    }

    private void assertDriverCanReceiveOrders(Long driverId, DriverProfile profile) {
        PlatformUser user = platformUserMapper.selectById(driverId);
        if (user == null || user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Driver account is disabled");
        }
        Vehicle vehicle = queryVehicle(driverId);
        if (vehicle == null || vehicle.getAuditStatus() == null || vehicle.getAuditStatus() != 2) {
            throw new BusinessException(ErrorCode.DRIVER_INVALID, "Please submit vehicle info and pass admin review first");
        }
        if (profile.getAuditStatus() == null) {
            profile.setAuditStatus(vehicle.getAuditStatus());
        }
    }

    private boolean hasDriverOrderPermission(Long driverId) {
        PlatformUser user = platformUserMapper.selectById(driverId);
        if (user == null || user.getEnabled() == null || user.getEnabled() != 1) {
            return false;
        }
        Vehicle vehicle = queryVehicle(driverId);
        return vehicle != null && vehicle.getAuditStatus() != null && vehicle.getAuditStatus() == 2;
    }

    private Vehicle queryVehicle(Long driverId) {
        return vehicleMapper.selectOne(new LambdaQueryWrapper<Vehicle>()
                .eq(Vehicle::getDriverId, driverId)
                .orderByDesc(Vehicle::getId)
                .last("limit 1"));
    }

    private Map<String, Object> mapOrderView(RideOrder order) {
        Map<String, Object> row = BeanUtil.beanToMap(order, new LinkedHashMap<>(), false, false);
        PlatformUser user = order.getUserId() == null ? null : platformUserMapper.selectById(order.getUserId());
        PlatformUser driver = order.getDriverId() == null ? null : platformUserMapper.selectById(order.getDriverId());
        Vehicle vehicle = order.getDriverId() == null ? null : queryVehicle(order.getDriverId());
        DriverProfile profile = order.getDriverId() == null ? null : driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, order.getDriverId())
                .last("limit 1"));

        Map<String, Object> userSummary = mapUserSummary(user);
        Map<String, Object> driverSummary = mapUserSummary(driver);
        String passengerName = displayName(user, "乘客");
        String driverName = displayName(driver, "司机");
        row.put("user", userSummary);
        row.put("passenger", userSummary);
        row.put("passengerName", passengerName);
        row.put("userName", passengerName);
        row.put("userNickname", user == null ? "" : firstNonBlank(user.getNickname(), user.getRealName()));
        row.put("driver", driverSummary);
        row.put("driverName", driverName);
        row.put("driverNickname", driver == null ? "" : firstNonBlank(driver.getNickname(), driver.getRealName()));
        row.put("driverPhone", driver == null ? "" : firstNonBlank(driver.getPhone()));
        row.put("driverScore", profile == null ? null : profile.getScore());
        row.put("vehicle", vehicle);
        row.put("plateNo", vehicle == null ? "" : firstNonBlank(vehicle.getPlateNo()));
        row.put("vehiclePlateNo", vehicle == null ? "" : firstNonBlank(vehicle.getPlateNo()));
        row.put("carModel", vehicle == null ? "" : firstNonBlank(
                (firstNonBlank(vehicle.getBrand()) + " " + firstNonBlank(vehicle.getModelName())).trim(),
                vehicle.getModelName(),
                vehicle.getBrand()));
        row.put("carColor", vehicle == null ? "" : firstNonBlank(vehicle.getColor()));
        row.put("cleanRemark", InternationalMetaUtil.cleanText(order.getRemark()));
        if (ServiceType.INTERNATIONAL.equals(order.getServiceType())) {
            Map<String, Object> internationalMeta = InternationalMetaUtil.parse(order.getRemark());
            putIfBlank(internationalMeta, "productName", "国际出行");
            putIfBlank(internationalMeta, "startName", order.getStartName());
            putIfBlank(internationalMeta, "endName", order.getEndName());
            putIfBlank(internationalMeta, "languageCode", order.getLanguageCode());
            putIfBlank(internationalMeta, "currencyCode", order.getCurrencyCode());
            putIfBlank(internationalMeta, "exchangeRate", order.getExchangeRate());
            putIfBlank(internationalMeta, "syncStatus", "BACKEND_ORDER");
            row.put("internationalMeta", internationalMeta);
        }
        return row;
    }

    private Map<String, Object> mapUserSummary(PlatformUser user) {
        if (user == null) {
            return null;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", user.getId());
        row.put("nickname", user.getNickname());
        row.put("realName", user.getRealName());
        row.put("displayName", displayName(user, ""));
        row.put("phone", user.getPhone());
        row.put("avatar", user.getAvatar());
        row.put("roleCode", user.getRoleCode());
        return row;
    }

    private String displayName(PlatformUser user, String fallback) {
        return user == null ? fallback : firstNonBlank(user.getNickname(), user.getRealName(), fallback);
    }

    private void writeCouponLog(UserCoupon userCoupon, Long couponId, String operationType, String content, Long orderId) {
        CouponOperationLog operationLog = new CouponOperationLog();
        operationLog.setCouponId(couponId);
        operationLog.setUserId(userCoupon.getUserId());
        operationLog.setUserCouponId(userCoupon.getId());
        operationLog.setOrderId(orderId);
        operationLog.setOperationType(operationType);
        operationLog.setContent(content);
        couponOperationLogMapper.insert(operationLog);
    }

    private String rewriteInvoiceMeta(RideOrder order, InvoiceApplyRequest request, String status, String handleRemark) {
        return InvoiceMetaUtil.rewrite(order.getRemark(), buildInvoiceMeta(order, request, status, handleRemark));
    }

    private Map<String, Object> buildInvoiceMeta(RideOrder order, InvoiceApplyRequest request, String status, String handleRemark) {
        Map<String, Object> previous = InvoiceMetaUtil.parse(order.getRemark());
        PlatformUser user = platformUserMapper.selectById(order.getUserId());
        CarType carType = order.getCarTypeId() == null ? null : carTypeMapper.selectById(order.getCarTypeId());
        PaymentRecord paymentRecord = latestPaymentRecord(order.getId());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime tripTime = firstTime(order.getFinishedAt(), order.getStartedAt(), order.getPaidAt(), order.getCreatedAt(), now);
        BigDecimal totalAmount = firstPositive(order.getActualAmount(), order.getPayableAmount(), order.getEstimatedAmount()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal distanceKm = firstPositive(order.getActualDistanceKm(), order.getEstimatedDistanceKm()).setScale(1, RoundingMode.HALF_UP);
        BigDecimal durationMin = firstPositive(order.getActualDurationMin(), order.getEstimatedDurationMin()).setScale(0, RoundingMode.HALF_UP);
        String buyerName = firstNonBlank(
                request.getInvoiceTitle(),
                InvoiceMetaUtil.firstText(previous, "buyerName", "title"),
                user == null ? "" : user.getRealName(),
                user == null ? "" : user.getNickname(),
                "个人");
        String buyerTaxNo = firstNonBlank(request.getTaxNo(), InvoiceMetaUtil.firstText(previous, "buyerTaxNo", "taxNo"), "个人无需填写");
        String buyerPhone = firstNonBlank(request.getBuyerPhone(), InvoiceMetaUtil.text(previous, "buyerPhone"), user == null ? "" : user.getPhone(), "13800000000");
        String invoiceNo = firstNonBlank(InvoiceMetaUtil.text(previous, "invoiceNo"), buildInvoiceNo(order));
        String invoiceCode = firstNonBlank(InvoiceMetaUtil.text(previous, "invoiceCode"), buildInvoiceCode(order));
        String issueAt = InvoiceStatus.ISSUED.equals(status)
                ? formatInvoiceTime(now)
                : firstNonBlank(InvoiceMetaUtil.text(previous, "issueAt"), "");
        String appliedAt = firstNonBlank(InvoiceMetaUtil.text(previous, "appliedAt"), formatInvoiceTime(now));

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("version", "2");
        meta.put("status", status);
        meta.put("invoiceStatus", status);
        meta.put("invoiceType", "电子普通发票");
        meta.put("invoiceCode", invoiceCode);
        meta.put("invoiceNo", invoiceNo);
        meta.put("invoiceDate", InvoiceStatus.ISSUED.equals(status) ? formatInvoiceDate(now) : formatInvoiceDate(tripTime));
        meta.put("issueAt", issueAt);
        meta.put("appliedAt", appliedAt);
        meta.put("handledAt", InvoiceStatus.APPLIED.equals(status) ? "" : formatInvoiceTime(now));
        meta.put("orderId", order.getId());
        meta.put("orderNo", order.getOrderNo());
        meta.put("title", buyerName);
        meta.put("buyerName", buyerName);
        meta.put("taxNo", buyerTaxNo);
        meta.put("buyerTaxNo", buyerTaxNo);
        meta.put("buyerPhone", buyerPhone);
        meta.put("sellerName", INVOICE_SELLER_NAME);
        meta.put("sellerTaxNo", INVOICE_SELLER_TAX_NO);
        meta.put("sellerPhone", INVOICE_SELLER_PHONE);
        meta.put("passengerName", firstNonBlank(user == null ? "" : user.getRealName(), user == null ? "" : user.getNickname(), "阳光乘客"));
        meta.put("tripTime", formatInvoiceTime(tripTime));
        meta.put("startName", firstNonBlank(order.getStartName(), "未记录上车点"));
        meta.put("endName", firstNonBlank(order.getEndName(), "未记录下车点"));
        meta.put("serviceType", firstNonBlank(order.getServiceType(), ServiceType.TAXI));
        meta.put("serviceName", serviceTypeLabel(order.getServiceType()));
        meta.put("carTypeName", carType == null || !StringUtils.hasText(carType.getName()) ? serviceTypeLabel(order.getServiceType()) : carType.getName());
        meta.put("distanceKm", distanceKm.toPlainString());
        meta.put("durationMin", durationMin.toPlainString());
        meta.put("payChannel", paymentRecord == null || !StringUtils.hasText(paymentRecord.getPayChannel()) ? "在线支付" : paymentRecord.getPayChannel());
        meta.put("currencyCode", firstNonBlank(order.getCurrencyCode(), "CNY"));
        meta.put("itemName", serviceTypeLabel(order.getServiceType()) + "出行服务费");
        meta.put("itemUnit", "次");
        meta.put("itemQuantity", "1");
        meta.put("itemUnitPrice", totalAmount.toPlainString());
        meta.put("itemAmount", totalAmount.toPlainString());
        meta.put("totalAmount", totalAmount.toPlainString());
        meta.put("couponDiscount", safeDecimal(order.getCouponDiscount()).setScale(2, RoundingMode.HALF_UP).toPlainString());
        meta.put("remark", firstNonBlank(request.getRemark(), InvoiceMetaUtil.text(previous, "remark"), "本发票为打车出行电子发票。"));
        meta.put("handleRemark", firstNonBlank(handleRemark, InvoiceMetaUtil.text(previous, "handleRemark"), ""));
        meta.put("rejectReason", InvoiceStatus.REJECTED.equals(status) ? firstNonBlank(handleRemark, request.getRemark(), "发票信息不完整，请补充后重新申请。") : "");
        return meta;
    }

    private PaymentRecord latestPaymentRecord(Long orderId) {
        if (orderId == null) {
            return null;
        }
        return paymentRecordMapper.selectOne(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderId, orderId)
                .orderByDesc(PaymentRecord::getId)
                .last("limit 1"));
    }

    private String buildInvoiceCode(RideOrder order) {
        long suffix = Math.abs(Objects.hash(order.getId(), order.getOrderNo())) % 100000L;
        return "0310024" + String.format("%05d", suffix);
    }

    private String buildInvoiceNo(RideOrder order) {
        long suffix = Math.abs(Objects.hash(order.getOrderNo(), order.getId(), order.getUserId())) % 100000000L;
        return String.format("%08d", suffix);
    }

    private BigDecimal firstPositive(BigDecimal... values) {
        if (values != null) {
            for (BigDecimal value : values) {
                BigDecimal decimal = safeDecimal(value);
                if (decimal.compareTo(BigDecimal.ZERO) > 0) {
                    return decimal;
                }
            }
        }
        return BigDecimal.ZERO;
    }

    private LocalDateTime firstTime(LocalDateTime... values) {
        if (values != null) {
            for (LocalDateTime value : values) {
                if (value != null) {
                    return value;
                }
            }
        }
        return LocalDateTime.now();
    }

    private String formatInvoiceTime(LocalDateTime value) {
        return (value == null ? LocalDateTime.now() : value).format(INVOICE_DATE_TIME_FORMATTER);
    }

    private String formatInvoiceDate(LocalDateTime value) {
        return (value == null ? LocalDateTime.now() : value).format(INVOICE_DATE_FORMATTER);
    }

    private String serviceTypeLabel(String serviceType) {
        if (ServiceType.CARPOOL.equals(serviceType)) {
            return "顺风车";
        }
        if (ServiceType.INTERNATIONAL.equals(serviceType)) {
            return "国际出行";
        }
        return "即时打车";
    }

    private String firstNonBlank(String... values) {
        if (values != null) {
            for (String value : values) {
                if (StringUtils.hasText(value)) {
                    return value.trim();
                }
            }
        }
        return "";
    }

    private void putIfBlank(Map<String, Object> row, String key, Object value) {
        if (row == null || !StringUtils.hasText(key) || value == null) {
            return;
        }
        Object current = row.get(key);
        if (current == null || !StringUtils.hasText(String.valueOf(current))) {
            row.put(key, value);
        }
    }

    private String buildDispatchRemark(String dispatchMode, String originalRemark) {
        String mode = StringUtils.hasText(dispatchMode) ? dispatchMode : "SMART";
        String suffix = "SMART".equalsIgnoreCase(mode) ? "SMART dispatch" : "Manual dispatch";
        if (!StringUtils.hasText(originalRemark)) {
            return suffix;
        }
        return originalRemark + " | " + suffix;
    }

    private boolean isNightPeriod() {
        String range = getStringConfig("nightTimeRange", DEFAULT_NIGHT_TIME_RANGE);
        String[] parts = range.split("-");
        if (parts.length != 2) {
            return defaultNightPeriod();
        }
        try {
            LocalTime start = LocalTime.parse(parts[0].trim());
            LocalTime end = LocalTime.parse(parts[1].trim());
            LocalTime now = LocalTime.now();
            if (start.equals(end)) {
                return true;
            }
            if (start.isBefore(end)) {
                return !now.isBefore(start) && !now.isAfter(end);
            }
            return !now.isBefore(start) || !now.isAfter(end);
        } catch (Exception ex) {
            return defaultNightPeriod();
        }
    }

    private String buildRejectCacheKey(Long driverId, Long orderId) {
        return "order:reject:" + driverId + ":" + orderId;
    }

    private BigDecimal safeDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        try {
            return new BigDecimal(Objects.toString(value, "0")).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception exception) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
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

    private Integer getIntegerConfig(String key, Integer defaultValue) {
        SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                .eq(SystemConfig::getConfigKey, key)
                .last("limit 1"));
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(config.getConfigValue().trim());
        } catch (Exception ex) {
            return defaultValue;
        }
    }

    private String getStringConfig(String key, String defaultValue) {
        SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                .eq(SystemConfig::getConfigKey, key)
                .last("limit 1"));
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            return defaultValue;
        }
        return config.getConfigValue().trim();
    }

    private boolean defaultNightPeriod() {
        LocalTime now = LocalTime.now();
        return now.isAfter(LocalTime.of(23, 0)) || now.isBefore(LocalTime.of(6, 0));
    }

    private record PricingResult(BigDecimal baseAmount,
                                 BigDecimal nightSurchargeAmount,
                                 BigDecimal longDistanceSurchargeAmount,
                                 BigDecimal finalAmount,
                                 String currencyCode,
                                 BigDecimal exchangeRate) {
    }

    private record CouponUseResult(Long userCouponId, BigDecimal discountAmount) {
    }
}
