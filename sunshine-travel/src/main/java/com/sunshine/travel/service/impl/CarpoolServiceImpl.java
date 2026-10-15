package com.sunshine.travel.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.CarpoolApplyStatus;
import com.sunshine.travel.common.CarpoolTripStatus;
import com.sunshine.travel.common.CarpoolRequestStatus;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.dto.CarpoolCancelRequest;
import com.sunshine.travel.dto.CarpoolConfirmRequest;
import com.sunshine.travel.dto.CarpoolPublishRequest;
import com.sunshine.travel.dto.CarpoolRideRequestCreateRequest;
import com.sunshine.travel.entity.CarpoolApplication;
import com.sunshine.travel.entity.CarpoolTrip;
import com.sunshine.travel.entity.CarpoolRideRequest;
import com.sunshine.travel.entity.PlatformUser;
import com.sunshine.travel.mapper.CarpoolApplicationMapper;
import com.sunshine.travel.mapper.CarpoolTripMapper;
import com.sunshine.travel.mapper.CarpoolRideRequestMapper;
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
    private final CarpoolRideRequestMapper carpoolRideRequestMapper;

    public CarpoolServiceImpl(CarpoolTripMapper carpoolTripMapper,
                              CarpoolApplicationMapper carpoolApplicationMapper,
                              PlatformUserMapper platformUserMapper,
                              CarpoolRideRequestMapper carpoolRideRequestMapper) {
        this.carpoolTripMapper = carpoolTripMapper;
        this.carpoolApplicationMapper = carpoolApplicationMapper;
        this.platformUserMapper = platformUserMapper;
        this.carpoolRideRequestMapper = carpoolRideRequestMapper;
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
    @Transactional
    public Map<String, Object> publishRideRequest(CarpoolRideRequestCreateRequest request) {
        if (request.getDepartTime().isBefore(LocalDateTime.now().plusMinutes(30))) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "出发时间至少晚于当前30分钟");
        }
        if (request.getStartName().equals(request.getEndName())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "顺风车起终点不能相同");
        }
        CarpoolRideRequest rideRequest = new CarpoolRideRequest();
        rideRequest.setPassengerUserId(UserContext.userId());
        rideRequest.setRequestNo("CR" + IdUtil.getSnowflakeNextIdStr());
        rideRequest.setStartName(request.getStartName());
        rideRequest.setEndName(request.getEndName());
        rideRequest.setDepartTime(request.getDepartTime());
        rideRequest.setPassengerCount(request.getPassengerCount());
        rideRequest.setAcceptCarpool(!Boolean.FALSE.equals(request.getAcceptCarpool()));
        rideRequest.setSharedAmount(request.getSharedAmount());
        rideRequest.setBaggageRule(request.getBaggageRule());
        rideRequest.setRequestRemark(request.getRequestRemark());
        rideRequest.setStatus(CarpoolRequestStatus.PUBLISHED);
        carpoolRideRequestMapper.insert(rideRequest);
        return buildRideRequestCard(rideRequest);
    }

    @Override
    public List<Map<String, Object>> matchRideRequests(Long tripId) {
        CarpoolTrip trip = requireTrip(tripId);
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以查看匹配需求");
        }
        LocalDateTime from = trip.getDepartTime().minusMinutes(30);
        LocalDateTime to = trip.getDepartTime().plusMinutes(30);
        return carpoolRideRequestMapper.selectList(new LambdaQueryWrapper<CarpoolRideRequest>()
                        .eq(CarpoolRideRequest::getStatus, CarpoolRequestStatus.PUBLISHED)
                        .ge(CarpoolRideRequest::getDepartTime, from)
                        .le(CarpoolRideRequest::getDepartTime, to)
                        .le(CarpoolRideRequest::getPassengerCount, trip.getRemainSeatCount())
                        .orderByAsc(CarpoolRideRequest::getDepartTime))
                .stream()
                .filter(request -> routeCompatible(trip, request))
                .sorted(Comparator
                        .comparingInt((CarpoolRideRequest request) -> routeMatchScore(trip, request)).reversed()
                        .thenComparingLong(request -> Math.abs(java.time.Duration.between(trip.getDepartTime(), request.getDepartTime()).toMinutes()))
                        .thenComparing(CarpoolRideRequest::getSharedAmount))
                .map(this::buildRideRequestCard)
                .toList();
    }

    @Override
    @Transactional
    public void acceptRideRequest(Long requestId, Long tripId) {
        CarpoolTrip trip = requireTripForUpdate(tripId);
        CarpoolRideRequest request = carpoolRideRequestMapper.selectOne(new LambdaQueryWrapper<CarpoolRideRequest>()
                .eq(CarpoolRideRequest::getId, requestId).last("FOR UPDATE"));
        if (request == null) throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "乘客需求不存在");
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以接单");
        }
        if (!CarpoolRequestStatus.PUBLISHED.equals(request.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "该需求已被其他车主处理");
        }
        if (!routeCompatible(trip, request) || !Objects.equals(trip.getDepartTime().toLocalDate(), request.getDepartTime().toLocalDate())
                || Math.abs(java.time.Duration.between(trip.getDepartTime(), request.getDepartTime()).toMinutes()) > 30) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "当前行程与乘客需求不匹配");
        }
        int seats = request.getPassengerCount();
        if (trip.getRemainSeatCount() < seats) throw new BusinessException(ErrorCode.BUSINESS_ERROR, "剩余座位不足");
        Long duplicate = carpoolApplicationMapper.selectCount(new LambdaQueryWrapper<CarpoolApplication>()
                .eq(CarpoolApplication::getRequestId, requestId)
                .in(CarpoolApplication::getApplicationStatus, List.of(CarpoolApplyStatus.OWNER_CONFIRMED, CarpoolApplyStatus.CONFIRMED)));
        if (duplicate != null && duplicate > 0) throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "该需求已接单");
        CarpoolApplication application = new CarpoolApplication();
        application.setTripId(trip.getId());
        application.setRequestId(requestId);
        application.setPassengerUserId(request.getPassengerUserId());
        application.setCompanionCount(Math.max(0, seats - 1));
        application.setSharedAmount(trip.getSharedAmount().multiply(BigDecimal.valueOf(seats)));
        application.setApplicationStatus(CarpoolApplyStatus.OWNER_CONFIRMED);
        application.setOwnerConfirmedAt(LocalDateTime.now());
        application.setNote("车主主动接单，等待乘客确认");
        carpoolApplicationMapper.insert(application);
        request.setStatus(CarpoolRequestStatus.MATCHED);
        carpoolRideRequestMapper.updateById(request);
        trip.setRemainSeatCount(trip.getRemainSeatCount() - seats);
        syncTripStatus(trip);
    }

    @Override
    @Transactional
    public void cancelRideRequest(Long requestId, String reason) {
        CarpoolRideRequest request = carpoolRideRequestMapper.selectOne(new LambdaQueryWrapper<CarpoolRideRequest>()
                .eq(CarpoolRideRequest::getId, requestId).last("FOR UPDATE"));
        if (request == null) throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "乘客需求不存在");
        if (!Objects.equals(request.getPassengerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有发布需求的乘客可以取消");
        }
        if (!CarpoolRequestStatus.PUBLISHED.equals(request.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "已被车主接单的需求请在同行申请中处理");
        }
        request.setStatus(CarpoolRequestStatus.CANCELLED);
        request.setRequestRemark(reason);
        carpoolRideRequestMapper.updateById(request);
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
    public void ownerConfirm(CarpoolConfirmRequest request) {
        CarpoolApplication application = requireApplication(request.getApplicationId());
        CarpoolTrip trip = requireTripForUpdate(application.getTripId());
        application = requireApplicationForUpdate(request.getApplicationId());
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以执行该操作");
        }
        if (List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前行程已结束，不能处理申请");
        }
        if (!CarpoolApplyStatus.APPLIED.equals(application.getApplicationStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前申请状态不允许车主处理");
        }
        if ("REJECT".equalsIgnoreCase(request.getAction())) {
            application.setApplicationStatus(CarpoolApplyStatus.REJECTED);
            application.setCancelReason(request.getNote());
            carpoolApplicationMapper.updateById(application);
            if (application.getRequestId() != null) {
                CarpoolRideRequest rideRequest = carpoolRideRequestMapper.selectById(application.getRequestId());
                if (rideRequest != null) {
                    rideRequest.setStatus(CarpoolRequestStatus.PUBLISHED);
                    carpoolRideRequestMapper.updateById(rideRequest);
                }
            }
            releaseSeat(trip, application);
            return;
        }
        if (!"APPROVE".equalsIgnoreCase(request.getAction())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "车主操作类型不合法");
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
        CarpoolTrip trip = requireTripForUpdate(application.getTripId());
        application = requireApplicationForUpdate(request.getApplicationId());
        if (!Objects.equals(application.getPassengerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有申请乘客可以执行该操作");
        }
        if (List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "当前行程已结束，不能确认同行");
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
        if (application.getRequestId() != null) {
            CarpoolRideRequest rideRequest = carpoolRideRequestMapper.selectById(application.getRequestId());
            if (rideRequest != null) {
                rideRequest.setStatus(CarpoolRequestStatus.CONFIRMED);
                carpoolRideRequestMapper.updateById(rideRequest);
            }
        }
        syncTripStatus(trip);
    }

    @Override
    @Transactional
    public void cancel(CarpoolCancelRequest request) {
        CarpoolApplication application = requireApplication(request.getApplicationId());
        CarpoolTrip trip = requireTripForUpdate(application.getTripId());
        application = requireApplicationForUpdate(request.getApplicationId());
        boolean isOwner = Objects.equals(trip.getOwnerUserId(), UserContext.userId());
        boolean isPassenger = Objects.equals(application.getPassengerUserId(), UserContext.userId());
        if (!isOwner && !isPassenger) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权限取消该拼车申请");
        }
        if (CarpoolApplyStatus.CANCELLED.equals(application.getApplicationStatus())) {
            return;
        }
        if (CarpoolApplyStatus.REJECTED.equals(application.getApplicationStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "已拒绝的申请不能取消");
        }
        application.setApplicationStatus(CarpoolApplyStatus.CANCELLED);
        application.setCancelReason(request.getReason());
        carpoolApplicationMapper.updateById(application);
        if (application.getRequestId() != null) {
            CarpoolRideRequest rideRequest = carpoolRideRequestMapper.selectById(application.getRequestId());
            if (rideRequest != null && !CarpoolRequestStatus.CONFIRMED.equals(rideRequest.getStatus())) {
                rideRequest.setStatus(isOwner ? CarpoolRequestStatus.PUBLISHED : CarpoolRequestStatus.CANCELLED);
                carpoolRideRequestMapper.updateById(rideRequest);
            }
        }
        releaseSeat(trip, application);
    }

    @Override
    @Transactional
    public void cancelTrip(Long tripId, String reason) {
        CarpoolTrip trip = requireTripForUpdate(tripId);
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以取消行程");
        }
        if (List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus())) {
            return;
        }
        if (trip.getDepartTime() != null && !trip.getDepartTime().isAfter(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "出发后不能取消行程");
        }
        List<CarpoolApplication> activeApplications = listApplicationsByTrip(trip.getId()).stream()
                .filter(item -> isActiveApplication(item.getApplicationStatus()))
                .toList();
        for (CarpoolApplication application : activeApplications) {
            application.setApplicationStatus(CarpoolApplyStatus.CANCELLED);
            application.setCancelReason(reason);
            carpoolApplicationMapper.updateById(application);
            if (application.getRequestId() != null) {
                CarpoolRideRequest rideRequest = carpoolRideRequestMapper.selectById(application.getRequestId());
                if (rideRequest != null) {
                    rideRequest.setStatus(CarpoolRequestStatus.CANCELLED);
                    carpoolRideRequestMapper.updateById(rideRequest);
                }
            }
        }
        trip.setRemainSeatCount(trip.getSeatCount());
        trip.setStatus(CarpoolTripStatus.CANCELLED);
        carpoolTripMapper.updateById(trip);
    }

    @Override
    @Transactional
    public void finishTrip(Long tripId) {
        CarpoolTrip trip = requireTripForUpdate(tripId);
        if (!Objects.equals(trip.getOwnerUserId(), UserContext.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有车主可以结束行程");
        }
        if (trip.getDepartTime() != null && trip.getDepartTime().isAfter(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "出发前不能结束行程");
        }
        if (CarpoolTripStatus.CANCELLED.equals(trip.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "已取消的行程不能结束");
        }
        trip.setStatus(CarpoolTripStatus.FINISHED);
        carpoolTripMapper.updateById(trip);
        List<CarpoolApplication> applications = listApplicationsByTrip(trip.getId());
        for (CarpoolApplication application : applications) {
            if (application.getRequestId() != null && CarpoolApplyStatus.CONFIRMED.equals(application.getApplicationStatus())) {
                CarpoolRideRequest request = carpoolRideRequestMapper.selectById(application.getRequestId());
                if (request != null) {
                    request.setStatus(CarpoolRequestStatus.FINISHED);
                    carpoolRideRequestMapper.updateById(request);
                }
            }
        }
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
        result.put("passengerRequests", carpoolRideRequestMapper.selectList(new LambdaQueryWrapper<CarpoolRideRequest>()
                        .eq(CarpoolRideRequest::getPassengerUserId, currentUserId)
                        .orderByDesc(CarpoolRideRequest::getId))
                .stream().map(this::buildRideRequestCard).toList());
        return result;
    }

    private CarpoolTrip requireTrip(Long tripId) {
        CarpoolTrip trip = carpoolTripMapper.selectById(tripId);
        if (trip == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "顺风车行程不存在");
        }
        return trip;
    }

    private CarpoolTrip requireTripForUpdate(Long tripId) {
        CarpoolTrip trip = carpoolTripMapper.selectOne(new LambdaQueryWrapper<CarpoolTrip>()
                .eq(CarpoolTrip::getId, tripId)
                .last("FOR UPDATE"));
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

    private CarpoolApplication requireApplicationForUpdate(Long applicationId) {
        CarpoolApplication application = carpoolApplicationMapper.selectOne(new LambdaQueryWrapper<CarpoolApplication>()
                .eq(CarpoolApplication::getId, applicationId)
                .last("FOR UPDATE"));
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
        trip.setRemainSeatCount(Math.min(trip.getSeatCount(), trip.getRemainSeatCount() + seat));
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
                .filter(item -> isActiveApplication(item.getApplicationStatus()))
                .findFirst()
                .orElse(null);
    }

    private boolean isActiveApplication(String status) {
        return List.of(CarpoolApplyStatus.APPLIED, CarpoolApplyStatus.OWNER_CONFIRMED,
                CarpoolApplyStatus.PASSENGER_CONFIRMED, CarpoolApplyStatus.CONFIRMED).contains(status);
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
        map.put("canApply", false);
        map.put("myApplicationStatus", myApplication == null ? "" : myApplication.getApplicationStatus());
        map.put("myApplicationStatusText", myApplication == null ? "" : applicationStatusText(myApplication.getApplicationStatus()));
        map.put("canPassengerConfirm", myApplication != null
                && Objects.equals(currentUserId, myApplication.getPassengerUserId())
                && CarpoolApplyStatus.OWNER_CONFIRMED.equals(myApplication.getApplicationStatus()));
        map.put("canPassengerCancel", myApplication != null
                && Objects.equals(currentUserId, myApplication.getPassengerUserId())
                && canCancelApplication(myApplication));
        map.put("canCancelTrip", Objects.equals(trip.getOwnerUserId(), currentUserId)
                && trip.getDepartTime() != null
                && trip.getDepartTime().isAfter(LocalDateTime.now())
                && !List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus()));
        map.put("canFinishTrip", Objects.equals(trip.getOwnerUserId(), currentUserId)
                && trip.getDepartTime() != null
                && !trip.getDepartTime().isAfter(LocalDateTime.now())
                && !List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus()));
        return map;
    }

    private Map<String, Object> buildRideRequestCard(CarpoolRideRequest request) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", request.getId());
        map.put("requestNo", request.getRequestNo());
        map.put("passengerUserId", request.getPassengerUserId());
        map.put("startName", request.getStartName());
        map.put("endName", request.getEndName());
        map.put("departTime", request.getDepartTime());
        map.put("departTimeText", formatDateTime(request.getDepartTime()));
        map.put("passengerCount", request.getPassengerCount());
        map.put("acceptCarpool", request.getAcceptCarpool());
        map.put("sharedAmount", request.getSharedAmount());
        map.put("baggageRule", request.getBaggageRule());
        map.put("requestRemark", request.getRequestRemark());
        map.put("status", request.getStatus());
        map.put("statusText", rideRequestStatusText(request.getStatus()));
        map.put("statusTone", rideRequestStatusTone(request.getStatus()));
        map.put("routeText", request.getStartName() + " → " + request.getEndName());
        return map;
    }

    private boolean routeCompatible(CarpoolTrip trip, CarpoolRideRequest request) {
        return routePartCompatible(trip.getStartName(), request.getStartName())
                && routePartCompatible(trip.getEndName(), request.getEndName());
    }

    private int routeMatchScore(CarpoolTrip trip, CarpoolRideRequest request) {
        return routePartScore(trip.getStartName(), request.getStartName())
                + routePartScore(trip.getEndName(), request.getEndName());
    }

    private int routePartScore(String left, String right) {
        String a = normalizeRoutePart(left);
        String b = normalizeRoutePart(right);
        if (a.equals(b)) return 3;
        if (a.contains(b) || b.contains(a)) return 2;
        return 0;
    }

    private boolean routePartCompatible(String left, String right) {
        String a = normalizeRoutePart(left);
        String b = normalizeRoutePart(right);
        return !a.isBlank() && !b.isBlank() && (a.contains(b) || b.contains(a));
    }

    private String normalizeRoutePart(String value) {
        return value == null ? "" : value.replaceAll("[\\s,，。.!！?？-]", "").toLowerCase();
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
        return !List.of(CarpoolTripStatus.CANCELLED, CarpoolTripStatus.FINISHED).contains(trip.getStatus());
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

    private String rideRequestStatusText(String status) {
        return switch (status) {
            case CarpoolRequestStatus.MATCHED -> "车主已接单，待你确认";
            case CarpoolRequestStatus.CONFIRMED -> "双方已确认同行";
            case CarpoolRequestStatus.CANCELLED -> "需求已取消";
            default -> "等待车主接单";
        };
    }

    private String rideRequestStatusTone(String status) {
        return switch (status) {
            case CarpoolRequestStatus.CONFIRMED -> "success";
            case CarpoolRequestStatus.CANCELLED -> "danger";
            case CarpoolRequestStatus.MATCHED -> "warning";
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
