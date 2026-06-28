package com.sunshine.travel.service;

import com.sunshine.travel.dto.AuthLoginRequest;
import com.sunshine.travel.dto.AuthRegisterRequest;
import com.sunshine.travel.dto.ProfileUpdateRequest;
import com.sunshine.travel.dto.RealNameSubmitRequest;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.vo.AuthLoginVO;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

public interface AuthService {

    PlatformUser register(AuthRegisterRequest request);

    AuthLoginVO login(AuthLoginRequest request);

    AuthLoginVO refreshToken();

    PlatformUser currentProfile();

    PlatformUser updateProfile(ProfileUpdateRequest request);

    Map<String, Object> uploadAvatar(MultipartFile file);

    Map<String, Object> submitRealName(RealNameSubmitRequest request);
}
