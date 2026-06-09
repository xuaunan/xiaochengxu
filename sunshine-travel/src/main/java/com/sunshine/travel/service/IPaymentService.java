package com.sunshine.travel.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.sunshine.travel.entity.PaymentRecord;

import java.math.BigDecimal;

/**
 * 支付业务接口
 * 
 * @author 开发团队
 */
public interface IPaymentService extends IService<PaymentRecord> {
    
    /**
     * 创建支付订单
     */
    PaymentRecord createPayment(Long orderId, Long userId, BigDecimal amount, Integer paymentMethod);
    
    /**
     * 支付成功
     */
    void mockPaymentSuccess(String paymentNo);
    
    /**
     * 申请退款
     */
    void applyRefund(String paymentNo, BigDecimal refundAmount, String reason);
    
    /**
     * 查询支付状态
     */
    PaymentRecord queryPaymentStatus(String paymentNo);
}
