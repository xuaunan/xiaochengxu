package com.sunshine.travel.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        // 手动 new ObjectMapper 会覆盖 Spring Boot 默认配置，
        // 必须显式关闭 FAIL_ON_UNKNOWN_PROPERTIES，否则多端传入的冗余字段（如网页端 couponName）会直接 400「请求体格式错误」
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }
}

