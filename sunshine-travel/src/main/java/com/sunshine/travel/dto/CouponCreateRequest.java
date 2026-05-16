package com.sunshine.travel.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

@Data
public class CouponCreateRequest {

    @NotBlank(message = "优惠券名称不能为空")
    private String couponName;

    @NotBlank(message = "优惠券类型不能为空")
    private String couponType;

    @NotBlank(message = "适用范围不能为空")
    private String serviceScope;

    @DecimalMin(value = "0.0", message = "门槛金额不能小于0")
    private BigDecimal thresholdAmount;

    @DecimalMin(value = "0.0", inclusive = false, message = "减免金额必须大于0")
    private BigDecimal discountAmount;

    private BigDecimal discountRate;

    @NotNull(message = "是否可叠加不能为空")
    private Integer stackable;

    @NotNull(message = "总库存不能为空")
    @Min(value = 1, message = "总库存必须大于0")
    private Integer totalCount;

    @NotNull(message = "单人领取上限不能为空")
    @Min(value = 1, message = "单人领取上限必须大于0")
    private Integer receiveLimitPerUser;

    @NotNull(message = "生效开始时间不能为空")
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime validStartTime;

    @NotNull(message = "生效结束时间不能为空")
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime validEndTime;

    private String ruleDesc;
}
