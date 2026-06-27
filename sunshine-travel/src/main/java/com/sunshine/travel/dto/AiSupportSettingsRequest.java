package com.sunshine.travel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AiSupportSettingsRequest {

    private Boolean enabled;

    @Size(max = 30, message = "AI提供商不能超过30个字符")
    private String provider;

    @Size(max = 80, message = "AI模型不能超过80个字符")
    private String model;

    @Size(max = 255, message = "AI接口地址不能超过255个字符")
    private String apiUrl;

    @Size(max = 255, message = "API Password不能超过255个字符")
    private String apiPassword;

    @Min(value = 3, message = "超时时间不能小于3秒")
    @Max(value = 60, message = "超时时间不能超过60秒")
    private Integer timeoutSeconds;

    @Min(value = 0, message = "温度不能小于0")
    @Max(value = 2, message = "温度不能大于2")
    private Double temperature;

    @Min(value = 64, message = "最大输出不能小于64")
    @Max(value = 4096, message = "最大输出不能超过4096")
    private Integer maxTokens;

    @Size(max = 2000, message = "系统提示词不能超过2000个字符")
    private String systemPrompt;

    @Size(max = 500, message = "兜底回复不能超过500个字符")
    private String fallbackMessage;

    private Boolean debugEnabled;
}
