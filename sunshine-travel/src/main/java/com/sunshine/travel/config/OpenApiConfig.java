package com.sunshine.travel.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI().info(new Info()
                .title("阳光出行业务 API")
                .version("2.0.0")
                .description("覆盖即时打车、顺风车、国际出行、优惠券与后台管理的业务接口")
                .contact(new Contact().name("Sunshine Travel Team").email("sunshine@example.com")));
    }
}
