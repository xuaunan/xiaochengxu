package com.sunshine.travel.service.support;

import com.sunshine.travel.entity.MessageRecord;
import com.sunshine.travel.mapper.MessageRecordMapper;
import org.springframework.stereotype.Component;

@Component
public class MessagePushSupport {

    private final MessageRecordMapper messageRecordMapper;

    public MessagePushSupport(MessageRecordMapper messageRecordMapper) {
        this.messageRecordMapper = messageRecordMapper;
    }

    public void push(Long userId, String bizType, String templateCode, String title, String content, String languageCode) {
        if (userId == null) {
            return;
        }
        MessageRecord messageRecord = new MessageRecord();
        messageRecord.setUserId(userId);
        messageRecord.setBizType(bizType);
        messageRecord.setTemplateCode(templateCode);
        messageRecord.setTitle(title);
        messageRecord.setContent(content);
        messageRecord.setLanguageCode(languageCode == null ? "zh-CN" : languageCode);
        messageRecord.setSendStatus("SUCCESS");
        messageRecordMapper.insert(messageRecord);
    }
}
