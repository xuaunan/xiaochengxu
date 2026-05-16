package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AuthRegisterRequest {

    @NotBlank
    @Pattern(regexp = "^1\\d{10}$", message = "手机号格式不正确")
    private String phone;

    @NotBlank
    @Size(min = 6, max = 20, message = "密码长度需为6-20位")
    private String password;

    @NotBlank
    @Size(max = 20, message = "昵称长度不能超过20位")
    private String nickname;

    @NotBlank
    private String roleCode;

    private String defaultLanguage;
}
