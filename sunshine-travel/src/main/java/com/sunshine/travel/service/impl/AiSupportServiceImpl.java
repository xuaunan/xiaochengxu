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
    private static final int RECENT_MESSAGE_CONTEXT_LIMIT = 24;
    private static final List<String> DEFAULT_API_PASSWORD_ENV_KEYS = List.of("SPARK_AGENT_API_PASSWORD", "SPARK_API_PASSWORD");
    private static final String LEGACY_TRANSFER_RULE = "遇到投诉、事故、安全、账户资金异常或用户要求人工时，提示已转人工并说明客服会在后台跟进。";
    private static final String UPDATED_TRANSFER_RULE = "投诉或建议类问题先正常说明处理入口、需要补充的信息和查看进度方式；只有事故、安全、账户资金异常或用户明确要求人工时，才提示转人工。";
    private static final String LEGACY_FALLBACK_MESSAGE = "AI客服暂时没有响应，已为你转接人工客服，请稍后查看后台客服回复。";
    private static final String COMPLAINT_GUIDANCE_REPLY = """
            投诉建议的提交入口：网页端在左侧导航点【投诉建议】进入投诉反馈页提交；小程序端在【我的】-账户服务【投诉建议】，或订单详情【售后服务】-【投诉反馈】提交。
            请补充：相关订单、发生时间、问题经过、希望的处理方式；如果有截图或凭证也可以一并提交。
            我会先帮您梳理处理信息，涉及安全、事故、账户资金异常，或您明确要求人工时，再为您转人工跟进。
            """;
    private static final String LEGACY_DEFAULT_SYSTEM_PROMPT = """
            你是阳光出行多端AI客服。回答要简洁、礼貌、可执行。
            只能围绕乘客订单、支付退款、优惠券发票、司机听单接单、提现到账、资质审核、行程问题提供帮助。
            投诉或建议类问题先正常说明处理入口、需要补充的信息和查看进度方式；只有事故、安全、账户资金异常或用户明确要求人工时，才提示转人工。
            用户只发送“投诉建议”时，表示想了解投诉/建议入口，不等于要求人工客服。禁止直接回复“已转人工”“已转接人工客服”“请稍候”。
            不要编造订单状态、金额、审核结论或政策；不确定时请用户补充订单号或等待人工客服。
            """;
    private static final String DEFAULT_SYSTEM_PROMPT = """
            你是阳光出行多端AI客服。回答要简洁、礼貌、可执行，并根据每位用户的真实业务数据个性化作答，避免千篇一律的模板话术。
            只能围绕乘客订单、支付退款、优惠券发票、司机听单接单、提现到账、资质审核、行程问题提供帮助。
            用户咨询订单、支付退款、提现、审核、听单接单等问题时，优先使用后端提供的真实业务数据直接回答，自然引用订单号、状态、金额、时间等关键信息；数据里已有的信息不要反过来向用户索要。
            投诉或建议类问题先正常说明处理入口、需要补充的信息和查看进度方式；只有事故、安全、账户资金异常或用户明确要求人工时，才提示转人工。
            用户只发送“投诉建议”时，表示想了解投诉/建议入口，不等于要求人工客服。禁止直接回复“已转人工”“已转接人工客服”“请稍候”。
            不要编造订单状态、金额、审核结论或政策；数据里查不到时如实说明，再引导用户补充订单号或等待人工客服。
            """;
    private static final String DEFAULT_FALLBACK_MESSAGE = "AI客服暂时没有响应，请稍后再试，或回复\"转人工\"联系人工客服。";
    private static final String LEGACY_DEFAULT_FALLBACK_MESSAGE = "AI客服暂时没有响应，已转接人工客服。";
    private static final List<String> HISTORY_SOURCE_PREFIXES = List.of(
            "AI客服历史回复：", "AI客服历史回复:",
            "人工客服历史回复：", "人工客服历史回复:",
            "用户历史消息：", "用户历史消息:");
    private static final java.util.regex.Pattern FORBIDDEN_LINK_PATTERN =
            java.util.regex.Pattern.compile("(?i)(https?://|www\\.|[a-z0-9-]+\\.(com|cn|net|org|top|vip|xyz))");
    private static final String TRANSFER_MARKER = "[转人工]";
    private static final String TRANSFER_MARKER_ALT = "【转人工】";
    private static final String PRODUCT_FACTS_INSTRUCTION = """
            产品事实（必须遵守，禁止向用户编造任何不存在的渠道或功能）：
            1. 阳光出行只有微信小程序（乘客端小程序、司机端小程序）和网页端；没有独立手机APP。禁止出现"下载APP""应用商店""司机端APP"等说法。
            2. 平台通知只通过小程序【消息通知】和网页端站内消息送达；禁止出现"短信通知""电话通知""邮件通知"。
            3. 平台没有对外官网网址。提到网页端时只说"阳光出行平台网页版"或"网页端"，禁止说出任何具体网址、域名或链接（如 www.xxx.com）。
            4. 乘客想成为司机：引导其在微信内使用司机端小程序，或在网页端选择司机身份登录，完成实名认证并提交车辆资料，等待平台审核。
            5. 审核时效、到账时效等平台未明确规定的口径，不要编造具体天数（如"1-3个工作日"），如实说明以平台通知为准，或建议转人工确认。
            """;
    /** 违禁话术重试后仍出现时的最终修正文案：保证用户永远看不到编造的渠道。 */
    private static final String SAFE_PRODUCT_REPLY = """
            抱歉，刚才的说明有误，更正一下：阳光出行只有微信小程序（乘客端、司机端）和网页端，没有独立手机APP，无需下载任何应用。乘客想成为司机，可以在微信内使用司机端小程序，完成实名认证并提交车辆资料，等待平台审核；审核结果会通过小程序【消息通知】或网页端站内消息送达，平台不发送短信。如需进一步帮助，您可以回复"转人工"。""";
    private static final String TRANSFER_INTENT_INSTRUCTION = """
            转人工的处理规则（由你判断，但必须先征得用户确认，宁缺毋滥）：
            1. 只有当同一问题你已经认真尝试解答仍未解决、用户明显不满并多次抱怨，或用户明确、强烈表达要人工客服时，才回复固定标记：[转人工]，不要附加任何其他文字。系统会先询问用户是否确认转接，用户确认后才会真正转接。
            2. 用户第一次提出问题、只是补充信息、情绪轻微，或问题你能解答时：正常回答，禁止输出该标记。宁可多解答一轮，也不要轻易建议转人工。
            """;

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
        map.put("dataContextScopes", List.of("当前问题焦点", "客服会话", "订单", "支付/退款", "优惠券", "司机资料", "车辆", "提现", "投诉"));
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
            String reply = callChatCompletion(prompt, "", "MINIAPP", List.of(), "", null);
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
        return generateSupportReply(prompt, userRole, "MINIAPP", recentMessages, businessContext);
    }

    @Override
    public Optional<String> generateSupportReply(String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext) {
        Map<String, String> values = configValues();
        if (!boolValue(values, KEY_ENABLED, true)) {
            return Optional.empty();
        }
        try {
            String reply = normalizeReply(prompt, callChatCompletion(prompt, userRole, channel, recentMessages, businessContext, null), channel);
            if (containsForbiddenChannelClaim(reply) || containsForbiddenLink(reply)) {
                String warning = "你刚才的回答错误提到了\"下载APP/应用商店/短信通知/具体网址\"，这些在阳光出行不存在，平台也没有任何官网网址。请严格依据产品事实重新回答：平台只有微信小程序（乘客端、司机端）和网页端；提到网页端只说\"阳光出行平台网页版\"；所有通知只通过小程序【消息通知】和网页站内消息。";
                String retried = normalizeReply(prompt, callChatCompletion(prompt, userRole, channel, recentMessages, businessContext, warning), channel);
                reply = (containsForbiddenChannelClaim(retried) || containsForbiddenLink(retried)) ? SAFE_PRODUCT_REPLY : retried;
            }
            reply = avoidParroting(prompt, userRole, channel, recentMessages, businessContext, reply);
            return Optional.ofNullable(reply);
        } catch (RuntimeException ex) {
            if (boolValue(values, KEY_DEBUG_ENABLED, false)) {
                System.err.println("[AI_SUPPORT] " + safeError(ex));
            }
            String fallback = values.getOrDefault(KEY_FALLBACK_MESSAGE, DEFAULT_FALLBACK_MESSAGE);
            return StringUtils.hasText(fallback) ? Optional.of(fallback.trim()) : Optional.empty();
        }
    }

    /**
     * 弱模型容易原样复读上一条AI回复：检测到复读时带警告重试一次，
     * 仍复读则原样返回，由 Support 侧的重复回复兜底处理。
     */
    private String avoidParroting(String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext, String reply) {
        String previousAi = lastAiContent(recentMessages);
        if (!StringUtils.hasText(reply) || !StringUtils.hasText(previousAi)
                || !stripHistoryPrefix(reply).equals(stripHistoryPrefix(previousAi))) {
            return reply;
        }
        String warning = "你刚才的回答和上一条AI客服回复完全一样，属于重复。请针对用户最新一条消息重新作答，用不同的表达直接解决用户当前的问题，不要复述历史。";
        try {
            String retried = normalizeReply(prompt, callChatCompletion(prompt, userRole, channel, recentMessages, businessContext, warning), channel);
            return StringUtils.hasText(retried) ? retried : reply;
        } catch (RuntimeException ex) {
            return reply;
        }
    }

    private String lastAiContent(List<Map<String, Object>> recentMessages) {
        String content = "";
        for (Map<String, Object> item : recentMessages) {
            if (Boolean.TRUE.equals(item.get("fromAi"))) {
                content = String.valueOf(item.getOrDefault("content", ""));
            }
        }
        return content.trim();
    }

    /** 输出防线：识别对不存在渠道的编造（应用商店/下载司机端/短信通知），触发重试或兜底修正。 */
    private boolean containsForbiddenChannelClaim(String reply) {
        if (!StringUtils.hasText(reply)) {
            return false;
        }
        String normalized = reply.toLowerCase().replace(" ", "");
        if (normalized.contains("应用商店") || normalized.contains("下载司机端")) {
            return true;
        }
        return mentionsSmsWithoutNegation(normalized);
    }

    /** "短信"只有前面紧邻否定词（没有/无/不/未）才算合规表述，如"没有短信""不发送短信"。 */
    private boolean mentionsSmsWithoutNegation(String normalized) {
        int idx = normalized.indexOf("短信");
        while (idx >= 0) {
            String before = normalized.substring(Math.max(0, idx - 4), idx);
            if (!before.contains("没有") && !before.contains("无") && !before.contains("不") && !before.contains("未")) {
                return true;
            }
            idx = normalized.indexOf("短信", idx + 2);
        }
        return false;
    }

    /** 输出防线：禁止编造任何网址/域名/链接，提到网页端只能说"阳光出行平台网页版"。 */
    private boolean containsForbiddenLink(String reply) {
        return StringUtils.hasText(reply) && FORBIDDEN_LINK_PATTERN.matcher(reply).find();
    }

    private String callChatCompletion(String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext, String retryWarning) {
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
        body.put("messages", buildMessages(values, prompt, userRole, channel, recentMessages, businessContext, retryWarning));

        try {
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(apiUrl, new HttpEntity<>(body, headers), JsonNode.class);
            return extractReply(response.getBody());
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, provider.label() + "接口调用失败：" + safeError(ex));
        }
    }

    private List<Map<String, String>> buildMessages(Map<String, String> values, String prompt, String userRole, String channel, List<Map<String, Object>> recentMessages, String businessContext, String retryWarning) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(message("system", values.getOrDefault(KEY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT)));
        messages.add(message("system", channelInstruction(channel)));
        messages.add(message("system", TRANSFER_INTENT_INSTRUCTION));
        if (StringUtils.hasText(userRole)) {
            messages.add(message("system", "当前客服渠道：" + channelText(channel) + "；当前用户角色：" + userRole));
        }
        if (StringUtils.hasText(businessContext)) {
            messages.add(message("system", """
                    下面是后端按当前客服会话读取并脱敏后的真实业务数据、产品背景知识和“当前问题焦点”。
                    回答规则：
                    1. 像熟悉这位用户资料的专属客服：咨询订单、支付退款、提现、审核、听单接单、优惠券、发票、投诉等问题时，先看“当前问题焦点”和对应真实数据，直接结合具体记录回答，并自然引用订单号、状态、金额、时间等关键信息。
                    2. 数据里已有的信息（提现记录、订单状态、审核状态、接单权限、钱包余额等）不要反过来让用户提供，也不要只给千篇一律的导航话术；只有当数据不足以确定用户所指的具体记录时，才列出候选并请用户说明是哪一条。
                    3. 未查询到的数据要如实说明“当前没有查到”，再引导用户补充订单号、截图或问题描述，或建议人工跟进；严禁编造数据、状态、金额或政策。
                    4. 入口、页面名称以产品背景知识为准，解释要口语自然，不要机械罗列资料。
                    """ + "\n" + businessContext.trim()));
        }
        String normalizedPrompt = stripHistoryPrefix(prompt == null ? "" : prompt.trim());
        int fromIndex = Math.max(recentMessages.size() - RECENT_MESSAGE_CONTEXT_LIMIT, 0);
        List<Map<String, Object>> history = recentMessages.subList(fromIndex, recentMessages.size());
        // 历史里若已有与当前问题相同的用户消息（同一问题重发），跳过它并始终把 prompt
        // 追加为最后一条 user 消息，让弱模型明确"最后一条才是要回答的问题"，避免复读历史。
        int skipIndex = -1;
        for (int i = history.size() - 1; i >= 0; i--) {
            Map<String, Object> item = history.get(i);
            boolean assistant = Boolean.TRUE.equals(item.get("fromAdmin")) || Boolean.TRUE.equals(item.get("fromAi"));
            if (!assistant && normalizedPrompt.equals(stripHistoryPrefix(String.valueOf(item.getOrDefault("content", "")).trim()))) {
                skipIndex = i;
                break;
            }
        }
        for (int i = 0; i < history.size(); i++) {
            if (i == skipIndex) {
                continue;
            }
            Map<String, Object> item = history.get(i);
            String content = String.valueOf(item.getOrDefault("content", "")).trim();
            if (!StringUtils.hasText(content) || isLegacyAutoTransferReply(content)) {
                continue;
            }
            boolean assistant = Boolean.TRUE.equals(item.get("fromAdmin")) || Boolean.TRUE.equals(item.get("fromAi"));
            if (isWebChannel(channel) && assistant && containsMiniappPath(content)) {
                continue;
            }
            if (!isWebChannel(channel) && assistant && containsInvalidMiniappEntry(content)) {
                continue;
            }
            messages.add(message(assistant ? "assistant" : "user", historyContent(item, content)));
        }
        messages.add(message("system", """
                以上历史消息带有“用户历史消息：”“AI客服历史回复：”“人工客服历史回复：”来源标记，仅供区分来源。
                请针对用户最新一条消息直接作答：如果是追问，结合历史继续回答；不要原样重复之前的回复，也不要复述这些标记。
                """));
        // 产品事实放在最贴近用户问题处以强化弱模型的遵从度
        messages.add(message("system", PRODUCT_FACTS_INSTRUCTION + (StringUtils.hasText(retryWarning) ? "\n" + retryWarning.trim() : "")));
        messages.add(message("user", prompt));
        return messages;
    }

    private String channelInstruction(String channel) {
        if (isWebChannel(channel)) {
            return """
                    当前客服渠道是网页端，不是小程序。
                    回答网页用户的操作步骤时，用网页端可见入口表达，例如：左侧导航【行程】、【投诉建议】、【钱包】、【发票】，以及订单卡片、订单详情按钮、左侧导航【客服】；网页左侧导航里没有【订单】这一项，订单在【行程】中。
                    不要把小程序路径直接套给网页用户；如果历史消息里有不同渠道的旧说法，要结合当前网页端上下文改成用户看得到的说法。
                    """.trim();
        }
        return """
                当前客服渠道是小程序端。
                回答小程序用户的操作步骤时，用小程序端可见入口表达，不要混入网页端侧边栏或门户页路径。
                产品背景知识来自当前小程序源码和后端真实业务数据。你可以自然解释流程，但入口名称要贴近当前版本的真实页面和按钮；不确定时先说明不确定并引导用户补充截图或转人工核实。
                """.trim();
    }

    private boolean isWebChannel(String channel) {
        if (!StringUtils.hasText(channel)) {
            return false;
        }
        String normalized = channel.trim().toUpperCase();
        return "WEB".equals(normalized) || "H5".equals(normalized) || "PC".equals(normalized);
    }

    private String channelText(String channel) {
        return isWebChannel(channel) ? "网页端" : "小程序";
    }

    private boolean containsMiniappPath(String content) {
        if (!StringUtils.hasText(content)) {
            return false;
        }
        String normalized = content.replaceAll("\\s+", "");
        return normalized.contains("小程序")
                || normalized.contains("【我的】")
                || normalized.contains("【全部订单】")
                || normalized.contains("【行程】");
    }

    private boolean containsInvalidMiniappEntry(String content) {
        if (!StringUtils.hasText(content)) {
            return false;
        }
        String normalized = content.replaceAll("\\s+", "");
        return normalized.contains("【帮助与反馈】")
                || normalized.contains("帮助与反馈")
                || normalized.contains("【我的投诉】")
                || normalized.contains("我的投诉");
    }

    private String historyContent(Map<String, Object> item, String content) {
        if (Boolean.TRUE.equals(item.get("fromAdmin"))) {
            return "人工客服历史回复：" + content;
        }
        if (Boolean.TRUE.equals(item.get("fromAi"))) {
            return "AI客服历史回复：" + content;
        }
        return "用户历史消息：" + content;
    }

    String normalizeReply(String prompt, String reply, String channel) {
        if (!StringUtils.hasText(reply)) {
            return reply;
        }
        String trimmed = stripHistoryPrefix(reply.trim());
        if (trimmed.contains(TRANSFER_MARKER) || trimmed.contains(TRANSFER_MARKER_ALT)) {
            // AI 判断可能需要人工：只产出征询文案，等用户确认后才由 Support 侧进入排队
            return MANUAL_TRANSFER_ASK;
        }
        if (isComplaintOrSuggestionPrompt(prompt) && !isManualRequest(prompt) && isAutoTransferReply(trimmed)) {
            return COMPLAINT_GUIDANCE_REPLY.trim();
        }
        return trimmed;
    }

    /** 输出兜底：弱模型有时会复述历史消息的来源前缀，这里强制剥离，避免用户看到内部标记。 */
    private String stripHistoryPrefix(String reply) {
        String result = reply;
        boolean changed = true;
        while (changed) {
            changed = false;
            for (String prefix : HISTORY_SOURCE_PREFIXES) {
                if (result.startsWith(prefix)) {
                    result = result.substring(prefix.length()).trim();
                    changed = true;
                }
            }
        }
        return result;
    }

    private boolean isComplaintOrSuggestionPrompt(String content) {
        String normalized = normalizeForMatch(content);
        return normalized.contains("投诉") || normalized.contains("建议") || normalized.contains("反馈");
    }

    private boolean isManualRequest(String content) {
        String normalized = normalizeForMatch(content);
        return normalized.contains("人工")
                || normalized.contains("真人")
                || normalized.contains("客服介入")
                || normalized.contains("转接")
                || normalized.contains("转人工");
    }

    private boolean isLegacyAutoTransferReply(String content) {
        return isAutoTransferReply(content) && normalizeForMatch(content).contains("请稍候");
    }

    private boolean isAutoTransferReply(String content) {
        String normalized = normalizeForMatch(content);
        return normalized.contains("已转人工")
                || normalized.contains("转人工客服")
                || normalized.contains("转接人工")
                || normalized.contains("转接客服")
                || normalized.contains("人工客服") && normalized.contains("请稍候");
    }

    private String normalizeForMatch(String content) {
        return content == null ? "" : content.replaceAll("\\s+", "").trim();
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
        repairSupportReplyDefaults();
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

    private void repairSupportReplyDefaults() {
        Map<String, String> values = new LinkedHashMap<>();
        systemConfigMapper.selectList(new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigGroup, CONFIG_GROUP))
                .forEach(item -> values.put(item.getConfigKey(), item.getConfigValue()));
        String systemPrompt = values.get(KEY_SYSTEM_PROMPT);
        if (StringUtils.hasText(systemPrompt) && systemPrompt.contains(LEGACY_TRANSFER_RULE)) {
            updateValue(KEY_SYSTEM_PROMPT, systemPrompt.replace(LEGACY_TRANSFER_RULE, UPDATED_TRANSFER_RULE));
        }
        if (StringUtils.hasText(systemPrompt) && systemPrompt.contains("阳光出行小程序的AI客服")) {
            updateValue(KEY_SYSTEM_PROMPT, systemPrompt.replace("阳光出行小程序的AI客服", "阳光出行多端AI客服"));
        }
        if (StringUtils.hasText(systemPrompt) && systemPrompt.trim().equals(LEGACY_DEFAULT_SYSTEM_PROMPT.trim())) {
            updateValue(KEY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT);
        }
        if (LEGACY_FALLBACK_MESSAGE.equals(values.get(KEY_FALLBACK_MESSAGE))
                || LEGACY_DEFAULT_FALLBACK_MESSAGE.equals(values.get(KEY_FALLBACK_MESSAGE))
                || !StringUtils.hasText(values.get(KEY_FALLBACK_MESSAGE))) {
            updateValue(KEY_FALLBACK_MESSAGE, DEFAULT_FALLBACK_MESSAGE);
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
        map.put(KEY_FALLBACK_MESSAGE, new DefaultConfig("失败兜底回复", DEFAULT_FALLBACK_MESSAGE, "TEXT", "AI接口异常或超时时回复给小程序用户并转人工"));
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
