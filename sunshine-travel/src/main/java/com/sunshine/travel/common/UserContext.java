package com.sunshine.travel.common;

import com.sunshine.travel.model.AuthUser;

public final class UserContext {

    private static final ThreadLocal<AuthUser> HOLDER = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(AuthUser authUser) {
        HOLDER.set(authUser);
    }

    public static AuthUser get() {
        return HOLDER.get();
    }

    public static Long userId() {
        AuthUser user = HOLDER.get();
        return user == null ? null : user.getUserId();
    }

    public static String role() {
        AuthUser user = HOLDER.get();
        return user == null ? null : user.getRoleCode();
    }

    public static void clear() {
        HOLDER.remove();
    }
}

