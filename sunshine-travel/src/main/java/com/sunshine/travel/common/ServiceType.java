package com.sunshine.travel.common;

import java.util.Set;

public final class ServiceType {

    public static final String TAXI = "TAXI";
    public static final String CARPOOL = "CARPOOL";
    public static final String INTERNATIONAL = "INTERNATIONAL";

    private static final Set<String> SUPPORTED = Set.of(TAXI, CARPOOL, INTERNATIONAL);

    private ServiceType() {
    }

    public static boolean isValid(String value) {
        return SUPPORTED.contains(value);
    }

    public static Set<String> supported() {
        return SUPPORTED;
    }
}
