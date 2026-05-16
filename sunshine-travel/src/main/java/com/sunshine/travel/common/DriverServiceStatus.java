package com.sunshine.travel.common;

import java.util.Set;

public final class DriverServiceStatus {

    public static final String OFFLINE = "OFFLINE";
    public static final String ONLINE = "ONLINE";
    public static final String BUSY = "BUSY";

    private static final Set<String> SUPPORTED = Set.of(OFFLINE, ONLINE, BUSY);

    private DriverServiceStatus() {
    }

    public static boolean isValid(String value) {
        return SUPPORTED.contains(value);
    }
}
