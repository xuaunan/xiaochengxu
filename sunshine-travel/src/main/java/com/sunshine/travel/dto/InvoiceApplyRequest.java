package com.sunshine.travel.dto;

import lombok.Data;

@Data
public class InvoiceApplyRequest {

    private String invoiceTitle;
    private String taxNo;
    private String buyerPhone;
    private String remark;
}
