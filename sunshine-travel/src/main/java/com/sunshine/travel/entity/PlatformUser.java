package com.sunshine.travel.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_platform_user")
public class PlatformUser extends BaseEntity {

    private String openId;
    private String phone;
    private String password;
    private String nickname;
    private String avatar;
    private String realName;
    private String idCard;
    private String gender;
    private String roleCode;
    private Integer authStatus;
    private Integer enabled;
    private BigDecimal walletBalance;
    private String memberStatus;
    private String memberLevel;
    private LocalDateTime memberOpenedAt;
    private LocalDateTime memberExpireAt;
    private String memberLastCouponWeek;
    private String emergencyContact;
    private String emergencyPhone;
    private String defaultLanguage;
    private String authRemark;
}
