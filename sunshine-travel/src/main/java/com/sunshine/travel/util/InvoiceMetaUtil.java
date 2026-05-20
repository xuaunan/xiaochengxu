package com.sunshine.travel.util;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.util.StringUtils;

public final class InvoiceMetaUtil {

    public static final String START_TAG = "[INVOICE_META]";
    public static final String END_TAG = "[/INVOICE_META]";

    private InvoiceMetaUtil() {
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

    public static String read(String remark, String key) {
        Object value = parse(remark).get(key);
        return value == null ? "" : String.valueOf(value);
    }

    public static String rewrite(String remark, Map<String, Object> meta) {
        String cleanRemark = strip(remark);
        String payload = JSONUtil.toJsonStr(meta == null ? Map.of() : meta);
        String invoiceBlock = START_TAG + payload + END_TAG;
        return StringUtils.hasText(cleanRemark) ? cleanRemark + " " + invoiceBlock : invoiceBlock;
    }

    public static String strip(String remark) {
        if (!StringUtils.hasText(remark)) {
            return "";
        }
        return remark.replaceAll("\\[INVOICE_META\\][\\s\\S]*?\\[/INVOICE_META\\]", "").trim();
    }

    public static String text(Map<String, Object> meta, String key) {
        if (meta == null || !StringUtils.hasText(key)) {
            return "";
        }
        Object value = meta.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    public static String firstText(Map<String, Object> meta, String... keys) {
        if (keys == null) {
            return "";
        }
        for (String key : keys) {
            String value = text(meta, key);
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return "";
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
