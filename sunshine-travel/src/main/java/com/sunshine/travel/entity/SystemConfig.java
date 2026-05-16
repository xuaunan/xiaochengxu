package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_system_config")
public class SystemConfig extends BaseEntity {

    private String configKey;
    private String configName;
    private String configValue;
    private String configType;
    private String configGroup;
    private String remark;
}
