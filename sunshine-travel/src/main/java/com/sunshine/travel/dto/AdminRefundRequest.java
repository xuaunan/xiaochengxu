package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminRefundRequest {

    @NotBlank(message = "退款原因不能为空")
    private String reason;
}
