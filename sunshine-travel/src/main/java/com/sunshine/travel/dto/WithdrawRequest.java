package com.sunshine.travel.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class WithdrawRequest {

    @NotNull
    @DecimalMin("1")
    private BigDecimal applyAmount;
    @NotBlank
    private String bankAccount;
    @NotBlank
    private String bankName;
}

