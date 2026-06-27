package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AiSupportTestRequest {

    @NotBlank(message = "测试内容不能为空")
    @Size(max = 500, message = "测试内容不能超过500个字符")
    private String prompt;
}
