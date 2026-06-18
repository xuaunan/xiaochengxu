package com.sunshine.travel.util;

import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;

public final class ProfileFieldGuard {

    private ProfileFieldGuard() {
    }

    public static String sanitizeRequired(String fieldName, String value) {
        String normalized = normalize(value);
        validate(fieldName, normalized);
        return normalized;
    }

    public static String sanitizeOptional(String fieldName, String value) {
        String normalized = normalize(value);
        validate(fieldName, normalized);
        return normalized;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static void validate(String fieldName, String value) {
        if (value.isEmpty()) {
            return;
        }
        if (looksCorrupted(value)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR,
                    fieldName + "包含异常字符，请检查输入法或编码设置后重试");
        }
    }

    private static boolean looksCorrupted(String value) {
        String normalized = normalize(value);
        return normalized.indexOf('\uFFFD') >= 0
                || normalized.contains("?")
                || normalized.contains("？");
    }
}
