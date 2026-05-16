package com.sunshine.travel.common;

import java.util.List;
import java.util.Set;

public final class OrderStatus {

    public static final String CREATED = "CREATED";
    public static final String DISPATCHING = "DISPATCHING";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String PICKING_UP = "PICKING_UP";
    public static final String IN_TRIP = "IN_TRIP";
    public static final String FINISHED = "FINISHED";
    public static final String CANCELLED = "CANCELLED";

    private static final Set<String> TERMINAL_STATUS = Set.of(FINISHED, CANCELLED);
    private static final Set<String> SUPPORTED = Set.of(CREATED, DISPATCHING, ACCEPTED, PICKING_UP, IN_TRIP, FINISHED, CANCELLED);

    private OrderStatus() {
    }

    public static boolean isValid(String status) {
        return SUPPORTED.contains(status);
    }

    public static boolean isTerminal(String status) {
        return TERMINAL_STATUS.contains(status);
    }

    public static boolean canTransfer(String currentStatus, String targetStatus) {
        return switch (currentStatus) {
            case CREATED -> List.of(DISPATCHING, CANCELLED).contains(targetStatus);
            case DISPATCHING -> List.of(ACCEPTED, CANCELLED).contains(targetStatus);
            case ACCEPTED -> List.of(PICKING_UP, CANCELLED).contains(targetStatus);
            case PICKING_UP -> List.of(IN_TRIP, CANCELLED).contains(targetStatus);
            case IN_TRIP -> FINISHED.equals(targetStatus);
            default -> false;
        };
    }
}
