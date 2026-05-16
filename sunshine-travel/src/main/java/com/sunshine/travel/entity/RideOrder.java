package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_ride_order")
public class RideOrder extends BaseEntity {

    private String orderNo;
    private Long userId;
    private Long driverId;
    private Long carTypeId;
    private String serviceType;
    private String orderStatus;
    private String startName;
    private String startLng;
    private String startLat;
    private String endName;
    private String endLng;
    private String endLat;
    private BigDecimal estimatedDistanceKm;
    private BigDecimal estimatedDurationMin;
    private BigDecimal estimatedAmount;
    private BigDecimal couponDiscount;
    private Long userCouponId;
    private BigDecimal payableAmount;
    private BigDecimal actualAmount;
    private BigDecimal actualDistanceKm;
    private BigDecimal actualDurationMin;
    private BigDecimal nightSurchargeAmount;
    private BigDecimal longDistanceSurchargeAmount;
    private BigDecimal platformCommissionAmount;
    private BigDecimal driverIncomeAmount;
    private BigDecimal exchangeRate;
    private String currencyCode;
    private String dispatchMode;
    private String payStatus;
    private String cancelReason;
    private String cancelByRole;
    private BigDecimal cancelFee;
    private BigDecimal refundAmount;
    private String refundReason;
    private LocalDateTime refundedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime paidAt;
    private String invoiceStatus;
    private String evaluationStatus;
    private String complaintStatus;
    private String settlementStatus;
    private String languageCode;
    private String remark;
}
