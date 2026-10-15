package com.sunshine.travel.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class OrderCreateRequestDateFormatTests {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void parsesCarpoolDepartureRangeSentByMiniapp() throws Exception {
        OrderCreateRequest request = objectMapper.readValue("""
                {"carTypeId":1,"serviceType":"CARPOOL","startName":"白云区大岭北街三巷","startLng":"113.2","startLat":"23.1","endName":"广州市统计局","endLng":"113.3","endLat":"23.2","estimatedDistanceKm":8.5,"estimatedDurationMin":25,"dispatchMode":"SMART","carpoolDepartureAt":"2026-09-28T12:00:00","carpoolDepartureEndAt":"2026-09-28T15:00:00","carpoolPassengerCount":2,"remark":"[CARPOOL_META]{}[/CARPOOL_META]"}
                """, OrderCreateRequest.class);

        assertEquals(LocalDateTime.of(2026, 9, 28, 12, 0), request.getCarpoolDepartureAt());
        assertEquals(LocalDateTime.of(2026, 9, 28, 15, 0), request.getCarpoolDepartureEndAt());
    }
}
