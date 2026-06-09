package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.SupportMessageRequest;
import com.sunshine.travel.service.SupportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "在线客服")
@RequireRole({RoleCode.USER, RoleCode.DRIVER})
@RestController
@RequestMapping("/support")
public class SupportController {

    private final SupportService supportService;

    public SupportController(SupportService supportService) {
        this.supportService = supportService;
    }

    @Operation(summary = "我的客服会话")
    @GetMapping("/conversation")
    public ApiResponse<?> conversation() {
        return ApiResponse.success(supportService.currentConversation());
    }

    @Operation(summary = "我的客服消息")
    @GetMapping("/messages")
    public ApiResponse<?> messages() {
        return ApiResponse.success(supportService.currentMessages());
    }

    @Operation(summary = "发送客服消息")
    @PostMapping("/messages")
    public ApiResponse<?> send(@Valid @RequestBody SupportMessageRequest request) {
        return ApiResponse.success("消息已发送", supportService.sendCurrentMessage(request.getContent()));
    }
}
