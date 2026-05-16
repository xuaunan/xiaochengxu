package com.sunshine.travel.config;

import com.sunshine.travel.annotation.RequireLogin;
import com.sunshine.travel.annotation.RequireRole;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.UserContext;
import java.util.Arrays;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(jakarta.servlet.http.HttpServletRequest request,
                             jakarta.servlet.http.HttpServletResponse response,
                             Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequireRole requireRole = findRequireRole(handlerMethod);
        boolean needLogin = requireRole != null || hasRequireLogin(handlerMethod);
        if (!needLogin) {
            return true;
        }
        if (UserContext.userId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (requireRole != null && Arrays.stream(requireRole.value()).noneMatch(role -> role.equals(UserContext.role()))) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return true;
    }

    private boolean hasRequireLogin(HandlerMethod handlerMethod) {
        return AnnotatedElementUtils.hasAnnotation(handlerMethod.getMethod(), RequireLogin.class)
                || AnnotatedElementUtils.hasAnnotation(handlerMethod.getBeanType(), RequireLogin.class);
    }

    private RequireRole findRequireRole(HandlerMethod handlerMethod) {
        RequireRole methodAnnotation = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getMethod(), RequireRole.class);
        if (methodAnnotation != null) {
            return methodAnnotation;
        }
        return AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), RequireRole.class);
    }
}
