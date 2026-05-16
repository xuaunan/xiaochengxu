package com.sunshine.travel.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.entity.MessageRecord;
import com.sunshine.travel.mapper.MessageRecordMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "消息通知")
@RestController
@RequestMapping("/messages")
public class MessageController {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("MM-dd HH:mm");

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

    private Map<String, Object> toMessageView(MessageRecord record) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", record.getId());
        row.put("title", record.getTitle());
        row.put("content", record.getContent());
        row.put("type", record.getBizType());
        row.put("templateCode", record.getTemplateCode());
        row.put("unread", false);
        row.put("time", record.getCreatedAt() == null ? "" : TIME_FORMATTER.format(record.getCreatedAt()));
        row.put("createdAt", record.getCreatedAt());
        return row;
    }
}
