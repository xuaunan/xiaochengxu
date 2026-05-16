package com.sunshine.travel.vo;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardVO {

    private String range;
    private Long todayOrderTotal;
    private BigDecimal todayTurnover;
    private Long activeUserTotal;
    private BigDecimal complaintRate;
    private Long userTotal;
    private Long verifiedUserTotal;
    private Long unverifiedUserTotal;
    private Long newUserDelta;
    private Long driverTotal;
    private Long approvedDriverTotal;
    private Long pendingDriverTotal;
    private Long newDriverDelta;
    private Long orderTotal;
    private Long taxiOrderTotal;
    private Long carpoolOrderTotal;
    private Long internationalOrderTotal;
    private Long newOrderDelta;
    private BigDecimal turnoverTotal;
    private BigDecimal yesterdayTurnover;
    private BigDecimal turnoverDeltaRate;
    private BigDecimal taxiTurnover;
    private BigDecimal carpoolTurnover;
    private BigDecimal internationalTurnover;
    private BigDecimal commissionTotal;
    private BigDecimal yesterdayCommission;
    private BigDecimal commissionDeltaRate;
    private BigDecimal complaintResolveRate;
    private Long complaintTotal;
    private Long resolvedComplaintTotal;
    private Long unresolvedComplaintTotal;
    private List<Map<String, Object>> trend;
    private List<Map<String, Object>> latestOrders;
    private Map<String, Object> businessShare;
    private Map<String, Object> operations;
    private List<Map<String, Object>> userCityDistribution;
    private Map<String, List<Map<String, Object>>> rideRegionDistribution;
    private List<Map<String, Object>> driverScoreDistribution;
    private String generatedAt;
}
