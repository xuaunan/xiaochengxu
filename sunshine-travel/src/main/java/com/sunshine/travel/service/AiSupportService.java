package com.sunshine.travel.service;

import com.sunshine.travel.dto.AiSupportSettingsRequest;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AiSupportService {

    /** AI 判断需要人工后统一回复的排队提示文案（真正接入以管理员点击"开启对话"为准）。 */
    String MANUAL_TRANSFER_REPLY = "正在为您转接人工客服，请稍后";

    /** AI 判断用户可能需要人工时的征询文案：必须等用户确认后才真正转接。 */
    String MANUAL_TRANSFER_ASK = "很抱歉刚才没有帮您解决问题。需要为您转接人工客服吗？回复\"确认\"即可为您转接；如不需要，请继续描述您的问题。";

    Map<String, Object> settings();

    Map<String, Object> saveSettings(AiSupportSettingsRequest request);

    Map<String, Object> test(String prompt);

    Optional<String> generateSupportReply(String prompt, String userRole, List<Map<String, Object>> recentMessages, String businessContext);

    Optional<String> generateSupportReply(String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext);
}
