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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
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
    private static final Duration MANUAL_PENDING_REMIND_TIMEOUT = Duration.ofSeconds(60);
    private static final String MANUAL_WAIT_WARNING = "人工客服等待时间太久啦，即将为您结束本次人工接待，后续您可以继续由AI客服为您服务。";
    private static final String MANUAL_OPEN_NOTICE = "已接入人工客服";
    private static final String MANUAL_CLOSE_NOTICE = "已关闭人工客服";
    private static final String MANUAL_PENDING_REMIND = "当前时段咨询量较大，请稍等。";
    private static final String MANUAL_TRANSFER_REPLY = AiSupportService.MANUAL_TRANSFER_REPLY;
    private static final String MANUAL_TRANSFER_ASK = AiSupportService.MANUAL_TRANSFER_ASK;
    private static final String REPEATED_REPLY_NOTICE = "抱歉，刚才的回复可能没有完全解决您的问题。您可以把问题说得更具体一点（例如订单号、金额、时间或所在页面），我再帮您进一步核实。";
    private static final String EMERGENCY_SUPPORT_PREFIX = "【紧急安全求助】";
    private static final String DEFAULT_AI_WELCOME_MESSAGE = "您好，阳光出行客服已接入，请描述您遇到的问题。";
    private static final String PREVIOUS_AI_WELCOME_MESSAGE = "您好，阳光出行AI客服已接入，请描述您遇到的问题。";
    private static final String LEGACY_DEFAULT_WELCOME_MESSAGE = "您好，阳光出行客服已接入，请描述您遇到的问题。";
    private static final String MEMBER_STATUS_ACTIVE = "ACTIVE";
    private static final String ROLE_AI = "AI";
    private static final String CHANNEL_MINIAPP = "MINIAPP";
    private static final String CHANNEL_WEB = "WEB";

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
    public Map<String, Object> currentConversation(String clientChannel) {
        SupportConversation conversation = findOrCreateCurrentConversation(clientChannel);
        activateEmergencyConversationIfNeeded(conversation);
        closeExpiredManualConversation(conversation);
        remindPendingManualTransfer(conversation);
        return mapConversation(conversation);
    }

    @Override
    @Transactional
    public List<Map<String, Object>> currentMessages(String clientChannel) {
        SupportConversation conversation = findOrCreateCurrentConversation(clientChannel);
        activateEmergencyConversationIfNeeded(conversation);
        closeExpiredManualConversation(conversation);
        remindPendingManualTransfer(conversation);
        conversation.setUnreadForUser(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversation.getId());
    }

    @Override
    @Transactional
    public Map<String, Object> sendCurrentMessage(String content) {
        return sendCurrentMessage(content, CHANNEL_MINIAPP);
    }

    @Override
    @Transactional
    public Map<String, Object> sendCurrentMessage(String content, String clientChannel) {
        SupportConversation conversation = findOrCreateCurrentConversation(clientChannel);
        closeExpiredManualConversation(conversation);
        remindPendingManualTransfer(conversation);
        SupportMessage message = insertMessage(conversation.getId(), UserContext.userId(), UserContext.role(), content);
        boolean wasManual = STATUS_MANUAL.equals(conversation.getStatus());
        boolean transferConfirm = hasPendingTransferAsk(conversation.getId()) && isTransferConfirmation(message.getContent());
        boolean manualIntent = hasManualSupportIntent(message.getContent()) || transferConfirm;
        boolean emergencyIntent = isEmergencySupportRequest(message.getContent());
        boolean directManual = !wasManual && emergencyIntent;
        conversation.setStatus(wasManual || directManual ? STATUS_MANUAL : STATUS_OPEN);
        conversation.setLastMessage(message.getContent());
        conversation.setLastMessageAt(message.getCreatedAt());
        conversation.setUnreadForAdmin(safeInt(conversation.getUnreadForAdmin()) + 1);
        conversation.setUnreadForUser(0);
        SupportMessage notice = null;
        SupportMessage reply = null;
        if (wasManual) {
            // 人工接待中只记录用户消息，不再触发AI。
        } else if (directManual) {
            notice = insertManualOpenNotice(conversation);
            conversation.setLastMessage(notice.getContent());
            conversation.setLastMessageAt(notice.getCreatedAt());
            conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        } else if (manualIntent) {
            // 用户主动要求转人工（原始逻辑）：只回复排队提示，会话保持待接入（后台显示"开启对话"）；
            // 管理员点击开启对话后才真正接入（出现"已接入人工客服"）；等待期间AI不再回复（见 hasPendingManualTransfer）。
            reply = insertMessage(conversation.getId(), null, ROLE_AI, MANUAL_TRANSFER_REPLY);
            conversation.setLastMessage(reply.getContent());
            conversation.setLastMessageAt(reply.getCreatedAt());
            conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        }
        supportConversationMapper.updateById(conversation);
        if (!wasManual && !manualIntent && !emergencyIntent && !hasPendingManualTransfer(conversation.getId())) {
            scheduleAiReply(conversation.getId(), message.getId(), content);
        }
        return buildSendResult(conversation, message, notice, reply);
    }

    @Override
    public PageResult<Map<String, Object>> adminConversations(long current, long size, String keyword, String role, String status) {
        closeExpiredManualConversations();
        String normalizedRole = StringUtils.hasText(role) ? role.trim().toUpperCase(Locale.ROOT) : "";
        String normalizedStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : "";
        List<Map<String, Object>> rows = new ArrayList<>(supportConversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                        .eq(StringUtils.hasText(normalizedRole), SupportConversation::getUserRole, normalizedRole)
                        .eq(StringUtils.hasText(normalizedStatus), SupportConversation::getStatus, normalizedStatus)
                        .orderByDesc(SupportConversation::getLastMessageAt)
                        .orderByDesc(SupportConversation::getId))
                .stream()
                .map(conversation -> {
                    activateEmergencyConversationIfNeeded(conversation);
                    return mapConversation(conversation);
                })
                .filter(item -> matchesKeyword(item, keyword))
                .toList());
        rows.sort(this::compareSupportQueueRows);
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
        activateEmergencyConversationIfNeeded(conversation);
        closeExpiredManualConversation(conversation);
        conversation.setUnreadForAdmin(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversationId);
    }

    @Override
    @Transactional
    public Map<String, Object> sendAdminMessage(Long conversationId, String content) {
        SupportConversation conversation = requireConversation(conversationId);
        if (!STATUS_MANUAL.equals(conversation.getStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请先开启人工对话");
        }
        SupportMessage message = insertMessage(conversationId, UserContext.userId(), RoleCode.ADMIN, content);
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
        String prompt = rows.stream()
                .filter(item -> !Boolean.TRUE.equals(item.get("fromAdmin")) && !Boolean.TRUE.equals(item.get("fromAi")))
                .reduce((first, second) -> second)
                .map(item -> String.valueOf(item.getOrDefault("content", "")))
                .orElse(conversation.getLastMessage());
        Map<String, Object> context;
        String[] focus = focusInputs(rows);
        if (StringUtils.hasText(focus[0])) {
            context = aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole(), conversation.getChannel(), focus[0], focus[1]);
        } else {
            context = aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole(), conversation.getChannel(), prompt);
        }
        String reply = aiSupportService.generateSupportReply(prompt, conversation.getUserRole(), conversation.getChannel(), rows, String.valueOf(context.getOrDefault("contextText", "")))
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
        return aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole(), conversation.getChannel());
    }

    @Override
    @Transactional
    public Map<String, Object> updateStatus(Long conversationId, String status) {
        SupportConversation conversation = requireConversation(conversationId);
        String nextStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : STATUS_OPEN;
        if (!List.of(STATUS_OPEN, STATUS_MANUAL, STATUS_CLOSED).contains(nextStatus)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "客服会话状态不合法");
        }
        String currentStatus = conversation.getStatus();
        conversation.setStatus(nextStatus);
        if (STATUS_MANUAL.equals(nextStatus)) {
            SupportMessage notice = STATUS_MANUAL.equals(currentStatus) ? null : insertManualOpenNotice(conversation);
            if (notice != null) {
                conversation.setLastMessage(notice.getContent());
                conversation.setLastMessageAt(notice.getCreatedAt());
                conversation.setUnreadForAdmin(0);
                conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
            }
        } else if (!STATUS_MANUAL.equals(nextStatus) && STATUS_MANUAL.equals(currentStatus)) {
            SupportMessage existingNotice = latestManualCloseNoticeAfter(conversation, null);
            SupportMessage notice = existingNotice == null
                    ? insertMessage(conversationId, null, RoleCode.ADMIN, MANUAL_CLOSE_NOTICE)
                    : existingNotice;
            if (notice != null) {
                conversation.setLastMessage(notice.getContent());
                conversation.setLastMessageAt(notice.getCreatedAt());
            }
            conversation.setUnreadForAdmin(0);
            if (existingNotice == null) {
                conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
            }
        }
        supportConversationMapper.updateById(conversation);
        operationLogSupport.log("SUPPORT", "STATUS", "SUPPORT_CONVERSATION", conversationId, "客服会话状态更新为：" + nextStatus);
        return mapConversation(conversation);
    }

    private SupportConversation findOrCreateCurrentConversation(String clientChannel) {
        Long userId = UserContext.userId();
        String role = UserContext.role();
        String channel = normalizeChannel(clientChannel);
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!List.of(RoleCode.USER, RoleCode.DRIVER).contains(role)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前角色不支持小程序客服会话");
        }
        SupportConversation conversation = supportConversationMapper.selectOne(new LambdaQueryWrapper<SupportConversation>()
                .eq(SupportConversation::getUserId, userId)
                .eq(SupportConversation::getUserRole, role)
                .eq(SupportConversation::getChannel, channel)
                .last("limit 1"));
        if (conversation != null) {
            return conversation;
        }
        LocalDateTime now = LocalDateTime.now();
        SupportConversation next = new SupportConversation();
        next.setUserId(userId);
        next.setUserRole(role);
        next.setChannel(channel);
        next.setStatus(STATUS_OPEN);
        next.setLastMessage("已进入在线客服");
        next.setLastMessageAt(now);
        next.setUnreadForAdmin(0);
        next.setUnreadForUser(0);
        next.setCreatedAt(now);
        next.setUpdatedAt(now);
        supportConversationMapper.insert(next);
        String welcomeText = aiSupportContextService.buildWelcomeText(userId, role, channel);
        SupportMessage welcome = insertMessage(next.getId(), null, ROLE_AI,
                StringUtils.hasText(welcomeText) ? welcomeText : DEFAULT_AI_WELCOME_MESSAGE);
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

    private void insertAiReplyIfAvailable(SupportConversation conversation, Long triggerMessageId, String userContent) {
        SupportConversation latestConversation = supportConversationMapper.selectById(conversation.getId());
        if (latestConversation == null || STATUS_MANUAL.equals(latestConversation.getStatus())) {
            return;
        }
        if (hasPendingManualTransfer(conversation.getId())) {
            return;
        }
        if (hasNewerUserMessage(conversation.getId(), triggerMessageId, conversation.getUserRole())) {
            return;
        }
        List<Map<String, Object>> recentMessages = listMessageRows(conversation.getId());
        String previousAiContent = latestAiMessageContent(recentMessages);
        String[] focus = focusInputs(recentMessages);
        if (!StringUtils.hasText(focus[0])) {
            focus[0] = userContent;
        }
        Map<String, Object> context = aiSupportContextService.buildContext(conversation.getUserId(), conversation.getUserRole(), conversation.getChannel(), focus[0], focus[1]);
        Optional<String> replyOptional = aiSupportService.generateSupportReply(focus[0], conversation.getUserRole(), conversation.getChannel(), recentMessages, String.valueOf(context.getOrDefault("contextText", "")));
        if (replyOptional.isEmpty()) {
            return;
        }
        String reply = replyOptional.get().trim();
        // LLM 调用期间可能已人工接管或出现更新的用户消息，插入前重新核对，避免迟到、错序回复
        latestConversation = supportConversationMapper.selectById(conversation.getId());
        if (latestConversation == null || STATUS_MANUAL.equals(latestConversation.getStatus())
                || hasNewerUserMessage(conversation.getId(), triggerMessageId, conversation.getUserRole())) {
            return;
        }
        String contentToInsert = reply;
        boolean protectedReply = MANUAL_TRANSFER_REPLY.equals(reply) || MANUAL_TRANSFER_ASK.equals(reply);
        if (!protectedReply && StringUtils.hasText(previousAiContent) && previousAiContent.equals(reply)) {
            // 复读/重复兜底：统一引导用户补充信息并保持AI接待；是否转人工由用户确认决定，不再自动转。
            contentToInsert = REPEATED_REPLY_NOTICE;
        }
        SupportMessage replyMessage = insertMessage(conversation.getId(), null, ROLE_AI, contentToInsert);
        SupportConversation current = supportConversationMapper.selectById(conversation.getId());
        if (current == null || STATUS_MANUAL.equals(current.getStatus())) {
            return;
        }
        // AI 回复一律不改变会话状态：转人工只能由用户显式请求或确认后进入排队，
        // 真正接入以管理员点击"开启对话"为准。
        current.setStatus(STATUS_OPEN);
        current.setLastMessage(replyMessage.getContent());
        current.setLastMessageAt(replyMessage.getCreatedAt());
        current.setUnreadForUser(safeInt(current.getUnreadForUser()) + 1);
        supportConversationMapper.updateById(current);
    }

    private void scheduleAiReply(Long conversationId, Long triggerMessageId, String userContent) {
        Runnable task = () -> CompletableFuture.runAsync(() -> {
            try {
                SupportConversation latest = supportConversationMapper.selectById(conversationId);
                if (latest != null) {
                    insertAiReplyIfAvailable(latest, triggerMessageId, userContent);
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

    /**
     * 并发防护：用户连续发送消息时，每个消息各自触发一次 AI 生成。若本条消息之后
     * 已有更新的用户消息，说明本次生成已过期，直接丢弃，由新消息自己的任务负责回复，
     * 避免重复回复和"回复顺序与提问顺序错位"。
     */
    private boolean hasNewerUserMessage(Long conversationId, Long afterMessageId, String userRole) {
        if (afterMessageId == null) {
            return false;
        }
        Long count = supportMessageMapper.selectCount(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .gt(SupportMessage::getId, afterMessageId)
                .eq(SupportMessage::getSenderRole, userRole));
        return count != null && count > 0;
    }

    private String latestAiMessageContent(List<Map<String, Object>> rows) {
        String content = "";
        for (Map<String, Object> item : rows) {
            if (Boolean.TRUE.equals(item.get("fromAi"))) {
                content = String.valueOf(item.getOrDefault("content", ""));
            }
        }
        return content.trim();
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
        return collapseDuplicateSystemNotices(page.getRecords()).stream().map(this::mapMessage).toList();
    }

    /**
     * 提取用户最近几条发言供 AI 上下文做"当前问题焦点"判断：第一个元素是最新一条，
     * 第二个是它之前最多三条的拼接，保证"那第二单呢""怎么还没到"这类追问不丢失上一轮话题。
     */
    private String[] focusInputs(List<Map<String, Object>> rows) {
        List<String> contents = new ArrayList<>();
        for (Map<String, Object> item : rows) {
            if (Boolean.TRUE.equals(item.get("fromAdmin")) || Boolean.TRUE.equals(item.get("fromAi"))) {
                continue;
            }
            String content = String.valueOf(item.getOrDefault("content", "")).trim();
            if (StringUtils.hasText(content)) {
                contents.add(content);
            }
        }
        if (contents.isEmpty()) {
            return new String[]{"", ""};
        }
        int latestIndex = contents.size() - 1;
        int historyStart = Math.max(0, latestIndex - 3);
        return new String[]{contents.get(latestIndex), String.join("\n", contents.subList(historyStart, latestIndex))};
    }

    private List<SupportMessage> collapseDuplicateSystemNotices(List<SupportMessage> messages) {
        List<SupportMessage> result = new ArrayList<>();
        for (SupportMessage message : messages) {
            SupportMessage previous = result.isEmpty() ? null : result.get(result.size() - 1);
            if (isSameSystemNotice(previous, message)) {
                continue;
            }
            result.add(message);
        }
        return result;
    }

    private boolean isSameSystemNotice(SupportMessage left, SupportMessage right) {
        if (!isSystemNotice(left) || !isSystemNotice(right)) {
            return false;
        }
        return left.getContent() != null && left.getContent().equals(right.getContent());
    }

    private Map<String, Object> buildSendResult(SupportConversation conversation, SupportMessage message, SupportMessage notice, SupportMessage reply) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("message", mapMessage(message));
        if (notice != null) {
            map.put("notice", mapMessage(notice));
        }
        if (reply != null) {
            map.put("reply", mapMessage(reply));
        }
        map.put("conversation", mapConversation(conversation));
        map.put("messages", listMessageRows(conversation.getId()));
        return map;
    }

    private Map<String, Object> mapConversation(SupportConversation conversation) {
        PlatformUser user = platformUserMapper.selectById(conversation.getUserId());
        boolean member = isActiveMember(user);
        List<SupportMessage> pendingSupportMessages = pendingSupportMessages(conversation);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", conversation.getId());
        map.put("userId", conversation.getUserId());
        map.put("userRole", conversation.getUserRole());
        map.put("channel", normalizeChannel(conversation.getChannel()));
        map.put("channelText", channelText(conversation.getChannel()));
        map.put("roleText", RoleCode.DRIVER.equals(conversation.getUserRole()) ? "司机" : "乘客");
        map.put("nickname", user == null ? "" : user.getNickname());
        map.put("phone", user == null ? "" : user.getPhone());
        map.put("member", member);
        map.put("memberLevel", member ? user.getMemberLevel() : "");
        map.put("status", conversation.getStatus());
        map.put("manualMode", STATUS_MANUAL.equals(conversation.getStatus()));
        map.put("transferPending", hasPendingManualTransfer(conversation.getId()));
        map.put("needsManualReception", needsManualReception(conversation, pendingSupportMessages));
        map.put("emergencySupport", hasEmergencySupport(conversation));
        map.put("lastMessage", normalizeWelcomeContent(conversation.getLastMessage()));
        map.put("lastMessageAt", conversation.getLastMessageAt());
        map.put("unreadForAdmin", safeInt(conversation.getUnreadForAdmin()));
        map.put("unreadForUser", safeInt(conversation.getUnreadForUser()));
        map.put("createdAt", conversation.getCreatedAt());
        return map;
    }

    private Map<String, Object> mapMessage(SupportMessage message) {
        boolean aiWelcome = isDefaultAiWelcome(message);
        boolean systemNotice = isSystemNotice(message);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", message.getId());
        map.put("conversationId", message.getConversationId());
        map.put("senderId", message.getSenderId());
        map.put("senderRole", message.getSenderRole());
        map.put("fromAdmin", RoleCode.ADMIN.equals(message.getSenderRole()) && !aiWelcome);
        map.put("fromAi", ROLE_AI.equals(message.getSenderRole()) || aiWelcome);
        map.put("systemNotice", systemNotice);
        map.put("content", normalizeWelcomeContent(message.getContent()));
        map.put("createdAt", message.getCreatedAt());
        return map;
    }

    private boolean isDefaultAiWelcome(SupportMessage message) {
        if (message == null || message.getSenderId() != null || !RoleCode.ADMIN.equals(message.getSenderRole())) {
            return false;
        }
        String content = message.getContent();
        return DEFAULT_AI_WELCOME_MESSAGE.equals(content)
                || LEGACY_DEFAULT_WELCOME_MESSAGE.equals(content)
                || PREVIOUS_AI_WELCOME_MESSAGE.equals(content);
    }

    private String normalizeWelcomeContent(String content) {
        return PREVIOUS_AI_WELCOME_MESSAGE.equals(content) ? DEFAULT_AI_WELCOME_MESSAGE : content;
    }

    private boolean isSystemNotice(SupportMessage message) {
        if (message == null || message.getSenderId() != null || !RoleCode.ADMIN.equals(message.getSenderRole())) {
            return false;
        }
        String content = message.getContent();
        return MANUAL_OPEN_NOTICE.equals(content) || MANUAL_CLOSE_NOTICE.equals(content) || MANUAL_WAIT_WARNING.equals(content)
                || MANUAL_PENDING_REMIND.equals(content);
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

    private String normalizeChannel(String channel) {
        if (!StringUtils.hasText(channel)) {
            return CHANNEL_MINIAPP;
        }
        String normalized = channel.trim().toUpperCase(Locale.ROOT);
        if ("WEB".equals(normalized) || "H5".equals(normalized) || "PC".equals(normalized)) {
            return CHANNEL_WEB;
        }
        return CHANNEL_MINIAPP;
    }

    private String channelText(String channel) {
        return CHANNEL_WEB.equals(normalizeChannel(channel)) ? "网页端" : "小程序";
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
        SupportMessage lastAdminMessage = latestManualAdminAnchorMessage(conversation.getId());
        if (lastAdminMessage == null || lastAdminMessage.getCreatedAt() == null) {
            return false;
        }
        SupportMessage lastUserMessage = latestUserMessage(conversation.getId());
        LocalDateTime lastUserAt = lastUserMessage == null ? null : lastUserMessage.getCreatedAt();
        LocalDateTime manualAnchorAt = lastAdminMessage.getCreatedAt();
        if (lastUserAt != null && lastUserAt.isAfter(manualAnchorAt)) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        if (!manualAnchorAt.isAfter(now.minus(MANUAL_WARN_TIMEOUT)) && !hasManualWaitWarningAfter(conversation.getId(), manualAnchorAt)) {
            SupportMessage warning = insertMessage(conversation.getId(), null, RoleCode.ADMIN, MANUAL_WAIT_WARNING);
            conversation.setLastMessage(warning.getContent());
            conversation.setLastMessageAt(warning.getCreatedAt());
            conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
            supportConversationMapper.updateById(conversation);
        }
        if (manualAnchorAt.isAfter(now.minus(MANUAL_IDLE_TIMEOUT))) {
            return false;
        }
        SupportMessage existingCloseNotice = latestManualCloseNoticeAfter(conversation, manualAnchorAt);
        SupportMessage closeNotice = existingCloseNotice == null
                ? insertMessage(conversation.getId(), null, RoleCode.ADMIN, MANUAL_CLOSE_NOTICE)
                : existingCloseNotice;
        conversation.setStatus(STATUS_OPEN);
        if (closeNotice != null) {
            conversation.setLastMessage(closeNotice.getContent());
            conversation.setLastMessageAt(closeNotice.getCreatedAt());
        }
        if (existingCloseNotice == null) {
            conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        }
        supportConversationMapper.updateById(conversation);
        return true;
    }

    /**
     * AI 已发出转接征询且用户尚未答复：最新一条 AI 消息是征询文案。
     * 用户确认后由 sendCurrentMessage 进入排队；用户继续描述问题则征询自然失效。
     */
    private boolean hasPendingTransferAsk(Long conversationId) {
        if (conversationId == null) {
            return false;
        }
        SupportMessage lastAi = supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, ROLE_AI)
                .orderByDesc(SupportMessage::getId)
                .last("limit 1"));
        return lastAi != null && MANUAL_TRANSFER_ASK.equals(lastAi.getContent());
    }

    private boolean isTransferConfirmation(String content) {
        String normalized = content == null ? "" : content.replaceAll("\s+", "").trim();
        if (!StringUtils.hasText(normalized)) {
            return false;
        }
        if (List.of("确认", "需要", "要", "好", "好的", "是", "是的", "确定", "同意", "可以", "要人工", "转人工", "人工", "人工客服", "联系人工", "转接人工").contains(normalized)) {
            return true;
        }
        return normalized.contains("确认") || normalized.contains("转人工") || normalized.contains("联系人工");
    }

    /**
     * 用户已请求转人工且人工尚未接入：最新转接提示之后没有任何管理员消息（开启对话/回复/关闭）。
     * 等待期间 AI 保持沉默；管理员点击"开启对话"（出现"已接入人工客服"）、回复或关闭人工后恢复。
     */
    private boolean hasPendingManualTransfer(Long conversationId) {
        SupportMessage transferReply = latestManualTransferReply(conversationId);
        if (transferReply == null || transferReply.getId() == null) {
            return false;
        }
        Long adminAfter = supportMessageMapper.selectCount(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, RoleCode.ADMIN)
                .ne(SupportMessage::getContent, MANUAL_PENDING_REMIND)
                .gt(SupportMessage::getId, transferReply.getId()));
        return adminAfter == null || adminAfter == 0;
    }

    /**
     * 用户主动转人工后的排队提醒：转接提示（AI 消息）之后若还没有任何真实人工消息，
     * 超过 60 秒提示"当前时段咨询量较大，请稍等"，只提示一次。
     * 人工真正接入（产生 ADMIN 消息）后不再提醒。
     */
    private void remindPendingManualTransfer(SupportConversation conversation) {
        SupportMessage transferReply = latestManualTransferReply(conversation.getId());
        if (transferReply == null || transferReply.getCreatedAt() == null) {
            return;
        }
        LocalDateTime transferAt = transferReply.getCreatedAt();
        SupportMessage lastAdminMessage = latestManualAdminAnchorMessage(conversation.getId());
        if (lastAdminMessage != null && lastAdminMessage.getCreatedAt() != null
                && !lastAdminMessage.getCreatedAt().isBefore(transferAt)) {
            return;
        }
        if (hasManualPendingRemindAfter(conversation.getId(), transferReply.getId())) {
            return;
        }
        if (transferAt.isAfter(LocalDateTime.now().minus(MANUAL_PENDING_REMIND_TIMEOUT))) {
            return;
        }
        SupportMessage remind = insertMessage(conversation.getId(), null, RoleCode.ADMIN, MANUAL_PENDING_REMIND);
        conversation.setLastMessage(remind.getContent());
        conversation.setLastMessageAt(remind.getCreatedAt());
        conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        supportConversationMapper.updateById(conversation);
    }

    private SupportMessage latestManualTransferReply(Long conversationId) {
        if (conversationId == null) {
            return null;
        }
        return supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, ROLE_AI)
                .eq(SupportMessage::getContent, MANUAL_TRANSFER_REPLY)
                .orderByDesc(SupportMessage::getId)
                .last("limit 1"));
    }

    private boolean hasManualPendingRemindAfter(Long conversationId, Long afterMessageId) {
        if (conversationId == null || afterMessageId == null) {
            return false;
        }
        Long count = supportMessageMapper.selectCount(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getContent, MANUAL_PENDING_REMIND)
                .gt(SupportMessage::getId, afterMessageId));
        return count != null && count > 0;
    }

    /**
     * 客服队列排序规则（产品定义）：
     * 紧急置顶（不区分会员，按时间）> 等待人工接应（会员>非会员）> 人工接待中（会员>非会员）> AI接待（会员>非会员），
     * 同级同等身份按最近消息时间倒序。
     */
    private int compareSupportQueueRows(Map<String, Object> left, Map<String, Object> right) {
        int leftTier = supportQueueTier(left);
        int rightTier = supportQueueTier(right);
        int tierDiff = Integer.compare(leftTier, rightTier);
        if (tierDiff != 0) {
            return tierDiff;
        }
        if (leftTier != 0) {
            int memberDiff = Boolean.compare(Boolean.TRUE.equals(right.get("member")), Boolean.TRUE.equals(left.get("member")));
            if (memberDiff != 0) {
                return memberDiff;
            }
        }
        return compareSupportQueueTime(left, right);
    }

    private int supportQueueTier(Map<String, Object> row) {
        if (Boolean.TRUE.equals(row.get("emergencySupport"))) {
            return 0;
        }
        if (Boolean.TRUE.equals(row.get("transferPending")) || Boolean.TRUE.equals(row.get("needsManualReception"))) {
            return 1;
        }
        if (Boolean.TRUE.equals(row.get("manualMode"))) {
            return 2;
        }
        return 3;
    }

    private int compareSupportQueueTime(Map<String, Object> left, Map<String, Object> right) {
        Object leftAt = left.get("lastMessageAt");
        Object rightAt = right.get("lastMessageAt");
        Long leftId = left.get("id") instanceof Long ? (Long) left.get("id") : 0L;
        Long rightId = right.get("id") instanceof Long ? (Long) right.get("id") : 0L;
        if (leftAt instanceof LocalDateTime && rightAt instanceof LocalDateTime) {
            int diff = ((LocalDateTime) rightAt).compareTo((LocalDateTime) leftAt);
            if (diff != 0) {
                return diff;
            }
        }
        return Long.compare(rightId, leftId);
    }

    private boolean hasManualWaitWarningAfter(Long conversationId, LocalDateTime since) {
        if (conversationId == null || since == null) {
            return false;
        }
        return supportMessageMapper.selectCount(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getContent, MANUAL_WAIT_WARNING)
                .gt(SupportMessage::getCreatedAt, since)) > 0;
    }

    private SupportMessage insertManualOpenNotice(SupportConversation conversation) {
        if (conversation == null || conversation.getId() == null) {
            return null;
        }
        return insertMessage(conversation.getId(), null, RoleCode.ADMIN, MANUAL_OPEN_NOTICE);
    }

    private SupportMessage latestManualCloseNoticeAfter(SupportConversation conversation, LocalDateTime manualAnchorAt) {
        if (conversation == null || conversation.getId() == null) {
            return null;
        }
        LocalDateTime anchorAt = manualAnchorAt;
        if (anchorAt == null) {
            SupportMessage anchor = latestManualAdminAnchorMessage(conversation.getId());
            anchorAt = anchor == null ? null : anchor.getCreatedAt();
        }
        SupportMessage latestClose = latestSystemNotice(conversation.getId(), MANUAL_CLOSE_NOTICE);
        if (latestClose != null && latestClose.getCreatedAt() != null
                && (anchorAt == null || !latestClose.getCreatedAt().isBefore(anchorAt))) {
            return latestClose;
        }
        return null;
    }

    private SupportMessage latestManualAdminAnchorMessage(Long conversationId) {
        if (conversationId == null) {
            return null;
        }
        return supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, RoleCode.ADMIN)
                .ne(SupportMessage::getContent, MANUAL_WAIT_WARNING)
                .ne(SupportMessage::getContent, MANUAL_CLOSE_NOTICE)
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
        if ("人工".equals(normalized) || "人工客服".equals(normalized) || "真人".equals(normalized)) {
            return true;
        }
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

    private List<SupportMessage> pendingSupportMessages(SupportConversation conversation) {
        if (conversation == null || STATUS_MANUAL.equals(conversation.getStatus())) {
            return List.of();
        }
        SupportMessage latestClose = latestSystemNotice(conversation.getId(), MANUAL_CLOSE_NOTICE);
        SupportMessage latestOpen = latestSystemNotice(conversation.getId(), MANUAL_OPEN_NOTICE);
        Long handledMessageId = latestMessageId(latestClose, latestOpen);
        return supportMessageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversation.getId())
                .gt(handledMessageId != null, SupportMessage::getId, handledMessageId)
                .orderByDesc(SupportMessage::getId));
    }

    private boolean needsManualReception(SupportConversation conversation, List<SupportMessage> pendingMessages) {
        if (conversation == null || STATUS_MANUAL.equals(conversation.getStatus())) {
            return false;
        }
        return pendingMessages.stream()
                .anyMatch(message -> isTransferReply(message) || isUserMessage(message) && hasManualSupportIntent(message.getContent()));
    }

    private boolean hasEmergencySupport(SupportConversation conversation) {
        if (conversation == null || STATUS_CLOSED.equals(conversation.getStatus())) {
            return false;
        }
        SupportMessage latestEmergency = latestEmergencySupportMessage(conversation.getId());
        if (latestEmergency == null) {
            return false;
        }
        SupportMessage latestClose = latestSystemNotice(conversation.getId(), MANUAL_CLOSE_NOTICE);
        return latestClose == null || latestEmergency.getId() > latestClose.getId();
    }

    private void activateEmergencyConversationIfNeeded(SupportConversation conversation) {
        if (conversation == null || !STATUS_OPEN.equals(conversation.getStatus())) {
            return;
        }
        SupportMessage latestEmergency = latestEmergencySupportMessage(conversation.getId());
        if (latestEmergency == null) {
            return;
        }
        SupportMessage latestClose = latestSystemNotice(conversation.getId(), MANUAL_CLOSE_NOTICE);
        if (latestClose != null && latestClose.getId() > latestEmergency.getId()) {
            return;
        }
        SupportMessage latestOpen = latestSystemNotice(conversation.getId(), MANUAL_OPEN_NOTICE);
        SupportMessage notice = latestOpen != null && latestOpen.getId() > latestEmergency.getId()
                ? latestOpen
                : insertManualOpenNotice(conversation);
        conversation.setStatus(STATUS_MANUAL);
        conversation.setLastMessage(notice.getContent());
        conversation.setLastMessageAt(notice.getCreatedAt());
        conversation.setUnreadForAdmin(0);
        conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        supportConversationMapper.updateById(conversation);
    }

    private SupportMessage latestEmergencySupportMessage(Long conversationId) {
        if (conversationId == null) {
            return null;
        }
        return supportMessageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                        .eq(SupportMessage::getConversationId, conversationId)
                        .orderByDesc(SupportMessage::getId))
                .stream()
                .filter(this::isUserMessage)
                .filter(message -> isEmergencySupportRequest(message.getContent()))
                .findFirst()
                .orElse(null);
    }

    private boolean isEmergencySupportRequest(String content) {
        return StringUtils.hasText(content) && content.trim().startsWith(EMERGENCY_SUPPORT_PREFIX);
    }

    private boolean isTransferReply(SupportMessage message) {
        return message != null && ROLE_AI.equals(message.getSenderRole()) && MANUAL_TRANSFER_REPLY.equals(message.getContent());
    }

    private boolean isUserMessage(SupportMessage message) {
        return message != null && !RoleCode.ADMIN.equals(message.getSenderRole()) && !ROLE_AI.equals(message.getSenderRole());
    }

    private Long latestMessageId(SupportMessage left, SupportMessage right) {
        if (left == null) {
            return right == null ? null : right.getId();
        }
        if (right == null) {
            return left.getId();
        }
        return left.getId() > right.getId() ? left.getId() : right.getId();
    }

    private LocalDateTime latestSystemNoticeAt(Long conversationId, String content) {
        SupportMessage notice = latestSystemNotice(conversationId, content);
        return notice == null ? null : notice.getCreatedAt();
    }

    private SupportMessage latestSystemNotice(Long conversationId, String content) {
        if (conversationId == null || !StringUtils.hasText(content)) {
            return null;
        }
        return supportMessageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .eq(SupportMessage::getSenderRole, RoleCode.ADMIN)
                .eq(SupportMessage::getContent, content)
                .orderByDesc(SupportMessage::getId)
                .last("limit 1"));
    }

    private LocalDateTime latestTime(LocalDateTime left, LocalDateTime right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left.isAfter(right) ? left : right;
    }
}
