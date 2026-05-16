package com.sunshine.travel.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthUser {

    private Long userId;
    private String roleCode;
    private String nickname;
}

