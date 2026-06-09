package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.AdminMemberUpdateRequest;
import com.sunshine.travel.service.MembershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "后台会员管理")
@RequireRole(RoleCode.ADMIN)
@RestController
@RequestMapping("/admin/members")
public class AdminMembershipController {

    private final MembershipService membershipService;

    public AdminMembershipController(MembershipService membershipService) {
        this.membershipService = membershipService;
    }

    @Operation(summary = "会员分页查询")
    @GetMapping
    public ApiResponse<?> members(@RequestParam(defaultValue = "1") long current,
                                  @RequestParam(defaultValue = "10") long size,
                                  @RequestParam(required = false) String keyword,
                                  @RequestParam(required = false) String status) {
        return ApiResponse.success(membershipService.adminMembers(current, size, keyword, status));
    }

    @Operation(summary = "更新会员状态")
    @PostMapping("/{userId}")
    public ApiResponse<?> update(@PathVariable Long userId, @RequestBody AdminMemberUpdateRequest request) {
        return ApiResponse.success("会员状态已更新", membershipService.updateMember(userId, request));
    }

    @Operation(summary = "补发本周会员券")
    @PostMapping("/{userId}/weekly-coupons")
    public ApiResponse<?> grantWeeklyCoupons(@PathVariable Long userId) {
        return ApiResponse.success("会员券包已同步", membershipService.grantWeeklyCoupons(userId));
    }
}
