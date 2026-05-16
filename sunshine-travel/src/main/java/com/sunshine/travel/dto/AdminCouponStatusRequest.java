package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdminCouponStatusRequest {

    @NotNull(message = "状态不能为空")
    private Integer status;
}
