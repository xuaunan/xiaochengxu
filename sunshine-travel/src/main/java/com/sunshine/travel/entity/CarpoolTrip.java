package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_carpool_trip")
public class CarpoolTrip extends BaseEntity {

    private Long ownerUserId;
    private String tripNo;
    private String startName;
    private String endName;
    private LocalDateTime departTime;
    private Integer seatCount;
    private Integer remainSeatCount;
    private BigDecimal sharedAmount;
    private String languageCode;
    private String baggageRule;
    private String tripRemark;
    private String status;
}
