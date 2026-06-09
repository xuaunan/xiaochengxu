package com.sunshine.travel.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class NoticeTimeRangeUtilTests {

    @Test
    void blankRangeIsAlwaysActive() {
        assertTrue(NoticeTimeRangeUtil.isActive(null, LocalTime.NOON));
        assertTrue(NoticeTimeRangeUtil.isActive(" ", LocalTime.NOON));
    }

    @Test
    void sameStartAndEndMeansAllDay() {
        assertTrue(NoticeTimeRangeUtil.isActive("09:00-09:00", LocalTime.of(2, 0)));
    }

    @Test
    void daytimeRangeOnlyMatchesInsideWindow() {
        assertTrue(NoticeTimeRangeUtil.isActive("08:30-18:00", LocalTime.of(12, 0)));
        assertFalse(NoticeTimeRangeUtil.isActive("08:30-18:00", LocalTime.of(20, 0)));
    }

    @Test
    void overnightRangeSupportsCrossMidnight() {
        assertTrue(NoticeTimeRangeUtil.isActive("23:00-06:00", LocalTime.of(23, 30)));
        assertTrue(NoticeTimeRangeUtil.isActive("23:00-06:00", LocalTime.of(5, 59)));
        assertFalse(NoticeTimeRangeUtil.isActive("23:00-06:00", LocalTime.of(14, 0)));
    }

    @Test
    void invalidRangeFallsBackToVisible() {
        assertTrue(NoticeTimeRangeUtil.isActive("bad-value", LocalTime.of(14, 0)));
    }
}
