package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_system_version")
public class SystemVersion extends BaseEntity {

    private String versionNo;
    private String clientType;
    private String releaseNote;
    private Integer forceUpdate;
    private Integer status;
    private String downloadUrl;
}
