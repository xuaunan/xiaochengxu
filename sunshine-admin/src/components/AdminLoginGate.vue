<template>
  <div class="gate-mask">
    <div class="gate-glow" aria-hidden="true"></div>

    <section class="gate-card" :class="{ 'is-shaking': shaking }" role="dialog" aria-modal="true" aria-label="管理员登录">
      <header class="gate-brand">
        <span class="gate-logo">阳</span>
        <div>
          <h2>管理员登录</h2>
          <p>阳光出行 · 运营后台</p>
        </div>
      </header>

      <div v-if="locked" class="gate-locked">
        <div class="gate-locked-icon">
          <el-icon><Lock /></el-icon>
        </div>
        <strong>登录入口已锁定</strong>
        <p>
          今日已连续输错 <em>{{ MAX_LOGIN_ATTEMPTS }}</em> 次，按安全策略已禁止继续输入，
          请于次日 00:00 后重试，或联系系统管理员。
        </p>
        <span class="gate-locked-date">锁定日期：{{ today }}</span>
      </div>

      <el-form v-else class="gate-form" @submit.prevent>
        <el-form-item>
          <el-input
            v-model="form.username"
            :prefix-icon="User"
            autocomplete="username"
            placeholder="请输入管理员账号"
            size="large"
            @keyup.enter="submit"
          />
        </el-form-item>

        <el-form-item>
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            autocomplete="current-password"
            placeholder="请输入登录密码"
            show-password
            size="large"
            type="password"
            @keyup.enter="submit"
          />
        </el-form-item>

        <transition name="gate-fade">
          <div v-if="errorText" class="gate-error">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ errorText }}</span>
          </div>
        </transition>

        <div class="gate-meta">
          <span class="gate-attempts" :class="{ 'is-danger': remaining <= 2 }">
            剩余尝试次数 {{ remaining }} / {{ MAX_LOGIN_ATTEMPTS }}
          </span>
          <span v-if="warningText" class="gate-warning">{{ warningText }}</span>
        </div>

        <el-button
          class="gate-submit"
          :loading="submitting"
          size="large"
          type="primary"
          @click="submit"
        >
          {{ submitting ? '正在登录…' : '登录后台' }}
        </el-button>
      </el-form>

      <footer class="gate-footer">
        <span>仅限授权管理员使用，本后台不开放注册</span>
        <span class="gate-hint">演示账号：<strong>admin</strong> / <strong>123456</strong></span>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { Lock, User, WarningFilled } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'
import {
  MAX_LOGIN_ATTEMPTS,
  clearLoginGuard,
  getAdminAccount,
  getRemainingAttempts,
  isLoginLocked,
  recordLoginFailure,
  startAdminSession,
  verifyAdminCredential
} from '../utils/adminAuth'

const emit = defineEmits(['success'])

const form = reactive({
  username: getAdminAccount().username,
  password: ''
})
const submitting = ref(false)
const errorText = ref('')
const shaking = ref(false)
const remaining = ref(getRemainingAttempts())
const locked = ref(isLoginLocked())

const today = new Date().toLocaleDateString('zh-CN')

const warningText = computed(() => {
  if (locked.value) return '今日已锁定'
  if (remaining.value <= 2) return '再输错将锁定至次日'
  return ''
})

function refreshGuard() {
  remaining.value = getRemainingAttempts()
  locked.value = isLoginLocked()
}

function triggerShake() {
  shaking.value = true
  window.setTimeout(() => {
    shaking.value = false
  }, 420)
}

function submit() {
  if (submitting.value || locked.value) return

  const username = form.username.trim()
  if (!username) {
    errorText.value = '请输入管理员账号'
    triggerShake()
    return
  }
  if (!form.password) {
    errorText.value = '请输入登录密码'
    triggerShake()
    return
  }

  submitting.value = true
  errorText.value = ''

  // 演示用的前端校验，真实项目请替换为后端登录接口
  window.setTimeout(() => {
    if (verifyAdminCredential(username, form.password)) {
      clearLoginGuard()
      startAdminSession(username)
      submitting.value = false
      form.password = ''
      emit('success')
      return
    }

    recordLoginFailure()
    refreshGuard()
    submitting.value = false
    form.password = ''
    errorText.value = locked.value
      ? '连续输错次数已达上限，今日已禁止继续登录'
      : `账号或密码不正确，本日还可尝试 ${remaining.value} 次`
    triggerShake()
  }, 260)
}
</script>

<style scoped>
.gate-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 26% 18%, rgba(255, 255, 255, 0.34), transparent 52%),
    linear-gradient(155deg, rgba(255, 252, 248, 0.56), rgba(255, 238, 220, 0.66) 58%, rgba(255, 253, 250, 0.56));
  -webkit-backdrop-filter: blur(16px) saturate(1.16);
  backdrop-filter: blur(16px) saturate(1.16);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .gate-mask {
    background: linear-gradient(155deg, #fff8f1, #fff2e4 58%, #fffdfa);
  }
}

.gate-glow {
  position: absolute;
  width: 620px;
  height: 620px;
  border-radius: 50%;
  top: -180px;
  right: -140px;
  background: radial-gradient(circle, rgba(255, 122, 24, 0.16), transparent 68%);
  pointer-events: none;
}

.gate-card {
  position: relative;
  width: min(430px, 100%);
  padding: 34px 34px 26px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(255, 218, 184, 0.9);
  box-shadow:
    0 32px 70px rgba(15, 23, 42, 0.18),
    0 4px 14px rgba(15, 23, 42, 0.06);
}

.gate-card.is-shaking {
  animation: gate-shake 0.4s ease;
}

@keyframes gate-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  18% {
    transform: translateX(-9px);
  }
  36% {
    transform: translateX(7px);
  }
  54% {
    transform: translateX(-5px);
  }
  72% {
    transform: translateX(3px);
  }
}

.gate-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 26px;
}

.gate-logo {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 17px;
  background: linear-gradient(135deg, #ff9a45, #ff7a18);
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(255, 122, 24, 0.28);
}

.gate-brand h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #172033;
}

.gate-brand p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.gate-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.gate-form :deep(.el-input__wrapper) {
  border-radius: 14px;
  padding: 4px 14px;
  box-shadow: 0 0 0 1px rgba(226, 232, 240, 0.95) inset;
}

.gate-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px rgba(255, 122, 24, 0.75) inset;
}

.gate-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 13px;
  border-radius: 12px;
  background: rgba(254, 242, 242, 0.95);
  border: 1px solid rgba(254, 202, 202, 0.95);
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.4;
}

.gate-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #64748b;
}

.gate-attempts {
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.95);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.gate-attempts.is-danger {
  background: rgba(255, 247, 237, 0.98);
  border-color: rgba(253, 186, 116, 0.9);
  color: #c2410c;
}

.gate-warning {
  color: #c2410c;
}

.gate-submit {
  width: 100%;
  border-radius: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  --el-button-bg-color: #ff7a18;
  --el-button-border-color: #ff7a18;
  --el-button-hover-bg-color: #ff8c33;
  --el-button-hover-border-color: #ff8c33;
  --el-button-active-bg-color: #ea6a06;
}

.gate-locked {
  display: grid;
  gap: 10px;
  padding: 22px 20px;
  border-radius: 18px;
  text-align: center;
  background: linear-gradient(160deg, rgba(255, 247, 237, 0.98), rgba(254, 242, 242, 0.98));
  border: 1px solid rgba(253, 186, 116, 0.85);
}

.gate-locked-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin: 0 auto;
  border-radius: 50%;
  background: rgba(255, 237, 213, 0.95);
  color: #ea6a06;
  font-size: 22px;
}

.gate-locked strong {
  font-size: 16px;
  color: #9a3412;
}

.gate-locked p {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: #b45309;
}

.gate-locked em {
  font-style: normal;
  font-weight: 800;
}

.gate-locked-date {
  font-size: 12px;
  color: #d97706;
}

.gate-footer {
  display: grid;
  gap: 4px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed rgba(226, 232, 240, 0.95);
  font-size: 12px;
  color: #94a3b8;
}

.gate-hint strong {
  color: #64748b;
}

.gate-fade-enter-active,
.gate-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.gate-fade-enter-from,
.gate-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
