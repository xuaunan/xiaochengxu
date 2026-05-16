package com.sunshine.travel.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class OrderFinishRequest {

    @NotNull
    @DecimalMin(value = "0.1", message = "实际里程必须大于0")
    private BigDecimal actualDistanceKm;

    @NotNull
    @DecimalMin(value = "1", message = "实际时长必须大于0")
    private BigDecimal actualDurationMin;
}
