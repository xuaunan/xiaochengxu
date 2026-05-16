package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminComplaintHandleRequest {

    @NotBlank(message = "处理结果不能为空")
    private String handleResult;
}
