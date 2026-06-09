package com.sunshine.travel.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.entity.MessageRecord;
import com.sunshine.travel.mapper.MessageRecordMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "消息通知")
@RestController
@RequestMapping("/messages")
public class MessageController {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("MM-dd HH:mm");
    private static final String READ_STATUS_READ = "READ";
    private static final String READ_STATUS_UNREAD = "UNREAD";

    private final MessageRecordMapper messageRecordMapper;

    public MessageController(MessageRecordMapper messageRecordMapper) {
        this.messageRecordMapper = messageRecordMapper;
    }

    @Operation(summary = "我的消息通知")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping
    public ApiResponse<?> mine() {
        List<Map<String, Object>> messages = messageRecordMapper.selectList(new LambdaQueryWrapper<MessageRecord>()
                        .eq(MessageRecord::getUserId, UserContext.userId())
                        .orderByDesc(MessageRecord::getId)
                        .last("limit 50"))
                .stream()
                .map(this::toMessageView)
                .toList();
        return ApiResponse.success(messages);
    }

    @Operation(summary = "娑堟伅璇︽儏")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @GetMapping("/{messageId}")
    public ApiResponse<?> detail(@PathVariable Long messageId) {
        return ApiResponse.success(toMessageView(requireOwnMessage(messageId)));
    }

    @Operation(summary = "鏍囪娑堟伅宸茶")
    @RequireRole({RoleCode.USER, RoleCode.DRIVER, RoleCode.ADMIN})
    @PostMapping("/{messageId}/read")
    public ApiResponse<?> markRead(@PathVariable Long messageId) {
        MessageRecord message = requireOwnMessage(messageId);
        if (!isRead(message) || message.getReadAt() == null) {
            message.setReadStatus(READ_STATUS_READ);
            message.setReadAt(LocalDateTime.now());
            messageRecordMapper.updateById(message);
        }
        return ApiResponse.success("Message marked as read", toMessageView(message));
    }

    private MessageRecord requireOwnMessage(Long messageId) {
        MessageRecord record = messageRecordMapper.selectById(messageId);
        if (record == null || !UserContext.userId().equals(record.getUserId())) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "Message not found");
        }
        return record;
    }

    private Map<String, Object> toMessageView(MessageRecord record) {
        boolean read = isRead(record);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", record.getId());
        row.put("title", record.getTitle());
        row.put("content", record.getContent());
        row.put("type", record.getBizType());
        row.put("templateCode", record.getTemplateCode());
        row.put("unread", !read);
        row.put("read", read);
        row.put("isRead", read);
        row.put("readStatus", read ? READ_STATUS_READ : READ_STATUS_UNREAD);
        row.put("readAt", record.getReadAt());
        row.put("time", record.getCreatedAt() == null ? "" : TIME_FORMATTER.format(record.getCreatedAt()));
        row.put("createdAt", record.getCreatedAt());
        return row;
    }

    private boolean isRead(MessageRecord record) {
        return READ_STATUS_READ.equalsIgnoreCase(record.getReadStatus());
    }
}
