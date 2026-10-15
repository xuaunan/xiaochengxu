package com.sunshine.travel.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;

@Data
public class CarpoolRideRequestCreateRequest {

    @NotBlank
    private String startName;
    @NotBlank
    private String endName;
    @NotNull
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime departTime;
    @NotNull
    @Min(1)
    private Integer passengerCount;
    private Boolean acceptCarpool = true;
    @NotNull
    @DecimalMin(value = "1.0", message = "分摊金额必须大于0")
    private BigDecimal sharedAmount;
    private String baggageRule;
    private String requestRemark;
}
