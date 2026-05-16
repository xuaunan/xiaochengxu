package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_vehicle")
public class Vehicle extends BaseEntity {

    private Long driverId;
    private String plateNo;
    private String brand;
    private String modelName;
    private String color;
    private Integer seatCount;
    private String insuranceExpireDate;
    private String annualInspectExpireDate;
    private String vehicleLicenseImageUrl;
    private String driverLicenseImageUrl;
    private Integer auditStatus;
    private String auditRemark;
}
