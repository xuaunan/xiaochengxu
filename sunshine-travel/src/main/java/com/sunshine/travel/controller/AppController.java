package com.sunshine.travel.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.DriverServiceStatus;
import com.sunshine.travel.entity.CarType;
import com.sunshine.travel.entity.DriverProfile;
import com.sunshine.travel.entity.SystemNotice;
import com.sunshine.travel.mapper.CarTypeMapper;
import com.sunshine.travel.mapper.DriverProfileMapper;
import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.mapper.SystemNoticeMapper;
import com.sunshine.travel.service.CouponService;
import com.sunshine.travel.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "应用首页")
@RestController
@RequestMapping("/app")
public class AppController {

    private final CarTypeMapper carTypeMapper;
    private final CouponService couponService;
    private final OrderService orderService;
    private final SystemNoticeMapper systemNoticeMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final DriverProfileMapper driverProfileMapper;

    public AppController(CarTypeMapper carTypeMapper,
                         CouponService couponService,
                         OrderService orderService,
                         SystemNoticeMapper systemNoticeMapper,
                         SystemConfigMapper systemConfigMapper,
                         DriverProfileMapper driverProfileMapper) {
        this.carTypeMapper = carTypeMapper;
        this.couponService = couponService;
        this.orderService = orderService;
        this.systemNoticeMapper = systemNoticeMapper;
        this.systemConfigMapper = systemConfigMapper;
        this.driverProfileMapper = driverProfileMapper;
    }

    @Operation(summary = "首页聚合数据")
    @GetMapping("/home")
    public ApiResponse<?> home() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("banners", orderService.homeBanners());
        data.put("carTypes", carTypeMapper.selectList(new LambdaQueryWrapper<CarType>().eq(CarType::getEnabled, 1)));
        data.put("couponCenter", couponService.availableCoupons());
        data.put("fleet", fleetSummary());
        data.put("systemConfigs", systemConfigMapper.selectList(null).stream()
                .collect(LinkedHashMap::new,
                        (result, item) -> result.put(item.getConfigKey(), item.getConfigValue()),
                        Map::putAll));
        List<String> notices = systemNoticeMapper.selectList(new LambdaQueryWrapper<SystemNotice>()
                        .eq(SystemNotice::getStatus, 1)
                        .orderByDesc(SystemNotice::getSortNo)
                        .orderByDesc(SystemNotice::getId))
                .stream()
                .map(SystemNotice::getTitle)
                .limit(3)
                .toList();
        data.put("notices", notices);
        return ApiResponse.success(data);
    }

    @Operation(summary = "系统连接状态")
    @GetMapping("/health")
    public ApiResponse<?> health() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("backend", true);
        try {
            systemConfigMapper.selectCount(null);
            data.put("database", true);
        } catch (Exception exception) {
            data.put("database", false);
        }
        return ApiResponse.success(data);
    }

    private Map<String, Object> fleetSummary() {
        Long idle = driverProfileMapper.selectCount(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getServiceStatus, DriverServiceStatus.ONLINE));
        Long busy = driverProfileMapper.selectCount(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getServiceStatus, DriverServiceStatus.BUSY));
        Long offline = driverProfileMapper.selectCount(new LambdaQueryWrapper<DriverProfile>()
                .eq(DriverProfile::getServiceStatus, DriverServiceStatus.OFFLINE));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("onlineDriverCount", idle + busy);
        data.put("idleDriverCount", idle);
        data.put("busyDriverCount", busy);
        data.put("serviceDriverCount", busy);
        data.put("offlineDriverCount", offline);
        return data;
    }

    @Operation(summary = "费用试算")
    @GetMapping("/estimate")
    public ApiResponse<?> estimate(@RequestParam Long carTypeId,
                                   @RequestParam String serviceType,
                                   @RequestParam BigDecimal distanceKm,
                                   @RequestParam BigDecimal durationMin) {
        return ApiResponse.success(orderService.estimate(carTypeId, serviceType, distanceKm, durationMin));
    }
}
