package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WithdrawAuditRequest {

    @NotBlank(message = "审核结果不能为空")
    private String action;

    private String rejectReason;
}
