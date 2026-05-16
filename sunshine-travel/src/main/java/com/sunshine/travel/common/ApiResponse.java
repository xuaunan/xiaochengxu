package com.sunshine.travel.common;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "统一接口返回体")
public class ApiResponse<T> {

    @Schema(description = "业务状态码", example = "0")
    private int code;

    @Schema(description = "返回消息", example = "success")
    private String msg;

    @Schema(description = "返回数据")
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMessage(), data);
    }

    public static <T> ApiResponse<T> success(String msg, T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), msg, data);
    }

    public static ApiResponse<Void> success(String msg) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), msg, null);
    }

    public static ApiResponse<Void> fail(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    public static ApiResponse<Void> fail(ErrorCode errorCode, String msg) {
        return new ApiResponse<>(errorCode.getCode(), msg, null);
    }

    public static ApiResponse<Void> fail(int code, String msg) {
        return new ApiResponse<>(code, msg, null);
    }
}
