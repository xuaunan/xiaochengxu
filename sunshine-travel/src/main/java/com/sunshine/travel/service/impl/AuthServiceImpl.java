package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.AuthStatus;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.AuthLoginRequest;
import com.sunshine.travel.dto.AuthRegisterRequest;
import com.sunshine.travel.dto.ProfileUpdateRequest;
import com.sunshine.travel.dto.RealNameSubmitRequest;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.service.AuthService;
import com.sunshine.travel.util.JwtUtil;
import com.sunshine.travel.util.PasswordUtil;
import com.sunshine.travel.util.ProfileFieldGuard;
import com.sunshine.travel.vo.AuthLoginVO;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuthServiceImpl implements AuthService {

    private static final Set<String> ALLOWED_AVATAR_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp");

    private final PlatformUserMapper platformUserMapper;
    private final DriverProfileMapper driverProfileMapper;
    private final JwtUtil jwtUtil;
    private final String uploadDir;

    public AuthServiceImpl(PlatformUserMapper platformUserMapper,
                           DriverProfileMapper driverProfileMapper,
                           JwtUtil jwtUtil,
                           @Value("${app.upload-dir}") String uploadDir) {
        this.platformUserMapper = platformUserMapper;
        this.driverProfileMapper = driverProfileMapper;
        this.jwtUtil = jwtUtil;
        this.uploadDir = uploadDir;
    }

    @Override
    @Transactional
    public PlatformUser register(AuthRegisterRequest request) {
        if (!RoleCode.isValid(request.getRoleCode())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "角色类型不合法");
        }
        PlatformUser existing = platformUserMapper.selectOne(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getPhone, request.getPhone())
                .eq(PlatformUser::getRoleCode, request.getRoleCode()));
        if (existing != null) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "该手机号已注册当前角色");
        }
        PlatformUser user = new PlatformUser();
        user.setPhone(request.getPhone());
        user.setPassword(PasswordUtil.encode(request.getPassword()));
        user.setNickname(ProfileFieldGuard.sanitizeRequired("昵称", request.getNickname()));
        user.setRoleCode(request.getRoleCode());
        user.setOpenId("mock-" + request.getPhone() + "-" + request.getRoleCode());
        user.setAuthStatus(AuthStatus.UNVERIFIED);
        user.setEnabled(1);
        user.setWalletBalance(BigDecimal.valueOf(200));
        user.setMemberStatus("NONE");
        user.setMemberLevel("普通用户");
        user.setDefaultLanguage(StringUtils.hasText(request.getDefaultLanguage()) ? request.getDefaultLanguage() : "zh-CN");
        platformUserMapper.insert(user);
        if (RoleCode.DRIVER.equals(request.getRoleCode())) {
            DriverProfile driverProfile = new DriverProfile();
            driverProfile.setUserId(user.getId());
            driverProfile.setDriverNo("DRV" + user.getId());
            driverProfile.setLicenseNo("PENDING");
            driverProfile.setServiceStatus(DriverServiceStatus.OFFLINE);
            driverProfile.setAuditStatus(AuthStatus.UNVERIFIED);
            driverProfile.setScore(BigDecimal.valueOf(5));
            driverProfile.setTotalIncome(BigDecimal.ZERO);
            driverProfile.setWithdrawableIncome(BigDecimal.ZERO);
            driverProfile.setCityCode("310100");
            driverProfileMapper.insert(driverProfile);
        }
        user.setPassword(null);
        return user;
    }

    @Override
    public AuthLoginVO login(AuthLoginRequest request) {
        if (!RoleCode.isValid(request.getRoleCode())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "角色类型不合法");
        }
        PlatformUser user = platformUserMapper.selectOne(new LambdaQueryWrapper<PlatformUser>()
                .eq(PlatformUser::getPhone, request.getPhone())
                .eq(PlatformUser::getRoleCode, request.getRoleCode()));
        if (user == null || !PasswordUtil.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "账号或密码错误");
        }
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号已被禁用");
        }
        return buildLoginVO(user);
    }

    @Override
    public AuthLoginVO refreshToken() {
        PlatformUser user = requireCurrentUser();
        return buildLoginVO(user);
    }

    @Override
    public PlatformUser currentProfile() {
        PlatformUser user = requireCurrentUser();
        user.setPassword(null);
        return user;
    }

    @Override
    @Transactional
    public PlatformUser updateProfile(ProfileUpdateRequest request) {
        PlatformUser user = requireCurrentUser();
        user.setNickname(ProfileFieldGuard.sanitizeRequired("昵称", request.getNickname()));
        if (StringUtils.hasText(request.getAvatar())) {
            user.setAvatar(request.getAvatar().trim());
        } else if (!StringUtils.hasText(user.getAvatar())) {
            user.setAvatar("/images/avatar-user.svg");
        }
        user.setRealName(ProfileFieldGuard.sanitizeOptional("真实姓名", request.getRealName()));
        user.setEmergencyContact(ProfileFieldGuard.sanitizeOptional("紧急联系人", request.getEmergencyContact()));
        user.setEmergencyPhone(cleanOptional(request.getEmergencyPhone()));
        platformUserMapper.updateById(user);
        user.setPassword(null);
        return user;
    }

    @Override
    @Transactional
    public Map<String, Object> uploadAvatar(MultipartFile file) {
        PlatformUser user = requireCurrentUser();
        if (!RoleCode.USER.equals(user.getRoleCode())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Avatar upload is only available for passengers");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Please select an avatar image");
        }

        String extension = resolveAvatarExtension(file.getOriginalFilename());
        if (!ALLOWED_AVATAR_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Only JPG, PNG, and WEBP images are supported");
        }

        String fileName = "avatar-" + UUID.randomUUID().toString().replace("-", "") + extension;
        Path targetPath = Path.of(uploadDir, "avatars", String.valueOf(user.getId()), fileName);
        try {
            Files.createDirectories(targetPath.getParent());
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "Failed to save avatar image");
        }

        String fileUrl = "/uploads/avatars/" + user.getId() + "/" + fileName;
        user.setAvatar(fileUrl);
        platformUserMapper.updateById(user);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileUrl", fileUrl);
        result.put("avatar", fileUrl);
        result.put("originalName", file.getOriginalFilename());
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> submitRealName(RealNameSubmitRequest request) {
        PlatformUser user = requireCurrentUser();
        user.setRealName(ProfileFieldGuard.sanitizeRequired("真实姓名", request.getRealName()));
        user.setIdCard(request.getIdCard());
        user.setAuthStatus(AuthStatus.PENDING);
        user.setAuthRemark("用户已提交实名认证，待管理员审核");
        platformUserMapper.updateById(user);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", user.getId());
        result.put("authStatus", user.getAuthStatus());
        result.put("message", "实名认证资料已提交");
        return result;
    }

    private String resolveAvatarExtension(String fileName) {
        if (!StringUtils.hasText(fileName) || !fileName.contains(".")) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "Uploaded image is missing a file extension");
        }
        return fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    }

    private PlatformUser requireCurrentUser() {
        Long userId = UserContext.userId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        PlatformUser user = platformUserMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private String cleanOptional(String value) {
        return value == null ? "" : value.trim();
    }

    private AuthLoginVO buildLoginVO(PlatformUser user) {
        return AuthLoginVO.builder()
                .token(jwtUtil.createToken(user.getId(), user.getRoleCode(), user.getNickname()))
                .userId(user.getId())
                .roleCode(user.getRoleCode())
                .nickname(user.getNickname())
                .defaultLanguage(user.getDefaultLanguage())
                .authStatus(user.getAuthStatus())
                .build();
    }
}
