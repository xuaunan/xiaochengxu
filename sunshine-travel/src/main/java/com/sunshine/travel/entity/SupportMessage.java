package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_support_message")
public class SupportMessage extends BaseEntity {

    private Long conversationId;
    private Long senderId;
    private String senderRole;
    private String content;
}
