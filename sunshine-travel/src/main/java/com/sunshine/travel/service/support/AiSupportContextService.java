package com.sunshine.travel.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.AuthStatus;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.entity.Complaint;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PaymentRecord;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.SupportConversation;
import com.sunshine.travel.entity.SupportMessage;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.entity.Vehicle;
import com.sunshine.travel.entity.WithdrawApplication;
import com.sunshine.travel.mapper.ComplaintMapper;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PaymentRecordMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.SupportConversationMapper;
import com.sunshine.travel.mapper.SupportMessageMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.mapper.VehicleMapper;
import com.sunshine.travel.mapper.WithdrawApplicationMapper;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
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
    private static final int CROSS_CHANNEL_CONVERSATION_LIMIT = 2;
    private static final int CROSS_CHANNEL_MESSAGE_LIMIT = 6;
    private static final int CROSS_CHANNEL_RECENT_DAYS = 7;
    private static final String CHANNEL_WEB = "WEB";
    /** 全平台通用事实：防止AI编造APP、应用商店、短信等不存在的渠道。 */
    private static final String PLATFORM_FACTS =
            "平台形态（事实，禁止编造其他渠道）：阳光出行只有微信小程序（乘客端小程序、司机端小程序）和网页端，没有独立手机APP，不存在应用商店下载；"
                    + "审核结果、订单状态等平台通知只通过小程序【消息通知】和网页端站内消息送达，没有短信、电话、邮件通知；"
                    + "平台没有对外官网网址，提到网页端时只说\"阳光出行平台网页版\"，禁止说出任何具体网址或域名。";

    private static final String[] KW_WITHDRAW = {"提现", "到账", "打款", "佣金"};
    private static final String[] KW_INCOME = {"收入", "收益", "流水"};
    private static final String[] KW_DISPATCH = {"听单", "接单", "派单", "解锁", "权限"};
    private static final String[] KW_ORDER = {"订单", "行程", "单子", "打车", "叫车", "接驾", "顺风车", "国际", "司机", "乘客", "取消"};
    private static final String[] KW_PAYMENT = {"支付", "付款", "退款", "扣款", "费用", "车费", "价格", "多收", "重复扣"};
    private static final String[] KW_AUDIT = {"审核", "资质", "认证", "车辆", "资料", "证件", "驳回"};
    private static final String[] KW_COUPON = {"优惠券", "优惠", "领券", "抵扣"};
    private static final String[] KW_INVOICE = {"发票"};
    private static final String[] KW_COMPLAINT = {"投诉", "反馈", "建议"};
    private static final String[] KW_WALLET = {"钱包", "余额"};

    private final PlatformUserMapper platformUserMapper;
    private final RideOrderMapper rideOrderMapper;
    private final PaymentRecordMapper paymentRecordMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponMapper couponMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final VehicleMapper vehicleMapper;
    private final WithdrawApplicationMapper withdrawApplicationMapper;
    private final ComplaintMapper complaintMapper;
    private final SupportConversationMapper supportConversationMapper;
    private final SupportMessageMapper supportMessageMapper;

    public AiSupportContextService(PlatformUserMapper platformUserMapper,
                                   RideOrderMapper rideOrderMapper,
                                   PaymentRecordMapper paymentRecordMapper,
                                   UserCouponMapper userCouponMapper,
                                   CouponMapper couponMapper,
                                   DriverProfileMapper driverProfileMapper,
                                   VehicleMapper vehicleMapper,
                                   WithdrawApplicationMapper withdrawApplicationMapper,
                                   ComplaintMapper complaintMapper,
                                   SupportConversationMapper supportConversationMapper,
                                   SupportMessageMapper supportMessageMapper) {
        this.platformUserMapper = platformUserMapper;
        this.rideOrderMapper = rideOrderMapper;
        this.paymentRecordMapper = paymentRecordMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponMapper = couponMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.vehicleMapper = vehicleMapper;
        this.withdrawApplicationMapper = withdrawApplicationMapper;
        this.complaintMapper = complaintMapper;
        this.supportConversationMapper = supportConversationMapper;
        this.supportMessageMapper = supportMessageMapper;
    }

    public Map<String, Object> buildContext(Long userId, String userRole) {
        return buildContext(userId, userRole, "MINIAPP");
    }

    public Map<String, Object> buildContext(Long userId, String userRole, String channel) {
        return buildContext(userId, userRole, channel, null, null);
    }

    public Map<String, Object> buildContext(Long userId, String userRole, String channel, String focusQuestion) {
        return buildContext(userId, userRole, channel, focusQuestion, null);
    }

    /**
     * focusQuestion 是用户最新一条消息，focusHistory 是它之前最多几条用户消息的拼接。
     * 焦点主题按"最新消息 + 近几轮用户消息"合并判断，保证"那第二单呢""怎么还没到"这类
     * 不含关键词的追问不会丢失上一轮的话题焦点。
     */
    public Map<String, Object> buildContext(Long userId, String userRole, String channel, String focusQuestion, String focusHistory) {
        PlatformUser user = userId == null ? null : platformUserMapper.selectById(userId);
        List<String> lines = new ArrayList<>();
        List<Map<String, Object>> sections = new ArrayList<>();
        List<String> sources = new ArrayList<>();
        String normalizedChannel = normalizeChannel(channel);

        lines.add("以下为系统从数据库读取的当前会话真实业务数据、产品背景知识和当前问题焦点。回答必须优先使用这些真实数据、贴合用户具体情况；未查询到的数据要如实说明，不要编造。");
        lines.add(currentTimeline());
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
            addField(userSection, "钱包余额", user.getWalletBalance() == null ? null : money(user.getWalletBalance()) + " 元");
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

        DriverProfile profile = null;
        List<Vehicle> vehicles = List.of();
        List<WithdrawApplication> withdraws = List.of();
        List<UserCoupon> coupons = List.of();
        if (RoleCode.DRIVER.equals(userRole)) {
            profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                    .eq(DriverProfile::getUserId, userId)
                    .last("limit 1"));
            vehicles = recentVehicles(userId);
            withdraws = recentWithdraws(userId);
            appendDriverContext(userId, user, profile, vehicles, withdraws, lines, sections, sources);
        } else {
            coupons = recentCoupons(userId);
            appendPassengerContext(coupons, lines, sections, sources);
        }

        appendCrossChannelContext(userId, userRole, normalizedChannel, lines, sections, sources);

        appendFocusSection(focusQuestion, focusHistory, userRole, user, orders, payments, complaints, profile, vehicles, withdraws, coupons, lines, sections);

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

    private void appendPassengerContext(List<UserCoupon> userCoupons, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
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
        addField(knowledgeSection, "平台形态", PLATFORM_FACTS);
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
            addField(knowledgeSection, "乘客页面清单", "真实页面包含：欢迎页、登录、首页、搜索位置、地图选点、等待接单、司机已接单、行程进行中、费用结算、行程评价、行程、订单详情、支付订单、顺风车、乘客需求确认、发布顺风车行程、顺风车详情、我的顺风车、International、国际出行下单、我的国际行程、优惠券中心、我的、编辑资料、实名认证、我的钱包、评价管理、投诉反馈、帮助中心、系统设置、消息通知、电子发票、在线客服。");
            addField(knowledgeSection, "叫车下单", "乘客端底部【首页】选择打车服务，填写起点和终点，选择车型/价格后点【确认叫车】；下单后进入【等待接单】，司机接单后进入【司机已接单】，上车后进入【行程进行中】，结束后进入【费用结算】和【支付订单】。");
            addField(knowledgeSection, "成为司机", "乘客想成为司机：在微信内使用司机端小程序（不是APP，无需下载），登录后按页面引导完成实名认证并提交车辆资料，由平台管理员审核；车辆审核通过、接单权限解锁后即可在司机端小程序听单接单，审核结果在司机端小程序【消息通知】查看；网页端也可以选择司机身份登录并提交认证。");
            addField(knowledgeSection, "位置选择", "乘客端首页点击起点或终点进入【搜索位置】；搜索页有【我的位置】【收藏夹】【地图选点】，点【地图选点】进入地图选址并确认上车点/目的地。");
            addField(knowledgeSection, "行程订单", "乘客端底部【行程】进入订单中心，可按打车、顺风车、国际出行和状态筛选；点击订单进入【订单详情】。订单详情包含状态进度、司机/车辆、费用、优惠券、售后服务和订单信息。");
            addField(knowledgeSection, "支付退款发票评价", "订单完成后在【订单详情】点支付按钮进入【支付订单】，可选微信支付或余额支付；取消支付时订单保持待支付。退款不是直接改订单，订单详情【申请退款】会提示需提交投诉或联系客服处理。【申请发票】进入【电子发票】；完成并支付后可进入【行程评价】提交评价，历史评价在【我的】-【评价管理】。");
            addField(knowledgeSection, "顺风车", "乘客端底部【顺风车】填写起点、终点、出发时间和人数发布预约需求；车主先发布自己的固定路线和空位，系统按路线、时间及座位筛选需求，由车主主动接单，乘客再次确认后锁定同行。车主可拒绝或取消；顺风车不是即时叫车，不会自动派车。相关页面包括【乘客需求确认】【发布顺风车行程】【顺风车详情】【我的顺风车】。");
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
        addField(knowledgeSection, "平台形态", PLATFORM_FACTS);
        if (RoleCode.DRIVER.equals(userRole)) {
            addField(knowledgeSection, "真实左侧导航", "听单、行程、收益、司机资质、客服、接单设置、资料设置、消息（共8项；没有名为【订单】的导航，司机订单在【行程】里）");
            addField(knowledgeSection, "听单", "接单大厅：开启/停止接单、查看待接订单并抢单、处理当前行程。");
            addField(knowledgeSection, "行程", "司机的订单都在这里；接单、到达、开始行程、完成等流转操作在订单卡片上执行。");
            addField(knowledgeSection, "收益", "累计收入、可提现金额、提现记录与提现申请。");
            addField(knowledgeSection, "司机资质", "资质认证提交、车辆资料、审核状态与审核备注。");
            addField(knowledgeSection, "接单设置/资料设置", "接单偏好与司机资料维护。");
            addField(knowledgeSection, "消息", "平台通知：审核结果、订单状态、系统通知都在这里。");
        } else {
            addField(knowledgeSection, "真实左侧导航", "叫车、行程、优惠券、顺风车、国际、钱包、发票、评价管理、投诉建议、帮助、客服、消息、我的（共13项；没有名为【订单】的导航，叫车订单在【行程】里）");
            addField(knowledgeSection, "叫车", "选择出发地、目的地、服务类型和车型后点击确认叫车提交订单。");
            addField(knowledgeSection, "行程", "叫车订单在这里：当前订单、历史订单；订单详情内有支付、取消、评价、发票和投诉入口。用户说找不到订单时，引导到【行程】而不是【订单】。");
            addField(knowledgeSection, "投诉建议", "左侧导航直接点【投诉建议】进入投诉反馈页提交；也可以从【行程】订单详情进入。没有名为【订单】或【我的投诉】的导航项。");
            addField(knowledgeSection, "钱包", "余额、支付与退款记录。");
            addField(knowledgeSection, "发票", "电子发票申请与记录。");
            addField(knowledgeSection, "评价管理", "历史行程评价。");
            addField(knowledgeSection, "消息", "站内通知：审核结果、订单状态、系统通知都在这里。");
            addField(knowledgeSection, "优惠券/顺风车/国际", "优惠券领取与使用、顺风车行程、国际出行入口。");
        }
        addField(knowledgeSection, "客服", "当前对话页；转人工后由后台客服回复。");
        sections.add(knowledgeSection);
        lines.add("网页端功能入口：" + fieldsToText(knowledgeSection));
    }

    private void appendDriverContext(Long userId, PlatformUser user, DriverProfile profile, List<Vehicle> vehicles,
                                     List<WithdrawApplication> withdraws, List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        if (profile != null) {
            sources.add("t_driver_profile");
            Map<String, Object> profileSection = section("司机资料");
            addField(profileSection, "司机编号", profile.getDriverNo());
            addField(profileSection, "服务状态", statusText(profile.getServiceStatus()));
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
        boolean canReceiveOrders = canDriverReceiveOrders(user, latestVehicle);
        addField(permissionSection, "接单权限", canReceiveOrders ? "已解锁" : "未解锁");
        addField(permissionSection, "权限依据", driverPermissionReason(user, latestVehicle));
        addField(permissionSection, "当前车辆审核", latestVehicle == null ? "未提交车辆" : auditText(latestVehicle.getAuditStatus()));
        sections.add(permissionSection);
        lines.add("司机接单权限：" + fieldsToText(permissionSection));

        Map<String, Object> dispatchDataSection = section("司机接单数据");
        addField(dispatchDataSection, "今日订单数", safeCount(rideOrderMapper.selectCount(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getDriverId, userId)
                .ge(RideOrder::getCreatedAt, LocalDate.now().atStartOfDay()))));
        addField(dispatchDataSection, "待接订单数", safeCount(rideOrderMapper.selectCount(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getOrderStatus, OrderStatus.DISPATCHING))));
        addField(dispatchDataSection, "说明", "待接订单数为接单大厅全平台当前可见数量；司机反馈接不到单时，结合今日订单数、接单权限和待接订单数一起分析。");
        sections.add(dispatchDataSection);
        lines.add("司机接单数据：" + fieldsToText(dispatchDataSection));

        if (!withdraws.isEmpty()) {
            sources.add("t_withdraw_application");
            Map<String, Object> withdrawSection = section("提现记录");
            withdrawSection.put("rows", withdraws.stream().map(this::withdrawRow).toList());
            sections.add(withdrawSection);
            lines.add("提现记录：");
            withdraws.forEach(withdraw -> lines.add("- " + withdrawText(withdraw)));
        } else {
            lines.add("提现记录：未查询到提现申请。");
        }
    }

    /**
     * 根据用户最新消息识别咨询主题，把对应的真实记录摘成"当前问题焦点"，
     * 插在上下文最前面，让 AI 优先围绕该用户自己的数据回答，而不是给通用话术。
     */
    private void appendFocusSection(String focusQuestion, String focusHistory, String userRole, PlatformUser user,
                                    List<RideOrder> orders, List<PaymentRecord> payments, List<Complaint> complaints,
                                    DriverProfile profile, List<Vehicle> vehicles, List<WithdrawApplication> withdraws,
                                    List<UserCoupon> coupons, List<String> lines, List<Map<String, Object>> sections) {
        if (!StringUtils.hasText(focusQuestion) && !StringUtils.hasText(focusHistory)) {
            return;
        }
        String normalized = normalizeFocusText(focusQuestion) + " " + normalizeFocusText(focusHistory);
        boolean isDriver = RoleCode.DRIVER.equals(userRole);
        boolean focusWithdraw = isDriver && containsAny(normalized, KW_WITHDRAW);
        boolean focusIncome = isDriver && containsAny(normalized, KW_INCOME);
        boolean focusDispatch = isDriver && containsAny(normalized, KW_DISPATCH);
        boolean focusOrder = containsAny(normalized, KW_ORDER);
        boolean focusPayment = containsAny(normalized, KW_PAYMENT);
        boolean focusAudit = containsAny(normalized, KW_AUDIT);
        boolean focusCoupon = !isDriver && containsAny(normalized, KW_COUPON);
        boolean focusInvoice = containsAny(normalized, KW_INVOICE);
        boolean focusComplaint = containsAny(normalized, KW_COMPLAINT);
        boolean focusWallet = containsAny(normalized, KW_WALLET);
        boolean matched = focusWithdraw || focusIncome || focusDispatch || focusOrder || focusPayment
                || focusAudit || focusCoupon || focusInvoice || focusComplaint || focusWallet;
        if (!matched) {
            return;
        }

        Map<String, Object> focusSection = section("当前问题焦点");
        addField(focusSection, "用户最新消息", truncate(focusQuestion, 120));
        if (StringUtils.hasText(focusHistory)) {
            addField(focusSection, "此前咨询", truncate(focusHistory.replaceAll("\\s+", " "), 150));
        }
        if (focusWithdraw) {
            if (withdraws.isEmpty()) {
                addField(focusSection, "提现焦点", "未查询到该司机的提现申请；可直接告知当前没有提现记录，并引导到提现入口（小程序【收益】-【提现管理】，网页端司机收益页）。");
            } else {
                addField(focusSection, "提现焦点", "最近一笔提现：" + withdrawBrief(withdraws.get(0)) + "；共查询到" + withdraws.size()
                        + "条提现记录。回答提现问题时直接结合这笔记录回答，不要再让用户提供提现金额、时间或银行账户。");
            }
        }
        if (focusIncome && profile != null) {
            addField(focusSection, "收入焦点", "累计收入=" + money(profile.getTotalIncome()) + " 元，可提现=" + money(profile.getWithdrawableIncome())
                    + " 元。回答收入问题时直接使用这些数字。");
        }
        if (focusDispatch) {
            Vehicle latestVehicle = vehicles.isEmpty() ? null : vehicles.get(0);
            addField(focusSection, "听单焦点", "该司机接单权限当前为【" + (canDriverReceiveOrders(user, latestVehicle) ? "已解锁" : "未解锁")
                    + "】，依据：" + driverPermissionReason(user, latestVehicle) + "。回答听单/接单问题时先告知这个真实状态。");
        }
        if (focusOrder) {
            if (orders.isEmpty()) {
                addField(focusSection, "订单焦点", "未查询到订单记录；可直接告知当前没有订单，并引导用户下单或核对登录身份。");
            } else {
                addField(focusSection, "订单焦点", "最近一单：" + orderBrief(orders.get(0)) + "；共查询到" + orders.size()
                        + "单。咨询订单/行程问题时优先结合最近一单回答；只有无法确定用户所指时才列出候选并请用户说明是哪一单。");
            }
        }
        if (focusPayment) {
            if (payments.isEmpty()) {
                addField(focusSection, "支付焦点", "未查询到支付/退款记录；如实告知并可引导用户核对支付方式。");
            } else {
                addField(focusSection, "支付焦点", "最近一笔支付：" + paymentText(payments.get(0)) + "。回答支付/退款问题时直接结合这笔记录。");
            }
        }
        if (focusAudit) {
            if (isDriver) {
                Vehicle latestVehicle = vehicles.isEmpty() ? null : vehicles.get(0);
                String profileText = profile == null ? "未查询到司机资料"
                        : "司机资料审核状态=" + auditText(profile.getAuditStatus()) + (StringUtils.hasText(profile.getAuditRemark()) ? "（备注：" + profile.getAuditRemark() + "）" : "");
                String vehicleText = latestVehicle == null ? "未提交车辆"
                        : "车辆审核状态=" + auditText(latestVehicle.getAuditStatus()) + (StringUtils.hasText(latestVehicle.getAuditRemark()) ? "（备注：" + latestVehicle.getAuditRemark() + "）" : "");
                addField(focusSection, "审核焦点", profileText + "；" + vehicleText + "。回答资质/审核问题时直接结合这些真实状态和备注。");
            } else if (user != null) {
                addField(focusSection, "审核焦点", "实名认证状态=" + auditText(user.getAuthStatus()) + "。回答认证问题时直接结合该状态。");
            }
        }
        if (focusCoupon) {
            if (coupons.isEmpty()) {
                addField(focusSection, "优惠券焦点", "未查询到该乘客的优惠券；可直接告知并引导领券。");
            } else {
                addField(focusSection, "优惠券焦点", "最近一张券：" + couponText(coupons.get(0)) + "；共" + coupons.size() + "张。回答优惠券问题时直接结合这些券。");
            }
        }
        if (focusInvoice) {
            if (orders.isEmpty()) {
                addField(focusSection, "发票焦点", "未查询到订单，暂无发票信息。");
            } else {
                addField(focusSection, "发票焦点", "最近一单发票状态=" + text(orders.get(0).getInvoiceStatus()) + "。回答发票问题时结合该状态和订单信息。");
            }
        }
        if (focusComplaint) {
            if (complaints.isEmpty()) {
                addField(focusSection, "投诉焦点", "未查询到投诉记录；可引导用户通过正式入口提交。");
            } else {
                addField(focusSection, "投诉焦点", "最近一条投诉：" + complaintText(complaints.get(0)) + "。回答投诉进度时直接结合该记录。");
            }
        }
        if (focusWallet && user != null && user.getWalletBalance() != null) {
            addField(focusSection, "钱包焦点", "钱包余额=" + money(user.getWalletBalance()) + " 元。回答钱包/余额问题时直接使用该数字。");
        }

        sections.add(0, focusSection);
        List<String> focusLines = new ArrayList<>();
        focusLines.add("当前问题焦点（最高优先级，回答必须先结合以下真实数据）：");
        for (Map<String, Object> field : (List<Map<String, Object>>) focusSection.getOrDefault("fields", List.of())) {
            focusLines.add("- " + field.get("label") + "=" + field.get("value"));
        }
        lines.addAll(1, focusLines);
    }

    /**
     * 跨渠道记忆：会话按渠道隔离，用户在小程序说过的问题切到网页端（或反过来）AI 一无所知。
     * 这里把同用户同角色、其他渠道最近 7 天内的会话末尾几条消息注入上下文，避免重复询问。
     */
    private void appendCrossChannelContext(Long userId, String userRole, String currentChannel,
                                           List<String> lines, List<Map<String, Object>> sections, List<String> sources) {
        if (userId == null) {
            return;
        }
        List<SupportConversation> otherConversations = supportConversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                .eq(SupportConversation::getUserId, userId)
                .eq(SupportConversation::getUserRole, userRole)
                .ne(SupportConversation::getChannel, currentChannel)
                .ge(SupportConversation::getLastMessageAt, LocalDateTime.now().minusDays(CROSS_CHANNEL_RECENT_DAYS))
                .orderByDesc(SupportConversation::getLastMessageAt)
                .last("limit " + CROSS_CHANNEL_CONVERSATION_LIMIT));
        if (otherConversations.isEmpty()) {
            return;
        }
        Map<String, Object> crossSection = section("其他渠道沟通记录");
        List<String> crossLines = new ArrayList<>();
        for (SupportConversation other : otherConversations) {
            List<SupportMessage> messages = supportMessageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                    .eq(SupportMessage::getConversationId, other.getId())
                    .orderByDesc(SupportMessage::getId)
                    .last("limit " + CROSS_CHANNEL_MESSAGE_LIMIT));
            if (messages.isEmpty()) {
                continue;
            }
            List<SupportMessage> chronological = new ArrayList<>(messages);
            Collections.reverse(chronological);
            String joined = chronological.stream()
                    .map(item -> senderLabel(item.getSenderRole()) + "：" + truncate(item.getContent(), 80))
                    .collect(Collectors.joining("；"));
            String label = channelText(other.getChannel()) + "会话（最近消息 " + time(other.getLastMessageAt()) + "）";
            addField(crossSection, label, joined);
            crossLines.add("- " + label + "=" + joined);
        }
        if (crossLines.isEmpty()) {
            return;
        }
        sources.add("t_support_conversation");
        sources.add("t_support_message");
        sections.add(crossSection);
        lines.add("其他渠道沟通记录（结合这些记录避免重复询问用户已说明过的问题）：");
        lines.addAll(crossLines);
    }

    private String senderLabel(String senderRole) {
        if ("AI".equals(senderRole)) {
            return "AI客服";
        }
        if (RoleCode.ADMIN.equals(senderRole)) {
            return "人工客服";
        }
        return "用户";
    }

    /**
     * 个性化欢迎语：带上用户昵称和一条当前最相关的真实状态（车辆审核/接单权限/实名认证）。
     * 无法个性化时返回 null，由调用方回退到默认欢迎语。
     */
    public String buildWelcomeText(Long userId, String userRole, String channel) {
        try {
            PlatformUser user = userId == null ? null : platformUserMapper.selectById(userId);
            if (user == null) {
                return null;
            }
            String nickname = StringUtils.hasText(user.getNickname()) ? user.getNickname().trim() : "";
            boolean isDriver = RoleCode.DRIVER.equals(userRole);
            StringBuilder text = new StringBuilder("您好，");
            if (StringUtils.hasText(nickname)) {
                text.append(nickname).append(isDriver ? "师傅" : "");
            }
            text.append("！我是阳光出行AI客服。");
            if (isDriver) {
                if (!isEnabled(user)) {
                    text.append("当前账号状态异常，请转人工核实处理。");
                    return text.toString();
                }
                Vehicle vehicle = recentVehicles(userId).stream().findFirst().orElse(null);
                if (vehicle == null) {
                    text.append("您还未提交车辆资料，提交并通过审核后即可解锁接单。");
                } else if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.APPROVED)) {
                    text.append("您的车辆审核已通过、接单权限已解锁，听单、提现、资质审核问题都可以直接问我。");
                } else if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.PENDING)) {
                    text.append("您的车辆正在审核中，通过后即可解锁接单权限。");
                } else if (Objects.equals(vehicle.getAuditStatus(), AuthStatus.REJECTED)) {
                    text.append(StringUtils.hasText(vehicle.getAuditRemark())
                            ? "您的车辆审核未通过（备注：" + vehicle.getAuditRemark() + "），可修改后重新提交。"
                            : "您的车辆审核未通过，可查看备注后修改重新提交。");
                }
            } else {
                Integer authStatus = user.getAuthStatus();
                if (Objects.equals(authStatus, AuthStatus.APPROVED)) {
                    text.append("实名认证已完成，订单、支付退款、优惠券、发票问题都可以直接问我。");
                } else if (Objects.equals(authStatus, AuthStatus.PENDING)) {
                    text.append("您的实名认证正在审核中。");
                } else if (Objects.equals(authStatus, AuthStatus.REJECTED)) {
                    text.append("您的实名认证未通过，可修改后重新提交。");
                } else {
                    text.append(CHANNEL_WEB.equals(normalizeChannel(channel))
                            ? "您还未完成实名认证，可在账户资料页提交。"
                            : "您还未完成实名认证，可在【我的】-【实名认证】提交。");
                }
            }
            return text.toString();
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean canDriverReceiveOrders(PlatformUser user, Vehicle latestVehicle) {
        return isEnabled(user) && latestVehicle != null && Objects.equals(latestVehicle.getAuditStatus(), AuthStatus.APPROVED);
    }

    private String withdrawBrief(WithdrawApplication withdraw) {
        return time(withdraw.getCreatedAt()) + " 申请 " + money(withdraw.getApplyAmount()) + " 元（"
                + text(withdraw.getBankName()) + " " + maskBankAccount(withdraw.getBankAccount())
                + "），状态：" + withdrawStatusText(withdraw.getStatus());
    }

    private String withdrawStatusText(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        return switch (normalized) {
            case "PENDING" -> "审核中（等待管理员审核打款）";
            case "APPROVED" -> "已审核通过（打款中，请留意到账）";
            case "REJECTED" -> "已驳回";
            default -> StringUtils.hasText(normalized) ? normalized : "未知";
        };
    }

    private String orderBrief(RideOrder order) {
        return "订单号 " + text(order.getOrderNo()) + "，" + text(order.getStartName()) + " -> " + text(order.getEndName())
                + "，状态=" + statusText(order.getOrderStatus()) + "，支付=" + statusText(order.getPayStatus())
                + "，实付=" + money(order.getActualAmount()) + "，创建=" + time(order.getCreatedAt());
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
        row.put("服务", statusText(order.getServiceType()));
        row.put("订单状态", statusText(order.getOrderStatus()));
        row.put("支付状态", statusText(order.getPayStatus()));
        row.put("发票状态", statusText(order.getInvoiceStatus()));
        row.put("投诉状态", statusText(order.getComplaintStatus()));
        row.put("起点", order.getStartName());
        row.put("终点", order.getEndName());
        row.put("优惠抵扣", money(order.getCouponDiscount()));
        row.put("应付", money(order.getPayableAmount()));
        row.put("实付", money(order.getActualAmount()));
        row.put("退款", money(order.getRefundAmount()));
        row.put("司机分成", money(order.getDriverIncomeAmount()));
        row.put("创建时间", order.getCreatedAt());
        row.put("出发时间", order.getCarpoolDepartureAt());
        row.put("支付时间", order.getPaidAt());
        row.put("完成时间", order.getFinishedAt());
        row.put("取消原因", order.getCancelReason());
        row.put("接单时间", order.getAcceptedAt());
        return row;
    }

    private String orderText(RideOrder order) {
        return "订单号=" + text(order.getOrderNo())
                + "，服务=" + statusText(order.getServiceType())
                + "，状态=" + statusText(order.getOrderStatus())
                + "，支付=" + statusText(order.getPayStatus())
                + "，发票=" + statusText(order.getInvoiceStatus())
                + "，投诉=" + statusText(order.getComplaintStatus())
                + "，起终点=" + text(order.getStartName()) + " -> " + text(order.getEndName())
                + "，优惠抵扣=" + money(order.getCouponDiscount())
                + "，应付=" + money(order.getPayableAmount())
                + "，实付=" + money(order.getActualAmount())
                + "，退款=" + money(order.getRefundAmount())
                + "，司机分成=" + money(order.getDriverIncomeAmount())
                + "，创建=" + time(order.getCreatedAt())
                + (order.getCarpoolDepartureAt() == null ? "" : "，出发时间=" + time(order.getCarpoolDepartureAt()))
                + "，完成=" + time(order.getFinishedAt())
                + (StringUtils.hasText(order.getCancelReason()) ? "，取消原因=" + text(order.getCancelReason()) : "");
    }

    private Map<String, Object> paymentRow(PaymentRecord payment) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("订单ID", payment.getOrderId());
        row.put("支付单号", payment.getPayNo());
        row.put("渠道", payment.getPayChannel());
        row.put("状态", statusText(payment.getPayStatus()));
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
                + "，状态=" + statusText(payment.getPayStatus())
                + "，金额=" + money(payment.getPayAmount())
                + "，退款=" + money(payment.getRefundAmount())
                + "，支付时间=" + time(payment.getPaidAt());
    }

    private Map<String, Object> couponRow(UserCoupon userCoupon) {
        Coupon coupon = userCoupon.getCouponId() == null ? null : couponMapper.selectById(userCoupon.getCouponId());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("券名称", coupon == null ? "未查询到券模板" : coupon.getCouponName());
        row.put("状态", statusText(userCoupon.getCouponStatus()));
        row.put("适用范围", statusText(userCoupon.getServiceScope()));
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
                + "，状态=" + statusText(userCoupon.getCouponStatus())
                + "，适用=" + statusText(userCoupon.getServiceScope())
                + "，减免=" + (coupon == null ? "未知" : money(coupon.getDiscountAmount()))
                + "，有效期=" + time(userCoupon.getValidStartTime()) + "至" + time(userCoupon.getValidEndTime());
    }

    private Map<String, Object> complaintRow(Complaint complaint) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("订单ID", complaint.getOrderId());
        row.put("类型", statusText(complaint.getComplaintType()));
        row.put("处理状态", statusText(complaint.getHandleStatus()));
        row.put("处理结果", complaint.getHandleResult());
        row.put("提交时间", complaint.getCreatedAt());
        row.put("处理时间", complaint.getHandleTime());
        return row;
    }

    private String complaintText(Complaint complaint) {
        return "订单ID=" + complaint.getOrderId()
                + "，类型=" + statusText(complaint.getComplaintType())
                + "，状态=" + statusText(complaint.getHandleStatus())
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
        row.put("卡号", maskBankAccount(withdraw.getBankAccount()));
        row.put("状态", withdrawStatusText(withdraw.getStatus()));
        row.put("驳回原因", withdraw.getRejectReason());
        row.put("申请时间", withdraw.getCreatedAt());
        row.put("审核时间", withdraw.getAuditedAt());
        return row;
    }

    private String withdrawText(WithdrawApplication withdraw) {
        return "金额=" + money(withdraw.getApplyAmount())
                + "，银行=" + text(withdraw.getBankName())
                + "，卡号=" + maskBankAccount(withdraw.getBankAccount())
                + "，状态=" + withdrawStatusText(withdraw.getStatus())
                + "，原因=" + text(withdraw.getRejectReason())
                + "，申请=" + time(withdraw.getCreatedAt())
                + "，审核=" + time(withdraw.getAuditedAt());
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

    private boolean containsAny(String normalized, String... keywords) {
        for (String keyword : keywords) {
            if (normalized.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String truncate(String value, int max) {
        String trimmed = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max) + "…";
    }

    private String normalizeFocusText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }

    private long safeCount(Long count) {
        return count == null ? 0L : count;
    }

    private String currentTimeline() {
        LocalDateTime now = LocalDateTime.now();
        return "当前时间：" + now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + " " + chineseWeekday(now.getDayOfWeek())
                + "。用户提到“今天、昨天、刚才、上周”等相对时间时，先以此时间换算，再匹配上面的真实记录。";
    }

    private String chineseWeekday(DayOfWeek day) {
        return switch (day) {
            case MONDAY -> "周一";
            case TUESDAY -> "周二";
            case WEDNESDAY -> "周三";
            case THURSDAY -> "周四";
            case FRIDAY -> "周五";
            case SATURDAY -> "周六";
            case SUNDAY -> "周日";
        };
    }

    /** 把数据库状态码统一翻译成中文，避免弱模型把 DISPATCHING、UNPAID 等原样输出给用户。 */
    private String statusText(String value) {
        if (!StringUtils.hasText(value)) {
            return "未记录";
        }
        return switch (value.trim().toUpperCase()) {
            case "TAXI" -> "即时打车";
            case "CARPOOL" -> "顺风车";
            case "INTERNATIONAL" -> "国际出行";
            case "ALL" -> "全场通用";
            case "CREATED" -> "已创建";
            case "DISPATCHING" -> "等待接单";
            case "ACCEPTED" -> "司机已接单";
            case "PICKING_UP" -> "接驾中";
            case "IN_TRIP" -> "行程中";
            case "FINISHED" -> "已完成";
            case "CANCELLED" -> "已取消";
            case "UNPAID" -> "待支付";
            case "PAID" -> "已支付";
            case "REFUNDED" -> "已退款";
            case "NONE" -> "无";
            case "APPLIED" -> "已申请";
            case "ISSUED" -> "已开票";
            case "UNUSED" -> "可用";
            case "USED" -> "已用";
            case "EXPIRED" -> "已过期";
            case "PENDING" -> "待处理";
            case "DONE" -> "已处理";
            case "OPEN" -> "处理中";
            case "CLOSED" -> "已关闭";
            case "APPROVED" -> "已通过";
            case "REJECTED" -> "已驳回";
            case "CONFIRMED" -> "已确认";
            case "ONLINE" -> "在线听单";
            case "OFFLINE" -> "离线";
            case "BUSY" -> "服务中";
            default -> value.trim();
        };
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

    private String maskBankAccount(String account) {
        String digits = String.valueOf(account == null ? "" : account).replaceAll("\\D", "");
        if (digits.length() < 4) {
            return "尾号****";
        }
        return "尾号" + digits.substring(digits.length() - 4);
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
