package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_driver_profile")
public class DriverProfile extends BaseEntity {

    private Long userId;
    private String driverNo;
    private String licenseNo;
    private String serviceStatus;
    private Integer auditStatus;
    private BigDecimal score;
    private BigDecimal totalIncome;
    private BigDecimal withdrawableIncome;
    private String cityCode;
    private String lastLongitude;
    private String lastLatitude;
    private String auditRemark;
}
