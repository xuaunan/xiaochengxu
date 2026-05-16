package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserAuditRequest {

    @NotNull(message = "审核状态不能为空")
    private Integer authStatus;

    @NotBlank(message = "审核备注不能为空")
    private String remark;
}
