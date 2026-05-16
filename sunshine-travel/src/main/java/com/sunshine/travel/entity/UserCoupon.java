package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user_coupon")
public class UserCoupon extends BaseEntity {

    private Long userId;
    private Long couponId;
    private String couponStatus;
    private String serviceScope;
    private LocalDateTime validStartTime;
    private LocalDateTime validEndTime;
    private Long bindOrderId;
    private String receiveMode;
    private LocalDateTime usedAt;
}
