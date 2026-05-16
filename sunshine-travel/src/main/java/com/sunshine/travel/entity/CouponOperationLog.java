package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_coupon_operation_log")
public class CouponOperationLog extends BaseEntity {

    private Long couponId;
    private Long userId;
    private Long userCouponId;
    private Long orderId;
    private String operationType;
    private String content;
}
