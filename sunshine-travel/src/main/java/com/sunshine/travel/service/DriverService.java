package com.sunshine.travel.service;

import com.sunshine.travel.dto.DriverCertificationRequest;
import com.sunshine.travel.dto.DriverProfileUpdateRequest;
import com.sunshine.travel.dto.DriverStatusRequest;
import com.sunshine.travel.dto.WithdrawRequest;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

public interface DriverService {

    Map<String, Object> dashboard();

    Map<String, Object> updateProfile(DriverProfileUpdateRequest request);

    void toggleServiceStatus(DriverStatusRequest request);

    void withdraw(WithdrawRequest request);

    Map<String, Object> submitCertification(DriverCertificationRequest request);

    Map<String, Object> uploadCertificationDocument(MultipartFile file, String documentType);
}
