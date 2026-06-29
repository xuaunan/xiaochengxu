package com.sunshine.travel.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.AuthStatus;
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
    private static final String CHANNEL_WEB = "WEB";

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
        return buildContext(userId, userRole, "MINIAPP");
    }

    public Map<String, Object> buildContext(Long userId, String userRole, String channel) {
        PlatformUser user = userId == null ? null : platformUserMapper.selectById(userId);
        List<String> lines = new ArrayList<>();
        List<Map<String, Object>> sections = new ArrayList<>();
        List<String> sources = new ArrayList<>();
        String normalizedChannel = normalizeChannel(channel);

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

        appendProductKnowledge(userRole, normalizedChannel, lines, sections, sources);

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
            appendDriverContext(userId, user, lines, sections, sources);
        } else {
            appendPassengerContext(userId, lines, sections, sources);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("userRole", userRole);
        result.put("channel", normalizedChannel);
        result.put("channelText", channelText(normalizedChannel));
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

    private void appendProductKnowledge(String userRole, String channel, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        if (CHANNEL_WEB.equals(normalizeChannel(channel))) {
            appendWebProductKnowledge(userRole, lines, sections, sources);
            return;
        }
        sources.add("miniapp_navigation_knowledge");
        Map<String, Object> knowledgeSection = section("小程序产品背景");
        if (RoleCode.DRIVER.equals(userRole)) {
            addField(knowledgeSection, "司机底部导航", "【听单】pages/dashboard/index、【行程】pages/orders/index、【收益】pages/wallet/index、【我的】pages/profile/index");
            addField(knowledgeSection, "司机页面清单", "真实页面包含：听单/接单大厅、司机登录/我的车辆、行程、收益、我的、编辑司机资料、行程进行中、行程详情、提现管理、司机消息、在线客服、接单设置。没有独立的【司机中心】页面。");
            addField(knowledgeSection, "听单接单", "司机端底部【听单】进入接单大厅；车辆审核通过且接单权限解锁后，可点【开始接单/停止接单】，查看待接订单、当前行程，执行接单、拒单和继续行程。接单后进入【行程进行中】。");
            addField(knowledgeSection, "我的车辆", "司机端【我的】-核心功能【我的车辆】进入司机登录/车辆页；可查看当前绑定车辆、审核状态、审核备注，添加或更换车辆。提交或更换车辆后要等待管理员审核，审核期间接单权限会临时锁定。");
            addField(knowledgeSection, "司机行程", "司机端底部【行程】或【我的】-核心功能【我的订单】查看接单记录、进行中订单和历史行程；进行中订单打开【行程进行中】，其他订单打开【行程详情】。");
            addField(knowledgeSection, "司机收益提现", "司机端底部【收益】或【我的】-经营数据【我的收入】查看今日收入、本月收入、可提现金额和收益明细；点提现入口进入【提现管理】，填写提现金额并点【确认提现】，提现记录也在该页查看。");
            addField(knowledgeSection, "接单设置", "司机端【我的】-经营数据【接单设置】或设置页调整听单开关、语音播报、轨迹模式、声音风格和自动接单偏好。");
            addField(knowledgeSection, "司机账号消息客服", "司机端【我的】-账号与消息包含【司机资料】【消息通知】【在线客服】；司机资料编辑昵称、城市编码和紧急联系人；消息通知查看平台通知、审核结果和活动消息；在线客服处理接单、审核和提现问题。");
        } else {
            addField(knowledgeSection, "乘客底部导航", "【首页】pages/home/index、【行程】pages/orders/index、【顺风车】pages/carpool/index、【优惠券】pages/coupon/index、【我的】pages/profile/index");
            addField(knowledgeSection, "乘客页面清单", "真实页面包含：欢迎页、登录、首页、搜索位置、地图选点、等待接单、司机已接单、行程进行中、费用结算、行程评价、行程、订单详情、支付订单、顺风车、确认顺风车订单、发布顺风车行程、顺风车详情、申请搭乘、我的顺风车、International、国际出行下单、我的国际行程、优惠券中心、我的、编辑资料、实名认证、我的钱包、评价管理、投诉反馈、帮助中心、系统设置、消息通知、电子发票、在线客服。");
            addField(knowledgeSection, "叫车下单", "乘客端底部【首页】选择打车服务，填写起点和终点，选择车型/价格后点【确认叫车】；下单后进入【等待接单】，司机接单后进入【司机已接单】，上车后进入【行程进行中】，结束后进入【费用结算】和【支付订单】。");
            addField(knowledgeSection, "位置选择", "乘客端首页点击起点或终点进入【搜索位置】；搜索页有【我的位置】【收藏夹】【地图选点】，点【地图选点】进入地图选址并确认上车点/目的地。");
            addField(knowledgeSection, "行程订单", "乘客端底部【行程】进入订单中心，可按打车、顺风车、国际出行和状态筛选；点击订单进入【订单详情】。订单详情包含状态进度、司机/车辆、费用、优惠券、售后服务和订单信息。");
            addField(knowledgeSection, "支付退款发票评价", "订单完成后在【订单详情】点支付按钮进入【支付订单】，可选微信支付或余额支付；取消支付时订单保持待支付。退款不是直接改订单，订单详情【申请退款】会提示需提交投诉或联系客服处理。【申请发票】进入【电子发票】；完成并支付后可进入【行程评价】提交评价，历史评价在【我的】-【评价管理】。");
            addField(knowledgeSection, "顺风车", "乘客端底部【顺风车】查看顺路行程、发布顺风车行程、进入顺风车详情和申请搭乘；相关页面包括【确认顺风车订单】【发布顺风车行程】【顺风车详情】【申请搭乘】【我的顺风车】。");
            addField(knowledgeSection, "国际出行", "乘客端首页的国际出行入口进入【International】和【国际出行下单】；可查看港澳跨境/接送机等国际服务，【我的国际行程】查看国际订单。");
            addField(knowledgeSection, "优惠券会员", "乘客端底部【优惠券】进入【优惠券中心】，可查看可用、已用、已过期优惠券，领券和开通/查看阳光会员；从券点击使用会回到首页并带上可用券，订单估价自动匹配可用券。");
            addField(knowledgeSection, "我的账户服务", "乘客端底部【我的】的账户服务包含【个人资料】【实名认证】【我的钱包】【评价管理】【投诉建议】【在线客服】【消息通知】【帮助中心】【系统设置】【电子发票】");
            addField(knowledgeSection, "资料认证钱包", "【个人资料】编辑昵称、真实姓名、紧急联系人；【实名认证】提交或查看认证状态；【我的钱包】查看余额、支付/退款记录和关联订单。");
            addField(knowledgeSection, "消息帮助设置", "【消息通知】展示订单状态、支付、司机接单、优惠券、发票和系统通知，点击消息会跳到对应订单/优惠券/发票/行程页面；【帮助中心】是常见问题与权限说明；【系统设置】包含消息推送和自动匹配优惠券等本机设置。");
            addField(knowledgeSection, "投诉建议", "乘客端底部【我的】-账户服务【投诉建议】进入【投诉反馈】页；订单详情【售后服务】-【投诉反馈】可带订单进入。页面内可选择问题、说明情况、提交给客服，并在【处理记录】查看受理状态。");
            addField(knowledgeSection, "在线客服", "乘客端底部【我的】-账户服务【在线客服】进入客服对话；常见咨询包含【订单问题】【支付退款】【发票优惠券】【投诉建议】【联系人工】。AI会读取本小程序渠道的会话记录和真实业务数据；【帮助中心】不是投诉入口。");
            addField(knowledgeSection, "当前版本提示", "乘客端当前主要通过【行程】和【订单详情】查看订单，通过【投诉建议】/【投诉反馈】提交反馈；司机端车辆与接单权限在【我的车辆】和【听单】相关页面处理。遇到用户说的入口名称和当前版本不一致时，先温和说明当前版本可见入口。");
        }
        sections.add(knowledgeSection);
        lines.add("小程序产品背景：" + fieldsToText(knowledgeSection));
    }

    private void appendWebProductKnowledge(String userRole, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        sources.add("web_navigation_knowledge");
        Map<String, Object> knowledgeSection = section("网页端功能入口");
        addField(knowledgeSection, "当前渠道", "网页端");
        if (RoleCode.DRIVER.equals(userRole)) {
            addField(knowledgeSection, "司机网页首页", "切换司机身份后，在司机首页查看听单状态、待接订单和当前订单处理入口。");
            addField(knowledgeSection, "司机订单", "进入司机行程/订单页，可查看待接单、进行中、历史订单，并执行接单、到达、开始、完成等操作。");
            addField(knowledgeSection, "司机收益", "进入司机收益页查看累计收入、可提现金额、提现记录，并提交提现申请。");
            addField(knowledgeSection, "司机车辆", "进入车辆/资料页查看车辆信息、车牌车型、审核状态和资质进度。");
            addField(knowledgeSection, "网页客服", "网页客服页会读取网页端本会话记录和真实业务数据；转人工后由后台客服继续处理。");
        } else {
            addField(knowledgeSection, "乘客网页首页", "在乘客首页选择出发地、目的地、服务类型和车型后，点击确认叫车提交订单。");
            addField(knowledgeSection, "网页位置选择", "点击起点或终点输入框搜索位置，确认后回填到叫车表单。");
            addField(knowledgeSection, "网页订单", "进入行程/订单页查看当前订单、历史订单、支付、评价、发票和投诉入口。");
            addField(knowledgeSection, "网页优惠与会员", "在优惠券/会员区域查看可用券、已用券、会员状态和优惠抵扣信息。");
            addField(knowledgeSection, "网页客服", "网页客服页会读取网页端本会话记录和真实业务数据；转人工后由后台客服继续处理。");
        }
        sections.add(knowledgeSection);
        lines.add("网页端功能入口：" + fieldsToText(knowledgeSection));
    }

    private void appendDriverContext(Long userId, PlatformUser user, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
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
        Vehicle latestVehicle = vehicles.isEmpty() ? null : vehicles.get(0);
        if (!vehicles.isEmpty()) {
            sources.add("t_vehicle");
            Map<String, Object> vehicleSection = section("车辆资料");
            vehicleSection.put("rows", vehicles.stream().map(this::vehicleRow).toList());
            sections.add(vehicleSection);
            lines.add("车辆资料：");
            vehicles.forEach(vehicle -> lines.add("- " + vehicleText(vehicle)));
        }

        Map<String, Object> permissionSection = section("司机接单权限");
        boolean canReceiveOrders = isEnabled(user) && latestVehicle != null && Objects.equals(latestVehicle.getAuditStatus(), AuthStatus.APPROVED);
        addField(permissionSection, "接单权限", canReceiveOrders ? "已解锁" : "未解锁");
        addField(permissionSection, "权限依据", driverPermissionReason(user, latestVehicle));
        addField(permissionSection, "当前车辆审核", latestVehicle == null ? "未提交车辆" : auditText(latestVehicle.getAuditStatus()));
        sections.add(permissionSection);
        lines.add("司机接单权限：" + fieldsToText(permissionSection));

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

    private String normalizeChannel(String channel) {
        if (!StringUtils.hasText(channel)) {
            return "MINIAPP";
        }
        String normalized = channel.trim().toUpperCase();
        return CHANNEL_WEB.equals(normalized) || "H5".equals(normalized) || "PC".equals(normalized) ? CHANNEL_WEB : "MINIAPP";
    }

    private String channelText(String channel) {
        return CHANNEL_WEB.equals(normalizeChannel(channel)) ? "网页端" : "小程序";
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
            case AuthStatus.UNVERIFIED -> "未提交";
            case AuthStatus.PENDING -> "待审核";
            case AuthStatus.APPROVED -> "通过";
            case AuthStatus.REJECTED -> "拒绝";
            default -> String.valueOf(status);
        };
    }

    private boolean isEnabled(PlatformUser user) {
        return user == null || user.getEnabled() == null || user.getEnabled() == 1;
    }

    private String driverPermissionReason(PlatformUser user, Vehicle latestVehicle) {
        if (!isEnabled(user)) {
            return "账号已禁用，暂不可接单";
        }
        if (latestVehicle == null) {
            return "未查询到车辆资料，请先提交车辆并通过审核";
        }
        if (Objects.equals(latestVehicle.getAuditStatus(), AuthStatus.APPROVED)) {
            return "车辆审核已通过，可开始接单";
        }
        return "车辆审核状态为" + auditText(latestVehicle.getAuditStatus()) + "，暂不可接单";
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
