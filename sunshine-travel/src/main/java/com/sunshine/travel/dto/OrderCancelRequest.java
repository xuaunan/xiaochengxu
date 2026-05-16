package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrderCancelRequest {

    @NotBlank
    private String reason;
}

