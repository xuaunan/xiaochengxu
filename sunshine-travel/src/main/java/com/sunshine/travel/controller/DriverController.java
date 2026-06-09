package com.sunshine.travel.controller;

import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.dto.DriverCertificationRequest;
import com.sunshine.travel.dto.DriverProfileUpdateRequest;
import com.sunshine.travel.dto.DriverStatusRequest;
import com.sunshine.travel.dto.WithdrawRequest;
import com.sunshine.travel.service.DriverService;
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

@Tag(name = "Driver")
@RequireRole(RoleCode.DRIVER)
@RestController
@RequestMapping("/driver")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @Operation(summary = "Driver dashboard")
    @GetMapping("/dashboard")
    public ApiResponse<?> dashboard() {
        return ApiResponse.success(driverService.dashboard());
    }

    @Operation(summary = "Driver withdraw records")
    @GetMapping("/withdraws")
    public ApiResponse<?> withdraws() {
        return ApiResponse.success(driverService.withdraws());
    }

    @Operation(summary = "Update driver profile")
    @PutMapping("/profile")
    public ApiResponse<?> updateProfile(@Valid @RequestBody DriverProfileUpdateRequest request) {
        return ApiResponse.success("Driver profile updated", driverService.updateProfile(request));
    }

    @Operation(summary = "Update driver service status")
    @PostMapping("/service-status")
    public ApiResponse<?> serviceStatus(@Valid @RequestBody DriverStatusRequest request) {
        driverService.toggleServiceStatus(request);
        return ApiResponse.success("Driver status updated");
    }

    @Operation(summary = "Submit withdraw request")
    @PostMapping("/withdraw")
    public ApiResponse<?> withdraw(@Valid @RequestBody WithdrawRequest request) {
        driverService.withdraw(request);
        return ApiResponse.success("Withdraw request submitted");
    }

    @Operation(summary = "Submit driver certification")
    @PostMapping("/certification")
    public ApiResponse<?> certification(@Valid @RequestBody DriverCertificationRequest request) {
        return ApiResponse.success("Driver certification submitted", driverService.submitCertification(request));
    }

    @Operation(summary = "Upload driver document")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> upload(@RequestParam("file") MultipartFile file,
                                 @RequestParam(required = false) String documentType) {
        return ApiResponse.success("File uploaded", driverService.uploadCertificationDocument(file, documentType));
    }
}
