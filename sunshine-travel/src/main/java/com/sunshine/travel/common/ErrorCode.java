package com.sunshine.travel.common;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(0, "success"),
    BUSINESS_ERROR(4000, "业务处理失败"),
    PARAM_ERROR(4001, "请求参数不合法"),
    UNAUTHORIZED(4002, "请先登录"),
    FORBIDDEN(4003, "无权限访问"),
    DATA_NOT_FOUND(4004, "数据不存在"),
    STATUS_ERROR(4005, "当前状态不允许该操作"),
    DUPLICATE_REQUEST(4006, "请勿重复提交"),
    COUPON_INVALID(4007, "优惠券不可用"),
    ORDER_INVALID(4008, "订单不可操作"),
    DRIVER_INVALID(4009, "司机状态异常"),
    SYSTEM_ERROR(5000, "系统繁忙，请稍后重试");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
