package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_system_notice")
public class SystemNotice extends BaseEntity {

    private String title;
    private String content;
    private Integer status;
    private Integer sortNo;
    private String targetRole;
}
