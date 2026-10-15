package com.sunshine.travel.service;

import com.sunshine.travel.dto.CarpoolCancelRequest;
import com.sunshine.travel.dto.CarpoolConfirmRequest;
import com.sunshine.travel.dto.CarpoolPublishRequest;
import com.sunshine.travel.dto.CarpoolRideRequestCreateRequest;
import java.util.List;
import java.util.Map;

public interface CarpoolService {

    Map<String, Object> publish(CarpoolPublishRequest request);

    Map<String, Object> publishRideRequest(CarpoolRideRequestCreateRequest request);

    List<Map<String, Object>> matchRideRequests(Long tripId);

    void acceptRideRequest(Long requestId, Long tripId);

    void cancelRideRequest(Long requestId, String reason);

    Map<String, Object> detail(Long tripId);

    void ownerConfirm(CarpoolConfirmRequest request);

    void passengerConfirm(CarpoolConfirmRequest request);

    void cancel(CarpoolCancelRequest request);

    void cancelTrip(Long tripId, String reason);

    void finishTrip(Long tripId);

    Map<String, Object> myTrips();
}
