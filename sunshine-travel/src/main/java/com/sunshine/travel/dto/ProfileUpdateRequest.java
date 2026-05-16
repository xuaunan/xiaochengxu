package com.sunshine.travel.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileUpdateRequest {

    @NotBlank(message = "昵称不能为空")
    @Size(max = 20, message = "昵称长度不能超过20位")
    private String nickname;

    @Size(max = 255, message = "头像地址长度不能超过255位")
    private String avatar;

    @JsonAlias("real_name")
    @Size(max = 20, message = "真实姓名长度不能超过20位")
    private String realName;

    @JsonAlias("emergency_contact")
    @Size(max = 20, message = "紧急联系人长度不能超过20位")
    private String emergencyContact;

    @JsonAlias("emergency_phone")
    @Pattern(regexp = "^$|^\\d{8,16}$", message = "紧急电话需为8-16位纯数字")
    private String emergencyPhone;

}
