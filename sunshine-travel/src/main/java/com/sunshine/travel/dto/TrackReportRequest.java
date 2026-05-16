package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class TrackReportRequest {

    @NotBlank(message = "经度不能为空")
    private String longitude;

    @NotBlank(message = "纬度不能为空")
    private String latitude;

    private Boolean waitingRedLight;

    private Long waitSeconds;

    private Long currentWaitSeconds;

    private String trafficText;

    private String waitingText;

    private BigDecimal speedKmh;

    private BigDecimal heading;

    private String traceMode;

    private String remark;
}
