package com.sunshine.travel.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CarpoolApplyStatus;
import com.sunshine.travel.common.CarpoolTripStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.CarpoolApplyRequest;
import com.sunshine.travel.dto.CarpoolCancelRequest;
import com.sunshine.travel.dto.CarpoolConfirmRequest;
import com.sunshine.travel.dto.CarpoolPublishRequest;
import com.sunshine.travel.entity.CarpoolApplication;
import com.sunshine.travel.entity.CarpoolTrip;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.mapper.CarpoolApplicationMapper;
import com.sunshine.travel.mapper.CarpoolTripMapper;
import com.sunshine.travel.mapper.PlatformUserMapper;
import com.sunshine.travel.service.CarpoolService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CarpoolServiceImpl implements CarpoolService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final CarpoolTripMapper carpoolTripMapper;
    private final CarpoolApplicationMapper carpoolApplicationMapper;
    private final PlatformUserMapper platformUserMapper;

    public CarpoolServiceImpl(CarpoolTripMapper carpoolTripMapper,
                              CarpoolApplicationMapper carpoolApplicationMapper,
                              PlatformUserMapper platformUserMapper) {
        this.carpoolTripMapper = carpoolTripMapper;
        this.carpoolApplicationMapper = carpoolApplicationMapper;
        this.platformUserMapper = platformUserMapper;
    }

    @Override
    @Transactional
    public Map<String, Object> publish(CarpoolPublishRequest request) {
        if (request.getDepartTime().isBefore(LocalDateTime.now().plusMinutes(30))) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "出发时间至少晚于当前30分钟");
        }
        if (request.getStartName().equals(request.getEndName())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "顺风车起终点不能相同");
        }
        CarpoolTrip trip = new CarpoolTrip();
        trip.setOwnerUserId(UserContext.userId());
        trip.setTripNo("CP" + IdUtil.getSnowflakeNextIdStr());
        trip.setStartName(request.getStartName());
        trip.setEndName(request.getEndName());
        trip.setDepartTime(request.getDepartTime());
        trip.setSeatCount(request.getSeatCount());
        trip.setRemainSeatCount(request.getSeatCount());
        trip.setSharedAmount(request.getSharedAmount());
        trip.setLanguageCode("zh-CN");
        trip.setBaggageRule(request.getBaggageRule());
        trip.setTripRemark(request.getTripRemark());
        trip.setStatus(CarpoolTripStatus.PUBLISHED);
        carpoolTripMapper.insert(trip);
        return buildTripCard(trip, UserContext.userId());
    }

    @Override
    public List<Map<String, Object>> search(String keyword) {
        LambdaQueryWrapper<CarpoolTrip> wrapper = new LambdaQueryWrapper<CarpoolTrip>()
                .in(CarpoolTrip::getStatus, List.of(CarpoolTripStatus.PUBLISHED, CarpoolTripStatus.MATCHING, CarpoolTripStatus.FULL))
                .ge(CarpoolTrip::getDepartTime, LocalDateTime.now())
                .orderByAsc(CarpoolTrip::getDepartTime);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(q -> q.like(CarpoolTrip::getStartName, keyword).or().like(CarpoolTrip::getEndName, keyword));
        }
        Long currentUserId = UserContext.userId();
        return carpoolTripMapper.selectList(wrapper).stream()
                .map(item -> buildTripCard(item, currentUserId))
                .toList();
    }

    @Override
    public Map<String, Object> detail(Long tripId) {
        CarpoolTrip trip = requireTrip(tripId);
        Long currentUserId = UserContext.userId();
        List<CarpoolApplication> applications = listApplicationsByTrip(trip.getId());
        CarpoolApplication myApplication = findCurrentUserApplication(applications, currentUserId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("trip", buildTripCard(trip, currentUserId));
        result.put("owner", buildUserSummary(queryUser(trip.getOwnerUserId())));
        result.put("summary", buildTripSummary(trip, applications));
        result.put("currentUserRole", resolveCurrentUserRole(trip, currentUserId, myApplication));
        result.put("myApplication", myApplication == null ? null : buildApplicationCard(myApplication, trip, currentUserId, false));
        result.put("applications", buildVisibleApplications(trip, applications, currentUserId));
        return result;
    }

    @Override
    @Transactional
    public void apply(CarpoolApplyRequest request) {
        CarpoolTrip trip = requireTrip(request.getTripId());
        if (Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "不能申请自己的顺风车行程");
        }
        if (List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED, CarpoolTripStatus.CONFIRMED).contains(trip.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前行程不可申请");
        }
        int needSeat = request.getCompanionCount() + 1;
        if (trip.getRemainSeatCount() < needSeat) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "剩余座位不足");
        }
        Long count = carpoolApplicationMapper.selectCount(new LambdaQueryWrapper<CarpoolApplication>()
                .eq(CarpoolApplication::getTripId, trip.getId())
                .eq(CarpoolApplication::getPassengerUserId, UserContext.userId())
                .in(CarpoolApplication::getApplicationStatus, List.of(
                        CarpoolApplyStatus.APPLIED,
                        CarpoolApplyStatus.OWNER_CONFIRMED,
                        CarpoolApplyStatus.PASSENGER_CONFIRMED,
                        CarpoolApplyStatus.CONFIRMED)));
        if (count != null && count > 0) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "您已申请过该行程");
        }
        CarpoolApplication application = new CarpoolApplication();
        application.setTripId(trip.getId());
        application.setPassengerUserId(UserContext.userId());
        application.setCompanionCount(request.getCompanionCount());
        application.setSharedAmount(trip.getSharedAmount().multiply(BigDecimal.valueOf(needSeat)));
        application.setApplicationStatus(CarpoolApplyStatus.APPLIED);
        application.setNote(request.getNote());
        carpoolApplicationMapper.insert(application);
        trip.setRemainSeatCount(trip.getRemainSeatCount() - needSeat);
        syncTripStatus(trip);
    }

    @Override
    @Transactional
    public void ownerConfirm(CarpoolConfirmRequest request) {
        CarpoolApplication application = requireApplication(request.getApplicationId());
        CarpoolTrip trip = requireTrip(application.getTripId());
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以执行该操作");
        }
        if ("REJECT".equalsIgnoreCase(request.getAction())) {
            application.setApplicationStatus(CarpoolApplyStatus.REJECTED);
            application.setCancelReason(request.getNote());
            carpoolApplicationMapper.updateById(application);
            releaseSeat(trip, application);
            return;
        }
        if (!"APPROVE".equalsIgnoreCase(request.getAction())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "车主操作类型不合法");
        }
        if (!CarpoolApplyStatus.APPLIED.equals(application.getApplicationStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前申请状态不允许车主确认");
        }
        application.setApplicationStatus(CarpoolApplyStatus.OWNER_CONFIRMED);
        application.setOwnerConfirmedAt(LocalDateTime.now());
        application.setNote(request.getNote());
        carpoolApplicationMapper.updateById(application);
    }

    @Override
    @Transactional
    public void passengerConfirm(CarpoolConfirmRequest request) {
        CarpoolApplication application = requireApplication(request.getApplicationId());
        if (!Objects.equals(application.getPassengerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有申请乘客可以执行该操作");
        }
        if (!"CONFIRM".equalsIgnoreCase(request.getAction())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "乘客操作类型不合法");
        }
        if (!CarpoolApplyStatus.OWNER_CONFIRMED.equals(application.getApplicationStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前申请尚未通过车主确认");
        }
        application.setApplicationStatus(CarpoolApplyStatus.CONFIRMED);
        application.setPassengerConfirmedAt(LocalDateTime.now());
        application.setNote(request.getNote());
        carpoolApplicationMapper.updateById(application);
        syncTripStatus(requireTrip(application.getTripId()));
    }

    @Override
    @Transactional
    public void cancel(CarpoolCancelRequest request) {
        CarpoolApplication application = requireApplication(request.getApplicationId());
        CarpoolTrip trip = requireTrip(application.getTripId());
        boolean isOwner = Objects.equals(trip.getOwnerUserId(), UserContext.userId());
        boolean isPassenger = Objects.equals(application.getPassengerUserId(), UserContext.userId());
        if (!isOwner && !isPassenger) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权限取消该拼车申请");
        }
        if (List.of(CarpoolApplyStatus.CANCELLED, CarpoolApplyStatus.REJECTED).contains(application.getApplicationStatus())) {
            return;
        }
        application.setApplicationStatus(CarpoolApplyStatus.CANCELLED);
        application.setCancelReason(request.getReason());
        carpoolApplicationMapper.updateById(application);
        releaseSeat(trip, application);
    }

    @Override
    public Map<String, Object> myTrips() {
        Long currentUserId = UserContext.userId();
        List<Map<String, Object>> ownerRecords = carpoolTripMapper.selectList(new LambdaQueryWrapper<CarpoolTrip>()
                        .eq(CarpoolTrip::getOwnerUserId, currentUserId)
                        .orderByDesc(CarpoolTrip::getId))
                .stream()
                .map(item -> buildOwnerTripRecord(item, currentUserId))
                .toList();

        List<Map<String, Object>> passengerRecords = carpoolApplicationMapper.selectList(new LambdaQueryWrapper<CarpoolApplication>()
                        .eq(CarpoolApplication::getPassengerUserId, currentUserId)
                        .orderByDesc(CarpoolApplication::getId))
                .stream()
                .map(item -> buildPassengerTripRecord(item, currentUserId))
                .sorted(Comparator.comparing(item -> String.valueOf(item.get("departTime")), Comparator.reverseOrder()))
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", buildMineSummary(ownerRecords, passengerRecords));
        result.put("ownerRecords", ownerRecords);
        result.put("passengerRecords", passengerRecords);
        return result;
    }

    private CarpoolTrip requireTrip(Long tripId) {
        CarpoolTrip trip = carpoolTripMapper.selectById(tripId);
        if (trip == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "顺风车行程不存在");
        }
        return trip;
    }

    private CarpoolApplication requireApplication(Long applicationId) {
        CarpoolApplication application = carpoolApplicationMapper.selectById(applicationId);
        if (application == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "拼车申请不存在");
        }
        return application;
    }

    private List<CarpoolApplication> listApplicationsByTrip(Long tripId) {
        return carpoolApplicationMapper.selectList(new LambdaQueryWrapper<CarpoolApplication>()
                .eq(CarpoolApplication::getTripId, tripId)
                .orderByDesc(CarpoolApplication::getId));
    }

    private PlatformUser queryUser(Long userId) {
        return userId == null ? null : platformUserMapper.selectById(userId);
    }

    private void releaseSeat(CarpoolTrip trip, CarpoolApplication application) {
        int seat = application.getCompanionCount() + 1;
        trip.setRemainSeatCount(trip.getRemainSeatCount() + seat);
        syncTripStatus(trip);
    }

    private void syncTripStatus(CarpoolTrip trip) {
        if (CarpoolTripStatus.CANCELLED.equals(trip.getStatus()) || CarpoolTripStatus.FINISHED.equals(trip.getStatus())) {
            carpoolTripMapper.updateById(trip);
            return;
        }
        List<CarpoolApplication> applications = listApplicationsByTrip(trip.getId());
        boolean hasConfirmed = applications.stream()
                .anyMatch(item -> CarpoolApplyStatus.CONFIRMED.equals(item.getApplicationStatus()));
        if (hasConfirmed) {
            trip.setStatus(CarpoolTripStatus.CONFIRMED);
        } else if (trip.getRemainSeatCount() == null || Objects.equals(trip.getRemainSeatCount(), trip.getSeatCount())) {
            trip.setStatus(CarpoolTripStatus.PUBLISHED);
        } else if (trip.getRemainSeatCount() <= 0) {
            trip.setStatus(CarpoolTripStatus.FULL);
        } else {
            trip.setStatus(CarpoolTripStatus.MATCHING);
        }
        carpoolTripMapper.updateById(trip);
    }

    private CarpoolApplication findCurrentUserApplication(List<CarpoolApplication> applications, Long currentUserId) {
        if (currentUserId == null) {
            return null;
        }
        return applications.stream()
                .filter(item -> Objects.equals(item.getPassengerUserId(), currentUserId))
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> buildTripCard(CarpoolTrip trip, Long currentUserId) {
        PlatformUser owner = queryUser(trip.getOwnerUserId());
        List<CarpoolApplication> applications = listApplicationsByTrip(trip.getId());
        CarpoolApplication myApplication = findCurrentUserApplication(applications, currentUserId);
        Map<String, Object> summary = buildTripSummary(trip, applications);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", trip.getId());
        map.put("tripNo", trip.getTripNo());
        map.put("startName", trip.getStartName());
        map.put("endName", trip.getEndName());
        map.put("departTime", trip.getDepartTime());
        map.put("departTimeText", formatDateTime(trip.getDepartTime()));
        map.put("seatCount", trip.getSeatCount());
        map.put("remainSeatCount", trip.getRemainSeatCount());
        map.put("sharedAmount", trip.getSharedAmount());
        map.put("languageCode", trip.getLanguageCode());
        map.put("baggageRule", trip.getBaggageRule());
        map.put("tripRemark", trip.getTripRemark());
        map.put("status", trip.getStatus());
        map.put("statusText", tripStatusText(trip.getStatus()));
        map.put("statusTone", tripStatusTone(trip.getStatus()));
        map.put("ownerUserId", trip.getOwnerUserId());
        map.put("ownerName", owner == null ? "车主未实名" : owner.getNickname());
        map.put("ownerPhoneMask", owner == null ? "" : maskPhone(owner.getPhone()));
        map.put("ownerAvatar", owner == null ? "" : owner.getAvatar());
        map.put("bookedSeatCount", summary.get("bookedSeatCount"));
        map.put("pendingApplicationCount", summary.get("pendingApplicationCount"));
        map.put("confirmedApplicationCount", summary.get("confirmedApplicationCount"));
        map.put("applicationCount", summary.get("applicationCount"));
        map.put("currentUserRole", resolveCurrentUserRole(trip, currentUserId, myApplication));
        map.put("hasApplied", myApplication != null);
        map.put("canApply", canApplyTrip(trip, currentUserId, myApplication));
        map.put("myApplicationStatus", myApplication == null ? "" : myApplication.getApplicationStatus());
        map.put("myApplicationStatusText", myApplication == null ? "" : applicationStatusText(myApplication.getApplicationStatus()));
        map.put("canPassengerConfirm", myApplication != null
                && Objects.equals(currentUserId, myApplication.getPassengerUserId())
                && CarpoolApplyStatus.OWNER_CONFIRMED.equals(myApplication.getApplicationStatus()));
        map.put("canPassengerCancel", myApplication != null
                && Objects.equals(currentUserId, myApplication.getPassengerUserId())
                && canCancelApplication(myApplication));
        return map;
    }

    private Map<String, Object> buildTripSummary(CarpoolTrip trip, List<CarpoolApplication> applications) {
        long pendingCount = applications.stream()
                .filter(item -> CarpoolApplyStatus.APPLIED.equals(item.getApplicationStatus()))
                .count();
        long confirmedCount = applications.stream()
                .filter(item -> List.of(
                                CarpoolApplyStatus.OWNER_CONFIRMED,
                                CarpoolApplyStatus.PASSENGER_CONFIRMED,
                                CarpoolApplyStatus.CONFIRMED)
                        .contains(item.getApplicationStatus()))
                .count();
        int seatCount = trip.getSeatCount() == null ? 0 : trip.getSeatCount();
        int remainSeatCount = trip.getRemainSeatCount() == null ? 0 : trip.getRemainSeatCount();

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("seatCount", seatCount);
        map.put("remainSeatCount", remainSeatCount);
        map.put("bookedSeatCount", Math.max(seatCount - remainSeatCount, 0));
        map.put("applicationCount", applications.size());
        map.put("pendingApplicationCount", pendingCount);
        map.put("confirmedApplicationCount", confirmedCount);
        return map;
    }

    private List<Map<String, Object>> buildVisibleApplications(CarpoolTrip trip,
                                                               List<CarpoolApplication> applications,
                                                               Long currentUserId) {
        if (Objects.equals(trip.getOwnerUserId(), currentUserId)) {
            return applications.stream()
                    .map(item -> buildApplicationCard(item, trip, currentUserId, true))
                    .toList();
        }
        return applications.stream()
                .filter(item -> Objects.equals(item.getPassengerUserId(), currentUserId))
                .map(item -> buildApplicationCard(item, trip, currentUserId, false))
                .toList();
    }

    private Map<String, Object> buildApplicationCard(CarpoolApplication application,
                                                     CarpoolTrip trip,
                                                     Long currentUserId,
                                                     boolean exposePassenger) {
        PlatformUser passenger = queryUser(application.getPassengerUserId());
        int totalSeatCount = (application.getCompanionCount() == null ? 0 : application.getCompanionCount()) + 1;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", application.getId());
        map.put("tripId", application.getTripId());
        map.put("companionCount", application.getCompanionCount());
        map.put("totalSeatCount", totalSeatCount);
        map.put("sharedAmount", application.getSharedAmount());
        map.put("applicationStatus", application.getApplicationStatus());
        map.put("applicationStatusText", applicationStatusText(application.getApplicationStatus()));
        map.put("statusTone", applicationStatusTone(application.getApplicationStatus()));
        map.put("note", application.getNote());
        map.put("cancelReason", application.getCancelReason());
        map.put("ownerConfirmedAt", application.getOwnerConfirmedAt());
        map.put("passengerConfirmedAt", application.getPassengerConfirmedAt());
        map.put("canOwnerApprove", Objects.equals(trip.getOwnerUserId(), currentUserId)
                && CarpoolApplyStatus.APPLIED.equals(application.getApplicationStatus()));
        map.put("canOwnerReject", Objects.equals(trip.getOwnerUserId(), currentUserId)
                && CarpoolApplyStatus.APPLIED.equals(application.getApplicationStatus()));
        map.put("canPassengerConfirm", Objects.equals(application.getPassengerUserId(), currentUserId)
                && CarpoolApplyStatus.OWNER_CONFIRMED.equals(application.getApplicationStatus()));
        map.put("canPassengerCancel", Objects.equals(application.getPassengerUserId(), currentUserId)
                && canCancelApplication(application));
        if (exposePassenger) {
            map.put("passengerUserId", application.getPassengerUserId());
            map.put("passengerName", passenger == null ? "乘客未实名" : passenger.getNickname());
            map.put("passengerPhoneMask", passenger == null ? "" : maskPhone(passenger.getPhone()));
            map.put("passengerAvatar", passenger == null ? "" : passenger.getAvatar());
        }
        return map;
    }

    private Map<String, Object> buildOwnerTripRecord(CarpoolTrip trip, Long currentUserId) {
        List<CarpoolApplication> applications = listApplicationsByTrip(trip.getId());
        String bucket = resolveTripBucket(trip.getStatus(), trip.getDepartTime());

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("trip", buildTripCard(trip, currentUserId));
        record.put("summary", buildTripSummary(trip, applications));
        record.put("applications", applications.stream()
                .map(item -> buildApplicationCard(item, trip, currentUserId, true))
                .toList());
        record.put("statusBucket", bucket);
        record.put("statusBucketText", statusBucketText(bucket));
        record.put("departTime", trip.getDepartTime());
        return record;
    }

    private Map<String, Object> buildPassengerTripRecord(CarpoolApplication application, Long currentUserId) {
        CarpoolTrip trip = requireTrip(application.getTripId());
        String bucket = resolvePassengerBucket(application, trip);

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("trip", buildTripCard(trip, currentUserId));
        record.put("application", buildApplicationCard(application, trip, currentUserId, false));
        record.put("statusBucket", bucket);
        record.put("statusBucketText", statusBucketText(bucket));
        record.put("departTime", trip.getDepartTime());
        return record;
    }

    private Map<String, Object> buildMineSummary(List<Map<String, Object>> ownerRecords, List<Map<String, Object>> passengerRecords) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("ownerTripTotal", ownerRecords.size());
        map.put("passengerTripTotal", passengerRecords.size());
        map.put("pendingTotal", countByBucket(ownerRecords, passengerRecords, "pending"));
        map.put("upcomingTotal", countByBucket(ownerRecords, passengerRecords, "upcoming"));
        map.put("processingTotal", countByBucket(ownerRecords, passengerRecords, "processing"));
        map.put("completedTotal", countByBucket(ownerRecords, passengerRecords, "completed"));
        return map;
    }

    private long countByBucket(List<Map<String, Object>> ownerRecords, List<Map<String, Object>> passengerRecords, String bucket) {
        return ownerRecords.stream().filter(item -> bucket.equals(item.get("statusBucket"))).count()
                + passengerRecords.stream().filter(item -> bucket.equals(item.get("statusBucket"))).count();
    }

    private Map<String, Object> buildUserSummary(PlatformUser user) {
        if (user == null) {
            return null;
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("nickname", user.getNickname());
        map.put("avatar", user.getAvatar());
        map.put("phoneMask", maskPhone(user.getPhone()));
        map.put("defaultLanguage", user.getDefaultLanguage());
        return map;
    }

    private String resolveCurrentUserRole(CarpoolTrip trip, Long currentUserId, CarpoolApplication myApplication) {
        if (currentUserId == null) {
            return "GUEST";
        }
        if (Objects.equals(trip.getOwnerUserId(), currentUserId)) {
            return "OWNER";
        }
        return myApplication == null ? "GUEST" : "PASSENGER";
    }

    private boolean canApplyTrip(CarpoolTrip trip, Long currentUserId, CarpoolApplication myApplication) {
        if (currentUserId == null || Objects.equals(trip.getOwnerUserId(), currentUserId) || myApplication != null) {
            return false;
        }
        if (trip.getDepartTime() != null && trip.getDepartTime().isBefore(LocalDateTime.now())) {
            return false;
        }
        if (trip.getRemainSeatCount() == null || trip.getRemainSeatCount() <= 0) {
            return false;
        }
        return !List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED, CarpoolTripStatus.CONFIRMED).contains(trip.getStatus());
    }

    private boolean canCancelApplication(CarpoolApplication application) {
        return !List.of(CarpoolApplyStatus.CANCELLED, CarpoolApplyStatus.REJECTED).contains(application.getApplicationStatus());
    }

    private String resolveTripBucket(String tripStatus, LocalDateTime departTime) {
        if (List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(tripStatus)) {
            return "completed";
        }
        if (CarpoolTripStatus.CONFIRMED.equals(tripStatus)) {
            return departTime != null && departTime.isAfter(LocalDateTime.now()) ? "upcoming" : "processing";
        }
        return "pending";
    }

    private String resolvePassengerBucket(CarpoolApplication application, CarpoolTrip trip) {
        if (List.of(CarpoolApplyStatus.CANCELLED, CarpoolApplyStatus.REJECTED).contains(application.getApplicationStatus())
                || List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus())) {
            return "completed";
        }
        if (CarpoolApplyStatus.CONFIRMED.equals(application.getApplicationStatus())) {
            return trip.getDepartTime() != null && trip.getDepartTime().isAfter(LocalDateTime.now()) ? "upcoming" : "processing";
        }
        return "pending";
    }

    private String statusBucketText(String bucket) {
        return switch (bucket) {
            case "upcoming" -> "待出发";
            case "processing" -> "行程中";
            case "completed" -> "已完成";
            default -> "待确认";
        };
    }

    private String tripStatusText(String status) {
        return switch (status) {
            case CarpoolTripStatus.MATCHING -> "拼友匹配中";
            case CarpoolTripStatus.FULL -> "座位已满";
            case CarpoolTripStatus.CONFIRMED -> "已确认成行";
            case CarpoolTripStatus.CANCELLED -> "已取消";
            case CarpoolTripStatus.FINISHED -> "已完成";
            default -> "可申请";
        };
    }

    private String tripStatusTone(String status) {
        return switch (status) {
            case CarpoolTripStatus.CONFIRMED -> "success";
            case CarpoolTripStatus.CANCELLED -> "danger";
            case CarpoolTripStatus.FULL -> "warning";
            default -> "processing";
        };
    }

    private String applicationStatusText(String status) {
        return switch (status) {
            case CarpoolApplyStatus.OWNER_CONFIRMED -> "待乘客确认";
            case CarpoolApplyStatus.PASSENGER_CONFIRMED, CarpoolApplyStatus.CONFIRMED -> "已确认同行";
            case CarpoolApplyStatus.CANCELLED -> "已取消";
            case CarpoolApplyStatus.REJECTED -> "已拒绝";
            default -> "待车主处理";
        };
    }

    private String applicationStatusTone(String status) {
        return switch (status) {
            case CarpoolApplyStatus.CONFIRMED, CarpoolApplyStatus.PASSENGER_CONFIRMED -> "success";
            case CarpoolApplyStatus.CANCELLED, CarpoolApplyStatus.REJECTED -> "danger";
            case CarpoolApplyStatus.OWNER_CONFIRMED -> "warning";
            default -> "processing";
        };
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime == null ? "" : dateTime.format(DATE_TIME_FORMATTER);
    }

    private String maskPhone(String phone) {
        if (!StringUtils.hasText(phone) || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }
}
