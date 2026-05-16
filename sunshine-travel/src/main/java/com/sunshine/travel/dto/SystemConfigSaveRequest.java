package com.sunshine.travel.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class SystemConfigSaveRequest {

    @Valid
    @NotEmpty(message = "配置列表不能为空")
    private List<SystemConfigItemRequest> items;
}
