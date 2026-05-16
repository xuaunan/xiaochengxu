package com.sunshine.travel;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.sunshine.travel.mapper")
public class SunshineTravelApplication {

    public static void main(String[] args) {
        SpringApplication.run(SunshineTravelApplication.class, args);
    }
}

