package com.sunshine.travel.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.entity.Complaint;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PaymentRecord;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.entity.Vehicle;
import com.sunshine.travel.entity.WithdrawApplication;
import com.sunshine.travel.mapper.ComplaintMapper;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PaymentRecordMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.mapper.VehicleMapper;
import com.sunshine.travel.mapper.WithdrawApplicationMapper;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AiSupportContextService {

    private static final int ORDER_LIMIT = 5;
    private static final int PAYMENT_LIMIT = 5;
    private static final int COUPON_LIMIT = 5;
    private static final int WITHDRAW_LIMIT = 5;
    private static final int VEHICLE_LIMIT = 3;
    private static final int COMPLAINT_LIMIT = 5;

    private final PlatformUserMapper platformUserMapper;
    private final RideOrderMapper rideOrderMapper;
    private final PaymentRecordMapper paymentRecordMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponMapper couponMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final VehicleMapper vehicleMapper;
    private final WithdrawApplicationMapper withdrawApplicationMapper;
    private final ComplaintMapper complaintMapper;

    public AiSupportContextService(PlatformUserMapper platformUserMapper,
                                   RideOrderMapper rideOrderMapper,
                                   PaymentRecordMapper paymentRecordMapper,
                                   UserCouponMapper userCouponMapper,
                                   CouponMapper couponMapper,
                                   DriverProfileMapper driverProfileMapper,
                                   VehicleMapper vehicleMapper,
                                   WithdrawApplicationMapper withdrawApplicationMapper,
                                   ComplaintMapper complaintMapper) {
        this.platformUserMapper = platformUserMapper;
        this.rideOrderMapper = rideOrderMapper;
        this.paymentRecordMapper = paymentRecordMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponMapper = couponMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.vehicleMapper = vehicleMapper;
        this.withdrawApplicationMapper = withdrawApplicationMapper;
        this.complaintMapper = complaintMapper;
    }

    public Map<String, Object> buildContext(Long userId, String userRole) {
        PlatformUser user = userId == null ? null : platformUserMapper.selectById(userId);
        List<String> lines = new ArrayList<>();
        List<Map<String, Object>> sections = new ArrayList<>();
        List<String> sources = new ArrayList<>();

        lines.add("以下为系统从数据库读取的当前会话真实业务数据。只能基于这些数据回答；未查询到的数据必须说明未查询到，并建议人工客服跟进。");
        if (user == null) {
            lines.add("用户基础信息：未查询到用户记录。");
        } else {
            sources.add("t_platform_user");
            Map<String, Object> userSection = section("用户基础信息");
            addField(userSection, "用户ID", user.getId());
            addField(userSection, "身份", roleText(userRole));
            addField(userSection, "昵称", user.getNickname());
            addField(userSection, "手机号", maskPhone(user.getPhone()));
            addField(userSection, "账号状态", enabledText(user.getEnabled()));
            addField(userSection, "认证状态", auditText(user.getAuthStatus()));
            addField(userSection, "会员状态", user.getMemberStatus());
            addField(userSection, "会员等级", user.getMemberLevel());
            addField(userSection, "会员到期", user.getMemberExpireAt());
            sections.add(userSection);
            lines.add("用户基础信息：" + fieldsToText(userSection));
        }

        List<RideOrder> orders = recentOrders(userId, userRole);
        if (!orders.isEmpty()) {
            sources.add("t_ride_order");
            Map<String, Object> orderSection = section("最近订单");
            orderSection.put("rows", orders.stream().map(this::orderRow).toList());
            sections.add(orderSection);
            lines.add("最近订单：");
            orders.forEach(order -> lines.add("- " + orderText(order)));
        } else {
            lines.add("最近订单：未查询到。");
        }

        List<Long> orderIds = orders.stream().map(RideOrder::getId).filter(Objects::nonNull).toList();
        List<PaymentRecord> payments = recentPayments(orderIds);
        if (!payments.isEmpty()) {
            sources.add("t_payment_record");
            Map<String, Object> paymentSection = section("最近支付/退款");
            paymentSection.put("rows", payments.stream().map(this::paymentRow).toList());
            sections.add(paymentSection);
            lines.add("最近支付/退款：");
            payments.forEach(payment -> lines.add("- " + paymentText(payment)));
        }

        List<Complaint> complaints = recentComplaints(userId, orderIds);
        if (!complaints.isEmpty()) {
            sources.add("t_complaint");
            Map<String, Object> complaintSection = section("投诉记录");
            complaintSection.put("rows", complaints.stream().map(this::complaintRow).toList());
            sections.add(complaintSection);
            lines.add("投诉记录：");
            complaints.forEach(complaint -> lines.add("- " + complaintText(complaint)));
        }

        if (RoleCode.DRIVER.equals(userRole)) {
            appendDriverContext(userId, lines, sections, sources);
        } else {
            appendPassengerContext(userId, lines, sections, sources);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("userRole", userRole);
        result.put("roleText", roleText(userRole));
        result.put("generatedAt", LocalDateTime.now());
        result.put("sources", sources.stream().distinct().toList());
        result.put("sections", sections);
        result.put("contextText", String.join("\n", lines));
        result.put("summary", summary(user != null, orders.size(), payments.size(), complaints.size(), sections));
        return result;
    }

    private void appendPassengerContext(Long userId, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        List<UserCoupon> userCoupons = recentCoupons(userId);
        if (userCoupons.isEmpty()) {
            lines.add("优惠券：未查询到最近优惠券。");
            return;
        }
        sources.add("t_user_coupon");
        sources.add("t_coupon");
        Map<String, Object> couponSection = section("最近优惠券");
        couponSection.put("rows", userCoupons.stream().map(this::couponRow).toList());
        sections.add(couponSection);
        lines.add("最近优惠券：");
        userCoupons.forEach(userCoupon -> lines.add("- " + couponText(userCoupon)));
    }

    private void appendDriverContext(Long userId, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, userId)
                .last("limit 1"));
        if (profile != null) {
            sources.add("t_driver_profile");
            Map<String, Object> profileSection = section("司机资料");
            addField(profileSection, "司机编号", profile.getDriverNo());
            addField(profileSection, "服务状态", profile.getServiceStatus());
            addField(profileSection, "审核状态", auditText(profile.getAuditStatus()));
            addField(profileSection, "评分", profile.getScore());
            addField(profileSection, "累计收入", money(profile.getTotalIncome()));
            addField(profileSection, "可提现收入", money(profile.getWithdrawableIncome()));
            addField(profileSection, "城市", profile.getCityCode());
            addField(profileSection, "审核备注", profile.getAuditRemark());
            sections.add(profileSection);
            lines.add("司机资料：" + fieldsToText(profileSection));
        } else {
            lines.add("司机资料：未查询到。");
        }

        List<Vehicle> vehicles = recentVehicles(userId);
        if (!vehicles.isEmpty()) {
            sources.add("t_vehicle");
            Map<String, Object> vehicleSection = section("车辆资料");
            vehicleSection.put("rows", vehicles.stream().map(this::vehicleRow).toList());
            sections.add(vehicleSection);
            lines.add("车辆资料：");
            vehicles.forEach(vehicle -> lines.add("- " + vehicleText(vehicle)));
        }

        List<WithdrawApplication> withdraws = recentWithdraws(userId);
        if (!withdraws.isEmpty()) {
            sources.add("t_withdraw_application");
            Map<String, Object> withdrawSection = section("提现记录");
            withdrawSection.put("rows", withdraws.stream().map(this::withdrawRow).toList());
            sections.add(withdrawSection);
            lines.add("提现记录：");
            withdraws.forEach(withdraw -> lines.add("- " + withdrawText(withdraw)));
        }
    }

    private List<RideOrder> recentOrders(Long userId, String userRole) {
        if (userId == null) {
            return List.of();
        }
        LambdaQueryWrapper<RideOrder> wrapper = new LambdaQueryWrapper<RideOrder>()
                .orderByDesc(RideOrder::getCreatedAt)
                .last("limit " + ORDER_LIMIT);
        if (RoleCode.DRIVER.equals(userRole)) {
            wrapper.eq(RideOrder::getDriverId, userId);
        } else {
            wrapper.eq(RideOrder::getUserId, userId);
        }
        return rideOrderMapper.selectList(wrapper);
    }

    private List<PaymentRecord> recentPayments(List<Long> orderIds) {
        if (orderIds.isEmpty()) {
            return List.of();
        }
        return paymentRecordMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                .in(PaymentRecord::getOrderId, orderIds)
                .orderByDesc(PaymentRecord::getCreatedAt)
                .last("limit " + PAYMENT_LIMIT));
    }

    private List<UserCoupon> recentCoupons(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return userCouponMapper.selectList(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getUserId, userId)
                .orderByDesc(UserCoupon::getCreatedAt)
                .last("limit " + COUPON_LIMIT));
    }

    private List<Complaint> recentComplaints(Long userId, List<Long> orderIds) {
        if (userId == null && orderIds.isEmpty()) {
            return List.of();
        }
        LambdaQueryWrapper<Complaint> wrapper = new LambdaQueryWrapper<Complaint>().orderByDesc(Complaint::getCreatedAt).last("limit " + COMPLAINT_LIMIT);
        if (userId != null && !orderIds.isEmpty()) {
            wrapper.and(item -> item.eq(Complaint::getUserId, userId).or().in(Complaint::getOrderId, orderIds));
        } else if (userId != null) {
            wrapper.eq(Complaint::getUserId, userId);
        } else {
            wrapper.in(Complaint::getOrderId, orderIds);
        }
        return complaintMapper.selectList(wrapper);
    }

    private List<Vehicle> recentVehicles(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return vehicleMapper.selectList(new LambdaQueryWrapper<Vehicle>()
                .eq(Vehicle::getDriverId, userId)
                .orderByDesc(Vehicle::getCreatedAt)
                .last("limit " + VEHICLE_LIMIT));
    }

    private List<WithdrawApplication> recentWithdraws(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return withdrawApplicationMapper.selectList(new LambdaQueryWrapper<WithdrawApplication>()
                .eq(WithdrawApplication::getDriverId, userId)
                .orderByDesc(WithdrawApplication::getCreatedAt)
                .last("limit " + WITHDRAW_LIMIT));
    }

    private Map<String, Object> section(String title) {
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("title", title);
        section.put("fields", new ArrayList<Map<String, Object>>());
        return section;
    }

    @SuppressWarnings("unchecked")
    private void addField(Map<String, Object> section, String label, Object value) {
        if (value == null || !StringUtils.hasText(String.valueOf(value))) {
            return;
        }
        List<Map<String, Object>> fields = (List<Map<String, Object>>) section.get("fields");
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("label", label);
        field.put("value", value);
        fields.add(field);
    }

    @SuppressWarnings("unchecked")
    private String fieldsToText(Map<String, Object> section) {
        List<Map<String, Object>> fields = (List<Map<String, Object>>) section.getOrDefault("fields", List.of());
        if (fields.isEmpty()) {
            return "无可展示字段";
        }
        return fields.stream()
                .map(item -> item.get("label") + "=" + item.get("value"))
                .collect(Collectors.joining("；"));
    }

    private Map<String, Object> orderRow(RideOrder order) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("订单号", order.getOrderNo());
        row.put("服务", order.getServiceType());
        row.put("订单状态", order.getOrderStatus());
        row.put("支付状态", order.getPayStatus());
        row.put("发票状态", order.getInvoiceStatus());
        row.put("投诉状态", order.getComplaintStatus());
        row.put("起点", order.getStartName());
        row.put("终点", order.getEndName());
        row.put("应付", money(order.getPayableAmount()));
        row.put("实付", money(order.getActualAmount()));
        row.put("退款", money(order.getRefundAmount()));
        row.put("创建时间", order.getCreatedAt());
        row.put("支付时间", order.getPaidAt());
        row.put("接单时间", order.getAcceptedAt());
        return row;
    }

    private String orderText(RideOrder order) {
        return "订单号=" + text(order.getOrderNo())
                + "，服务=" + text(order.getServiceType())
                + "，状态=" + text(order.getOrderStatus())
                + "，支付=" + text(order.getPayStatus())
                + "，发票=" + text(order.getInvoiceStatus())
                + "，投诉=" + text(order.getComplaintStatus())
                + "，起终点=" + text(order.getStartName()) + " -> " + text(order.getEndName())
                + "，应付=" + money(order.getPayableAmount())
                + "，实付=" + money(order.getActualAmount())
                + "，退款=" + money(order.getRefundAmount())
                + "，创建=" + time(order.getCreatedAt());
    }

    private Map<String, Object> paymentRow(PaymentRecord payment) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("订单ID", payment.getOrderId());
        row.put("支付单号", payment.getPayNo());
        row.put("渠道", payment.getPayChannel());
        row.put("状态", payment.getPayStatus());
        row.put("金额", money(payment.getPayAmount()));
        row.put("退款金额", money(payment.getRefundAmount()));
        row.put("支付时间", payment.getPaidAt());
        row.put("退款时间", payment.getRefundedAt());
        return row;
    }

    private String paymentText(PaymentRecord payment) {
        return "订单ID=" + payment.getOrderId()
                + "，支付单=" + text(payment.getPayNo())
                + "，渠道=" + text(payment.getPayChannel())
                + "，状态=" + text(payment.getPayStatus())
                + "，金额=" + money(payment.getPayAmount())
                + "，退款=" + money(payment.getRefundAmount())
                + "，支付时间=" + time(payment.getPaidAt());
    }

    private Map<String, Object> couponRow(UserCoupon userCoupon) {
        Coupon coupon = userCoupon.getCouponId() == null ? null : couponMapper.selectById(userCoupon.getCouponId());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("券名称", coupon == null ? "未查询到券模板" : coupon.getCouponName());
        row.put("状态", userCoupon.getCouponStatus());
        row.put("适用范围", userCoupon.getServiceScope());
        row.put("门槛", coupon == null ? "" : money(coupon.getThresholdAmount()));
        row.put("减免", coupon == null ? "" : money(coupon.getDiscountAmount()));
        row.put("有效期开始", userCoupon.getValidStartTime());
        row.put("有效期结束", userCoupon.getValidEndTime());
        row.put("使用时间", userCoupon.getUsedAt());
        return row;
    }

    private String couponText(UserCoupon userCoupon) {
        Coupon coupon = userCoupon.getCouponId() == null ? null : couponMapper.selectById(userCoupon.getCouponId());
        return "券=" + (coupon == null ? "未查询到券模板" : text(coupon.getCouponName()))
                + "，状态=" + text(userCoupon.getCouponStatus())
                + "，适用=" + text(userCoupon.getServiceScope())
                + "，减免=" + (coupon == null ? "未知" : money(coupon.getDiscountAmount()))
                + "，有效期=" + time(userCoupon.getValidStartTime()) + "至" + time(userCoupon.getValidEndTime());
    }

    private Map<String, Object> complaintRow(Complaint complaint) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("订单ID", complaint.getOrderId());
        row.put("类型", complaint.getComplaintType());
        row.put("处理状态", complaint.getHandleStatus());
        row.put("处理结果", complaint.getHandleResult());
        row.put("提交时间", complaint.getCreatedAt());
        row.put("处理时间", complaint.getHandleTime());
        return row;
    }

    private String complaintText(Complaint complaint) {
        return "订单ID=" + complaint.getOrderId()
                + "，类型=" + text(complaint.getComplaintType())
                + "，状态=" + text(complaint.getHandleStatus())
                + "，结果=" + text(complaint.getHandleResult())
                + "，提交=" + time(complaint.getCreatedAt());
    }

    private Map<String, Object> vehicleRow(Vehicle vehicle) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("车牌", maskPlate(vehicle.getPlateNo()));
        row.put("品牌", vehicle.getBrand());
        row.put("车型", vehicle.getModelName());
        row.put("颜色", vehicle.getColor());
        row.put("座位数", vehicle.getSeatCount());
        row.put("审核状态", auditText(vehicle.getAuditStatus()));
        row.put("审核备注", vehicle.getAuditRemark());
        return row;
    }

    private String vehicleText(Vehicle vehicle) {
        return "车牌=" + maskPlate(vehicle.getPlateNo())
                + "，车型=" + text(vehicle.getBrand()) + " " + text(vehicle.getModelName())
                + "，座位=" + text(vehicle.getSeatCount())
                + "，审核=" + auditText(vehicle.getAuditStatus())
                + "，备注=" + text(vehicle.getAuditRemark());
    }

    private Map<String, Object> withdrawRow(WithdrawApplication withdraw) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("金额", money(withdraw.getApplyAmount()));
        row.put("银行", withdraw.getBankName());
        row.put("状态", withdraw.getStatus());
        row.put("驳回原因", withdraw.getRejectReason());
        row.put("申请时间", withdraw.getCreatedAt());
        row.put("审核时间", withdraw.getAuditedAt());
        return row;
    }

    private String withdrawText(WithdrawApplication withdraw) {
        return "金额=" + money(withdraw.getApplyAmount())
                + "，银行=" + text(withdraw.getBankName())
                + "，状态=" + text(withdraw.getStatus())
                + "，原因=" + text(withdraw.getRejectReason())
                + "，申请=" + time(withdraw.getCreatedAt());
    }

    private Map<String, Object> summary(boolean hasUser, int orderCount, int paymentCount, int complaintCount, List<Map<String, Object>> sections) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("hasUser", hasUser);
        summary.put("orderCount", orderCount);
        summary.put("paymentCount", paymentCount);
        summary.put("complaintCount", complaintCount);
        summary.put("sectionCount", sections.size());
        return summary;
    }

    private String roleText(String role) {
        return RoleCode.DRIVER.equals(role) ? "司机" : "乘客";
    }

    private String enabledText(Integer enabled) {
        if (enabled == null) {
            return "未知";
        }
        return enabled == 1 ? "正常" : "禁用";
    }

    private String auditText(Integer status) {
        if (status == null) {
            return "未知";
        }
        return switch (status) {
            case 0 -> "待审核";
            case 1 -> "通过";
            case 2 -> "拒绝";
            default -> String.valueOf(status);
        };
    }

    private String maskPhone(String phone) {
        if (!StringUtils.hasText(phone) || phone.length() < 7) {
            return text(phone);
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private String maskPlate(String plate) {
        if (!StringUtils.hasText(plate) || plate.length() <= 2) {
            return text(plate);
        }
        return plate.substring(0, 1) + "***" + plate.substring(plate.length() - 1);
    }

    private String money(BigDecimal value) {
        return value == null ? "未记录" : value.stripTrailingZeros().toPlainString();
    }

    private String time(LocalDateTime value) {
        return value == null ? "未记录" : value.toString().replace('T', ' ');
    }

    private String text(Object value) {
        if (value == null || !StringUtils.hasText(String.valueOf(value))) {
            return "未记录";
        }
        return String.valueOf(value).trim();
    }
}
