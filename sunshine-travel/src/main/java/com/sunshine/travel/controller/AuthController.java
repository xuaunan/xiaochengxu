package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireLogin;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.dto.AuthLoginRequest;
import com.sunshine.travel.dto.AuthRegisterRequest;
import com.sunshine.travel.dto.ProfileUpdateRequest;
import com.sunshine.travel.dto.RealNameSubmitRequest;
import com.sunshine.travel.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "认证模块")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "用户注册")
    @PostMapping("/register")
    public ApiResponse<?> register(@Valid @RequestBody AuthRegisterRequest request) {
        return ApiResponse.success("注册成功", authService.register(request));
    }

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public ApiResponse<?> login(@Valid @RequestBody AuthLoginRequest request) {
        return ApiResponse.success("登录成功", authService.login(request));
    }

    @Operation(summary = "刷新令牌")
    @RequireLogin
    @PostMapping("/refresh")
    public ApiResponse<?> refresh() {
        return ApiResponse.success("刷新成功", authService.refreshToken());
    }

    @Operation(summary = "当前登录用户信息")
    @RequireLogin
    @GetMapping("/profile")
    public ApiResponse<?> profile() {
        return ApiResponse.success(authService.currentProfile());
    }

    @Operation(summary = "编辑当前登录用户资料")
    @RequireLogin
    @PutMapping("/profile")
    public ApiResponse<?> updateProfile(@Valid @RequestBody ProfileUpdateRequest request) {
        return ApiResponse.success("资料更新成功", authService.updateProfile(request));
    }

    @Operation(summary = "上传当前登录用户头像")
    @RequireLogin
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return ApiResponse.success("头像上传成功", authService.uploadAvatar(file));
    }

    @Operation(summary = "提交实名认证")
    @RequireLogin
    @PostMapping("/real-name")
    public ApiResponse<?> submitRealName(@Valid @RequestBody RealNameSubmitRequest request) {
        return ApiResponse.success("实名认证资料已提交", authService.submitRealName(request));
    }
}
