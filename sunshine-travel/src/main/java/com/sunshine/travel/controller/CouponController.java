package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "优惠券模块")
@RestController
@RequestMapping("/coupons")
public class CouponController {

    private final CouponService couponService;

    public CouponController(CouponService couponService) {
        this.couponService = couponService;
    }

    @Operation(summary = "可领取优惠券列表")
    @GetMapping("/center")
    public ApiResponse<?> center() {
        return ApiResponse.success(couponService.availableCoupons());
    }

    @Operation(summary = "我的优惠券")
    @RequireRole(RoleCode.USER)
    @GetMapping("/mine")
    public ApiResponse<?> mine() {
        return ApiResponse.success(couponService.currentUserCoupons());
    }

    @Operation(summary = "领取优惠券")
    @RequireRole(RoleCode.USER)
    @PostMapping("/{couponId}/receive")
    public ApiResponse<?> receive(@PathVariable Long couponId) {
        couponService.receive(couponId);
        return ApiResponse.success("领取成功");
    }
}
