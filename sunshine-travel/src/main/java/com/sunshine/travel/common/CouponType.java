package com.sunshine.travel.common;

import java.util.Set;

public final class CouponType {

    public static final String CASH = "CASH";
    public static final String DISCOUNT = "DISCOUNT";

    private static final Set<String> SUPPORTED = Set.of(CASH, DISCOUNT);

    private CouponType() {
    }

    public static boolean isValid(String value) {
        return SUPPORTED.contains(value);
    }
}
