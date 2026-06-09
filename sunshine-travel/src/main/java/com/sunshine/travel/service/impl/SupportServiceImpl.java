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
import com.sunshine.travel.service.SupportService;
import com.sunshine.travel.service.support.OperationLogSupport;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SupportServiceImpl implements SupportService {

    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_CLOSED = "CLOSED";
    private static final String MEMBER_STATUS_ACTIVE = "ACTIVE";

    private final SupportConversationMapper supportConversationMapper;
    private final SupportMessageMapper supportMessageMapper;
    private final PlatformUserMapper platformUserMapper;
    private final OperationLogSupport operationLogSupport;

    public SupportServiceImpl(SupportConversationMapper supportConversationMapper,
                              SupportMessageMapper supportMessageMapper,
                              PlatformUserMapper platformUserMapper,
                              OperationLogSupport operationLogSupport) {
        this.supportConversationMapper = supportConversationMapper;
        this.supportMessageMapper = supportMessageMapper;
        this.platformUserMapper = platformUserMapper;
        this.operationLogSupport = operationLogSupport;
    }

    @Override
    @Transactional
    public Map<String, Object> currentConversation() {
        SupportConversation conversation = findOrCreateCurrentConversation();
        return mapConversation(conversation);
    }

    @Override
    @Transactional
    public List<Map<String, Object>> currentMessages() {
        SupportConversation conversation = findOrCreateCurrentConversation();
        conversation.setUnreadForUser(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversation.getId());
    }

    @Override
    @Transactional
    public Map<String, Object> sendCurrentMessage(String content) {
        SupportConversation conversation = findOrCreateCurrentConversation();
        SupportMessage message = insertMessage(conversation.getId(), UserContext.userId(), UserContext.role(), content);
        conversation.setStatus(STATUS_OPEN);
        conversation.setLastMessage(message.getContent());
        conversation.setLastMessageAt(message.getCreatedAt());
        conversation.setUnreadForAdmin(safeInt(conversation.getUnreadForAdmin()) + 1);
        conversation.setUnreadForUser(0);
        supportConversationMapper.updateById(conversation);
        return mapMessage(message);
    }

    @Override
    public PageResult<Map<String, Object>> adminConversations(long current, long size, String keyword, String role, String status) {
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
        conversation.setUnreadForAdmin(0);
        supportConversationMapper.updateById(conversation);
        return listMessageRows(conversationId);
    }

    @Override
    @Transactional
    public Map<String, Object> sendAdminMessage(Long conversationId, String content) {
        SupportConversation conversation = requireConversation(conversationId);
        SupportMessage message = insertMessage(conversationId, UserContext.userId(), RoleCode.ADMIN, content);
        conversation.setStatus(STATUS_OPEN);
        conversation.setLastMessage(message.getContent());
        conversation.setLastMessageAt(message.getCreatedAt());
        conversation.setUnreadForAdmin(0);
        conversation.setUnreadForUser(safeInt(conversation.getUnreadForUser()) + 1);
        supportConversationMapper.updateById(conversation);
        operationLogSupport.log("SUPPORT", "REPLY", "SUPPORT_CONVERSATION", conversationId, "客服回复会话");
        return mapMessage(message);
    }

    @Override
    @Transactional
    public Map<String, Object> updateStatus(Long conversationId, String status) {
        SupportConversation conversation = requireConversation(conversationId);
        String nextStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : STATUS_OPEN;
        if (!List.of(STATUS_OPEN, STATUS_CLOSED).contains(nextStatus)) {
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
        message.setContent(content == null ? "" : content.trim());
        message.setCreatedAt(now);
        message.setUpdatedAt(now);
        supportMessageMapper.insert(message);
        return message;
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
}
