package com.sunshine.travel.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminUserSaveRequest {

    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1\\d{10}$", message = "手机号格式不正确")
    private String phone;

    @NotBlank(message = "昵称不能为空")
    @Size(max = 20, message = "昵称长度不能超过20位")
    private String nickname;

    @JsonAlias("role_code")
    @NotBlank(message = "角色不能为空")
    private String roleCode;

    private String password;

    @JsonAlias("real_name")
    private String realName;

    @JsonAlias("id_card")
    private String idCard;

    @JsonAlias("emergency_contact")
    private String emergencyContact;

    @JsonAlias("emergency_phone")
    private String emergencyPhone;

    @JsonAlias("default_language")
    private String defaultLanguage;

    @NotNull(message = "启用状态不能为空")
    private Integer enabled;
}
