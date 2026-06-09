package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.service.MembershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "乘客会员")
@RequireRole(RoleCode.USER)
@RestController
@RequestMapping("/membership")
public class MembershipController {

    private final MembershipService membershipService;

    public MembershipController(MembershipService membershipService) {
        this.membershipService = membershipService;
    }

    @Operation(summary = "我的会员状态")
    @GetMapping
    public ApiResponse<?> current() {
        return ApiResponse.success(membershipService.currentMembership());
    }

    @Operation(summary = "开通乘客会员")
    @PostMapping("/activate")
    public ApiResponse<?> activate() {
        return ApiResponse.success("会员已开通", membershipService.activateCurrentUser());
    }

    @Operation(summary = "同步本周会员券")
    @PostMapping("/weekly-coupons")
    public ApiResponse<?> weeklyCoupons() {
        return ApiResponse.success("会员券包已同步", membershipService.ensureCurrentWeeklyCoupons());
    }
}
