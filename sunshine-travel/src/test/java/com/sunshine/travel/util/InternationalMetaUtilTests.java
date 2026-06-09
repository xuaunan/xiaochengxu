package com.sunshine.travel.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class InternationalMetaUtilTests {

    @Test
    void parsesJsonMetaFromRemark() {
        String remark = "[INTERNATIONAL_META]{\"routeCode\":\"PVG-HKG\",\"currencyCode\":\"USD\"}[/INTERNATIONAL_META] Need luggage help | SMART dispatch";

        Map<String, Object> meta = InternationalMetaUtil.parse(remark);

        assertEquals("PVG-HKG", meta.get("routeCode"));
        assertEquals("USD", meta.get("currencyCode"));
    }

    @Test
    void cleanTextRemovesMetaAndDispatchSuffix() {
        String remark = "[INTERNATIONAL_META]{\"routeCode\":\"SZX-HKG\"}[/INTERNATIONAL_META] Meet at gate A | SMART dispatch";

        assertEquals("Meet at gate A", InternationalMetaUtil.cleanText(remark));
    }

    @Test
    void blankRemarkReturnsEmptyMeta() {
        assertTrue(InternationalMetaUtil.parse("").isEmpty());
        assertEquals("", InternationalMetaUtil.cleanText(null));
    }
}
