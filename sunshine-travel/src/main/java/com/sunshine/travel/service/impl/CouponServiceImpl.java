package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CouponStatus;
import com.sunshine.travel.common.CouponType;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.CouponGrantRequest;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.CouponOperationLog;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.UserCoupon;
import com.sunshine.travel.mapper.CouponMapper;
import com.sunshine.travel.mapper.CouponOperationLogMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.UserCouponMapper;
import com.sunshine.travel.service.CouponService;
import com.sunshine.travel.service.support.MessagePushSupport;
import com.sunshine.travel.service.support.OperationLogSupport;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CouponServiceImpl implements CouponService {

    private final CouponMapper couponMapper;
    private final UserCouponMapper userCouponMapper;
    private final CouponOperationLogMapper couponOperationLogMapper;
    private final PlatformUserMapper platformUserMapper;
    private final MessagePushSupport messagePushSupport;
    private final OperationLogSupport operationLogSupport;

    public CouponServiceImpl(CouponMapper couponMapper,
                             UserCouponMapper userCouponMapper,
                             CouponOperationLogMapper couponOperationLogMapper,
                             PlatformUserMapper platformUserMapper,
                             MessagePushSupport messagePushSupport,
                             OperationLogSupport operationLogSupport) {
        this.couponMapper = couponMapper;
        this.userCouponMapper = userCouponMapper;
        this.couponOperationLogMapper = couponOperationLogMapper;
        this.platformUserMapper = platformUserMapper;
        this.messagePushSupport = messagePushSupport;
        this.operationLogSupport = operationLogSupport;
    }

    @Override
    @Transactional
    public List<UserCoupon> currentUserCoupons() {
        List<UserCoupon> coupons = userCouponMapper.selectList(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getUserId, UserContext.userId())
                .orderByDesc(UserCoupon::getId));
        LocalDateTime now = LocalDateTime.now();
        coupons.stream()
                .filter(item -> CouponStatus.UNUSED.equals(item.getCouponStatus())
                        && item.getValidEndTime() != null
                        && item.getValidEndTime().isBefore(now))
                .forEach(this::markExpired);
        return coupons;
    }

    @Override
    public List<Coupon> availableCoupons() {
        LocalDateTime now = LocalDateTime.now();
        return couponMapper.selectList(new LambdaQueryWrapper<Coupon>()
                .eq(Coupon::getStatus, 1)
                .gt(Coupon::getRemainCount, 0)
                .le(Coupon::getValidStartTime, now)
                .ge(Coupon::getValidEndTime, now)
                .orderByDesc(Coupon::getId));
    }

    @Override
    @Transactional
    public void receive(Long couponId) {
        Coupon coupon = requireCoupon(couponId);
        validateCouponTemplate(coupon);
        Long receiveCount = userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getUserId, UserContext.userId())
                .eq(UserCoupon::getCouponId, couponId));
        if (receiveCount != null
                && coupon.getReceiveLimitPerUser() != null
                && receiveCount >= coupon.getReceiveLimitPerUser()) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "已达到领取上限");
        }
        issueCoupon(UserContext.userId(), coupon, "USER_RECEIVE");
    }

    @Override
    @Transactional
    public Coupon createCoupon(CouponCreateRequest request) {
        validateCouponRequest(request);
        Coupon coupon = new Coupon();
        fillCoupon(coupon, request);
        coupon.setRemainCount(request.getTotalCount());
        coupon.setStatus(1);
        couponMapper.insert(coupon);
        operationLogSupport.log("COUPON", "CREATE", "COUPON", coupon.getId(), "管理员创建优惠券模板");
        return coupon;
    }

    @Override
    @Transactional
    public void grantCoupon(CouponGrantRequest request) {
        Coupon coupon = requireCoupon(request.getCouponId());
        validateCouponTemplate(coupon);
        PlatformUser user = platformUserMapper.selectById(request.getUserId());
        if (user == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "发券目标用户不存在");
        }
        issueCoupon(request.getUserId(), coupon, "ADMIN_GRANT");
        operationLogSupport.log("COUPON", "GRANT", "USER_COUPON", null,
                "管理员向用户 " + request.getUserId() + " 发放优惠券 " + coupon.getCouponName());
    }

    @Override
    public PageResult<Map<String, Object>> adminCoupons(long current, long size, String keyword, Integer status) {
        Page<Coupon> page = couponMapper.selectPage(new Page<>(current, size), new LambdaQueryWrapper<Coupon>()
                .like(StringUtils.hasText(keyword), Coupon::getCouponName, keyword)
                .eq(status != null, Coupon::getStatus, status)
                .orderByDesc(Coupon::getId));
        List<Map<String, Object>> records = page.getRecords().stream().map(this::mapCouponRow).toList();
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), records);
    }

    private Coupon requireCoupon(Long couponId) {
        Coupon coupon = couponMapper.selectById(couponId);
        if (coupon == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "优惠券不存在");
        }
        return coupon;
    }

    private void validateCouponTemplate(Coupon coupon) {
        if (coupon.getStatus() == null || coupon.getStatus() != 1) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "优惠券未启用");
        }
        if (coupon.getRemainCount() == null || coupon.getRemainCount() <= 0) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "优惠券库存不足");
        }
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getValidStartTime() != null && coupon.getValidStartTime().isAfter(now)) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "优惠券未到生效时间");
        }
        if (coupon.getValidEndTime() != null && coupon.getValidEndTime().isBefore(now)) {
            throw new BusinessException(ErrorCode.COUPON_INVALID, "优惠券已过期");
        }
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

    private void fillCoupon(Coupon coupon, CouponCreateRequest request) {
        coupon.setCouponName(request.getCouponName());
        coupon.setCouponType(request.getCouponType());
        coupon.setServiceScope(request.getServiceScope());
        coupon.setThresholdAmount(request.getThresholdAmount());
        coupon.setDiscountAmount(CouponType.CASH.equals(request.getCouponType()) ? request.getDiscountAmount() : null);
        coupon.setDiscountRate(CouponType.DISCOUNT.equals(request.getCouponType()) ? request.getDiscountRate() : null);
        coupon.setStackable(request.getStackable());
        coupon.setTotalCount(request.getTotalCount());
        coupon.setReceiveLimitPerUser(request.getReceiveLimitPerUser());
        coupon.setValidStartTime(request.getValidStartTime());
        coupon.setValidEndTime(request.getValidEndTime());
        coupon.setRuleDesc(request.getRuleDesc());
    }

    private void issueCoupon(Long userId, Coupon coupon, String mode) {
        coupon.setRemainCount(coupon.getRemainCount() - 1);
        couponMapper.updateById(coupon);
        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(userId);
        userCoupon.setCouponId(coupon.getId());
        userCoupon.setCouponStatus(CouponStatus.UNUSED);
        userCoupon.setServiceScope(coupon.getServiceScope());
        userCoupon.setValidStartTime(coupon.getValidStartTime());
        userCoupon.setValidEndTime(coupon.getValidEndTime());
        userCoupon.setReceiveMode(mode);
        userCouponMapper.insert(userCoupon);
        writeLog(coupon.getId(), userId, userCoupon.getId(), null, mode, "优惠券发放成功");
        messagePushSupport.push(userId, "COUPON", "COUPON_RECEIVED",
                "优惠券到账", "优惠券 " + coupon.getCouponName() + " 已发放到账", "zh-CN");
    }

    private void markExpired(UserCoupon item) {
        item.setCouponStatus(CouponStatus.EXPIRED);
        userCouponMapper.updateById(item);
        writeLog(item.getCouponId(), item.getUserId(), item.getId(), null, "EXPIRE", "优惠券已自动过期");
    }

    private Map<String, Object> mapCouponRow(Coupon item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", item.getId());
        map.put("couponName", item.getCouponName());
        map.put("couponType", item.getCouponType());
        map.put("serviceScope", item.getServiceScope());
        map.put("thresholdAmount", item.getThresholdAmount());
        map.put("discountAmount", item.getDiscountAmount());
        map.put("discountRate", item.getDiscountRate());
        map.put("remainCount", item.getRemainCount());
        map.put("totalCount", item.getTotalCount());
        map.put("status", item.getStatus());
        map.put("receiveLimitPerUser", item.getReceiveLimitPerUser());
        map.put("validStartTime", item.getValidStartTime());
        map.put("validEndTime", item.getValidEndTime());
        map.put("ruleDesc", item.getRuleDesc());
        map.put("receivedCount", Math.max((item.getTotalCount() == null ? 0 : item.getTotalCount())
                - (item.getRemainCount() == null ? 0 : item.getRemainCount()), 0));
        map.put("usedCount", userCouponMapper.selectCount(new LambdaQueryWrapper<UserCoupon>()
                .eq(UserCoupon::getCouponId, item.getId())
                .eq(UserCoupon::getCouponStatus, CouponStatus.USED)));
        return map;
    }

    private void writeLog(Long couponId, Long userId, Long userCouponId, Long orderId, String operationType, String content) {
        CouponOperationLog log = new CouponOperationLog();
        log.setCouponId(couponId);
        log.setUserId(userId);
        log.setUserCouponId(userCouponId);
        log.setOrderId(orderId);
        log.setOperationType(operationType);
        log.setContent(content);
        couponOperationLogMapper.insert(log);
    }
}
