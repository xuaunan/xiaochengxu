package com.sunshine.travel.service;

import com.sunshine.travel.dto.ComplaintRequest;
import com.sunshine.travel.dto.EvaluationRequest;
import com.sunshine.travel.dto.MockPayRequest;
import com.sunshine.travel.dto.OrderCreateRequest;
import com.sunshine.travel.dto.OrderFinishRequest;
import com.sunshine.travel.dto.TrackReportRequest;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.TravelTrace;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface OrderService {

    Map<String, Object> estimate(Long carTypeId, String serviceType, BigDecimal distanceKm, BigDecimal durationMin);

    RideOrder createOrder(OrderCreateRequest request);

    RideOrder detail(Long orderId);

    Map<String, Object> runtime(Long orderId);

    void cancelOrder(Long orderId, String reason);

    void acceptOrder(Long orderId);

    void rejectOrder(Long orderId, String reason);

    void startOrder(Long orderId);

    void pickupOrder(Long orderId);

    void finishOrder(Long orderId, OrderFinishRequest request);

    RideOrder mockPay(MockPayRequest request);

    List<RideOrder> currentUserOrders(String roleCode);

    List<RideOrder> waitingOrders();

    void submitEvaluation(EvaluationRequest request);

    void submitComplaint(ComplaintRequest request);

    List<Map<String, Object>> homeBanners();

    void reportTrack(Long orderId, TrackReportRequest request);

    List<TravelTrace> trackHistory(Long orderId);
}
