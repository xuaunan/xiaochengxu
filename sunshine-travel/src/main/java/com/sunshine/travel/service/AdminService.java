package com.sunshine.travel.service;

import com.sunshine.travel.common.PageResult;
import com.sunshine.travel.dto.AdminCouponStatusRequest;
import com.sunshine.travel.dto.AdminComplaintHandleRequest;
import com.sunshine.travel.dto.AdminDriverUpdateRequest;
import com.sunshine.travel.dto.AdminInvoiceHandleRequest;
import com.sunshine.travel.dto.AdminOrderStatusRequest;
import com.sunshine.travel.dto.AdminRefundRequest;
import com.sunshine.travel.dto.AdminResetPasswordRequest;
import com.sunshine.travel.dto.AdminUserSaveRequest;
import com.sunshine.travel.dto.CouponCreateRequest;
import com.sunshine.travel.dto.UserAuditRequest;
import com.sunshine.travel.dto.UserEnableRequest;
import com.sunshine.travel.dto.SystemConfigSaveRequest;
import com.sunshine.travel.dto.SystemNoticeSaveRequest;
import com.sunshine.travel.dto.SystemVersionSaveRequest;
import com.sunshine.travel.dto.WithdrawAuditRequest;
import com.sunshine.travel.vo.DashboardVO;
import java.util.List;
import java.util.Map;

public interface AdminService {

    DashboardVO dashboard(String range);

    List<Map<String, Object>> importantMessages();

    PageResult<Map<String, Object>> users(long current, long size, String keyword, String roleCode);

    Map<String, Object> userDetail(Long userId);

    Map<String, Object> createUser(AdminUserSaveRequest request);

    Map<String, Object> updateUser(Long userId, AdminUserSaveRequest request);

    void resetUserPassword(Long userId, AdminResetPasswordRequest request);

    PageResult<Map<String, Object>> drivers(long current, long size, String keyword, Integer auditStatus, String serviceStatus);

    Map<String, Object> driverDetail(Long driverId);

    Map<String, Object> updateDriver(Long driverId, AdminDriverUpdateRequest request);

    PageResult<Map<String, Object>> orders(long current, long size, String keyword, String status, String serviceType);

    Map<String, Object> orderDetail(Long orderId);

    void updateOrderStatus(Long orderId, AdminOrderStatusRequest request);

    void cancelOrder(Long orderId, String reason);

    void refundOrder(Long orderId, AdminRefundRequest request);

    PageResult<Map<String, Object>> withdraws(long current, long size, String status);

    PageResult<Map<String, Object>> coupons(long current, long size, String keyword, Integer status);

    Map<String, Object> updateCoupon(Long couponId, CouponCreateRequest request);

    void updateCouponStatus(Long couponId, AdminCouponStatusRequest request);

    PageResult<Map<String, Object>> couponOperationRecords(long current, long size, Long couponId, Long userId);

    void handleComplaint(Long complaintId, AdminComplaintHandleRequest request);

    void handleInvoice(Long orderId, AdminInvoiceHandleRequest request);

    PageResult<Map<String, Object>> logs(long current, long size, String module);

    void auditUser(Long userId, UserAuditRequest request);

    void enableUser(Long userId, UserEnableRequest request);

    void auditDriver(Long driverId, UserAuditRequest request);

    void auditWithdraw(Long withdrawId, WithdrawAuditRequest request);

    Map<String, Object> financeSummary();

    List<Map<String, Object>> systemConfigs();

    void saveSystemConfigs(SystemConfigSaveRequest request);

    PageResult<Map<String, Object>> notices(long current, long size, String keyword);

    Map<String, Object> createNotice(SystemNoticeSaveRequest request);

    Map<String, Object> updateNotice(Long noticeId, SystemNoticeSaveRequest request);

    PageResult<Map<String, Object>> versions(long current, long size, String clientType);

    Map<String, Object> createVersion(SystemVersionSaveRequest request);

    Map<String, Object> updateVersion(Long versionId, SystemVersionSaveRequest request);
}
