package com.sunshine.travel.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusiness(BusinessException exception, HttpServletRequest request) {
        log.warn("business exception, uri={}, msg={}", request.getRequestURI(), exception.getMessage());
        return ApiResponse.fail(exception.getCode(), exception.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ApiResponse<Void> handleValidException(Exception exception, HttpServletRequest request) {
        String msg;
        if (exception instanceof MethodArgumentNotValidException validException) {
            msg = validException.getBindingResult().getFieldErrors().stream()
                    .map(this::formatFieldError)
                    .collect(Collectors.joining("; "));
        } else {
            BindException bindException = (BindException) exception;
            msg = bindException.getBindingResult().getFieldErrors().stream()
                    .map(this::formatFieldError)
                    .collect(Collectors.joining("; "));
        }
        log.warn("validation exception, uri={}, msg={}", request.getRequestURI(), msg);
        return ApiResponse.fail(ErrorCode.PARAM_ERROR, msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ApiResponse<Void> handleConstraintViolation(ConstraintViolationException exception, HttpServletRequest request) {
        String msg = exception.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("; "));
        log.warn("constraint violation, uri={}, msg={}", request.getRequestURI(), msg);
        return ApiResponse.fail(ErrorCode.PARAM_ERROR, msg);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ApiResponse<Void> handleMessageNotReadable(HttpMessageNotReadableException exception, HttpServletRequest request) {
        log.warn("message not readable, uri={}, msg={}", request.getRequestURI(), exception.getMessage());
        return ApiResponse.fail(ErrorCode.PARAM_ERROR, "请求体格式错误");
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleDefault(Exception exception, HttpServletRequest request) {
        log.error("system exception, uri={}", request.getRequestURI(), exception);
        return ApiResponse.fail(ErrorCode.SYSTEM_ERROR);
    }

    private String formatFieldError(FieldError fieldError) {
        return fieldError.getField() + ":" + fieldError.getDefaultMessage();
    }
}
