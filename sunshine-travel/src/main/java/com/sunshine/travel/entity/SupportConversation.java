package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_support_conversation")
public class SupportConversation extends BaseEntity {

    private Long userId;
    private String userRole;
    private String channel;
    private String status;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private Integer unreadForAdmin;
    private Integer unreadForUser;
}
