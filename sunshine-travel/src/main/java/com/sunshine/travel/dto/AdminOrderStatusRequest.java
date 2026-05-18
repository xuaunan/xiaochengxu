package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminOrderStatusRequest {

    @NotBlank(message = "目标状态不能为空")
    private String orderStatus;

    private String payStatus;

    private String remark;
}
