package com.sunshine.travel.service;

import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.CouponGrantRequest;
import com.sunshine.travel.entity.Coupon;
import com.sunshine.travel.entity.UserCoupon;
import java.util.List;
import java.util.Map;

public interface CouponService {

    List<UserCoupon> currentUserCoupons();

    List<Coupon> availableCoupons();

    void receive(Long couponId);

    Coupon createCoupon(CouponCreateRequest request);

    void grantCoupon(CouponGrantRequest request);

    PageResult<Map<String, Object>> adminCoupons(long current, long size, String keyword, Integer status);
}
