package com.sunshine.travel.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.dto.AiSupportSettingsRequest;
import com.sunshine.travel.entity.SystemConfig;
import com.sunshine.travel.mapper.SystemConfigMapper;
import com.sunshine.travel.service.AiSupportService;
import com.sunshine.travel.service.support.OperationLogSupport;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class AiSupportServiceImpl implements AiSupportService {

    public static final String CONFIG_GROUP = "AI_SUPPORT";

    private static final String KEY_ENABLED = "aiSupportEnabled";
    private static final String KEY_PROVIDER = "aiSupportProvider";
    private static final String KEY_MODEL = "aiSupportModel";
    private static final String KEY_API_URL = "aiSupportApiUrl";
    private static final String KEY_API_PASSWORD = "aiSupportApiPassword";
    private static final String KEY_TIMEOUT_SECONDS = "aiSupportTimeoutSeconds";
    private static final String KEY_TEMPERATURE = "aiSupportTemperature";
    private static final String KEY_MAX_TOKENS = "aiSupportMaxTokens";
    private static final String KEY_SYSTEM_PROMPT = "aiSupportSystemPrompt";
    private static final String KEY_FALLBACK_MESSAGE = "aiSupportFallbackMessage";
    private static final String KEY_DEBUG_ENABLED = "aiSupportDebugEnabled";

    private static final String DEFAULT_PROVIDER = "spark_lite";
    private static final List<String> DEFAULT_API_PASSWORD_ENV_KEYS = List.of("SPARK_AGENT_API_PASSWORD", "SPARK_API_PASSWORD");
    private static final String DEFAULT_SYSTEM_PROMPT = """
            你是阳光出行小程序的AI客服。回答要简洁、礼貌、可执行。
            只能围绕乘客订单、支付退款、优惠券发票、司机听单接单、提现到账、资质审核、行程问题提供帮助。
            遇到投诉、事故、安全、账户资金异常或用户要求人工时，提示已转人工并说明客服会在后台跟进。
            不要编造订单状态、金额、审核结论或政策；不确定时请用户补充订单号或等待人工客服。
            """;
    private static final String DEFAULT_FALLBACK_MESSAGE = "AI客服暂时没有响应，已为你转接人工客服，请稍后查看后台客服回复。";

    private final SystemConfigMapper systemConfigMapper;
    private final OperationLogSupport operationLogSupport;

    public AiSupportServiceImpl(SystemConfigMapper systemConfigMapper, OperationLogSupport operationLogSupport) {
        this.systemConfigMapper = systemConfigMapper;
        this.operationLogSupport = operationLogSupport;
    }

    @Override
    public Map<String, Object> settings() {
        Map<String, String> values = configValues();
        AiProvider provider = providerOf(values.getOrDefault(KEY_PROVIDER, DEFAULT_PROVIDER));
        String apiUrl = firstText(values.get(KEY_API_URL), provider.apiUrl());
        String model = firstText(values.get(KEY_MODEL), provider.model());
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", boolValue(values, KEY_ENABLED, true));
        map.put("provider", provider.key());
        map.put("providerLabel", provider.label());
        map.put("providerOptions", providerOptions());
        map.put("model", model);
        map.put("apiUrl", apiUrl);
        map.put("apiPasswordMasked", maskSecret(values.getOrDefault(KEY_API_PASSWORD, "")));
        map.put("hasApiPassword", StringUtils.hasText(values.get(KEY_API_PASSWORD)));
        map.put("timeoutSeconds", intValue(values, KEY_TIMEOUT_SECONDS, 20));
        map.put("temperature", doubleValue(values, KEY_TEMPERATURE, 0.4D));
        map.put("maxTokens", intValue(values, KEY_MAX_TOKENS, 900));
        map.put("systemPrompt", values.getOrDefault(KEY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT).trim());
        map.put("fallbackMessage", values.getOrDefault(KEY_FALLBACK_MESSAGE, DEFAULT_FALLBACK_MESSAGE));
        map.put("debugEnabled", boolValue(values, KEY_DEBUG_ENABLED, false));
        map.put("dataContextEnabled", true);
        map.put("dataContextScopes", List.of("客服会话", "订单", "支付/退款", "优惠券", "司机资料", "车辆", "提现", "投诉"));
        return map;
    }

    @Override
    @Transactional
    public Map<String, Object> saveSettings(AiSupportSettingsRequest request) {
        ensureDefaults();
        AiProvider provider = providerOf(request.getProvider());
        Map<String, String> updates = new LinkedHashMap<>();
        putIfPresent(updates, KEY_ENABLED, boolString(request.getEnabled()));
        updates.put(KEY_PROVIDER, provider.key());
        updates.put(KEY_MODEL, firstText(request.getModel(), provider.model()));
        updates.put(KEY_API_URL, firstText(request.getApiUrl(), provider.apiUrl()));
        putIfText(updates, KEY_API_PASSWORD, request.getApiPassword());
        putIfPresent(updates, KEY_TIMEOUT_SECONDS, stringValue(request.getTimeoutSeconds()));
        putIfPresent(updates, KEY_TEMPERATURE, stringValue(request.getTemperature()));
        putIfPresent(updates, KEY_MAX_TOKENS, stringValue(request.getMaxTokens()));
        putIfPresent(updates, KEY_SYSTEM_PROMPT, normalizeBlankToDefault(request.getSystemPrompt(), DEFAULT_SYSTEM_PROMPT));
        putIfPresent(updates, KEY_FALLBACK_MESSAGE, normalizeBlankToDefault(request.getFallbackMessage(), DEFAULT_FALLBACK_MESSAGE));
        putIfPresent(updates, KEY_DEBUG_ENABLED, boolString(request.getDebugEnabled()));
        assertAllowedProviderUrl(provider, updates.get(KEY_API_URL));
        updates.forEach(this::updateValue);
        operationLogSupport.log("AI_SUPPORT", "SAVE_SETTINGS", "SYSTEM_CONFIG", null, "保存AI客服设置");
        return settings();
    }

    @Override
    public Map<String, Object> test(String prompt) {
        long start = System.currentTimeMillis();
        try {
            String reply = callChatCompletion(prompt, "", List.of(), "");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("ok", true);
            result.put("reply", reply);
            result.put("durationMs", System.currentTimeMillis() - start);
            return result;
        } catch (RuntimeException ex) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("ok", false);
            result.put("error", safeError(ex));
            result.put("durationMs", System.currentTimeMillis() - start);
            return result;
        }
    }

    @Override
    public Optional<String> generateSupportReply(String prompt, String userRole, List<Map<String, Object>> recentMessages, String businessContext) {
        Map<String, String> values = configValues();
        if (!boolValue(values, KEY_ENABLED, true)) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(callChatCompletion(prompt, userRole, recentMessages, businessContext));
        } catch (RuntimeException ex) {
            if (boolValue(values, KEY_DEBUG_ENABLED, false)) {
                System.err.println("[AI_SUPPORT] " + safeError(ex));
            }
            String fallback = values.getOrDefault(KEY_FALLBACK_MESSAGE, DEFAULT_FALLBACK_MESSAGE);
            return StringUtils.hasText(fallback) ? Optional.of(fallback) : Optional.empty();
        }
    }

    private String callChatCompletion(String prompt, String userRole, List<Map<String, Object>> recentMessages, String businessContext) {
        Map<String, String> values = configValues();
        AiProvider provider = providerOf(values.getOrDefault(KEY_PROVIDER, DEFAULT_PROVIDER));
        String apiUrl = firstText(values.get(KEY_API_URL), provider.apiUrl());
        String apiPassword = values.getOrDefault(KEY_API_PASSWORD, "");
        if (!StringUtils.hasText(apiPassword)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, provider.credentialLabel() + "未配置");
        }
        assertAllowedProviderUrl(provider, apiUrl);

        int timeoutSeconds = intValue(values, KEY_TIMEOUT_SECONDS, 20);
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(timeoutSeconds).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(timeoutSeconds).toMillis());
        RestTemplate restTemplate = new RestTemplate(factory);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiPassword);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", firstText(values.get(KEY_MODEL), provider.model()));
        body.put("stream", false);
        body.put("temperature", doubleValue(values, KEY_TEMPERATURE, 0.4D));
        body.put("max_tokens", intValue(values, KEY_MAX_TOKENS, 900));
        body.put("messages", buildMessages(values, prompt, userRole, recentMessages, businessContext));

        try {
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(apiUrl, new HttpEntity<>(body, headers), JsonNode.class);
            return extractReply(response.getBody());
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, provider.label() + "接口调用失败：" + safeError(ex));
        }
    }

    private List<Map<String, String>> buildMessages(Map<String, String> values, String prompt, String userRole, List<Map<String, Object>> recentMessages, String businessContext) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(message("system", values.getOrDefault(KEY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT)));
        if (StringUtils.hasText(userRole)) {
            messages.add(message("system", "当前小程序端角色：" + userRole));
        }
        if (StringUtils.hasText(businessContext)) {
            messages.add(message("system", """
                    下面是后端按当前客服会话从数据库读取并脱敏后的真实项目数据。
                    你必须优先依据这些数据回答；不要编造未出现的订单、支付、退款、优惠券、审核、提现或投诉状态。
                    如数据不足，明确说明系统暂未查询到并建议人工客服继续核实。
                    """ + "\n" + businessContext.trim()));
        }
        recentMessages.stream()
                .skip(Math.max(recentMessages.size() - 8, 0))
                .forEach(item -> {
                    String content = String.valueOf(item.getOrDefault("content", "")).trim();
                    if (!StringUtils.hasText(content)) {
                        return;
                    }
                    boolean assistant = Boolean.TRUE.equals(item.get("fromAdmin")) || Boolean.TRUE.equals(item.get("fromAi"));
                    messages.add(message(assistant ? "assistant" : "user", content));
                });
        if (messages.stream().noneMatch(item -> prompt.equals(item.get("content")))) {
            messages.add(message("user", prompt));
        }
        return messages;
    }

    private String extractReply(JsonNode node) {
        if (node == null) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "AI接口无返回");
        }
        JsonNode choices = node.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            String content = choices.get(0).path("message").path("content").asText("");
            if (StringUtils.hasText(content)) {
                return content.trim();
            }
            String text = choices.get(0).path("text").asText("");
            if (StringUtils.hasText(text)) {
                return text.trim();
            }
        }
        String direct = node.path("reply").asText("");
        if (StringUtils.hasText(direct)) {
            return direct.trim();
        }
        throw new BusinessException(ErrorCode.BUSINESS_ERROR, "AI接口返回格式无法识别");
    }

    private Map<String, String> configValues() {
        ensureDefaults();
        Map<String, String> values = new LinkedHashMap<>();
        systemConfigMapper.selectList(new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigGroup, CONFIG_GROUP))
                .forEach(item -> values.put(item.getConfigKey(), item.getConfigValue()));
        return values;
    }

    private void ensureDefaults() {
        defaults().forEach((key, item) -> {
            SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                    .eq(SystemConfig::getConfigKey, key)
                    .last("limit 1"));
            if (config == null) {
                SystemConfig next = new SystemConfig();
                next.setConfigKey(key);
                next.setConfigName(item.name());
                next.setConfigValue(item.value());
                next.setConfigType(item.type());
                next.setConfigGroup(CONFIG_GROUP);
                next.setRemark(item.remark());
                next.setCreatedAt(LocalDateTime.now());
                next.setUpdatedAt(LocalDateTime.now());
                systemConfigMapper.insert(next);
            }
        });
        repairLegacySparkDefaults();
    }

    private void repairLegacySparkDefaults() {
        Map<String, String> values = new LinkedHashMap<>();
        systemConfigMapper.selectList(new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigGroup, CONFIG_GROUP))
                .forEach(item -> values.put(item.getConfigKey(), item.getConfigValue()));
        if (!"spark".equals(values.get(KEY_PROVIDER))) {
            return;
        }
        if ("Spark-X2-Flash".equalsIgnoreCase(values.get(KEY_MODEL))) {
            updateValue(KEY_MODEL, "spark-x");
        }
        if ("https://spark-api-open.xf-yun.com/agent/v1/chat/completions".equals(values.get(KEY_API_URL))) {
            updateValue(KEY_MODEL, "spark-x");
        }
    }

    private Map<String, DefaultConfig> defaults() {
        AiProvider provider = providerOf(DEFAULT_PROVIDER);
        Map<String, DefaultConfig> map = new LinkedHashMap<>();
        map.put(KEY_ENABLED, new DefaultConfig("AI客服开关", "true", "BOOLEAN", "控制小程序客服是否自动接入AI回复"));
        map.put(KEY_PROVIDER, new DefaultConfig("AI提供商", provider.key(), "STRING", "可选择讯飞、DeepSeek、通义千问、智谱、豆包、OpenAI"));
        map.put(KEY_MODEL, new DefaultConfig("AI模型", provider.model(), "STRING", "当前提供商的模型名称"));
        map.put(KEY_API_URL, new DefaultConfig("AI接口地址", provider.apiUrl(), "STRING", "OpenAI Chat Completions兼容接口"));
        map.put(KEY_API_PASSWORD, new DefaultConfig("API密钥", defaultApiPassword(), "PASSWORD", "仅服务端保存，管理端脱敏展示"));
        map.put(KEY_TIMEOUT_SECONDS, new DefaultConfig("请求超时秒数", "20", "NUMBER", "AI接口请求超时时间"));
        map.put(KEY_TEMPERATURE, new DefaultConfig("温度", "0.4", "DECIMAL", "回复随机性，建议0到1之间"));
        map.put(KEY_MAX_TOKENS, new DefaultConfig("最大输出Token", "900", "NUMBER", "单次AI回复最大输出长度"));
        map.put(KEY_SYSTEM_PROMPT, new DefaultConfig("系统提示词", DEFAULT_SYSTEM_PROMPT, "TEXT", "约束AI客服身份、业务范围和人工转接规则"));
        map.put(KEY_FALLBACK_MESSAGE, new DefaultConfig("失败兜底回复", DEFAULT_FALLBACK_MESSAGE, "TEXT", "AI接口异常时自动回复给小程序用户"));
        map.put(KEY_DEBUG_ENABLED, new DefaultConfig("调试日志", "false", "BOOLEAN", "开启后在服务端输出AI异常摘要"));
        return map;
    }

    private List<Map<String, Object>> providerOptions() {
        return providers().values().stream()
                .map(provider -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("value", provider.key());
                    map.put("label", provider.label());
                    map.put("model", provider.model());
                    map.put("apiUrl", provider.apiUrl());
                    map.put("host", provider.host());
                    map.put("credentialLabel", provider.credentialLabel());
                    map.put("help", provider.help());
                    return map;
                })
                .toList();
    }

    private Map<String, AiProvider> providers() {
        Map<String, AiProvider> map = new LinkedHashMap<>();
        map.put("spark_lite", new AiProvider(
                "spark_lite",
                "讯飞星火通用版",
                "lite",
                "https://spark-api-open.xf-yun.com/v1/chat/completions",
                "spark-api-open.xf-yun.com",
                "API Password",
                "使用讯飞开放平台 API Password；通用版模型可填 lite、generalv3、generalv3.5 等已开通模型"
        ));
        map.put("spark", new AiProvider(
                "spark",
                "讯飞 Spark-X2-Flash",
                "spark-x",
                "https://spark-api-open.xf-yun.com/agent/v1/chat/completions",
                "spark-api-open.xf-yun.com",
                "API Password",
                "使用你截图里的 Spark-X2-Flash WebApi；模型参数必须填 spark-x，不能填服务展示名"
        ));
        map.put("deepseek", new AiProvider(
                "deepseek",
                "DeepSeek",
                "deepseek-chat",
                "https://api.deepseek.com/chat/completions",
                "api.deepseek.com",
                "API Key",
                "使用 DeepSeek API Key"
        ));
        map.put("qwen", new AiProvider(
                "qwen",
                "通义千问 DashScope",
                "qwen-plus",
                "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                "dashscope.aliyuncs.com",
                "API Key",
                "使用阿里云百炼 DashScope API Key"
        ));
        map.put("zhipu", new AiProvider(
                "zhipu",
                "智谱 GLM",
                "glm-4-flash",
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                "open.bigmodel.cn",
                "API Key",
                "使用智谱开放平台 API Key"
        ));
        map.put("doubao", new AiProvider(
                "doubao",
                "火山方舟豆包",
                "doubao-1-5-lite-32k-250115",
                "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                "ark.cn-beijing.volces.com",
                "API Key",
                "使用火山方舟 API Key；模型可填写你的 endpoint id 或模型名"
        ));
        map.put("openai", new AiProvider(
                "openai",
                "OpenAI",
                "gpt-4o-mini",
                "https://api.openai.com/v1/chat/completions",
                "api.openai.com",
                "API Key",
                "使用 OpenAI API Key"
        ));
        return map;
    }

    private AiProvider providerOf(String key) {
        Map<String, AiProvider> providers = providers();
        if (StringUtils.hasText(key) && providers.containsKey(key.trim())) {
            return providers.get(key.trim());
        }
        return providers.get(DEFAULT_PROVIDER);
    }

    private void updateValue(String key, String value) {
        SystemConfig config = systemConfigMapper.selectOne(new LambdaQueryWrapper<SystemConfig>()
                .eq(SystemConfig::getConfigKey, key)
                .last("limit 1"));
        if (config == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "AI配置不存在：" + key);
        }
        config.setConfigValue(value);
        systemConfigMapper.updateById(config);
    }

    private void assertAllowedProviderUrl(AiProvider provider, String apiUrl) {
        try {
            URI uri = URI.create(apiUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !provider.host().equalsIgnoreCase(uri.getHost())) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "当前提供商只允许使用官方HTTPS接口：" + provider.host());
            }
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "AI接口地址格式不正确");
        }
    }

    private Map<String, String> message(String role, String content) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("role", role);
        row.put("content", content == null ? "" : content.trim());
        return row;
    }

    private void putIfText(Map<String, String> map, String key, String value) {
        if (StringUtils.hasText(value)) {
            map.put(key, value.trim());
        }
    }

    private void putIfPresent(Map<String, String> map, String key, String value) {
        if (value != null) {
            map.put(key, value.trim());
        }
    }

    private String normalizeBlankToDefault(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String boolString(Boolean value) {
        return value == null ? null : String.valueOf(value);
    }

    private String firstText(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private boolean boolValue(Map<String, String> values, String key, boolean fallback) {
        String value = values.get(key);
        return StringUtils.hasText(value) ? Boolean.parseBoolean(value) : fallback;
    }

    private int intValue(Map<String, String> values, String key, int fallback) {
        try {
            return Integer.parseInt(values.getOrDefault(key, String.valueOf(fallback)));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private double doubleValue(Map<String, String> values, String key, double fallback) {
        try {
            return Double.parseDouble(values.getOrDefault(key, String.valueOf(fallback)));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String maskSecret(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 8) {
            return "****";
        }
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    private String safeError(Throwable ex) {
        String message = ex.getMessage();
        if (!StringUtils.hasText(message)) {
            return ex.getClass().getSimpleName();
        }
        String result = message;
        String defaultPassword = defaultApiPassword();
        if (StringUtils.hasText(defaultPassword)) {
            result = result.replace(defaultPassword, "***");
        }
        return result;
    }

    private String defaultApiPassword() {
        return DEFAULT_API_PASSWORD_ENV_KEYS.stream()
                .map(System::getenv)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");
    }

    private record DefaultConfig(String name, String value, String type, String remark) {
    }

    private record AiProvider(String key, String label, String model, String apiUrl, String host, String credentialLabel, String help) {
    }
}
