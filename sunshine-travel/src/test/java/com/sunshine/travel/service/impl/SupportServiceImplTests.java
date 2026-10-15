package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.SupportConversationMapper;
import com.sunshine.travel.mapper.SupportMessageMapper;
import com.sunshine.travel.model.AuthUser;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.service.AiSupportService;
import com.sunshine.travel.service.support.AiSupportContextService;
import com.sunshine.travel.service.support.OperationLogSupport;
import com.sunshine.travel.entity.SupportConversation;
import com.sunshine.travel.entity.SupportMessage;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证 AI 回复的并发防护：迟到回复丢弃、人工接管丢弃、重复兜底去重。
 * 通过 mock 全部依赖真实执行 sendCurrentMessage 的异步链路。
 */
class SupportServiceImplTests {

    private static final String FALLBACK_REPLY = "AI客服暂时没有响应，已转接人工客服。";
    private static final long CONVERSATION_ID = 5L;

    private SupportConversationMapper supportConversationMapper;
    private SupportMessageMapper supportMessageMapper;
    private PlatformUserMapper platformUserMapper;
    private AiSupportService aiSupportService;
    private AiSupportContextService aiSupportContextService;
    private OperationLogSupport operationLogSupport;
    private SupportServiceImpl service;
    private SupportConversation conversation;
    private AtomicLong messageIdSequence;

    @BeforeEach
    void setUp() {
        supportConversationMapper = mock(SupportConversationMapper.class);
        supportMessageMapper = mock(SupportMessageMapper.class);
        platformUserMapper = mock(PlatformUserMapper.class);
        aiSupportService = mock(AiSupportService.class);
        aiSupportContextService = mock(AiSupportContextService.class);
        operationLogSupport = mock(OperationLogSupport.class);
        service = new SupportServiceImpl(supportConversationMapper, supportMessageMapper, platformUserMapper,
                aiSupportService, aiSupportContextService, operationLogSupport);

        conversation = new SupportConversation();
        conversation.setId(CONVERSATION_ID);
        conversation.setUserId(2L);
        conversation.setUserRole(RoleCode.DRIVER);
        conversation.setChannel("MINIAPP");
        conversation.setStatus("OPEN");
        conversation.setLastMessageAt(LocalDateTime.now());
        conversation.setUnreadForAdmin(0);
        conversation.setUnreadForUser(0);
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);

        messageIdSequence = new AtomicLong(100);
        when(supportMessageMapper.insert(any(SupportMessage.class))).thenAnswer(invocation -> {
            SupportMessage message = invocation.getArgument(0);
            message.setId(messageIdSequence.incrementAndGet());
            return 1;
        });
        UserContext.set(AuthUser.builder().userId(2L).roleCode(RoleCode.DRIVER).build());
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void aiReplyInsertedForLatestUserMessage() {
        stubCommonReads(List.of(userMessage(101L, "提现到账")));
        when(aiSupportService.generateSupportReply(any(), any(), any(), any(), any()))
                .thenReturn(Optional.of("您最近一笔提现仍在审核中，通过后打款。"));

        service.sendCurrentMessage("提现到账", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage aiReply = messageCaptor.getAllValues().get(1);
        assertEquals("AI", aiReply.getSenderRole(), "AI 回复应以 AI 角色落库");
        assertEquals("您最近一笔提现仍在审核中，通过后打款。", aiReply.getContent());

        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("您最近一笔提现仍在审核中，通过后打款。", lastUpdate.getLastMessage(), "会话最后消息应更新为 AI 回复");
    }

    @Test
    void repeatedFallbackReplacedByGuidanceAndStaysOpen() {
        stubCommonReads(List.of(
                userMessage(101L, "提现到账"),
                aiMessage(102L, FALLBACK_REPLY)));
        when(aiSupportService.generateSupportReply(any(), any(), any(), any(), any()))
                .thenReturn(Optional.of(FALLBACK_REPLY));

        service.sendCurrentMessage("提现到账", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage secondInsert = messageCaptor.getAllValues().get(1);
        assertTrue(secondInsert.getContent().contains("更具体"), "重复兜底应替换为引导文案");
        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("OPEN", lastUpdate.getStatus(), "重复兜底不应自动转人工");
    }

    @Test
    void staleGenerationDiscardedWhenNewerUserMessageExists() {
        stubCommonReads(List.of(userMessage(101L, "提现到账")));
        when(supportMessageMapper.selectCount(any())).thenReturn(1L);

        service.sendCurrentMessage("提现到账", "MINIAPP");

        verify(aiSupportService, after(1500).never()).generateSupportReply(any(), any(), any(), any(), any());
        verify(supportMessageMapper, after(1500).times(1)).insert(any(SupportMessage.class));
    }

    @Test
    void generationDiscardedWhenConversationTurnsManual() {
        stubCommonReads(List.of(userMessage(101L, "提现到账")));
        when(supportConversationMapper.selectById(CONVERSATION_ID)).thenAnswer(invocation -> {
            conversation.setStatus("MANUAL");
            return conversation;
        });

        service.sendCurrentMessage("提现到账", "MINIAPP");

        verify(aiSupportService, after(1500).never()).generateSupportReply(any(), any(), any(), any(), any());
        verify(supportMessageMapper, after(1500).times(1)).insert(any(SupportMessage.class));
    }

    @Test
    void repeatedNormalReplyReplacedByGuidanceAndStaysOpen() {
        stubCommonReads(List.of(
                userMessage(101L, "提现到账"),
                aiMessage(102L, "您最近一笔提现仍在审核中，通过后打款。")));
        when(aiSupportService.generateSupportReply(any(), any(), any(), any(), any()))
                .thenReturn(Optional.of("您最近一笔提现仍在审核中，通过后打款。"));

        service.sendCurrentMessage("提现到账", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage secondInsert = messageCaptor.getAllValues().get(1);
        assertTrue(secondInsert.getContent().contains("更具体"), "普通复读应替换为引导补充信息的文案");
        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("OPEN", lastUpdate.getStatus(), "普通复读不应把会话转成人工");
    }

    @Test
    void transferRequestRepliesWithPendingTextAndStaysOpenForAdminPickup() {
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);
        when(supportConversationMapper.selectById(CONVERSATION_ID)).thenReturn(conversation);
        when(supportMessageMapper.selectOne(any())).thenReturn(null);
        stubEmptyMessagePage();

        service.sendCurrentMessage("联系人工", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage transferReply = messageCaptor.getAllValues().get(1);
        assertEquals("正在为您转接人工客服，请稍后", transferReply.getContent(), "转人工应先回复排队提示");
        assertEquals("AI", transferReply.getSenderRole());
        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("OPEN", lastUpdate.getStatus(), "等待人工接入期间会话保持待接入（后台显示开启对话）");
        verify(aiSupportService, after(1500).never()).generateSupportReply(any(), any(), any(), any(), any());
    }

    @Test
    void aiTransferAskWaitsForUserConfirmationBeforeQueue() {
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);
        when(supportConversationMapper.selectById(CONVERSATION_ID)).thenReturn(conversation);
        stubEmptyMessagePage();
        when(supportMessageMapper.selectCount(any())).thenReturn(0L);
        SupportMessage askReply = new SupportMessage();
        askReply.setId(120L);
        askReply.setConversationId(CONVERSATION_ID);
        askReply.setSenderRole("AI");
        askReply.setContent(AiSupportService.MANUAL_TRANSFER_ASK);
        when(supportMessageMapper.selectOne(any())).thenAnswer(inv -> {
            LambdaQueryWrapper<SupportMessage> wrapper = inv.getArgument(0);
            String sql = wrapper.getSqlSegment().toLowerCase();
            if (sql.contains("content")) {
                return null;
            }
            if (sql.contains("sender_role")) {
                return askReply;
            }
            return null;
        });
        when(aiSupportService.generateSupportReply(any(), any(), any(), any(), any()))
                .thenReturn(Optional.of(AiSupportService.MANUAL_TRANSFER_ASK));

        service.sendCurrentMessage("这个问题解决不了", "MINIAPP");
        verify(aiSupportService, timeout(3000)).generateSupportReply(any(), any(), any(), any(), any());
        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage aiInsert = messageCaptor.getAllValues().stream()
                .filter(m -> "AI".equals(m.getSenderRole())).findFirst().orElseThrow();
        assertEquals(AiSupportService.MANUAL_TRANSFER_ASK, aiInsert.getContent(), "AI判断转人工应先发征询文案");

        service.sendCurrentMessage("确认", "MINIAPP");
        ArgumentCaptor<SupportMessage> allInserts = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(4)).insert(allInserts.capture());
        SupportMessage queueReply = allInserts.getAllValues().stream()
                .filter(m -> "正在为您转接人工客服，请稍后".equals(m.getContent()))
                .findFirst().orElseThrow(() -> new AssertionError("用户确认后未进入排队, 实际插入: "
                        + allInserts.getAllValues().stream()
                                .map(m -> "[" + m.getSenderRole() + "]" + m.getContent())
                                .collect(java.util.stream.Collectors.joining(" , "))));
        assertEquals("正在为您转接人工客服，请稍后", queueReply.getContent(), "用户确认后才进入排队");
        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("OPEN", lastUpdate.getStatus(), "确认后进入排队等待，真正接入仍需管理员开启");
        verify(aiSupportService, times(1)).generateSupportReply(any(), any(), any(), any(), any());
    }

    @Test
    void pendingManualRemindSentAfterSixtySeconds() {
        SupportMessage transferReply = new SupportMessage();
        transferReply.setId(90L);
        transferReply.setConversationId(CONVERSATION_ID);
        transferReply.setSenderRole("AI");
        transferReply.setContent("正在为您转接人工客服，请稍后");
        transferReply.setCreatedAt(LocalDateTime.now().minusSeconds(120));
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);
        when(supportMessageMapper.selectOne(any())).thenReturn(transferReply, null, transferReply);
        when(supportMessageMapper.selectCount(any())).thenReturn(0L);
        stubEmptyMessagePage();

        service.sendCurrentMessage("在吗", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage remind = messageCaptor.getAllValues().get(0);
        assertEquals("当前时段咨询量较大，请稍等。", remind.getContent(), "等待接入超过60秒应发送排队提醒");
        assertEquals("ADMIN", remind.getSenderRole());
        verify(aiSupportService, after(1500).never()).generateSupportReply(any(), any(), any(), any(), any());
    }

    @Test
    void aiSilentWhileWaitingForManualPickup() {
        SupportMessage transferReply = new SupportMessage();
        transferReply.setId(90L);
        transferReply.setConversationId(CONVERSATION_ID);
        transferReply.setSenderRole("AI");
        transferReply.setContent("正在为您转接人工客服，请稍后");
        transferReply.setCreatedAt(LocalDateTime.now().minusSeconds(10));
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);
        when(supportMessageMapper.selectOne(any())).thenReturn(transferReply, null, transferReply);
        when(supportMessageMapper.selectCount(any())).thenReturn(0L);
        stubEmptyMessagePage();

        service.sendCurrentMessage("在吗", "MINIAPP");

        verify(supportMessageMapper, timeout(3000).times(1)).insert(any(SupportMessage.class));
        verify(aiSupportService, after(1500).never()).generateSupportReply(any(), any(), any(), any(), any());
    }

    @Test
    void aiJudgedTransferKeepsQueueStateAndStaysOpen() {
        when(supportConversationMapper.selectOne(any())).thenReturn(conversation);
        when(supportConversationMapper.selectById(CONVERSATION_ID)).thenReturn(conversation);
        stubEmptyMessagePage();
        // 模拟 AI 自行判断需要人工：normalizeReply 已把模型输出转成统一排队提示
        when(aiSupportService.generateSupportReply(any(), any(), any(), any(), any()))
                .thenReturn(Optional.of("正在为您转接人工客服，请稍后"));

        service.sendCurrentMessage("人工", "MINIAPP");

        ArgumentCaptor<SupportMessage> messageCaptor = ArgumentCaptor.forClass(SupportMessage.class);
        verify(supportMessageMapper, timeout(3000).times(2)).insert(messageCaptor.capture());
        SupportMessage aiReply = messageCaptor.getAllValues().get(1);
        assertEquals("正在为您转接人工客服，请稍后", aiReply.getContent(), "AI判断转人工应回复排队提示");
        ArgumentCaptor<SupportConversation> conversationCaptor = ArgumentCaptor.forClass(SupportConversation.class);
        verify(supportConversationMapper, timeout(3000).atLeastOnce()).updateById(conversationCaptor.capture());
        SupportConversation lastUpdate = conversationCaptor.getAllValues().get(conversationCaptor.getAllValues().size() - 1);
        assertEquals("OPEN", lastUpdate.getStatus(), "AI判断的转人工保持待接入（后台显示开启对话）");
    }

    private void stubEmptyMessagePage() {
        Page<SupportMessage> page = new Page<>(1, 200);
        page.setRecords(List.of());
        when(supportMessageMapper.selectPage(any(), any())).thenReturn(page);
    }

    private void stubCommonReads(List<SupportMessage> existingMessages) {
        when(supportConversationMapper.selectById(CONVERSATION_ID)).thenReturn(conversation);
        when(supportMessageMapper.selectCount(any())).thenReturn(0L);
        Page<SupportMessage> page = new Page<>(1, 200);
        page.setRecords(existingMessages);
        when(supportMessageMapper.selectPage(any(), any())).thenReturn(page);
        when(aiSupportContextService.buildContext(any(), any(), any(), any(), any()))
                .thenReturn(Map.of("contextText", "测试上下文"));
    }

    private SupportMessage userMessage(long id, String content) {
        SupportMessage message = new SupportMessage();
        message.setId(id);
        message.setConversationId(CONVERSATION_ID);
        message.setSenderId(2L);
        message.setSenderRole(RoleCode.DRIVER);
        message.setContent(content);
        message.setCreatedAt(LocalDateTime.now());
        return message;
    }

    private SupportMessage aiMessage(long id, String content) {
        SupportMessage message = new SupportMessage();
        message.setId(id);
        message.setConversationId(CONVERSATION_ID);
        message.setSenderRole("AI");
        message.setContent(content);
        message.setCreatedAt(LocalDateTime.now());
        return message;
    }
}
