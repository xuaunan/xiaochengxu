package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_carpool_application")
public class CarpoolApplication extends BaseEntity {

    private Long tripId;
    private Long passengerUserId;
    private Integer companionCount;
    private BigDecimal sharedAmount;
    private String applicationStatus;
    private LocalDateTime ownerConfirmedAt;
    private LocalDateTime passengerConfirmedAt;
    private String cancelReason;
    private String note;
}
