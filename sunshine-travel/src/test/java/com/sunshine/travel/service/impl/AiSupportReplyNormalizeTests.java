package com.sunshine.travel.service.impl;

import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.service.AiSupportService;
import com.sunshine.travel.service.support.OperationLogSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiSupportReplyNormalizeTests {

    private AiSupportServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AiSupportServiceImpl(Mockito.mock(SystemConfigMapper.class), Mockito.mock(OperationLogSupport.class));
    }

    @Test
    void markerOnlyReplyBecomesTransferAsk() {
        assertEquals(AiSupportService.MANUAL_TRANSFER_ASK, service.normalizeReply("人工", "[转人工]", "MINIAPP"));
        assertEquals(AiSupportService.MANUAL_TRANSFER_ASK, service.normalizeReply("人工", "【转人工】", "WEB"));
    }

    @Test
    void markerWithExtraTextStillBecomesTransferAsk() {
        String modelOutput = "[转人工] 好的，已为您通知人工客服。";
        assertEquals(AiSupportService.MANUAL_TRANSFER_ASK, service.normalizeReply("帮我找人", modelOutput, "MINIAPP"));
    }

    @Test
    void normalReplyKeptAsIsWithoutMarker() {
        String reply = "您最近一笔提现仍在审核中，通过后打款。";
        assertEquals(reply, service.normalizeReply("提现到账", reply, "MINIAPP"));
        assertFalse(service.normalizeReply("提现到账", reply, "MINIAPP").contains("[转人工]"));
    }

    @Test
    void historyPrefixStrippedBeforeMarkerCheck() {
        assertEquals(AiSupportService.MANUAL_TRANSFER_ASK, service.normalizeReply("人工", "AI客服历史回复：[转人工]", "MINIAPP"));
    }
}
