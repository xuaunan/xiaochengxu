package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.SupportMessageRequest;
import com.sunshine.travel.service.SupportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "后台客服服务")
@RequireRole(RoleCode.ADMIN)
@RestController
@RequestMapping("/admin/support")
public class AdminSupportController {

    private final SupportService supportService;

    public AdminSupportController(SupportService supportService) {
        this.supportService = supportService;
    }

    @Operation(summary = "客服会话分页查询")
    @GetMapping("/conversations")
    public ApiResponse<?> conversations(@RequestParam(defaultValue = "1") long current,
                                        @RequestParam(defaultValue = "10") long size,
                                        @RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String role,
                                        @RequestParam(required = false) String status) {
        return ApiResponse.success(supportService.adminConversations(current, size, keyword, role, status));
    }

    @Operation(summary = "客服会话消息")
    @GetMapping("/conversations/{conversationId}/messages")
    public ApiResponse<?> messages(@PathVariable Long conversationId) {
        return ApiResponse.success(supportService.adminMessages(conversationId));
    }

    @Operation(summary = "后台客服回复")
    @PostMapping("/conversations/{conversationId}/messages")
    public ApiResponse<?> send(@PathVariable Long conversationId, @Valid @RequestBody SupportMessageRequest request) {
        return ApiResponse.success("回复已发送", supportService.sendAdminMessage(conversationId, request.getContent()));
    }

    @Operation(summary = "AI建议回复")
    @PostMapping("/conversations/{conversationId}/ai-suggest")
    public ApiResponse<?> aiSuggest(@PathVariable Long conversationId) {
        return ApiResponse.success(supportService.adminAiSuggest(conversationId));
    }

    @Operation(summary = "AI引用数据预览")
    @GetMapping("/conversations/{conversationId}/ai-context")
    public ApiResponse<?> aiContext(@PathVariable Long conversationId) {
        return ApiResponse.success(supportService.adminAiContext(conversationId));
    }

    @Operation(summary = "更新客服会话状态")
    @PostMapping("/conversations/{conversationId}/status")
    public ApiResponse<?> updateStatus(@PathVariable Long conversationId, @RequestBody Map<String, String> request) {
        return ApiResponse.success("状态已更新", supportService.updateStatus(conversationId, request == null ? "" : request.get("status")));
    }
}
