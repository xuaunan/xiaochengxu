package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DriverStatusRequest {

    @NotBlank(message = "服务状态不能为空")
    private String serviceStatus;

    @NotBlank(message = "经度不能为空")
    private String longitude;

    @NotBlank(message = "纬度不能为空")
    private String latitude;
}
