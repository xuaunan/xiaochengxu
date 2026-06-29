package com.sunshine.travel.service;

import com.sunshine.travel.dto.AiSupportSettingsRequest;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AiSupportService {

    Map<String, Object> settings();

    Map<String, Object> saveSettings(AiSupportSettingsRequest request);

    Map<String, Object> test(String prompt);

    Optional<String> generateSupportReply(String prompt, String userRole, List<Map<String, Object>> recentMessages, String businessContext);

    Optional<String> generateSupportReply(String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext);
}
