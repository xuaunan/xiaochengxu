package com.sunshine.travel.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthLoginVO {

    private String token;
    private Long userId;
    private String roleCode;
    private String nickname;
    private String defaultLanguage;
    private Integer authStatus;
}
