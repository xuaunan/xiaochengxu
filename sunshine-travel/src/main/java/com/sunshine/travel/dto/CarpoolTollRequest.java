package com.sunshine.travel.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class CarpoolTollRequest {

    @NotNull
    @DecimalMin("0.00")
    private BigDecimal tollAmount;
}
