package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.CarpoolCancelRequest;
import com.sunshine.travel.dto.CarpoolConfirmRequest;
import com.sunshine.travel.dto.CarpoolPublishRequest;
import com.sunshine.travel.dto.CarpoolRideRequestCreateRequest;
import com.sunshine.travel.service.CarpoolService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "顺风车模块")
@RestController
@RequestMapping("/carpool")
public class CarpoolController {

    private final CarpoolService carpoolService;

    public CarpoolController(CarpoolService carpoolService) {
        this.carpoolService = carpoolService;
    }

    @Operation(summary = "发布顺风车行程")
    @RequireRole(RoleCode.USER)
    @PostMapping("/publish")
    public ApiResponse<?> publish(@Valid @RequestBody CarpoolPublishRequest request) {
        return ApiResponse.success("发布成功", carpoolService.publish(request));
    }

    @Operation(summary = "乘客发布顺风车需求")
    @RequireRole(RoleCode.USER)
    @PostMapping("/request")
    public ApiResponse<?> publishRideRequest(@Valid @RequestBody CarpoolRideRequestCreateRequest request) {
        return ApiResponse.success("需求已发布，等待车主主动接单", carpoolService.publishRideRequest(request));
    }

    @Operation(summary = "查看与车主行程匹配的乘客需求")
    @RequireRole(RoleCode.USER)
    @GetMapping("/{tripId}/matches")
    public ApiResponse<?> matchRideRequests(@PathVariable Long tripId) {
        return ApiResponse.success(carpoolService.matchRideRequests(tripId));
    }

    @Operation(summary = "车主接乘客需求")
    @RequireRole(RoleCode.USER)
    @PostMapping("/request/{requestId}/accept")
    public ApiResponse<?> acceptRideRequest(@PathVariable Long requestId, @RequestParam Long tripId) {
        carpoolService.acceptRideRequest(requestId, tripId);
        return ApiResponse.success("已接单，等待乘客确认");
    }

    @Operation(summary = "乘客取消顺风车需求")
    @RequireRole(RoleCode.USER)
    @PostMapping("/request/{requestId}/cancel")
    public ApiResponse<?> cancelRideRequest(@PathVariable Long requestId, @RequestBody(required = false) java.util.Map<String, String> request) {
        String reason = request == null ? "乘客取消出行需求" : request.getOrDefault("reason", "乘客取消出行需求");
        carpoolService.cancelRideRequest(requestId, reason);
        return ApiResponse.success("需求已取消");
    }

    @Operation(summary = "顺风车详情")
    @GetMapping("/{tripId}")
    public ApiResponse<?> detail(@PathVariable Long tripId) {
        return ApiResponse.success(carpoolService.detail(tripId));
    }

    @Operation(summary = "车主确认或拒绝")
    @RequireRole(RoleCode.USER)
    @PostMapping("/owner-confirm")
    public ApiResponse<?> ownerConfirm(@Valid @RequestBody CarpoolConfirmRequest request) {
        carpoolService.ownerConfirm(request);
        return ApiResponse.success("车主处理成功");
    }

    @Operation(summary = "乘客最终确认")
    @RequireRole(RoleCode.USER)
    @PostMapping("/passenger-confirm")
    public ApiResponse<?> passengerConfirm(@Valid @RequestBody CarpoolConfirmRequest request) {
        carpoolService.passengerConfirm(request);
        return ApiResponse.success("乘客确认成功");
    }

    @Operation(summary = "取消拼车申请")
    @RequireRole(RoleCode.USER)
    @PostMapping("/cancel")
    public ApiResponse<?> cancel(@Valid @RequestBody CarpoolCancelRequest request) {
        carpoolService.cancel(request);
        return ApiResponse.success("拼车申请已取消");
    }

    @Operation(summary = "车主取消顺风车行程")
    @RequireRole(RoleCode.USER)
    @PostMapping("/{tripId}/cancel")
    public ApiResponse<?> cancelTrip(@PathVariable Long tripId, @RequestBody(required = false) java.util.Map<String, String> request) {
        String reason = request == null ? "车主取消行程" : request.getOrDefault("reason", "车主取消行程");
        carpoolService.cancelTrip(tripId, reason);
        return ApiResponse.success("行程已取消");
    }

    @Operation(summary = "车主完成顺风车行程")
    @RequireRole(RoleCode.USER)
    @PostMapping("/{tripId}/finish")
    public ApiResponse<?> finishTrip(@PathVariable Long tripId) {
        carpoolService.finishTrip(tripId);
        return ApiResponse.success("行程已完成");
    }

    @Operation(summary = "我的顺风车数据")
    @RequireRole(RoleCode.USER)
    @GetMapping("/mine")
    public ApiResponse<?> mine() {
        return ApiResponse.success(carpoolService.myTrips());
    }
}
