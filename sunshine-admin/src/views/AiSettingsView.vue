<script setup>
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../api/http'

const DEFAULT_PROVIDER_OPTIONS = [
  {
    value: 'spark_lite',
    label: '讯飞星火通用版',
    model: 'lite',
    apiUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    credentialLabel: 'API Password',
    help: '使用讯飞开放平台 API Password；通用版模型可填 lite、generalv3、generalv3.5 等已开通模型'
  },
  {
    value: 'spark',
    label: '讯飞 Spark-X2-Flash',
    model: 'spark-x',
    apiUrl: 'https://spark-api-open.xf-yun.com/agent/v1/chat/completions',
    credentialLabel: 'API Password',
    help: '使用你截图里的 Spark-X2-Flash WebApi；模型参数必须填 spark-x，不能填服务展示名'
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    model: 'deepseek-chat',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    credentialLabel: 'API Key',
    help: '使用 DeepSeek API Key'
  },
  {
    value: 'qwen',
    label: '通义千问 DashScope',
    model: 'qwen-plus',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    credentialLabel: 'API Key',
    help: '使用阿里云百炼 DashScope API Key'
  },
  {
    value: 'zhipu',
    label: '智谱 GLM',
    model: 'glm-4-flash',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    credentialLabel: 'API Key',
    help: '使用智谱开放平台 API Key'
  },
  {
    value: 'doubao',
    label: '火山方舟豆包',
    model: 'doubao-1-5-lite-32k-250115',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    credentialLabel: 'API Key',
    help: '使用火山方舟 API Key；模型可填写你的 endpoint id 或模型名'
  },
  {
    value: 'openai',
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    credentialLabel: 'API Key',
    help: '使用 OpenAI API Key'
  }
]

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const loadError = ref('')
const testPrompt = ref('乘客咨询订单已支付但司机没有接单，应该怎么回复？')
const testResult = ref(null)
const providerOptions = ref(DEFAULT_PROVIDER_OPTIONS)

const settings = reactive({
  enabled: true,
  provider: 'spark_lite',
  providerLabel: '讯飞星火通用版',
  model: 'lite',
  apiUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
  apiPassword: '',
  apiPasswordMasked: '',
  hasApiPassword: false,
  timeoutSeconds: 20,
  temperature: 0.4,
  maxTokens: 900,
  systemPrompt: '',
  fallbackMessage: '',
  debugEnabled: false,
  dataContextEnabled: true,
  dataContextScopes: []
})

const currentProvider = computed(() =>
  providerOptions.value.find((item) => item.value === settings.provider) || providerOptions.value[0]
)

const credentialLabel = computed(() => currentProvider.value?.credentialLabel || 'API Key')

const passwordHint = computed(() => {
  if (settings.apiPassword.trim()) return `保存后将替换当前 ${credentialLabel.value}`
  if (settings.hasApiPassword) return `当前已配置：${settings.apiPasswordMasked}`
  return `尚未配置 ${credentialLabel.value}`
})

const statusText = computed(() => {
  if (loadError.value) return '连接异常'
  return settings.enabled ? '已接入' : '未启用'
})

const dataStatusItems = computed(() => [
  {
    label: '模型接口',
    value: settings.enabled && !loadError.value ? '已启用' : '待检查',
    tone: settings.enabled && !loadError.value ? 'success' : 'warning'
  },
  {
    label: credentialLabel.value,
    value: settings.hasApiPassword || settings.apiPassword.trim() ? '已配置' : '未配置',
    tone: settings.hasApiPassword || settings.apiPassword.trim() ? 'success' : 'warning'
  },
  {
    label: '项目数据',
    value: settings.dataContextEnabled ? '已接入客服会话' : '未接入',
    tone: settings.dataContextEnabled ? 'success' : 'warning'
  }
])

const dataScopeText = computed(() => {
  const scopes = Array.isArray(settings.dataContextScopes) ? settings.dataContextScopes : []
  return scopes.length ? scopes.join('、') : '客服会话、订单、支付/退款、优惠券、司机资料、车辆、提现、投诉'
})

async function loadSettings() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await http.get('/admin/ai/settings')
    providerOptions.value = Array.isArray(response?.providerOptions) && response.providerOptions.length
      ? response.providerOptions
      : DEFAULT_PROVIDER_OPTIONS
    Object.assign(settings, {
      ...response,
      apiPassword: ''
    })
  } catch (error) {
    loadError.value = error?.message || 'AI配置读取失败，请确认后端已重启到最新版本'
  } finally {
    loading.value = false
  }
}

function handleProviderChange(value) {
  const provider = providerOptions.value.find((item) => item.value === value)
  if (!provider) return
  settings.model = provider.model
  settings.apiUrl = provider.apiUrl
  settings.providerLabel = provider.label
  settings.apiPassword = ''
  testResult.value = null
}

async function saveSettings() {
  saving.value = true
  try {
    const payload = {
      enabled: settings.enabled,
      provider: settings.provider,
      model: settings.model,
      apiUrl: settings.apiUrl,
      timeoutSeconds: settings.timeoutSeconds,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
      fallbackMessage: settings.fallbackMessage,
      debugEnabled: settings.debugEnabled
    }
    if (settings.apiPassword.trim()) {
      payload.apiPassword = settings.apiPassword.trim()
    }
    const response = await http.post('/admin/ai/settings', payload)
    providerOptions.value = Array.isArray(response?.providerOptions) && response.providerOptions.length
      ? response.providerOptions
      : providerOptions.value
    Object.assign(settings, {
      ...response,
      apiPassword: ''
    })
    loadError.value = ''
    ElMessage.success('AI客服设置已保存')
  } finally {
    saving.value = false
  }
}

async function testAi() {
  const prompt = testPrompt.value.trim()
  if (!prompt) {
    ElMessage.warning('请输入调试内容')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await http.post('/admin/ai/test', { prompt })
  } finally {
    testing.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section class="page ai-settings-page">
    <article class="panel ai-hero">
      <div>
        <span class="panel-kicker">AI客服</span>
        <h3 class="panel-title">小程序双端智能客服设置</h3>
        <p class="panel-subtitle">
          统一配置乘客端、司机端客服的AI自动回复、调试参数和异常兜底话术。
        </p>
      </div>
      <div class="ai-status" :class="{ error: loadError }">
        <span :class="{ active: settings.enabled && !loadError }"></span>
        {{ statusText }}
      </div>
    </article>

    <el-alert
      v-if="loadError"
      class="ai-alert"
      type="warning"
      :closable="false"
      show-icon
      title="AI配置读取失败"
      :description="`${loadError}。常见原因：后端还没有重启到最新 jar、当前登录已失效，或旧数据库还没完成 AI 配置初始化。`"
    />

    <div class="ai-layout">
      <article v-loading="loading" class="panel ai-form-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">基础配置</span>
            <h3 class="panel-title">模型与密钥</h3>
          </div>
          <el-button :loading="saving" type="primary" @click="saveSettings">保存设置</el-button>
        </div>

        <el-form class="ai-form" label-width="122px">
          <el-form-item label="启用AI客服">
            <el-switch v-model="settings.enabled" />
          </el-form-item>
          <el-form-item label="提供商">
            <el-select v-model="settings.provider" style="width: 100%" @change="handleProviderChange">
              <el-option
                v-for="provider in providerOptions"
                :key="provider.value"
                :label="provider.label"
                :value="provider.value"
              />
            </el-select>
            <div class="form-tip">{{ currentProvider.help }}</div>
          </el-form-item>
          <el-form-item label="模型">
            <el-input v-model="settings.model" maxlength="80" />
          </el-form-item>
          <el-form-item label="接口地址">
            <el-input v-model="settings.apiUrl" maxlength="255" />
            <div class="form-tip">为防止服务端请求被滥用，后端只允许当前提供商的官方 HTTPS 域名。</div>
          </el-form-item>
          <el-form-item :label="credentialLabel">
            <el-input
              v-model="settings.apiPassword"
              maxlength="255"
              show-password
              placeholder="留空则保持当前密钥"
            />
            <div class="form-tip">{{ passwordHint }}</div>
          </el-form-item>
          <div class="ai-form-grid">
            <el-form-item label="超时秒数">
              <el-input-number v-model="settings.timeoutSeconds" :min="3" :max="60" />
            </el-form-item>
            <el-form-item label="温度">
              <el-input-number v-model="settings.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="最大Token">
              <el-input-number v-model="settings.maxTokens" :min="64" :max="4096" :step="64" />
            </el-form-item>
            <el-form-item label="调试日志">
              <el-switch v-model="settings.debugEnabled" />
            </el-form-item>
          </div>
          <el-form-item label="系统提示词">
            <el-input
              v-model="settings.systemPrompt"
              type="textarea"
              :rows="7"
              maxlength="2000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="兜底回复">
            <el-input
              v-model="settings.fallbackMessage"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </article>

      <article class="panel ai-debug-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">调试</span>
            <h3 class="panel-title">接口测试</h3>
            <p class="panel-subtitle">这里验证模型是否可用；真实订单、支付、司机等数据只在具体客服会话中读取。</p>
          </div>
        </div>

        <div class="data-status-grid">
          <div
            v-for="item in dataStatusItems"
            :key="item.label"
            class="data-status-item"
            :class="item.tone"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="data-scope">
          <span>真实数据范围</span>
          <p>{{ dataScopeText }}。后台客服页可查看每个会话的“AI引用数据”。</p>
        </div>

        <div class="provider-summary">
          <span>{{ currentProvider.label }}</span>
          <strong>{{ settings.model }}</strong>
        </div>

        <el-input
          v-model="testPrompt"
          type="textarea"
          :rows="5"
          maxlength="500"
          show-word-limit
          placeholder="输入一条用户问题进行测试"
        />
        <el-button class="debug-button" :loading="testing" type="primary" @click="testAi">发送测试</el-button>

        <div v-if="testResult" class="debug-result" :class="{ error: !testResult.ok }">
          <div class="debug-result__head">
            <strong>{{ testResult.ok ? '测试成功' : '测试失败' }}</strong>
            <span>{{ testResult.durationMs || 0 }} ms</span>
          </div>
          <p>{{ testResult.ok ? testResult.reply : testResult.error }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.ai-settings-page {
  display: grid;
  gap: 20px;
}

.ai-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-alert {
  border-radius: 8px;
}

.ai-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: 8px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 13px;
  font-weight: 600;
}

.ai-status.error {
  color: #b45309;
  background: #fffbeb;
  border-color: #fde68a;
}

.ai-status span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.ai-status span.active {
  background: #16a34a;
}

.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  align-items: start;
}

.ai-form {
  margin-top: 20px;
}

.ai-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.form-tip {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.data-status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0 12px;
}

.data-status-item {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.data-status-item.success {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.data-status-item.warning {
  border-color: #fde68a;
  background: #fffbeb;
}

.data-status-item span {
  color: #64748b;
  font-size: 12px;
}

.data-status-item strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
  word-break: keep-all;
}

.data-scope {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
}

.data-scope span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 650;
}

.data-scope p {
  margin: 5px 0 0;
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
}

.provider-summary {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.provider-summary span {
  color: #64748b;
  font-size: 12px;
}

.provider-summary strong {
  color: #0f172a;
  font-size: 13px;
  word-break: break-word;
}

.debug-button {
  width: 100%;
  margin-top: 12px;
}

.debug-result {
  margin-top: 14px;
  padding: 12px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.debug-result.error {
  background: #fff7ed;
  border-color: #fed7aa;
}

.debug-result__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #0f172a;
  font-size: 13px;
}

.debug-result__head span {
  color: #64748b;
  font-size: 12px;
}

.debug-result p {
  margin: 8px 0 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 1080px) {
  .ai-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .ai-hero,
  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .ai-form-grid {
    grid-template-columns: 1fr;
  }

  .data-status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
