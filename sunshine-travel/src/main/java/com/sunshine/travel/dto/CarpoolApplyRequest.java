package com.sunshine.travel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CarpoolApplyRequest {

    @NotNull
    private Long tripId;
    @NotNull
    @Min(0)
    private Integer companionCount;
    private String note;
}

