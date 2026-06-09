package com.sunshine.travel.util;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.util.StringUtils;

public final class InternationalMetaUtil {

    public static final String START_TAG = "[INTERNATIONAL_META]";
    public static final String END_TAG = "[/INTERNATIONAL_META]";

    private InternationalMetaUtil() {
    }

    public static Map<String, Object> parse(String remark) {
        Map<String, Object> result = new LinkedHashMap<>();
        String body = readBody(remark);
        if (!StringUtils.hasText(body)) {
            return result;
        }

        String trimmed = body.trim();
        if (trimmed.startsWith("{")) {
            try {
                JSONObject object = JSONUtil.parseObj(trimmed);
                for (String key : object.keySet()) {
                    result.put(key, object.get(key));
                }
                return result;
            } catch (Exception ignored) {
                result.clear();
            }
        }

        for (String part : trimmed.split(";")) {
            String[] pair = part.split("=", 2);
            if (pair.length == 2 && StringUtils.hasText(pair[0])) {
                result.put(pair[0].trim(), pair[1].trim());
            }
        }
        return result;
    }

    public static String strip(String remark) {
        if (!StringUtils.hasText(remark)) {
            return "";
        }
        return remark.replaceAll("\\[INTERNATIONAL_META\\][\\s\\S]*?\\[/INTERNATIONAL_META\\]", "").trim();
    }

    public static String cleanText(String remark) {
        return strip(remark).replaceAll("\\s*\\|\\s*(SMART dispatch|Manual dispatch)\\s*$", "").trim();
    }

    private static String readBody(String remark) {
        if (!StringUtils.hasText(remark)) {
            return "";
        }
        int start = remark.indexOf(START_TAG);
        int end = remark.indexOf(END_TAG);
        if (start < 0 || end <= start) {
            return "";
        }
        return remark.substring(start + START_TAG.length(), end);
    }
}
