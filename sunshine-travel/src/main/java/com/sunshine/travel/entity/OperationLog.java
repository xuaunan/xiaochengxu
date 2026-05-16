package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_operation_log")
public class OperationLog extends BaseEntity {

    private Long operatorId;
    private String operatorRole;
    private String bizModule;
    private String bizAction;
    private String targetType;
    private Long targetId;
    private String content;
}
