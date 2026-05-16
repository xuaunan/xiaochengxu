package com.sunshine.travel.service;

import com.sunshine.travel.dto.CarpoolApplyRequest;
import com.sunshine.travel.dto.CarpoolCancelRequest;
import com.sunshine.travel.dto.CarpoolConfirmRequest;
import com.sunshine.travel.dto.CarpoolPublishRequest;
import java.util.List;
import java.util.Map;

public interface CarpoolService {

    Map<String, Object> publish(CarpoolPublishRequest request);

    List<Map<String, Object>> search(String keyword);

    Map<String, Object> detail(Long tripId);

    void apply(CarpoolApplyRequest request);

    void ownerConfirm(CarpoolConfirmRequest request);

    void passengerConfirm(CarpoolConfirmRequest request);

    void cancel(CarpoolCancelRequest request);

    Map<String, Object> myTrips();
}
