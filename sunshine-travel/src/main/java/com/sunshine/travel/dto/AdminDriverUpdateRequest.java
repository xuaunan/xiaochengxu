package com.sunshine.travel.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminDriverUpdateRequest {

    @NotBlank(message = "司机昵称不能为空")
    @Size(max = 20, message = "司机昵称长度不能超过20位")
    private String nickname;

    @JsonAlias("city_code")
    @NotBlank(message = "城市编码不能为空")
    private String cityCode;

    @JsonAlias("license_no")
    @NotBlank(message = "驾驶证号不能为空")
    private String licenseNo;
}
