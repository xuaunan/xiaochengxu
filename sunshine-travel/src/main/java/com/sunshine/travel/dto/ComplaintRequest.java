package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ComplaintRequest {

    @NotNull
    private Long orderId;
    @NotBlank
    private String complaintType;
    @NotBlank
    private String content;
}

