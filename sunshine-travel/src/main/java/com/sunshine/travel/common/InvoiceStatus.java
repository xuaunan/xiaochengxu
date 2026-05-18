package com.sunshine.travel.common;

import java.util.Set;

public final class InvoiceStatus {

    public static final String NONE = "NONE";
    public static final String APPLIED = "APPLIED";
    public static final String ISSUED = "ISSUED";
    public static final String REJECTED = "REJECTED";

    private static final Set<String> SUPPORTED = Set.of(NONE, APPLIED, ISSUED, REJECTED);

    private InvoiceStatus() {
    }

    public static boolean isValid(String status) {
        return status != null && SUPPORTED.contains(status);
    }
}
