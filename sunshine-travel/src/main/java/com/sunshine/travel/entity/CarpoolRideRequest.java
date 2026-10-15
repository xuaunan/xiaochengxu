package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_carpool_ride_request")
public class CarpoolRideRequest extends BaseEntity {

    private Long passengerUserId;
    private String requestNo;
    private String startName;
    private String endName;
    private LocalDateTime departTime;
    private Integer passengerCount;
    private Boolean acceptCarpool;
    private BigDecimal sharedAmount;
    private String baggageRule;
    private String requestRemark;
    private String status;
}
