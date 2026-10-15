package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserAuditRequest {

    @NotNull(message = "审核状态不能为空")
    private Integer authStatus;

    @NotBlank(message = "审核备注不能为空")
    private String remark;

    /**
     * 审核范围：ALL=司机资质+车辆资料（默认，兼容旧调用），DRIVER=仅司机资质，VEHICLE=仅车辆资料
     */
    private String scope;
}
