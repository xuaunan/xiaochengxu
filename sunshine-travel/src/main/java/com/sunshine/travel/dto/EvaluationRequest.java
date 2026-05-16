package com.sunshine.travel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EvaluationRequest {

    @NotNull
    private Long orderId;
    @NotNull
    @Min(1)
    @Max(5)
    private Integer score;
    private String content;
}

