package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SystemVersionSaveRequest {

    @NotBlank(message = "版本号不能为空")
    private String versionNo;

    @NotBlank(message = "客户端类型不能为空")
    private String clientType;

    @NotBlank(message = "更新说明不能为空")
    private String releaseNote;

    @NotNull(message = "是否强制更新不能为空")
    private Integer forceUpdate;

    @NotNull(message = "状态不能为空")
    private Integer status;

    private String downloadUrl;
}
