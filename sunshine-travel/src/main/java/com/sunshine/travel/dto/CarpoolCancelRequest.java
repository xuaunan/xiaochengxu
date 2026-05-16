package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CarpoolCancelRequest {

    @NotNull(message = "申请ID不能为空")
    private Long applicationId;

    @NotBlank(message = "取消原因不能为空")
    private String reason;
}
