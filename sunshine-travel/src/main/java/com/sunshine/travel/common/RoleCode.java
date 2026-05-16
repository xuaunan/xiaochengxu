package com.sunshine.travel.common;

import java.util.Set;

public final class RoleCode {

    public static final String USER = "USER";
    public static final String DRIVER = "DRIVER";
    public static final String ADMIN = "ADMIN";

    private static final Set<String> SUPPORTED = Set.of(USER, DRIVER, ADMIN);

    private RoleCode() {
    }

    public static boolean isValid(String roleCode) {
        return SUPPORTED.contains(roleCode);
    }

    public static Set<String> supported() {
        return SUPPORTED;
    }
}
