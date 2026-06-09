package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CouponStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.AdminMemberUpdateRequest;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.CouponOperationLog;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.CouponOperationLogMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.service.MembershipService;
import com.sunshine.travel.service.support.MessagePushSupport;
import com.sunshine.travel.service.support.OperationLogSupport;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class MembershipServiceImpl implements MembershipService {

    private static final String MEMBER_STATUS_ACTIVE = "ACTIVE";
    private static final String MEMBER_STATUS_NONE = "NONE";
    private static final String MEMBER_LEVEL = "阳光会员";
    private static final String NORMAL_LEVEL = "普通用户";
    private static final String MEMBER_WEEKLY_MODE = "MEMBER_WEEKLY";

    private final PlatformUserMapper platformUserMapper;
    private final CouponMapper couponMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponOperationLogMapper couponOperationLogMapper;
    private final MessagePushSupport messagePushSupport;
    private final OperationLogSupport operationLogSupport;

    public MembershipServiceImpl(PlatformUserMapper platformUserMapper,
                                 CouponMapper couponMapper,
                                 UserCouponMapper userCouponMapper,
                                 CouponOperationLogMapper couponOperationLogMapper,
                                 MessagePushSupport messagePushSupport,
                                 OperationLogSupport operationLogSupport) {
        this.platformUserMapper = platformUserMapper;
        this.couponMapper = couponMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponOperationLogMapper = couponOperationLogMapper;
        this.messagePushSupport = messagePushSupport;
        this.operationLogSupport = operationLogSupport;
    }

    @Override
    @Transactional
    public Map<String, Object> currentMembership() {
        PlatformUser user = requirePassenger(UserContext.userId());
        List<Map<String, Object>> issued = isActiveMember(user)
                ? ensureWeeklyCouponsForUser(user, false)
                : List.of();
        return mapMembership(user, issued.size());
    }

    @Override
    @Transactional
    public Map<String, Object> activateCurrentUser() {
        PlatformUser user = requirePassenger(UserContext.userId());
        activateUser(user, LocalDateTime.now().plusMonths(1));
        List<Map<String, Object>> issued = ensureWeeklyCouponsForUser(user, true);
        operationLogSupport.log("MEMBER", "ACTIVATE_SELF", "USER", user.getId(), "乘客开通阳光会员");
        return mapMembership(user, issued.size());
    }

    @Override
    @Transactional
    public Map<String, Object> ensureCurrentWeeklyCoupons() {
        PlatformUser user = requirePassenger(UserContext.userId());
        List<Map<String, Object>> issued = ensureWeeklyCouponsForUser(user, true);
        return mapMembership(user, issued.size());
    }

    @Override
    public PageResult<Map<String, Object>> adminMembers(long current, long size, String keyword, String status) {
        List<Map<String, Object>> rows = platformUserMapper.selectList(new LambdaQueryWrapper<PlatformUser>()
                        .eq(PlatformUser::getRoleCode, RoleCode.USER)
                        .and(StringUtils.hasText(keyword), q -> q.like(PlatformUser::getNickname, keyword)
                                .or()
                                .like(PlatformUser::getPhone, keyword)
                                .or()
                                .like(PlatformUser::getRealName, keyword))
                        .orderByDesc(PlatformUser::getId))
                .stream()
                .map(item -> mapMembership(item, 0))
                .filter(item -> !StringUtils.hasText(status) || status.equals(item.get("memberStatus")))
                .toList();
        long total = rows.size();
        int fromIndex = (int) Math.max((current - 1) * size, 0);
        if (fromIndex >= rows.size()) {
            return new PageResult<>(total, current, size, List.of());
        }
        int toIndex = (int) Math.min(fromIndex + size, rows.size());
        return new PageResult<>(total, current, size, rows.subList(fromIndex, toIndex));
    }

    @Override
    @Transactional
    public Map<String, Object> updateMember(Long userId, AdminMemberUpdateRequest request) {
        PlatformUser user = requirePassenger(userId);
        AdminMemberUpdateRequest safeRequest = request == null ? new AdminMemberUpdateRequest() : request;
        String status = StringUtils.hasText(safeRequest.getMemberStatus())
                ? safeRequest.getMemberStatus().trim().toUpperCase(Locale.ROOT)
                : MEMBER_STATUS_ACTIVE;
        if (MEMBER_STATUS_ACTIVE.equals(status)) {
            LocalDateTime expireAt = safeRequest.getMemberExpireAt() == null
                    ? LocalDateTime.now().plusMonths(1)
                    : safeRequest.getMemberExpireAt();
            activateUser(user, expireAt);
            operationLogSupport.log("MEMBER", "ACTIVATE", "USER", userId, "管理员开通或续期会员");
        } else {
            user.setMemberStatus(MEMBER_STATUS_NONE);
            user.setMemberLevel(NORMAL_LEVEL);
            platformUserMapper.updateById(user);
            operationLogSupport.log("MEMBER", "DISABLE", "USER", userId, "管理员关闭会员");
        }
        return mapMembership(user, 0);
    }

    @Override
    @Transactional
    public Map<String, Object> grantWeeklyCoupons(Long userId) {
        PlatformUser user = requirePassenger(userId);
        List<Map<String, Object>> issued = ensureWeeklyCouponsForUser(user, true);
        operationLogSupport.log("MEMBER", "GRANT_WEEKLY", "USER", userId, "管理员同步会员每周券包");
        return mapMembership(user, issued.size());
    }

    private void activateUser(PlatformUser user, LocalDateTime expireAt) {
        LocalDateTime now = LocalDateTime.now();
        user.setMemberStatus(MEMBER_STATUS_ACTIVE);
        user.setMemberLevel(MEMBER_LEVEL);
        if (user.getMemberOpenedAt() == null) {
            user.setMemberOpenedAt(now);
        }
        user.setMemberExpireAt(expireAt == null ? now.plusMonths(1) : expireAt);
        platformUserMapper.updateById(user);
    }

    private List<Map<String, Object>> ensureWeeklyCouponsForUser(PlatformUser user, boolean notify) {
        if (!isActiveMember(user)) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "乘客会员未开通或已过期");
        }
        String weekCode = currentWeekCode();
        if (weekCode.equals(user.getMemberLastCouponWeek())) {
            return List.of();
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime validEnd = now.plusDays(7);
        List<Coupon> templates = ensureMemberCouponTemplates();
        List<Map<String, Object>> issued = new ArrayList<>();
        for (Coupon coupon : templates) {
            issued.add(issueMemberCoupon(user.getId(), coupon, weekCode, now, validEnd));
        }
        user.setMemberLastCouponWeek(weekCode);
        platformUserMapper.updateById(user);
        if (notify && !issued.isEmpty()) {
            messagePushSupport.push(user.getId(), "MEMBER", "MEMBER_WEEKLY_COUPONS",
                    "会员券包到账", "本周 3 张会员专属优惠券已到账，可在优惠券页面查看。", "zh-CN");
        }
        return issued;
    }

    private List<Coupon> ensureMemberCouponTemplates() {
        return List.of(
                ensureCouponTemplate("会员每周通用6元券", "ALL", BigDecimal.valueOf(20), BigDecimal.valueOf(6)),
                ensureCouponTemplate("会员每周打车8元券", "TAXI", BigDecimal.valueOf(30), BigDecimal.valueOf(8)),
                ensureCouponTemplate("会员每周顺风车5元券", "CARPOOL", BigDecimal.valueOf(20), BigDecimal.valueOf(5))
        );
    }

    private Coupon ensureCouponTemplate(String name, String scope, BigDecimal threshold, BigDecimal discount) {
        Coupon coupon = couponMapper.selectOne(new LambdaQueryWrapper<Coupon>()
                .eq(Coupon::getCouponName, name)
                .last("limit 1"));
        if (coupon != null) {
            if (coupon.getStatus() == null || coupon.getStatus() != 1 || coupon.getRemainCount() == null || coupon.getRemainCount() <= 0) {
                coupon.setStatus(1);
                coupon.setRemainCount(999999);
                couponMapper.updateById(coupon);
            }
            return coupon;
        }

        Coupon next = new Coupon();
        next.setCouponName(name);
        next.setCouponType("CASH");
        next.setServiceScope(scope);
        next.setThresholdAmount(threshold);
        next.setDiscountAmount(discount);
        next.setDiscountRate(null);
        next.setStackable(0);
        next.setTotalCount(999999);
        next.setRemainCount(999999);
        next.setStatus(1);
        next.setReceiveLimitPerUser(999999);
        next.setValidStartTime(LocalDateTime.now().minusDays(1));
        next.setValidEndTime(LocalDateTime.of(2030, 12, 31, 23, 59, 59));
        next.setRuleDesc("阳光会员每周专属券，每周自动发放");
        couponMapper.insert(next);
        return next;
    }

    private Map<String, Object> issueMemberCoupon(Long userId,
                                                   Coupon coupon,
                                                   String weekCode,
                                                   LocalDateTime validStart,
                                                   LocalDateTime validEnd) {
        coupon.setRemainCount(Math.max((coupon.getRemainCount() == null ? 0 : coupon.getRemainCount()) - 1, 0));
        couponMapper.updateById(coupon);

        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(userId);
        userCoupon.setCouponId(coupon.getId());
        userCoupon.setCouponStatus(CouponStatus.UNUSED);
        userCoupon.setServiceScope(coupon.getServiceScope());
        userCoupon.setValidStartTime(validStart);
        userCoupon.setValidEndTime(validEnd);
        userCoupon.setReceiveMode(MEMBER_WEEKLY_MODE);
        userCouponMapper.insert(userCoupon);

        CouponOperationLog log = new CouponOperationLog();
        log.setCouponId(coupon.getId());
        log.setUserId(userId);
        log.setUserCouponId(userCoupon.getId());
        log.setOperationType(MEMBER_WEEKLY_MODE);
        log.setContent("会员每周券包 " + weekCode + " 自动发放");
        couponOperationLogMapper.insert(log);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("couponId", coupon.getId());
        row.put("userCouponId", userCoupon.getId());
        row.put("couponName", coupon.getCouponName());
        row.put("serviceScope", coupon.getServiceScope());
        row.put("validEndTime", userCoupon.getValidEndTime());
        return row;
    }

    private PlatformUser requirePassenger(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        PlatformUser user = platformUserMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "用户不存在");
        }
        if (!RoleCode.USER.equals(user.getRoleCode())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有乘客账号支持会员");
        }
        return user;
    }

    private boolean isActiveMember(PlatformUser user) {
        LocalDateTime now = LocalDateTime.now();
        return user != null
                && RoleCode.USER.equals(user.getRoleCode())
                && MEMBER_STATUS_ACTIVE.equalsIgnoreCase(user.getMemberStatus())
                && user.getMemberExpireAt() != null
                && !user.getMemberExpireAt().isBefore(now);
    }

    private Map<String, Object> mapMembership(PlatformUser user, int issuedCount) {
        boolean active = isActiveMember(user);
        long weeklyCouponTotal = userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getUserId, user.getId())
                .eq(UserCoupon::getReceiveMode, MEMBER_WEEKLY_MODE));
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", user.getId());
        map.put("nickname", user.getNickname());
        map.put("phone", user.getPhone());
        map.put("roleCode", user.getRoleCode());
        map.put("active", active);
        map.put("memberStatus", active ? MEMBER_STATUS_ACTIVE : MEMBER_STATUS_NONE);
        map.put("memberLevel", active ? MEMBER_LEVEL : NORMAL_LEVEL);
        map.put("memberOpenedAt", user.getMemberOpenedAt());
        map.put("memberExpireAt", user.getMemberExpireAt());
        map.put("expireDate", user.getMemberExpireAt() == null ? "" : user.getMemberExpireAt().toLocalDate().toString());
        map.put("memberLastCouponWeek", user.getMemberLastCouponWeek());
        map.put("weeklyCouponTotal", weeklyCouponTotal);
        map.put("issuedCount", issuedCount);
        map.put("couponRuleText", "每周自动赠送 3 张不同优惠券");
        map.put("createdAt", user.getCreatedAt());
        return map;
    }

    private String currentWeekCode() {
        LocalDateTime now = LocalDateTime.now();
        WeekFields weekFields = WeekFields.ISO;
        return now.get(weekFields.weekBasedYear()) + "-W" + String.format("%02d", now.get(weekFields.weekOfWeekBasedYear()));
    }
}
