package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class RealNameSubmitRequest {

    @NotBlank(message = "真实姓名不能为空")
    private String realName;

    @NotBlank(message = "身份证号不能为空")
    @Pattern(regexp = "^[0-9Xx]{15,18}$", message = "身份证号格式不正确")
    private String idCard;
}
