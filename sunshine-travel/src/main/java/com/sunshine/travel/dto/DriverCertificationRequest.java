package com.sunshine.travel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DriverCertificationRequest {

    @NotBlank(message = "驾驶证号不能为空")
    private String licenseNo;

    @NotBlank(message = "车牌号不能为空")
    private String plateNo;

    @NotBlank(message = "品牌不能为空")
    private String brand;

    @NotBlank(message = "车型不能为空")
    private String modelName;

    @NotBlank(message = "车辆颜色不能为空")
    private String color;

    @NotNull(message = "座位数不能为空")
    @Min(value = 4, message = "座位数不能小于4")
    private Integer seatCount;

    @NotBlank(message = "保险到期日不能为空")
    private String insuranceExpireDate;

    @NotBlank(message = "年检到期日不能为空")
    private String annualInspectExpireDate;

    @NotBlank(message = "请上传行驶证照片")
    private String vehicleLicenseImageUrl;

    @NotBlank(message = "请上传驾驶证照片")
    private String driverLicenseImageUrl;
}
