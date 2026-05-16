package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserEnableRequest {

    @NotNull(message = "启用状态不能为空")
    private Integer enabled;
}
