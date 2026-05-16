package com.sunshine.travel.common;

import java.util.Set;

public final class PayStatus {

    public static final String UNPAID = "UNPAID";
    public static final String PAID = "PAID";
    public static final String REFUNDED = "REFUNDED";

    private static final Set<String> SUPPORTED = Set.of(UNPAID, PAID, REFUNDED);

    private PayStatus() {
    }

    public static boolean isValid(String status) {
        return SUPPORTED.contains(status);
    }
}
