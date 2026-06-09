package com.sunshine.travel.service.support;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class CacheSupport {

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final ConcurrentHashMap<String, LocalCacheEntry> fallbackCache = new ConcurrentHashMap<>();

    public CacheSupport(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    public boolean setIfAbsent(String key, String value, Duration ttl) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template == null) {
                return setLocalIfAbsent(key, value, ttl);
            }
            Boolean success = template.opsForValue().setIfAbsent(key, value, ttl);
            if (Boolean.TRUE.equals(success)) {
                setLocal(key, value, ttl);
                return true;
            }
            return false;
        } catch (Exception exception) {
            return setLocalIfAbsent(key, value, ttl);
        }
    }

    public Optional<String> get(String key) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template == null) {
                return getLocal(key);
            }
            String value = template.opsForValue().get(key);
            return value == null ? getLocal(key) : Optional.of(value);
        } catch (Exception exception) {
            return getLocal(key);
        }
    }

    public void set(String key, String value, Duration ttl) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template != null) {
                template.opsForValue().set(key, value, ttl);
            }
        } catch (Exception ignored) {
            setLocal(key, value, ttl);
            return;
        }
        setLocal(key, value, ttl);
    }

    public void delete(String key) {
        try {
            StringRedisTemplate template = redisTemplateProvider.getIfAvailable();
            if (template != null) {
                template.delete(key);
            }
        } catch (Exception ignored) {
        }
        fallbackCache.remove(key);
    }

    private boolean setLocalIfAbsent(String key, String value, Duration ttl) {
        Instant now = Instant.now();
        LocalCacheEntry next = new LocalCacheEntry(value, now.plus(ttl));
        LocalCacheEntry current = fallbackCache.compute(key, (ignored, existing) -> {
            if (existing == null || existing.isExpired(now)) {
                return next;
            }
            return existing;
        });
        return current == next;
    }

    private Optional<String> getLocal(String key) {
        Instant now = Instant.now();
        LocalCacheEntry entry = fallbackCache.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.isExpired(now)) {
            fallbackCache.remove(key, entry);
            return Optional.empty();
        }
        return Optional.of(entry.value);
    }

    private void setLocal(String key, String value, Duration ttl) {
        fallbackCache.put(key, new LocalCacheEntry(value, Instant.now().plus(ttl)));
    }

    private static final class LocalCacheEntry {
        private final String value;
        private final Instant expiresAt;

        private LocalCacheEntry(String value, Instant expiresAt) {
            this.value = value;
            this.expiresAt = expiresAt;
        }

        private boolean isExpired(Instant now) {
            return !expiresAt.isAfter(now);
        }
    }
}
