package com.sunshine.travel.service.support;

import java.time.Duration;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class CacheSupport {

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    public CacheSupport(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    public boolean setIfAbsent(String key, String value, Duration ttl) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template == null) {
                return true;
            }
            Boolean success = template.opsForValue().setIfAbsent(key, value, ttl);
            return Boolean.TRUE.equals(success);
        } catch (Exception exception) {
            return true;
        }
    }

    public Optional<String> get(String key) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template == null) {
                return Optional.empty();
            }
            return Optional.ofNullable(template.opsForValue().get(key));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    public void set(String key, String value, Duration ttl) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template != null) {
                template.opsForValue().set(key, value, ttl);
            }
        } catch (Exception ignored) {
        }
    }

    public void delete(String key) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template != null) {
                template.delete(key);
            }
        } catch (Exception ignored) {
        }
    }
}
