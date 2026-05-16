package com.sunshine.travel.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sunshine.travel.common.ApiResponse;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.model.AuthUser;
import com.sunshine.travel.util.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        try {
            if (header != null && header.startsWith("Bearer ")) {
                Claims claims = jwtUtil.parseToken(header.substring(7));
                UserContext.set(AuthUser.builder()
                        .userId(Long.valueOf(claims.getSubject()))
                        .roleCode((String) claims.get("role"))
                        .nickname((String) claims.get("nickname"))
                        .build());
            }
            filterChain.doFilter(request, response);
        } catch (JwtException | IllegalArgumentException exception) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(response.getWriter(), ApiResponse.fail(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录"));
        } finally {
            UserContext.clear();
        }
    }
}
