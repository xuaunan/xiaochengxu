package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.AdminCouponStatusRequest;
import com.sunshine.travel.dto.AdminComplaintHandleRequest;
import com.sunshine.travel.dto.AdminDriverUpdateRequest;
import com.sunshine.travel.dto.AdminOrderStatusRequest;
import com.sunshine.travel.dto.AdminRefundRequest;
import com.sunshine.travel.dto.AdminResetPasswordRequest;
import com.sunshine.travel.dto.AdminUserSaveRequest;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.CouponGrantRequest;
import com.sunshine.travel.dto.SystemConfigSaveRequest;
import com.sunshine.travel.dto.SystemNoticeSaveRequest;
import com.sunshine.travel.dto.SystemVersionSaveRequest;
import com.sunshine.travel.dto.UserAuditRequest;
import com.sunshine.travel.dto.UserEnableRequest;
import com.sunshine.travel.dto.WithdrawAuditRequest;
import com.sunshine.travel.service.AdminService;
import com.sunshine.travel.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "管理员后台")
@RequireRole(RoleCode.ADMIN)
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final AdminService adminService;
    private final CouponService couponService;

    public AdminController(AdminService adminService, CouponService couponService) {
        this.adminService = adminService;
        this.couponService = couponService;
    }

    @Operation(summary = "管理后台大盘")
    @GetMapping("/dashboard")
    public ApiResponse<?> dashboard(@RequestParam(defaultValue = "day") String range) {
        return ApiResponse.success(adminService.dashboard(range));
    }

    @Operation(summary = "用户分页查询")
    @GetMapping("/users")
    public ApiResponse<?> users(@RequestParam(defaultValue = "1") long current,
                                @RequestParam(defaultValue = "10") long size,
                                @RequestParam(required = false) String keyword,
                                @RequestParam(required = false) String roleCode) {
        return ApiResponse.success(adminService.users(current, size, keyword, roleCode));
    }

    @Operation(summary = "用户详情")
    @GetMapping("/users/{userId}")
    public ApiResponse<?> userDetail(@PathVariable Long userId) {
        return ApiResponse.success(adminService.userDetail(userId));
    }

    @Operation(summary = "新增用户")
    @PostMapping("/users")
    public ApiResponse<?> createUser(@Valid @RequestBody AdminUserSaveRequest request) {
        return ApiResponse.success("用户创建成功", adminService.createUser(request));
    }

    @Operation(summary = "编辑用户")
    @PutMapping("/users/{userId}")
    public ApiResponse<?> updateUser(@PathVariable Long userId, @Valid @RequestBody AdminUserSaveRequest request) {
        return ApiResponse.success("用户更新成功", adminService.updateUser(userId, request));
    }

    @Operation(summary = "重置用户密码")
    @PostMapping("/users/{userId}/reset-password")
    public ApiResponse<?> resetUserPassword(@PathVariable Long userId, @Valid @RequestBody AdminResetPasswordRequest request) {
        adminService.resetUserPassword(userId, request);
        return ApiResponse.success("密码重置成功");
    }

    @Operation(summary = "司机分页查询")
    @GetMapping("/drivers")
    public ApiResponse<?> drivers(@RequestParam(defaultValue = "1") long current,
                                  @RequestParam(defaultValue = "10") long size,
                                  @RequestParam(required = false) String keyword,
                                  @RequestParam(required = false) Integer auditStatus,
                                  @RequestParam(required = false) String serviceStatus) {
        return ApiResponse.success(adminService.drivers(current, size, keyword, auditStatus, serviceStatus));
    }

    @Operation(summary = "司机详情")
    @GetMapping("/drivers/{driverId}")
    public ApiResponse<?> driverDetail(@PathVariable Long driverId) {
        return ApiResponse.success(adminService.driverDetail(driverId));
    }

    @Operation(summary = "编辑司机资料")
    @PutMapping("/drivers/{driverId}")
    public ApiResponse<?> updateDriver(@PathVariable Long driverId, @Valid @RequestBody AdminDriverUpdateRequest request) {
        return ApiResponse.success("司机资料更新成功", adminService.updateDriver(driverId, request));
    }

    @Operation(summary = "订单分页查询")
    @GetMapping("/orders")
    public ApiResponse<?> orders(@RequestParam(defaultValue = "1") long current,
                                 @RequestParam(defaultValue = "10") long size,
                                 @RequestParam(required = false) String keyword,
                                 @RequestParam(required = false) String status,
                                 @RequestParam(required = false) String serviceType) {
        return ApiResponse.success(adminService.orders(current, size, keyword, status, serviceType));
    }

    @Operation(summary = "订单详情")
    @GetMapping("/orders/{orderId}")
    public ApiResponse<?> orderDetail(@PathVariable Long orderId) {
        return ApiResponse.success(adminService.orderDetail(orderId));
    }

    @Operation(summary = "管理员修改订单状态")
    @PostMapping("/orders/{orderId}/status")
    public ApiResponse<?> updateOrderStatus(@PathVariable Long orderId, @Valid @RequestBody AdminOrderStatusRequest request) {
        adminService.updateOrderStatus(orderId, request);
        return ApiResponse.success("订单状态更新成功");
    }

    @Operation(summary = "管理员取消订单")
    @PostMapping("/orders/{orderId}/cancel")
    public ApiResponse<?> cancelOrder(@PathVariable Long orderId, @Valid @RequestBody AdminRefundRequest request) {
        adminService.cancelOrder(orderId, request.getReason());
        return ApiResponse.success("订单取消成功");
    }

    @Operation(summary = "管理员退款")
    @PostMapping("/orders/{orderId}/refund")
    public ApiResponse<?> refundOrder(@PathVariable Long orderId, @Valid @RequestBody AdminRefundRequest request) {
        adminService.refundOrder(orderId, request);
        return ApiResponse.success("订单退款成功");
    }

    @Operation(summary = "提现申请分页查询")
    @GetMapping("/withdraws")
    public ApiResponse<?> withdraws(@RequestParam(defaultValue = "1") long current,
                                    @RequestParam(defaultValue = "10") long size,
                                    @RequestParam(required = false) String status) {
        return ApiResponse.success(adminService.withdraws(current, size, status));
    }

    @Operation(summary = "优惠券分页查询")
    @GetMapping("/coupons")
    public ApiResponse<?> coupons(@RequestParam(defaultValue = "1") long current,
                                  @RequestParam(defaultValue = "10") long size,
                                  @RequestParam(required = false) String keyword,
                                  @RequestParam(required = false) Integer status) {
        return ApiResponse.success(adminService.coupons(current, size, keyword, status));
    }

    @Operation(summary = "优惠券操作记录")
    @GetMapping("/coupon-records")
    public ApiResponse<?> couponRecords(@RequestParam(defaultValue = "1") long current,
                                        @RequestParam(defaultValue = "10") long size,
                                        @RequestParam(required = false) Long couponId,
                                        @RequestParam(required = false) Long userId) {
        return ApiResponse.success(adminService.couponOperationRecords(current, size, couponId, userId));
    }

    @Operation(summary = "处理投诉")
    @PostMapping("/complaints/{complaintId}/handle")
    public ApiResponse<?> handleComplaint(@PathVariable Long complaintId, @Valid @RequestBody AdminComplaintHandleRequest request) {
        adminService.handleComplaint(complaintId, request);
        return ApiResponse.success("投诉处理成功");
    }

    @Operation(summary = "创建优惠券")
    @PostMapping("/coupons")
    public ApiResponse<?> createCoupon(@Valid @RequestBody CouponCreateRequest request) {
        return ApiResponse.success("优惠券创建成功", couponService.createCoupon(request));
    }

    @Operation(summary = "编辑优惠券")
    @PutMapping("/coupons/{couponId}")
    public ApiResponse<?> updateCoupon(@PathVariable Long couponId, @Valid @RequestBody CouponCreateRequest request) {
        return ApiResponse.success("优惠券更新成功", adminService.updateCoupon(couponId, request));
    }

    @Operation(summary = "优惠券上下架")
    @PostMapping("/coupons/{couponId}/status")
    public ApiResponse<?> updateCouponStatus(@PathVariable Long couponId, @Valid @RequestBody AdminCouponStatusRequest request) {
        adminService.updateCouponStatus(couponId, request);
        return ApiResponse.success("优惠券状态更新成功");
    }

    @Operation(summary = "管理员发券")
    @PostMapping("/coupons/grant")
    public ApiResponse<?> grantCoupon(@Valid @RequestBody CouponGrantRequest request) {
        couponService.grantCoupon(request);
        return ApiResponse.success("发券成功");
    }

    @Operation(summary = "操作日志分页查询")
    @GetMapping("/logs")
    public ApiResponse<?> logs(@RequestParam(defaultValue = "1") long current,
                               @RequestParam(defaultValue = "10") long size,
                               @RequestParam(required = false) String module) {
        return ApiResponse.success(adminService.logs(current, size, module));
    }

    @Operation(summary = "财务汇总")
    @GetMapping("/finance/summary")
    public ApiResponse<?> financeSummary() {
        return ApiResponse.success(adminService.financeSummary());
    }

    @Operation(summary = "审核实名认证")
    @PostMapping("/users/{userId}/audit")
    public ApiResponse<?> auditUser(@PathVariable Long userId, @Valid @RequestBody UserAuditRequest request) {
        adminService.auditUser(userId, request);
        return ApiResponse.success("用户审核完成");
    }

    @Operation(summary = "启用禁用用户")
    @PostMapping("/users/{userId}/enable")
    public ApiResponse<?> enableUser(@PathVariable Long userId, @Valid @RequestBody UserEnableRequest request) {
        adminService.enableUser(userId, request);
        return ApiResponse.success("用户状态更新成功");
    }

    @Operation(summary = "审核司机资质")
    @PostMapping("/drivers/{driverId}/audit")
    public ApiResponse<?> auditDriver(@PathVariable Long driverId, @Valid @RequestBody UserAuditRequest request) {
        adminService.auditDriver(driverId, request);
        return ApiResponse.success("司机审核完成");
    }

    @Operation(summary = "审核提现申请")
    @PostMapping("/withdraws/{withdrawId}/audit")
    public ApiResponse<?> auditWithdraw(@PathVariable Long withdrawId, @Valid @RequestBody WithdrawAuditRequest request) {
        adminService.auditWithdraw(withdrawId, request);
        return ApiResponse.success("提现审核完成");
    }

    @Operation(summary = "查询系统配置")
    @GetMapping("/system/configs")
    public ApiResponse<?> systemConfigs() {
        return ApiResponse.success(adminService.systemConfigs());
    }

    @Operation(summary = "保存系统配置")
    @PostMapping("/system/configs")
    public ApiResponse<?> saveSystemConfigs(@Valid @RequestBody SystemConfigSaveRequest request) {
        adminService.saveSystemConfigs(request);
        return ApiResponse.success("系统配置保存成功");
    }

    @Operation(summary = "公告列表")
    @GetMapping("/system/notices")
    public ApiResponse<?> notices(@RequestParam(defaultValue = "1") long current,
                                  @RequestParam(defaultValue = "10") long size,
                                  @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminService.notices(current, size, keyword));
    }

    @Operation(summary = "新增公告")
    @PostMapping("/system/notices")
    public ApiResponse<?> createNotice(@Valid @RequestBody SystemNoticeSaveRequest request) {
        return ApiResponse.success("公告创建成功", adminService.createNotice(request));
    }

    @Operation(summary = "编辑公告")
    @PutMapping("/system/notices/{noticeId}")
    public ApiResponse<?> updateNotice(@PathVariable Long noticeId, @Valid @RequestBody SystemNoticeSaveRequest request) {
        return ApiResponse.success("公告更新成功", adminService.updateNotice(noticeId, request));
    }

    @Operation(summary = "版本列表")
    @GetMapping("/system/versions")
    public ApiResponse<?> versions(@RequestParam(defaultValue = "1") long current,
                                   @RequestParam(defaultValue = "10") long size,
                                   @RequestParam(required = false) String clientType) {
        return ApiResponse.success(adminService.versions(current, size, clientType));
    }

    @Operation(summary = "新增版本")
    @PostMapping("/system/versions")
    public ApiResponse<?> createVersion(@Valid @RequestBody SystemVersionSaveRequest request) {
        return ApiResponse.success("版本创建成功", adminService.createVersion(request));
    }

    @Operation(summary = "编辑版本")
    @PutMapping("/system/versions/{versionId}")
    public ApiResponse<?> updateVersion(@PathVariable Long versionId, @Valid @RequestBody SystemVersionSaveRequest request) {
        return ApiResponse.success("版本更新成功", adminService.updateVersion(versionId, request));
    }
}
