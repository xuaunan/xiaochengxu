package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class MockPayRequest {

    @NotNull
    private Long orderId;

    private String payChannel;
    private Long userCouponId;
    private BigDecimal couponDiscount;
    private BigDecimal payableAmount;
    private BigDecimal originalAmount;
}
