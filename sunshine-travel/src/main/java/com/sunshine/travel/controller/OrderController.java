package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.ComplaintRequest;
import com.sunshine.travel.dto.EvaluationRequest;
import com.sunshine.travel.dto.InvoiceApplyRequest;
import com.sunshine.travel.dto.MockPayRequest;
import com.sunshine.travel.dto.OrderCancelRequest;
import com.sunshine.travel.dto.OrderCreateRequest;
import com.sunshine.travel.dto.OrderFinishRequest;
import com.sunshine.travel.dto.TrackReportRequest;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.service.InvoiceImageService;
import com.sunshine.travel.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "订单模块")
@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;
    private final InvoiceImageService invoiceImageService;

    public OrderController(OrderService orderService, InvoiceImageService invoiceImageService) {
        this.orderService = orderService;
        this.invoiceImageService = invoiceImageService;
    }

    @Operation(summary = "创建订单")
    @RequireRole(RoleCode.USER)
    @PostMapping
    public ApiResponse<?> create(@Valid @RequestBody OrderCreateRequest request) {
        RideOrder order = orderService.createOrder(request);
        return ApiResponse.success("订单创建成功", orderService.detailView(order.getId()));
    }

    @Operation(summary = "我的订单")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/mine")
    public ApiResponse<?> mine() {
        return ApiResponse.success(orderService.currentUserOrderViews(UserContext.role()));
    }

    @Operation(summary = "订单详情")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/{orderId}")
    public ApiResponse<?> detail(@PathVariable Long orderId) {
        return ApiResponse.success(orderService.detailView(orderId));
    }

    @Operation(summary = "订单实时运行态")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/{orderId}/runtime")
    public ApiResponse<?> runtime(@PathVariable Long orderId) {
        return ApiResponse.success(orderService.runtime(orderId));
    }

    @Operation(summary = "待抢订单列表")
    @RequireRole({RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/waiting")
    public ApiResponse<?> waiting() {
        return ApiResponse.success(orderService.waitingOrderViews());
    }

    @Operation(summary = "司机接单")
    @RequireRole(RoleCode.DRIVER)
    @PostMapping("/{orderId}/accept")
    public ApiResponse<?> accept(@PathVariable Long orderId) {
        orderService.acceptOrder(orderId);
        return ApiResponse.success("接单成功");
    }

    @Operation(summary = "司机拒单")
    @RequireRole(RoleCode.DRIVER)
    @PostMapping("/{orderId}/reject")
    public ApiResponse<?> reject(@PathVariable Long orderId, @Valid @RequestBody OrderCancelRequest request) {
        orderService.rejectOrder(orderId, request.getReason());
        return ApiResponse.success("已拒绝该订单");
    }

    @Operation(summary = "司机开始接驾")
    @RequireRole(RoleCode.DRIVER)
    @PostMapping("/{orderId}/start")
    public ApiResponse<?> start(@PathVariable Long orderId) {
        orderService.startOrder(orderId);
        return ApiResponse.success("司机已开始接驾");
    }

    @Operation(summary = "乘客已上车/司机确认发车")
    @RequireRole({RoleCode.DRIVER, RoleCode.USER})
    @PostMapping("/{orderId}/pickup")
    public ApiResponse<?> pickup(@PathVariable Long orderId) {
        orderService.pickupOrder(orderId);
        return ApiResponse.success("行程已开始");
    }

    @Operation(summary = "结束行程")
    @RequireRole(RoleCode.DRIVER)
    @PostMapping("/{orderId}/finish")
    public ApiResponse<?> finish(@PathVariable Long orderId, @Valid @RequestBody OrderFinishRequest request) {
        orderService.finishOrder(orderId, request);
        return ApiResponse.success("行程已结束");
    }

    @Operation(summary = "取消订单")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @PostMapping("/{orderId}/cancel")
    public ApiResponse<?> cancel(@PathVariable Long orderId, @Valid @RequestBody OrderCancelRequest request) {
        orderService.cancelOrder(orderId, request.getReason());
        return ApiResponse.success("订单已取消");
    }

    @Operation(summary = "确认支付")
    @RequireRole({RoleCode.USER, RoleCode.ADMIN})
    @PostMapping("/mock-pay")
    public ApiResponse<?> mockPay(@Valid @RequestBody MockPayRequest request) {
        return ApiResponse.success("支付成功", orderService.mockPay(request));
    }

    @Operation(summary = "提交评价")
    @RequireRole(RoleCode.USER)
    @PostMapping("/evaluation")
    public ApiResponse<?> evaluation(@Valid @RequestBody EvaluationRequest request) {
        orderService.submitEvaluation(request);
        return ApiResponse.success("评价成功");
    }

    @Operation(summary = "提交投诉")
    @RequireRole({RoleCode.USER, RoleCode.ADMIN})
    @PostMapping("/complaint")
    public ApiResponse<?> complaint(@Valid @RequestBody ComplaintRequest request) {
        orderService.submitComplaint(request);
        return ApiResponse.success("投诉已提交");
    }

    @Operation(summary = "申请订单发票")
    @RequireRole(RoleCode.USER)
    @PostMapping("/{orderId}/invoice")
    public ApiResponse<?> applyInvoice(@PathVariable Long orderId, @RequestBody InvoiceApplyRequest request) {
        return ApiResponse.success("发票申请已提交", orderService.applyInvoice(orderId, request));
    }

    @Operation(summary = "查看订单发票图片")
    @RequireRole(RoleCode.USER)
    @GetMapping(value = "/{orderId}/invoice/image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> invoiceImage(@PathVariable Long orderId) {
        byte[] image = invoiceImageService.render(orderId, false);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=invoice-" + orderId + ".png")
                .contentType(MediaType.IMAGE_PNG)
                .body(image);
    }

    @Operation(summary = "上报订单轨迹点")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER})
    @PostMapping("/{orderId}/track/report")
    public ApiResponse<?> reportTrack(@PathVariable Long orderId, @Valid @RequestBody TrackReportRequest request) {
        orderService.reportTrack(orderId, request);
        return ApiResponse.success("轨迹已上报");
    }

    @Operation(summary = "查询历史轨迹")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/{orderId}/track/history")
    public ApiResponse<?> trackHistory(@PathVariable Long orderId) {
        return ApiResponse.success(orderService.trackHistory(orderId));
    }
}
