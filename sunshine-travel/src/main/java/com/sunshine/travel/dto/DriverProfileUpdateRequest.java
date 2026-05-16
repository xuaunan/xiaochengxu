package com.sunshine.travel.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DriverProfileUpdateRequest {

    @NotBlank(message = "司机昵称不能为空")
    @Size(max = 20, message = "司机昵称长度不能超过20位")
    private String nickname;

    @JsonAlias("city_code")
    @NotBlank(message = "城市编码不能为空")
    @Size(max = 20, message = "城市编码长度不能超过20位")
    private String cityCode;

    @JsonAlias("license_no")
    @NotBlank(message = "驾驶证号不能为空")
    @Size(max = 40, message = "驾驶证号长度不能超过40位")
    private String licenseNo;

    @JsonAlias("emergency_contact")
    @Size(max = 20, message = "紧急联系人长度不能超过20位")
    private String emergencyContact;

    @JsonAlias("emergency_phone")
    @Pattern(regexp = "^$|^\\d{8,16}$", message = "紧急电话需为8-16位纯数字")
    private String emergencyPhone;
}
