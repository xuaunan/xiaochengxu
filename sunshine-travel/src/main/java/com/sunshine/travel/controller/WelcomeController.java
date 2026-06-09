package com.sunshine.travel.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WelcomeController {

    @GetMapping(value = "/", produces = "text/html;charset=UTF-8")
    public ResponseEntity<String> index() {
        String html = """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Sunshine Travel API</title>
                    <style>
                        body { font-family: "Segoe UI", "PingFang SC", sans-serif; margin: 0; background: #f6f8fb; color: #1f2937; }
                        .wrap { max-width: 860px; margin: 48px auto; padding: 32px; background: #fff; border-radius: 20px; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08); }
                        h1 { margin: 0 0 12px; font-size: 30px; }
                        p { line-height: 1.75; color: #475569; }
                        ul { line-height: 1.9; padding-left: 20px; }
                        code { background: #f1f5f9; padding: 2px 8px; border-radius: 8px; }
                        a { color: #ea580c; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="wrap">
                        <h1>阳光出行服务已启动</h1>
                        <p>当前地址 <code>http://127.0.0.1:8080</code> 是 Spring Boot API 服务，不是管理端前端页面入口。</p>
                        <ul>
                            <li>接口文档：<a href="/doc.html" target="_blank">/doc.html</a></li>
                            <li>OpenAPI：<a href="/v3/api-docs" target="_blank">/v3/api-docs</a></li>
                            <li>管理端开发地址：<a href="http://127.0.0.1:5173" target="_blank">http://127.0.0.1:5173</a></li>
                            <li>小程序请求基地址：<code>http://127.0.0.1:8080</code></li>
                        </ul>
                    </div>
                </body>
                </html>
                """;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/html;charset=UTF-8"));
        return ResponseEntity.ok().headers(headers).body(html);
    }

    @GetMapping("/favicon.ico")
    public ResponseEntity<Void> favicon() {
        return ResponseEntity.noContent().build();
    }
}
