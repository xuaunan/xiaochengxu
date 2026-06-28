package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.SupportConversation;
import com.sunshine.travel.entity.SupportMessage;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.SupportConversationMapper;
import com.sunshine.travel.mapper.SupportMessageMapper;
import com.sunshine.travel.service.AiSupportService;
import com.sunshine.travel.service.SupportService;
import com.sunshine.travel.service.support.AiSupportContextService;
import com.sunshine.travel.service.support.OperationLogSupport;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class SupportServiceImpl implements SupportService {

    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_MANUAL = "MANUAL";
    private static final String STATUS_CLOSED = "CLOSED";
    private static final Duration MANUAL_WARN_TIMEOUT = Duration.ofSeconds(150);
    private static final Duration MANUAL_IDLE_TIMEOUT = Duration.ofMinutes(3);
    private static final String MANUAL_WAIT_WARNING = "人工客服等待时间太久啦，即将为您结束本次人工接待，后续您可以继续由AI客服为您服务。";
    private static final String MEMBER_STATUS_ACTIVE = "ACTIVE";
    private static final String ROLE_AI = "AI";

    private final SupportConversationMapper supportConversationMapper;
    private final SupportMessageMapper supportMessageMapper;
    private final PlatformUserMapper platformUserMapper;
    private final AiSupportService aiSupportService;
    private final AiSupportContextService aiSupportContextService;
    private final OperationLogSupport operationLogSupport;

    public SupportServiceImpl(SupportConversationMapper supportConversationMapper,
                              SupportMessageMapper supportMessageMapper,
                              PlatformUserMapper platformUserMapper,
                              AiSupportService aiSupportService,
                              AiSupportContextService aiSupportContextService,
                              OperationLogSupport operationLogSupport) {
        this.supportConversationMapper = supportConversationMapper;
        this.supportMessageMapper = supportMessageMapper;
        this.platformUserMapper = platformUserMapper;
        this.aiSupportService = aiSupportService;
        this.aiSupportContextService = aiSupportContextService;
        this.operationLogSupport = operationLogSupport;
    }

    @Override
    @Transactional
    public Map<String, Object> currentConversation() {
        SupportConversation conversation = findOrCreateCurrentConversation();
        closeExpiredManualConversation(conversation);
        return mapConversation(conversation);
    }

    @Override
    @Transactional
    public List<Map<String, Object>> currentMessages() {
        SupportConversation conversation = findOrCreateCurrentConversation();
        closeExpiredManualConversation(conversation);
        conversation.setUnreadForUser(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversation.getId());
    }

    @Override
    @Transactional
    public Map<String, Object> sendCurrentMessage(String content) {
        SupportConversation conversation = findOrCreateCurrentConversation();
        closeExpiredManualConversation(conversation);
        SupportMessage message = insertMessage(conversation.getId(), UserContext.userId(), UserContext.role(), content);
        boolean manualActive = STATUS_MANUAL.equals(conversation.getStatus()) || hasManualSupportIntent(message.getContent());
        conversation.setStatus(manualActive ? STATUS_MANUAL : STATUS_OPEN);
        conversation.setLastMessage(message.getContent());
        conversation.setLastMessageAt(message.getCreatedAt());
        conversation.setUnreadForAdmin(safeInt(conversation.getUnreadForAdmin()) + 1);
        conversation.setUnreadForUser(0);
        supportConversationMapper.updateById(conversation);
        if (!manualActive) {
            scheduleAiReply(conversation.getId(), content);
        }
        return mapMessage(message);
    }

    @Override
    public PageResult<Map<String, Object>> adminConversations(long current, long size, String keyword, String role, String status) {
        closeExpiredManualConversations();
        String normalizedRole = StringUtils.hasText(role) ? role.trim().toUpperCase(Locale.ROOT) : "";
        String normalizedStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : "";
        List<Map<String, Object>> rows = supportConversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                        .eq(StringUtils.hasText(normalizedRole), SupportConversation::getUserRole, normalizedRole)
                        .eq(StringUtils.hasText(normalizedStatus), SupportConversation::getStatus, normalizedStatus)
                        .orderByDesc(SupportConversation::getLastMessageAt)
                        .orderByDesc(SupportConversation::getId))
                .stream()
                .map(this::mapConversation)
                .filter(item -> matchesKeyword(item, keyword))
                .toList();
        long total = rows.size();
        int fromIndex = (int) Math.max((current - 1) * size, 0);
        if (fromIndex >= rows.size()) {
            return new PageResult<>(total, current, size, List.of());
        }
        int toIndex = (int) Math.min(fromIndex + size, rows.size());
        return new PageResult<>(total, current, size, rows.subList(fromIndex, toIndex));
    }

    @Override
    @Transactional
    public List<Map<String, Object>> adminMessages(Long conversationId) {
        SupportConversation conversation = requireConversation(conversationId);
        closeExpiredManualConversation(conversation);
        conversation.setUnreadForAdmin(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversationId);
    }

    @Override
    @Transactional
    public Map<String, Object> sendAdminMessage(Long conversationId, String content) {
        SupportConversation conversation = requireConversation(conversationId);
        SupportMessage message = insertMessage(conversationId, UserContext.userId(), RoleCode.ADMIN, content);
        conversation.setStatus(STATUS_MANUAL);
        conversation.setLastMessage(message.getContent());
        conversation.setLastMessageAt(message.getCreatedAt());
        conversation.setUnreadForAdmin(0);
        conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        supportConversationMapper.updateById(conversation);
        operationLogSupport.log("SUPPORT", "REPLY", "SUPPORT_CONVERSATION", conversationId, "客服回复会话");
        return mapMessage(message);
    }

    @Override
    public Map<String, Object> adminAiSuggest(Long conversationId) {
        SupportConversation conversation = requireConversation(conversationId);
        List<Map<String, Object>> rows = listMessageRows(conversationId);
        Map<String, Object> context = aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole());
        String prompt = rows.stream()
                .filter(item -> !Boolean.TRUE.equals(item.get("fromAdmin")) && !Boolean.TRUE.equals(item.get("fromAi")))
                .reduce((first, second) -> second)
                .map(item -> String.valueOf(item.getOrDefault("content", "")))
                .orElse(conversation.getLastMessage());
        String reply = aiSupportService.generateSupportReply(prompt, conversation.getUserRole(), rows, String.valueOf(context.getOrDefault("contextText", "")))
                .orElse("");
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("reply", reply);
        map.put("conversationId", conversationId);
        map.put("aiContext", context);
        return map;
    }

    @Override
    public Map<String, Object> adminAiContext(Long conversationId) {
        SupportConversation conversation = requireConversation(conversationId);
        return aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole());
    }

    @Override
    @Transactional
    public Map<String, Object> updateStatus(Long conversationId, String status) {
        SupportConversation conversation = requireConversation(conversationId);
        String nextStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : STATUS_OPEN;
        if (!List.of(STATUS_OPEN, STATUS_MANUAL, STATUS_CLOSED).contains(nextStatus)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "客服会话状态不合法");
        }
        conversation.setStatus(nextStatus);
        supportConversationMapper.updateById(conversation);
        operationLogSupport.log("SUPPORT", "STATUS", "SUPPORT_CONVERSATION", conversationId, "客服会话状态更新为：" + nextStatus);
        return mapConversation(conversation);
    }

    private SupportConversation findOrCreateCurrentConversation() {
        Long userId = UserContext.userId();
        String role = UserContext.role();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!List.of(RoleCode.USER, RoleCode.DRIVER).contains(role)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前角色不支持小程序客服会话");
        }
        SupportConversation conversation = supportConversationMapper.selectOne(new LambdaQueryWrapper<SupportConversation>()
                .eq(SupportConversation::getUserId, userId)
                .eq(SupportConversation::getUserRole, role)
                .last("limit 1"));
        if (conversation != null) {
            return conversation;
        }
        LocalDateTime now = LocalDateTime.now();
        SupportConversation next = new SupportConversation();
        next.setUserId(userId);
        next.setUserRole(role);
        next.setStatus(STATUS_OPEN);
        next.setLastMessage("已进入在线客服");
        next.setLastMessageAt(now);
        next.setUnreadForAdmin(0);
        next.setUnreadForUser(0);
        next.setCreatedAt(now);
        next.setUpdatedAt(now);
        supportConversationMapper.insert(next);
        SupportMessage welcome = insertMessage(next.getId(), null, RoleCode.ADMIN, "您好，阳光出行客服已接入，请描述您遇到的问题。");
        next.setLastMessage(welcome.getContent());
        next.setLastMessageAt(welcome.getCreatedAt());
        supportConversationMapper.updateById(next);
        return next;
    }

    private SupportMessage insertMessage(Long conversationId, Long senderId, String senderRole, String content) {
        LocalDateTime now = LocalDateTime.now();
        SupportMessage message = new SupportMessage();
        message.setConversationId(conversationId);
        message.setSenderId(senderId);
        message.setSenderRole(senderRole);
        message.setContent(normalizeContent(content));
        message.setCreatedAt(now);
        message.setUpdatedAt(now);
        supportMessageMapper.insert(message);
        return message;
    }

    private String normalizeContent(String content) {
        return content == null ? "" : content.trim();
    }

    private void insertAiReplyIfAvailable(SupportConversation conversation, String userContent) {
        SupportConversation latestConversation = supportConversationMapper.selectById(conversation.getId());
        if (latestConversation == null || STATUS_MANUAL.equals(latestConversation.getStatus())) {
            return;
        }
        List<Map<String, Object>> recentMessages = listMessageRows(conversation.getId());
        Map<String, Object> context = aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole());
        aiSupportService.generateSupportReply(userContent, conversation.getUserRole(), recentMessages, String.valueOf(context.getOrDefault("contextText", "")))
                .filter(StringUtils::hasText)
                .map(reply -> insertMessage(conversation.getId(), null, ROLE_AI, reply))
                .ifPresent(replyMessage -> {
                    SupportConversation current = supportConversationMapper.selectById(conversation.getId());
                    if (current == null || STATUS_MANUAL.equals(current.getStatus())) {
                        return;
                    }
                    current.setStatus(hasManualSupportIntent(replyMessage.getContent()) ? STATUS_MANUAL : STATUS_OPEN);
                    current.setLastMessage(replyMessage.getContent());
                    current.setLastMessageAt(replyMessage.getCreatedAt());
                    current.setUnreadForUser(safeInt(current.getUnreadForUser()) + 1);
                    supportConversationMapper.updateById(current);
                });
    }

    private void scheduleAiReply(Long conversationId, String userContent) {
        Runnable task = () -> CompletableFuture.runAsync(() -> {
            try {
                SupportConversation latest = supportConversationMapper.selectById(conversationId);
                if (latest != null) {
                    insertAiReplyIfAvailable(latest, userContent);
                }
            } catch (Exception ex) {
                log.warn("AI support reply failed, conversationId={}", conversationId, ex);
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
            return;
        }
        task.run();
    }

    private SupportConversation requireConversation(Long conversationId) {
        SupportConversation conversation = supportConversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "客服会话不存在");
        }
        return conversation;
    }

    private List<Map<String, Object>> listMessageRows(Long conversationId) {
        Page<SupportMessage> page = supportMessageMapper.selectPage(new Page<>(1, 200), new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .orderByAsc(SupportMessage::getId));
        return page.getRecords().stream().map(this::mapMessage).toList();
    }

    private Map<String, Object> mapConversation(SupportConversation conversation) {
        PlatformUser user = platformUserMapper.selectById(conversation.getUserId());
        boolean member = isActiveMember(user);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", conversation.getId());
        map.put("userId", conversation.getUserId());
        map.put("userRole", conversation.getUserRole());
        map.put("roleText", RoleCode.DRIVER.equals(conversation.getUserRole()) ? "司机" : "乘客");
        map.put("nickname", user == null ? "" : user.getNickname());
        map.put("phone", user == null ? "" : user.getPhone());
        map.put("member", member);
        map.put("memberLevel", member ? user.getMemberLevel() : "");
        map.put("status", conversation.getStatus());
        map.put("manualMode", STATUS_MANUAL.equals(conversation.getStatus()));
        map.put("lastMessage", conversation.getLastMessage());
        map.put("lastMessageAt", conversation.getLastMessageAt());
        map.put("unreadForAdmin", safeInt(conversation.getUnreadForAdmin()));
        map.put("unreadForUser", safeInt(conversation.getUnreadForUser()));
        map.put("createdAt", conversation.getCreatedAt());
        return map;
    }

    private Map<String, Object> mapMessage(SupportMessage message) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", message.getId());
        map.put("conversationId", message.getConversationId());
        map.put("senderId", message.getSenderId());
        map.put("senderRole", message.getSenderRole());
        map.put("fromAdmin", RoleCode.ADMIN.equals(message.getSenderRole()));
        map.put("fromAi", ROLE_AI.equals(message.getSenderRole()));
        map.put("content", message.getContent());
        map.put("createdAt", message.getCreatedAt());
        return map;
    }

    private boolean matchesKeyword(Map<String, Object> item, String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        String target = keyword.trim();
        return contains(item.get("nickname"), target)
                || contains(item.get("phone"), target)
                || contains(item.get("lastMessage"), target);
    }

    private boolean contains(Object value, String keyword) {
        return value != null && value.toString().contains(keyword);
    }

    private boolean isActiveMember(PlatformUser user) {
        return user != null
                && RoleCode.USER.equals(user.getRoleCode())
                && MEMBER_STATUS_ACTIVE.equalsIgnoreCase(user.getMemberStatus())
                && user.getMemberExpireAt() != null
                && !user.getMemberExpireAt().isBefore(LocalDateTime.now());
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private void closeExpiredManualConversations() {
        supportConversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                        .eq(SupportConversation::getStatus, STATUS_MANUAL))
                .forEach(this::closeExpiredManualConversation);
    }

    private boolean closeExpiredManualConversation(SupportConversation conversation) {
        if (conversation == null || !STATUS_MANUAL.equals(conversation.getStatus())) {
            return false;
        }
        SupportMessage lastAdminMessage = latestMessageByRole(conversation.getId(), RoleCode.ADMIN);
        SupportMessage lastUserMessage = latestUserMessage(conversation.getId());
        LocalDateTime manualAnchorAt = lastAdminMessage == null ? null : lastAdminMessage.getCreatedAt();
        if (manualAnchorAt == null && lastUserMessage != null) {
            manualAnchorAt = lastUserMessage.getCreatedAt();
        }
        if (manualAnchorAt == null) {
            return false;
        }
        boolean userRepliedAfterAdmin = lastAdminMessage != null
                && lastUserMessage != null
                && lastUserMessage.getCreatedAt() != null
                && lastUserMessage.getCreatedAt().isAfter(lastAdminMessage.getCreatedAt());
        if (userRepliedAfterAdmin) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        if (!manualAnchorAt.isAfter(now.minus(MANUAL_WARN_TIMEOUT)) && !hasManualWaitWarningAfter(conversation.getId(), manualAnchorAt)) {
            SupportMessage warning = insertMessage(conversation.getId(), null, ROLE_AI, MANUAL_WAIT_WARNING);
            conversation.setLastMessage(warning.getContent());
            conversation.setLastMessageAt(warning.getCreatedAt());
            conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
            supportConversationMapper.updateById(conversation);
        }
        if (manualAnchorAt.isAfter(now.minus(MANUAL_IDLE_TIMEOUT))) {
            return false;
        }
        conversation.setStatus(STATUS_OPEN);
        supportConversationMapper.updateById(conversation);
        return true;
    }

    private boolean hasManualWaitWarningAfter(Long conversationId, LocalDateTime since) {
        if (conversationId == null || since == null) {
            return false;
        }
        return supportMessageMapper.selectCount(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, ROLE_AI)
                .eq(SupportMessage::getContent, MANUAL_WAIT_WARNING)
                .gt(SupportMessage::getCreatedAt, since)) > 0;
    }

    private SupportMessage latestMessageByRole(Long conversationId, String role) {
        if (conversationId == null || !StringUtils.hasText(role)) {
            return null;
        }
        return supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, role)
                .orderByDesc(SupportMessage::getId)
                .last("limit 1"));
    }

    private SupportMessage latestUserMessage(Long conversationId) {
        if (conversationId == null) {
            return null;
        }
        return supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .ne(SupportMessage::getSenderRole, RoleCode.ADMIN)
                .ne(SupportMessage::getSenderRole, ROLE_AI)
                .orderByDesc(SupportMessage::getId)
                .last("limit 1"));
    }

    private boolean hasManualSupportIntent(String content) {
        if (!StringUtils.hasText(content)) {
            return false;
        }
        String normalized = content.replaceAll("\\s+", "").trim().toLowerCase(Locale.ROOT);
        return normalized.contains("联系人工")
                || normalized.contains("人工客服")
                || normalized.contains("转人工")
                || normalized.contains("找人工")
                || normalized.contains("转接人工")
                || normalized.contains("真人客服")
                || normalized.contains("人工跟进")
                || normalized.contains("账户资金异常")
                || normalized.contains("安全事故");
    }
}
