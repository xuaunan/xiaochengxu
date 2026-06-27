package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.AiSupportSettingsRequest;
import com.sunshine.travel.dto.AiSupportTestRequest;
import com.sunshine.travel.service.AiSupportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "AI客服设置")
@RequireRole(RoleCode.ADMIN)
@RestController
@RequestMapping("/admin/ai")
public class AdminAiController {

    private final AiSupportService aiSupportService;

    public AdminAiController(AiSupportService aiSupportService) {
        this.aiSupportService = aiSupportService;
    }

    @Operation(summary = "AI客服设置")
    @GetMapping("/settings")
    public ApiResponse<?> settings() {
        return ApiResponse.success(aiSupportService.settings());
    }

    @Operation(summary = "保存AI客服设置")
    @PostMapping("/settings")
    public ApiResponse<?> saveSettings(@Valid @RequestBody AiSupportSettingsRequest request) {
        return ApiResponse.success("AI客服设置已保存", aiSupportService.saveSettings(request));
    }

    @Operation(summary = "调试AI客服")
    @PostMapping("/test")
    public ApiResponse<?> test(@Valid @RequestBody AiSupportTestRequest request) {
        return ApiResponse.success(aiSupportService.test(request.getPrompt()));
    }
}
