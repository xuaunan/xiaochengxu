package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_withdraw_application")
public class WithdrawApplication extends BaseEntity {

    private Long driverId;
    private BigDecimal applyAmount;
    private String bankAccount;
    private String bankName;
    private String status;
    private String rejectReason;
    private LocalDateTime auditedAt;
    private Long auditedBy;
}
