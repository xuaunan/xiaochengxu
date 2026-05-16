package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CarpoolConfirmRequest {

    @NotNull(message = "申请ID不能为空")
    private Long applicationId;

    @NotBlank(message = "操作类型不能为空")
    private String action;

    private String note;
}
