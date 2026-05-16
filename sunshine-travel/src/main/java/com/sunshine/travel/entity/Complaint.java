package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_complaint")
public class Complaint extends BaseEntity {

    private Long orderId;
    private Long userId;
    private String complaintType;
    private String content;
    private String handleStatus;
    private String handleResult;
    private LocalDateTime handleTime;
}
