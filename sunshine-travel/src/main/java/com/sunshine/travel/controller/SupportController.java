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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Support")
@RequireRole({RoleCode.USER, RoleCode.DRIVER})
@RestController
@RequestMapping("/support")
public class SupportController {

    private final SupportService supportService;

    public SupportController(SupportService supportService) {
        this.supportService = supportService;
    }

    @Operation(summary = "Current support conversation")
    @GetMapping("/conversation")
    public ApiResponse<?> conversation(@RequestHeader(value = "X-Sunshine-Client", required = false) String client) {
        return ApiResponse.success(supportService.currentConversation(client));
    }

    @Operation(summary = "Current support messages")
    @GetMapping("/messages")
    public ApiResponse<?> messages(@RequestHeader(value = "X-Sunshine-Client", required = false) String client) {
        return ApiResponse.success(supportService.currentMessages(client));
    }

    @Operation(summary = "Send support message")
    @PostMapping("/messages")
    public ApiResponse<?> send(@Valid @RequestBody SupportMessageRequest request,
                               @RequestHeader(value = "X-Sunshine-Client", required = false) String client) {
        return ApiResponse.success("Message sent", supportService.sendCurrentMessage(request.getContent(), client));
    }
}
