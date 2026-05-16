package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_message_record")
public class MessageRecord extends BaseEntity {

    private Long userId;
    private String bizType;
    private String templateCode;
    private String title;
    private String content;
    private String languageCode;
    private String sendStatus;
}
