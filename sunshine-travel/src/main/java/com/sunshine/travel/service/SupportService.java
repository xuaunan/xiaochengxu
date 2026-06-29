package com.sunshine.travel.service;

import com.sunshine.travel.common.PageResult;
import java.util.List;
import java.util.Map;

public interface SupportService {

    Map<String, Object> currentConversation(String clientChannel);

    List<Map<String, Object>> currentMessages(String clientChannel);

    Map<String, Object> sendCurrentMessage(String content);

    Map<String, Object> sendCurrentMessage(String content, String clientChannel);

    PageResult<Map<String, Object>> adminConversations(long current, long size, String keyword, String role, String status);

    List<Map<String, Object>> adminMessages(Long conversationId);

    Map<String, Object> sendAdminMessage(Long conversationId, String content);

    Map<String, Object> adminAiSuggest(Long conversationId);

    Map<String, Object> adminAiContext(Long conversationId);

    Map<String, Object> updateStatus(Long conversationId, String status);
}
