package com.sunshine.travel.util;

import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.util.StringUtils;

public final class NoticeTimeRangeUtil {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");

    private NoticeTimeRangeUtil() {
    }

    public static boolean activeNow(String displayTimeRange) {
        return isActive(displayTimeRange, LocalTime.now(APP_ZONE));
    }

    public static boolean isActive(String displayTimeRange, LocalTime now) {
        if (!StringUtils.hasText(displayTimeRange)) {
            return true;
        }
        String[] parts = displayTimeRange.trim().split("-");
        if (parts.length != 2) {
            return true;
        }
        try {
            LocalTime start = LocalTime.parse(parts[0].trim());
            LocalTime end = LocalTime.parse(parts[1].trim());
            if (start.equals(end)) {
                return true;
            }
            if (start.isBefore(end)) {
                return !now.isBefore(start) && !now.isAfter(end);
            }
            return !now.isBefore(start) || !now.isAfter(end);
        } catch (RuntimeException ex) {
            return true;
        }
    }
}
