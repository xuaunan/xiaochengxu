package com.sunshine.travel.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminInvoiceHandleRequest {

    @NotBlank(message = "发票处理状态不能为空")
    private String invoiceStatus;

    private String invoiceTitle;
    private String taxNo;
    private String buyerPhone;
    private String remark;
}
