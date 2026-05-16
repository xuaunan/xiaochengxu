package com.sunshine.travel.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Data;

@Data
public class OrderCreateRequest {

    @NotNull
    private Long carTypeId;
    @NotBlank
    private String serviceType;
    @NotBlank
    private String startName;
    @NotBlank
    private String startLng;
    @NotBlank
    private String startLat;
    @NotBlank
    private String endName;
    @NotBlank
    private String endLng;
    @NotBlank
    private String endLat;
    @NotNull
    @DecimalMin("0.1")
    private BigDecimal estimatedDistanceKm;
    @NotNull
    @DecimalMin("1")
    private BigDecimal estimatedDurationMin;
    private Long userCouponId;
    private String dispatchMode;
    private String languageCode;
    private String currencyCode;
    private String remark;
}
