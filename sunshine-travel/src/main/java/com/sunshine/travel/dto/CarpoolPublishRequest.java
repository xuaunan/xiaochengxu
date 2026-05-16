package com.sunshine.travel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

@Data
public class CarpoolPublishRequest {

    @NotBlank
    private String startName;
    @NotBlank
    private String endName;
    @NotNull
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime departTime;
    @NotNull
    @Min(1)
    private Integer seatCount;
    @NotNull
    @DecimalMin(value = "1.0", message = "分摊金额必须大于0")
    private BigDecimal sharedAmount;
    private String baggageRule;
    private String tripRemark;
}
