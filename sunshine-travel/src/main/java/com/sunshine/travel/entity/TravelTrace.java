package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_travel_trace")
public class TravelTrace extends BaseEntity {

    private Long orderId;
    private Long userId;
    private Long driverId;
    private String bizRole;
    private String longitude;
    private String latitude;
    private Boolean waitingRedLight;
    private Long waitSeconds;
    private Long currentWaitSeconds;
    private String trafficText;
    private String waitingText;
    private BigDecimal speedKmh;
    private BigDecimal heading;
    private String remark;
    private LocalDateTime reportedAt;
}
