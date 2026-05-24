package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SystemNoticeSaveRequest {

    @NotBlank(message = "公告标题不能为空")
    private String title;

    @NotBlank(message = "公告内容不能为空")
    private String content;

    @NotNull(message = "状态不能为空")
    private Integer status;

    @NotNull(message = "首页优先级不能为空")
    private Integer sortNo;

    private String targetRole;

    private String displayTimeRange;
}
