package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.AuthStatus;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.OrderStatus;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.common.WithdrawStatus;
import com.sunshine.travel.dto.DriverCertificationRequest;
import com.sunshine.travel.dto.DriverProfileUpdateRequest;
import com.sunshine.travel.dto.DriverStatusRequest;
import com.sunshine.travel.dto.WithdrawRequest;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.entity.Vehicle;
import com.sunshine.travel.entity.WithdrawApplication;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.mapper.VehicleMapper;
import com.sunshine.travel.mapper.WithdrawApplicationMapper;
import com.sunshine.travel.service.DriverService;
import com.sunshine.travel.service.support.CacheSupport;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DriverServiceImpl implements DriverService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp");

    private final DriverProfileMapper driverProfileMapper;
    private final PlatformUserMapper platformUserMapper;
    private final RideOrderMapper rideOrderMapper;
    private final WithdrawApplicationMapper withdrawApplicationMapper;
    private final VehicleMapper vehicleMapper;
    private final CacheSupport cacheSupport;
    private final String uploadDir;

    public DriverServiceImpl(DriverProfileMapper driverProfileMapper,
                             PlatformUserMapper platformUserMapper,
                             RideOrderMapper rideOrderMapper,
                             WithdrawApplicationMapper withdrawApplicationMapper,
                             VehicleMapper vehicleMapper,
                             CacheSupport cacheSupport,
                             @Value("${app.upload-dir}") String uploadDir) {
        this.driverProfileMapper = driverProfileMapper;
        this.platformUserMapper = platformUserMapper;
        this.rideOrderMapper = rideOrderMapper;
        this.withdrawApplicationMapper = withdrawApplicationMapper;
        this.vehicleMapper = vehicleMapper;
        this.cacheSupport = cacheSupport;
        this.uploadDir = uploadDir;
    }

    @Override
    public Map<String, Object> dashboard() {
        PlatformUser user = requireDriverUser();
        user.setPassword(null);
        DriverProfile profile = requireProfile();
        Long driverId = UserContext.userId();
        List<RideOrder> orders = rideOrderMapper.selectList(new LambdaQueryWrapper<RideOrder>()
                .eq(RideOrder::getDriverId, driverId)
                .orderByDesc(RideOrder::getId)
                .last("limit 20"));
        Vehicle vehicle = queryVehicle(driverId);
        Map<String, Object> servicePermission = buildServicePermission(user, vehicle);
        if (DriverServiceStatus.BUSY.equals(profile.getServiceStatus())) {
            Long activeCount = rideOrderMapper.selectCount(new LambdaQueryWrapper<RideOrder>()
                    .eq(RideOrder::getDriverId, driverId)
                    .in(RideOrder::getOrderStatus, List.of(OrderStatus.ACCEPTED, OrderStatus.PICKING_UP, OrderStatus.IN_TRIP)));
            if (activeCount == null || activeCount == 0) {
                profile.setServiceStatus(Boolean.TRUE.equals(servicePermission.get("canReceiveOrders"))
                        ? DriverServiceStatus.ONLINE
                        : DriverServiceStatus.OFFLINE);
                driverProfileMapper.updateById(profile);
            }
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("user", user);
        map.put("profile", profile);
        map.put("vehicle", vehicle);
        map.put("servicePermission", servicePermission);
        map.put("orders", orders);
        map.put("pendingWithdraw", withdrawApplicationMapper.selectList(new LambdaQueryWrapper<WithdrawApplication>()
                .eq(WithdrawApplication::getDriverId, driverId)
                .eq(WithdrawApplication::getStatus, WithdrawStatus.PENDING)));
        return map;
    }

    @Override
    @Transactional
    public Map<String, Object> updateProfile(DriverProfileUpdateRequest request) {
        PlatformUser user = requireDriverUser();
        DriverProfile profile = requireProfile();
        user.setNickname(cleanRequired(request.getNickname()));
        user.setEmergencyContact(cleanOptional(request.getEmergencyContact()));
        user.setEmergencyPhone(cleanOptional(request.getEmergencyPhone()));
        platformUserMapper.updateById(user);

        profile.setCityCode(cleanRequired(request.getCityCode()));
        profile.setLicenseNo(cleanRequired(request.getLicenseNo()));
        driverProfileMapper.updateById(profile);

        return dashboard();
    }

    @Override
    @Transactional
    public void toggleServiceStatus(DriverStatusRequest request) {
        PlatformUser user = requireDriverUser();
        DriverProfile profile = requireProfile();
        if (!DriverServiceStatus.isValid(request.getServiceStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "司机服务状态不合法");
        }
        if (DriverServiceStatus.ONLINE.equals(request.getServiceStatus()) || DriverServiceStatus.BUSY.equals(request.getServiceStatus())) {
            Map<String, Object> permission = buildServicePermission(user, queryVehicle(profile.getUserId()));
            if (!Boolean.TRUE.equals(permission.get("canReceiveOrders"))) {
                throw new BusinessException(ErrorCode.DRIVER_INVALID, String.valueOf(permission.get("message")));
            }
        }
        profile.setServiceStatus(request.getServiceStatus());
        profile.setLastLongitude(request.getLongitude());
        profile.setLastLatitude(request.getLatitude());
        driverProfileMapper.updateById(profile);
        cacheSupport.set("driver:location:" + profile.getUserId(),
                request.getLongitude() + "," + request.getLatitude() + "," + request.getServiceStatus(),
                Duration.ofHours(2));
    }

    @Override
    @Transactional
    public void withdraw(WithdrawRequest request) {
        DriverProfile profile = requireProfile();
        if (request.getApplyAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "提现金额必须大于 0");
        }
        if (profile.getWithdrawableIncome().compareTo(request.getApplyAmount()) < 0) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "可提现余额不足");
        }
        Long pendingCount = withdrawApplicationMapper.selectCount(new LambdaQueryWrapper<WithdrawApplication>()
                .eq(WithdrawApplication::getDriverId, profile.getUserId())
                .eq(WithdrawApplication::getStatus, WithdrawStatus.PENDING));
        if (pendingCount != null && pendingCount > 0) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "当前存在待审核提现申请");
        }
        WithdrawApplication application = new WithdrawApplication();
        application.setDriverId(profile.getUserId());
        application.setApplyAmount(request.getApplyAmount());
        application.setBankAccount(request.getBankAccount());
        application.setBankName(request.getBankName());
        application.setStatus(WithdrawStatus.PENDING);
        withdrawApplicationMapper.insert(application);
        profile.setWithdrawableIncome(profile.getWithdrawableIncome().subtract(request.getApplyAmount()));
        driverProfileMapper.updateById(profile);
    }

    @Override
    @Transactional
    public Map<String, Object> submitCertification(DriverCertificationRequest request) {
        PlatformUser user = requireDriverUser();
        DriverProfile profile = requireProfile();
        profile.setLicenseNo(request.getLicenseNo());
        profile.setAuditStatus(AuthStatus.PENDING);
        profile.setAuditRemark("司机已提交车辆资料，等待管理员审核");
        if (!DriverServiceStatus.BUSY.equals(profile.getServiceStatus())) {
            profile.setServiceStatus(DriverServiceStatus.OFFLINE);
        }
        driverProfileMapper.updateById(profile);

        Vehicle vehicle = queryVehicle(UserContext.userId());
        if (vehicle == null) {
            vehicle = new Vehicle();
            vehicle.setDriverId(UserContext.userId());
        }
        vehicle.setPlateNo(request.getPlateNo());
        vehicle.setBrand(request.getBrand());
        vehicle.setModelName(request.getModelName());
        vehicle.setColor(request.getColor());
        vehicle.setSeatCount(request.getSeatCount());
        vehicle.setInsuranceExpireDate(request.getInsuranceExpireDate());
        vehicle.setAnnualInspectExpireDate(request.getAnnualInspectExpireDate());
        vehicle.setVehicleLicenseImageUrl(request.getVehicleLicenseImageUrl());
        vehicle.setDriverLicenseImageUrl(request.getDriverLicenseImageUrl());
        vehicle.setAuditStatus(AuthStatus.PENDING);
        vehicle.setAuditRemark("车辆资料已提交，等待审核");
        if (vehicle.getId() == null) {
            vehicleMapper.insert(vehicle);
        } else {
            vehicleMapper.updateById(vehicle);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driverId", user.getId());
        result.put("driverAuditStatus", profile.getAuditStatus());
        result.put("vehicleAuditStatus", vehicle.getAuditStatus());
        result.put("canReceiveOrders", false);
        result.put("message", "已提交，等待管理员审核");
        return result;
    }

    @Override
    public Map<String, Object> uploadCertificationDocument(MultipartFile file, String documentType) {
        requireDriverUser();
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请选择要上传的图片");
        }

        String extension = resolveExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "仅支持 JPG、PNG、WEBP 格式图片");
        }

        String normalizedType = normalizeDocumentType(documentType);
        String fileName = normalizedType + "-" + UUID.randomUUID().toString().replace("-", "") + extension;
        Path targetPath = Path.of(uploadDir, "driver-certification", String.valueOf(UserContext.userId()), fileName);
        try {
            Files.createDirectories(targetPath.getParent());
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "保存上传文件失败");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileUrl", "/uploads/driver-certification/" + UserContext.userId() + "/" + fileName);
        result.put("documentType", normalizedType);
        result.put("originalName", file.getOriginalFilename());
        return result;
    }

    private DriverProfile requireProfile() {
        DriverProfile profile = driverProfileMapper.selectOne(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getUserId, UserContext.userId()));
        if (profile == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "司机资料不存在");
        }
        return profile;
    }

    private PlatformUser requireDriverUser() {
        PlatformUser user = platformUserMapper.selectById(UserContext.userId());
        if (user == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "司机账号不存在");
        }
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号已被管理员禁用");
        }
        return user;
    }

    private String cleanRequired(String value) {
        return value == null ? "" : value.trim();
    }

    private String cleanOptional(String value) {
        return value == null ? "" : value.trim();
    }

    private Vehicle queryVehicle(Long driverId) {
        return vehicleMapper.selectOne(new LambdaQueryWrapper<Vehicle>()
                .eq(Vehicle::getDriverId, driverId)
                .orderByDesc(Vehicle::getId)
                .last("limit 1"));
    }

    private Map<String, Object> buildServicePermission(PlatformUser user, Vehicle vehicle) {
        Map<String, Object> permission = new LinkedHashMap<>();
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            permission.put("canReceiveOrders", false);
            permission.put("message", "司机账号已被管理员禁用");
            return permission;
        }
        if (vehicle == null) {
            permission.put("canReceiveOrders", false);
            permission.put("message", "请先提交车辆信息并通过管理员审核");
            return permission;
        }
        if (vehicle.getAuditStatus() == null || vehicle.getAuditStatus() != AuthStatus.APPROVED) {
            permission.put("canReceiveOrders", false);
            permission.put("message", "请先提交车辆信息并通过管理员审核");
            return permission;
        }
        permission.put("canReceiveOrders", true);
        permission.put("message", "车辆审核已通过，可开始接单");
        return permission;
    }

    private String resolveExtension(String fileName) {
        if (!StringUtils.hasText(fileName) || !fileName.contains(".")) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "上传文件缺少扩展名");
        }
        return fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    }

    private String normalizeDocumentType(String documentType) {
        if (!StringUtils.hasText(documentType)) {
            return "document";
        }
        String normalized = documentType.trim().toLowerCase();
        if (normalized.contains("vehicle")) {
            return "vehicle-license";
        }
        if (normalized.contains("driver")) {
            return "driver-license";
        }
        normalized = normalized.replaceAll("[^a-z0-9-]", "");
        return StringUtils.hasText(normalized) ? normalized : "document";
    }
}
