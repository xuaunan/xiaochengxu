package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CarpoolTollResponseRequest {

    @NotNull
    private Boolean confirm;
}
