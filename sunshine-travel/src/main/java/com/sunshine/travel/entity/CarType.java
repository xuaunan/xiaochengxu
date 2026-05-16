package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_car_type")
public class CarType extends BaseEntity {

    private String serviceCode;
    private String name;
    private String icon;
    private BigDecimal startPrice;
    private BigDecimal startDistanceKm;
    private BigDecimal distancePrice;
    private BigDecimal durationPrice;
    private BigDecimal longDistancePrice;
    private BigDecimal nightSurcharge;
    private BigDecimal crossBorderBasePrice;
    private Integer enabled;
}

