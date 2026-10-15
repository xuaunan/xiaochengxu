package com.sunshine.travel.service.support;

import com.sunshine.travel.common.AuthStatus;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiSupportContextServiceTests {

    private PlatformUserMapper platformUserMapper;
    private RideOrderMapper rideOrderMapper;
    private PaymentRecordMapper paymentRecordMapper;
    private UserCouponMapper userCouponMapper;
    private CouponMapper couponMapper;
    private DriverProfileMapper driverProfileMapper;
    private VehicleMapper vehicleMapper;
    private WithdrawApplicationMapper withdrawApplicationMapper;
    private ComplaintMapper complaintMapper;
    private SupportConversationMapper supportConversationMapper;
    private SupportMessageMapper supportMessageMapper;
    private AiSupportContextService service;

    @BeforeEach
    void setUp() {
        platformUserMapper = mock(PlatformUserMapper.class);
        rideOrderMapper = mock(RideOrderMapper.class);
        paymentRecordMapper = mock(PaymentRecordMapper.class);
        userCouponMapper = mock(UserCouponMapper.class);
        couponMapper = mock(CouponMapper.class);
        driverProfileMapper = mock(DriverProfileMapper.class);
        vehicleMapper = mock(VehicleMapper.class);
        withdrawApplicationMapper = mock(WithdrawApplicationMapper.class);
        complaintMapper = mock(ComplaintMapper.class);
        supportConversationMapper = mock(SupportConversationMapper.class);
        supportMessageMapper = mock(SupportMessageMapper.class);
        service = new AiSupportContextService(platformUserMapper, rideOrderMapper, paymentRecordMapper,
                userCouponMapper, couponMapper, driverProfileMapper, vehicleMapper, withdrawApplicationMapper, complaintMapper,
                supportConversationMapper, supportMessageMapper);
    }

    @Test
    void driverWithdrawFocusContainsRealRecordTimelineAndChineseStatus() {
        stubDriverData();

        Map<String, Object> context = service.buildContext(2L, "DRIVER", "MINIAPP", "提现到账", null);
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("当前时间："), "上下文应包含当前时间行：" + text);
        assertTrue(text.contains("最近一笔提现："), "应注入提现焦点：" + text);
        assertTrue(text.contains("审核中（等待管理员审核打款）"), "提现状态应翻译为中文文案：" + text);
        assertTrue(text.contains("尾号3444"), "银行卡号应脱敏为尾号：" + text);
        assertTrue(text.contains("等待接单"), "订单状态应翻译为中文：" + text);
        assertTrue(text.contains("待支付"), "支付状态应翻译为中文：" + text);
        assertFalse(text.contains("DISPATCHING"), "不允许英文状态码残留：" + text);
        assertFalse(text.contains("UNPAID"), "不允许英文状态码残留：" + text);
        List<?> sections = (List<?>) context.get("sections");
        assertEquals("当前问题焦点", ((Map<?, ?>) sections.get(0)).get("title"), "焦点段落应排在最前");
    }

    @Test
    void followUpWithoutKeywordsKeepsFocusFromRecentUserMessages() {
        stubDriverData();

        Map<String, Object> context = service.buildContext(2L, "DRIVER", "MINIAPP", "那怎么还没到？", "提现到账\n大概多久");
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("最近一笔提现："), "追问不含关键词时，焦点应从最近几轮用户消息补回：" + text);
        assertTrue(text.contains("此前咨询"), "焦点段落应带出此前咨询：" + text);
        assertTrue(text.contains("那怎么还没到？"), "焦点段落应带出最新消息：" + text);
    }

    @Test
    void noKeywordMeansNoFocusSection() {
        stubDriverData();

        Map<String, Object> context = service.buildContext(2L, "DRIVER", "MINIAPP", null, null);
        List<?> sections = (List<?>) context.get("sections");

        assertTrue(sections.stream().noneMatch(item -> "当前问题焦点".equals(((Map<?, ?>) item).get("title"))),
                "无关键词且无历史时不应生成焦点段落");
    }

    @Test
    void passengerWalletFocusShowsBalanceAndMaskedPhone() {
        PlatformUser passenger = new PlatformUser();
        passenger.setId(1L);
        passenger.setNickname("阳光乘客");
        passenger.setPhone("13812345678");
        passenger.setEnabled(1);
        passenger.setAuthStatus(AuthStatus.APPROVED);
        passenger.setWalletBalance(new BigDecimal("268.80"));
        when(platformUserMapper.selectById(1L)).thenReturn(passenger);
        when(rideOrderMapper.selectList(any())).thenReturn(List.of());
        when(userCouponMapper.selectList(any())).thenReturn(List.of());
        when(complaintMapper.selectList(any())).thenReturn(List.of());

        Map<String, Object> context = service.buildContext(1L, "USER", "MINIAPP", "我的钱包余额怎么变少了", null);
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("钱包焦点"), "应生成钱包焦点：" + text);
        assertTrue(text.contains("268.8"), "焦点应带出真实余额：" + text);
        assertTrue(text.contains("138****5678"), "手机号应脱敏：" + text);
    }

    @Test
    void passengerCouponFocusTranslatesCouponStatus() {
        PlatformUser passenger = new PlatformUser();
        passenger.setId(1L);
        passenger.setNickname("阳光乘客");
        passenger.setPhone("13812345678");
        passenger.setEnabled(1);
        passenger.setAuthStatus(AuthStatus.APPROVED);
        when(platformUserMapper.selectById(1L)).thenReturn(passenger);
        when(rideOrderMapper.selectList(any())).thenReturn(List.of());

        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(1L);
        userCoupon.setCouponId(5L);
        userCoupon.setCouponStatus("UNUSED");
        userCoupon.setServiceScope("ALL");
        userCoupon.setValidStartTime(LocalDateTime.of(2026, 9, 1, 0, 0));
        userCoupon.setValidEndTime(LocalDateTime.of(2026, 10, 31, 23, 59));
        when(userCouponMapper.selectList(any())).thenReturn(List.of(userCoupon));
        Coupon coupon = new Coupon();
        coupon.setId(5L);
        coupon.setCouponName("新客立减券");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setDiscountAmount(new BigDecimal("8"));
        when(couponMapper.selectById(5L)).thenReturn(coupon);
        when(complaintMapper.selectList(any())).thenReturn(List.of());

        Map<String, Object> context = service.buildContext(1L, "USER", "MINIAPP", "优惠券怎么用", null);
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("优惠券焦点"), "应生成优惠券焦点：" + text);
        assertTrue(text.contains("可用"), "券状态应翻译为中文：" + text);
        assertTrue(text.contains("全场通用"), "适用范围应翻译为中文：" + text);
        assertFalse(text.contains("UNUSED"), "不允许英文券状态残留：" + text);
    }

    @Test
    void driverDispatchDataInjectedForOrderQuestions() {
        stubDriverData();
        when(rideOrderMapper.selectCount(any())).thenReturn(3L, 7L);

        Map<String, Object> context = service.buildContext(2L, "DRIVER", "MINIAPP", "听单接不到订单", null);
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("今日订单数=3"), "应注入司机今日订单数：" + text);
        assertTrue(text.contains("待接订单数=7"), "应注入大厅待接订单数：" + text);
        List<?> sections = (List<?>) context.get("sections");
        assertTrue(sections.stream().anyMatch(item -> "司机接单数据".equals(((Map<?, ?>) item).get("title"))),
                "应有司机接单数据段落");
    }

    @Test
    void crossChannelContextInjectedForOtherChannelHistory() {
        stubDriverData();
        SupportConversation webConversation = new SupportConversation();
        webConversation.setId(77L);
        webConversation.setUserId(2L);
        webConversation.setUserRole("DRIVER");
        webConversation.setChannel("WEB");
        webConversation.setLastMessage("好的，已为您登记");
        webConversation.setLastMessageAt(LocalDateTime.now().minusHours(2));
        when(supportConversationMapper.selectList(any())).thenReturn(List.of(webConversation));
        SupportMessage older = new SupportMessage();
        older.setId(8L);
        older.setConversationId(77L);
        older.setSenderRole("DRIVER");
        older.setContent("网页端留言：提现一直不到账，帮我查下");
        older.setCreatedAt(LocalDateTime.now().minusHours(3));
        SupportMessage newer = new SupportMessage();
        newer.setId(9L);
        newer.setConversationId(77L);
        newer.setSenderRole("AI");
        newer.setContent("您在网页端反馈的提现问题已记录");
        newer.setCreatedAt(LocalDateTime.now().minusHours(2));
        when(supportMessageMapper.selectList(any())).thenReturn(List.of(newer, older));

        Map<String, Object> context = service.buildContext(2L, "DRIVER", "MINIAPP", "提现到账", null);
        String text = String.valueOf(context.get("contextText"));

        assertTrue(text.contains("其他渠道沟通记录"), "应注入其他渠道沟通记录：" + text);
        assertTrue(text.contains("网页端会话"), "应标注来源渠道：" + text);
        assertTrue(text.contains("提现一直不到账，帮我查下"), "应带出其他渠道的用户消息：" + text);
        assertTrue(text.contains("网页端留言：提现一直不到账"), "消息应按时间正序拼接：" + text);
    }

    @Test
    void welcomeTextPersonalizedByRoleAndStatus() {
        stubDriverData();
        String driverWelcome = service.buildWelcomeText(2L, "DRIVER", "MINIAPP");
        assertTrue(driverWelcome.contains("张师傅"), "司机欢迎语应带昵称：" + driverWelcome);
        assertTrue(driverWelcome.contains("接单权限已解锁"), "司机欢迎语应带真实权限状态：" + driverWelcome);

        PlatformUser passenger = new PlatformUser();
        passenger.setId(1L);
        passenger.setNickname("阳光乘客");
        passenger.setPhone("13812345678");
        passenger.setAuthStatus(AuthStatus.UNVERIFIED);
        when(platformUserMapper.selectById(1L)).thenReturn(passenger);
        String passengerWelcome = service.buildWelcomeText(1L, "USER", "MINIAPP");
        assertTrue(passengerWelcome.contains("阳光乘客"), "乘客欢迎语应带昵称：" + passengerWelcome);
        assertTrue(passengerWelcome.contains("实名认证"), "乘客欢迎语应带认证状态：" + passengerWelcome);

        assertNull(service.buildWelcomeText(null, "USER", "MINIAPP"), "查不到用户时应回退默认欢迎语");
    }

    private void stubDriverData() {
        PlatformUser driver = new PlatformUser();
        driver.setId(2L);
        driver.setNickname("张师傅");
        driver.setPhone("13812345678");
        driver.setEnabled(1);
        driver.setAuthStatus(AuthStatus.APPROVED);
        when(platformUserMapper.selectById(2L)).thenReturn(driver);

        RideOrder order = new RideOrder();
        order.setId(9001L);
        order.setOrderNo("DD20260930001");
        order.setServiceType("TAXI");
        order.setOrderStatus("DISPATCHING");
        order.setPayStatus("UNPAID");
        order.setInvoiceStatus("NONE");
        order.setComplaintStatus("NONE");
        order.setStartName("人民广场");
        order.setEndName("陆家嘴中心");
        order.setPayableAmount(new BigDecimal("35.80"));
        order.setActualAmount(new BigDecimal("35.80"));
        order.setRefundAmount(BigDecimal.ZERO);
        order.setCreatedAt(LocalDateTime.of(2026, 9, 30, 9, 16));
        when(rideOrderMapper.selectList(any())).thenReturn(List.of(order));

        DriverProfile profile = new DriverProfile();
        profile.setUserId(2L);
        profile.setDriverNo("DRV20260514001");
        profile.setServiceStatus("ONLINE");
        profile.setAuditStatus(AuthStatus.APPROVED);
        profile.setTotalIncome(new BigDecimal("3260.50"));
        profile.setWithdrawableIncome(new BigDecimal("1268.88"));
        when(driverProfileMapper.selectOne(any())).thenReturn(profile);

        Vehicle vehicle = new Vehicle();
        vehicle.setDriverId(2L);
        vehicle.setPlateNo("冀A12345");
        vehicle.setBrand("比亚迪");
        vehicle.setModelName("汉 EV");
        vehicle.setAuditStatus(AuthStatus.APPROVED);
        when(vehicleMapper.selectList(any())).thenReturn(List.of(vehicle));

        WithdrawApplication withdraw = new WithdrawApplication();
        withdraw.setDriverId(2L);
        withdraw.setApplyAmount(new BigDecimal("188.00"));
        withdraw.setBankAccount("6222020200112233444");
        withdraw.setBankName("中国银行");
        withdraw.setStatus("PENDING");
        withdraw.setCreatedAt(LocalDateTime.of(2026, 9, 30, 14, 20));
        when(withdrawApplicationMapper.selectList(any())).thenReturn(List.of(withdraw));

        when(paymentRecordMapper.selectList(any())).thenReturn(List.of());
        when(complaintMapper.selectList(any())).thenReturn(List.of());
    }
}
