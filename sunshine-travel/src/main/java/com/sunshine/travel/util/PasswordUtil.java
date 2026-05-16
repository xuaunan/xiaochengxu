package com.sunshine.travel.util;

import cn.hutool.crypto.digest.BCrypt;

public final class PasswordUtil {

    private PasswordUtil() {
    }

    public static String encode(String raw) {
        return BCrypt.hashpw(raw);
    }

    public static boolean matches(String raw, String encoded) {
        return BCrypt.checkpw(raw, encoded);
    }
}
