package com.sunshine.travel.service;

import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.dto.AdminMemberUpdateRequest;
import java.util.Map;

public interface MembershipService {

    Map<String, Object> currentMembership();

    Map<String, Object> activateCurrentUser();

    Map<String, Object> ensureCurrentWeeklyCoupons();

    PageResult<Map<String, Object>> adminMembers(long current, long size, String keyword, String status);

    Map<String, Object> updateMember(Long userId, AdminMemberUpdateRequest request);

    Map<String, Object> grantWeeklyCoupons(Long userId);
}
