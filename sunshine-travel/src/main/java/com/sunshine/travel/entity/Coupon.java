package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_coupon")
public class Coupon extends BaseEntity {

    private String couponName;
    private String couponType;
    private String serviceScope;
    private BigDecimal thresholdAmount;
    private BigDecimal discountAmount;
    private BigDecimal discountRate;
    private Integer stackable;
    private Integer totalCount;
    private Integer remainCount;
    private Integer status;
    private Integer receiveLimitPerUser;
    private LocalDateTime validStartTime;
    private LocalDateTime validEndTime;
    private String ruleDesc;
}
