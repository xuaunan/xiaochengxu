package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SupportMessageRequest {

    @NotBlank(message = "消息内容不能为空")
    @Size(max = 500, message = "消息内容不能超过500字")
    private String content;
}
