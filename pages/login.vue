<template>
  <div class="login-page">
    <section class="login-panel">
      <div class="login-copy">
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ appName }}</h1>
        <div class="managed-tags" :aria-label="copy.managedServicesLabel">
          <span v-if="!servicesReady">{{ copy.loadingServices }}</span>
          <template v-else>
            <span
              v-for="service in managedServices"
              :key="service.id"
              :title="service.host || service.slug"
            >
              {{ service.name }}
            </span>
            <span v-if="managedServices.length === 0">{{ copy.noServices }}</span>
          </template>
        </div>
        <div v-if="externalLogin" class="portal-note">
          {{ copy.externalLoginPrefix }}{{ serviceLabel }}
        </div>
      </div>

      <div class="login-box">
        <div class="auth-tabs" role="tablist" :aria-label="copy.authModeLabel">
          <button :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">
            {{ copy.loginTab }}
          </button>
          <button :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">
            {{ copy.registerTab }}
          </button>
        </div>

        <form class="auth-form" @submit.prevent="submitEmailAuth">
          <label v-if="mode === 'register'">
            <span class="field-label">{{ copy.nameLabel }}</span>
            <input v-model="form.name" class="field-input" autocomplete="name" :placeholder="copy.namePlaceholder" />
          </label>
          <label>
            <span class="field-label">{{ copy.emailLabel }}</span>
            <input
              v-model="form.email"
              class="field-input"
              autocomplete="email"
              inputmode="email"
              :placeholder="copy.emailPlaceholder"
              type="email"
            />
          </label>
          <label>
            <span class="field-label">{{ copy.passwordLabel }}</span>
            <input
              v-model="form.password"
              class="field-input"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              :placeholder="copy.passwordPlaceholder"
              type="password"
            />
          </label>

          <button class="primary-btn auth-submit" type="submit" :disabled="submitting">
            {{ mode === "login" ? copy.emailLogin : copy.emailRegister }}
          </button>
        </form>

        <div class="divider"><span>{{ copy.orText }}</span></div>

        <button class="linuxdo-btn" type="button" @click="startLinuxdoLogin">
          {{ copy.linuxdoLogin }}
        </button>

        <div class="login-preferences">
          <button
            class="theme-toggle"
            type="button"
            :aria-label="theme === 'light' ? copy.darkTheme : copy.lightTheme"
            :title="theme === 'light' ? copy.darkTheme : copy.lightTheme"
            @click="toggleTheme"
          >
            <svg v-if="theme === 'light'" class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.5 14.8A8.2 8.2 0 0 1 9.2 3.5A8.7 8.7 0 1 0 20.5 14.8Z" />
            </svg>
            <svg v-else class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
            </svg>
          </button>

          <div class="language-text-toggle" :aria-label="copy.languageLabel">
            <button
              type="button"
              :class="{ active: locale === 'zh' }"
              @click="setLocale('zh')"
            >
              {{ copy.zhLang }}
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              :class="{ active: locale === 'en' }"
              @click="setLocale('en')"
            >
              {{ copy.enLang }}
            </button>
          </div>
        </div>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
        <p class="muted small-note">
          {{ copy.securityNote }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

type Theme = "light" | "dark";
type Locale = "zh" | "en";

type PublicService = {
  id: string;
  name: string;
  slug: string;
  host: string;
};

const THEME_KEY = "portal-theme";
const LOCALE_KEY = "portal-locale";

const messages = {
  zh: {
    eyebrow: "登录入口",
    managedServicesLabel: "目前管理的服务和网站",
    loadingServices: "正在加载服务...",
    noServices: "暂无已启用服务",
    externalLoginPrefix: "正在为外部服务发起登录：",
    authModeLabel: "认证模式",
    loginTab: "登录",
    registerTab: "注册",
    nameLabel: "名称",
    namePlaceholder: "你的名字",
    emailLabel: "邮箱",
    emailPlaceholder: "you@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "至少 8 位",
    emailLogin: "邮箱登录",
    emailRegister: "邮箱注册",
    orText: "或",
    linuxdoLogin: "使用 Linux.do 登录",
    themeLabel: "日夜切换",
    lightTheme: "日间",
    darkTheme: "夜间",
    languageLabel: "中英文切换",
    zhLang: "中文",
    enLang: "EN",
    securityNote: "新用户注册或第三方登录后，仍需要邀请码或管理员审核才能访问服务。",
    unknownService: "未指定服务",
    authFailed: "认证失败"
  },
  en: {
    eyebrow: "Login Portal",
    managedServicesLabel: "Managed services and websites",
    loadingServices: "Loading services...",
    noServices: "No enabled services yet",
    externalLoginPrefix: "Starting login for external service: ",
    authModeLabel: "Authentication mode",
    loginTab: "Sign in",
    registerTab: "Sign up",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 8 characters",
    emailLogin: "Email sign in",
    emailRegister: "Create account",
    orText: "or",
    linuxdoLogin: "Continue with Linux.do",
    themeLabel: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    languageLabel: "Language",
    zhLang: "中文",
    enLang: "EN",
    securityNote: "New users still need an invite code or admin review before they can access services.",
    unknownService: "Unspecified service",
    authFailed: "Authentication failed"
  }
} as const;

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const appName = computed(() => runtimeConfig.public.appName || "ZR-AI服务");
const mode = ref<"login" | "register">("login");
const theme = ref<Theme>("light");
const locale = ref<Locale>("zh");
const submitting = ref(false);
const errorMessage = ref("");
const form = reactive({
  email: "",
  password: "",
  name: ""
});
const servicesReady = ref(false);

const clientId = computed(() => String(route.query.client_id || ""));
const callbackUrl = computed(() => String(route.query.callback || ""));
const state = computed(() => String(route.query.state || ""));
const externalLogin = computed(() => Boolean(clientId.value && callbackUrl.value));
const copy = computed(() => messages[locale.value]);
const serviceLabel = computed(() => clientId.value || copy.value.unknownService);
const managedServices = ref<PublicService[]>([]);

function setTheme(nextTheme: Theme) {
  theme.value = nextTheme;
  if (import.meta.client) {
    localStorage.setItem(THEME_KEY, nextTheme);
  }
}

function toggleTheme() {
  setTheme(theme.value === "light" ? "dark" : "light");
}

function setLocale(nextLocale: Locale) {
  locale.value = nextLocale;
  if (import.meta.client) {
    localStorage.setItem(LOCALE_KEY, nextLocale);
  }
}

useHead(() => ({
  htmlAttrs: {
    lang: locale.value === "en" ? "en" : "zh-CN",
    "data-theme": theme.value
  }
}));

async function loadManagedServices() {
  try {
    const result = await $fetch<{ services: PublicService[] }>("/api/public/services");
    managedServices.value = result.services;
  } catch {
    managedServices.value = [];
  }
}

async function continueAfterAuth() {
  if (externalLogin.value) {
    const result = await $fetch<{
      status: "authorized" | "needs_onboarding" | "needs_access";
      redirectUrl: string;
    }>("/api/portal/authorize", {
      method: "POST",
      body: {
        clientId: clientId.value,
        callbackUrl: callbackUrl.value,
        state: state.value || undefined
      }
    });

    if (result.status === "authorized") {
      await navigateTo(result.redirectUrl, { external: true });
      return;
    }

    await navigateTo(result.redirectUrl);
    return;
  }

  const me = await $fetch<{ status: string; isAdmin?: boolean }>("/api/portal/me");
  if (me.status === "PENDING") {
    await navigateTo("/onboarding");
    return;
  }

  if (me.isAdmin) {
    await navigateTo("/admin");
    return;
  }

  await navigateTo("/apps");
}

async function submitEmailAuth() {
  submitting.value = true;
  errorMessage.value = "";

  try {
    const endpoint = mode.value === "login" ? "/api/auth/login" : "/api/auth/register";
    await $fetch(endpoint, {
      method: "POST",
      body: {
        email: form.email,
        password: form.password,
        name: form.name || undefined
      }
    });
    await continueAfterAuth();
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message || error?.data?.statusMessage || error?.message || copy.value.authFailed;
  } finally {
    submitting.value = false;
  }
}

function startLinuxdoLogin() {
  const params = new URLSearchParams();
  if (clientId.value) {
    params.set("client_id", clientId.value);
  }
  if (callbackUrl.value) {
    params.set("callback", callbackUrl.value);
  }
  if (state.value) {
    params.set("state", state.value);
  }
  if (form.email) {
    params.set("login_hint", form.email);
  }

  window.location.href = `/api/auth/linuxdo/start${params.toString() ? `?${params}` : ""}`;
}

onMounted(async () => {
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    theme.value = storedTheme;
  }

  const storedLocale = localStorage.getItem(LOCALE_KEY);
  if (storedLocale === "zh" || storedLocale === "en") {
    locale.value = storedLocale;
  }

  await loadManagedServices();
  servicesReady.value = true;

  try {
    await $fetch("/api/auth/me");
    await continueAfterAuth();
  } catch {
    // not logged in
  }
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0 auto;
  padding: 48px 16px;
  background: transparent;
}

.login-panel {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(340px, 430px);
  width: min(1080px, 100%);
  overflow: hidden;
  border: 1px solid var(--page-border);
  border-radius: 20px;
  background: var(--page-surface-strong);
  box-shadow:
    0 22px 70px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(18px);
}

.login-copy {
  min-height: 490px;
  padding: clamp(34px, 5vw, 58px);
  border-right: 1px solid var(--page-border);
  background: var(--page-surface);
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--page-accent-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(42px, 6vw, 76px);
  line-height: 0.94;
  letter-spacing: 0;
}

.login-copy > p:not(.eyebrow) {
  margin: 22px 0;
  max-width: 460px;
  color: var(--page-muted);
  font-size: 16px;
  line-height: 1.8;
}

.managed-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.managed-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 7px 13px;
  background: var(--page-surface-strong);
  color: var(--page-muted);
  font-size: 13px;
  font-weight: 700;
}

.login-box {
  padding: clamp(24px, 4vw, 34px);
  background: var(--page-surface);
}

.auth-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 18px;
  padding: 4px;
  border-radius: 14px;
  background: var(--page-surface-muted);
}

.auth-tabs button {
  border: 0;
  border-radius: 10px;
  padding: 10px 12px;
  background: transparent;
  color: var(--page-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.auth-tabs button.active {
  background: var(--page-surface-strong);
  color: var(--page-text);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
}

.auth-form {
  display: grid;
  gap: 12px;
}

.auth-submit {
  margin-top: 4px;
  width: 100%;
}

.divider {
  position: relative;
  display: grid;
  place-items: center;
  margin: 20px 0;
  color: var(--page-muted);
  font-size: 12px;
}

.divider::before {
  position: absolute;
  inset: 50% 0 auto;
  height: 1px;
  background: var(--page-border);
  content: "";
}

.divider span {
  position: relative;
  padding: 0 10px;
  background: var(--page-surface);
}

.linuxdo-btn {
  width: 100%;
  border: 1px solid rgba(33, 88, 245, 0.18);
  border-radius: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #2158f5, #0f766e);
  color: white;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    filter 0.15s ease,
    transform 0.15s ease;
}

.login-preferences {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  min-height: 28px;
  margin-top: 10px;
}

.theme-toggle {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--page-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    transform 0.15s ease;
}

.theme-toggle:hover {
  color: var(--page-text);
  transform: translateY(-1px);
}

.theme-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.language-text-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--page-muted);
  font-size: 12px;
  line-height: 1;
}

.language-text-toggle button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 600;
  line-height: 1;
  transition:
    color 0.15s ease,
    opacity 0.15s ease;
}

.language-text-toggle button.active {
  color: var(--page-text);
}

.language-text-toggle button:not(.active):hover {
  color: var(--page-text);
}

.auth-tabs button:hover,
.linuxdo-btn:hover {
  transform: translateY(-1px);
}

.error-text {
  margin: 14px 0 0;
  color: #b91c1c;
}

.small-note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .login-page {
    align-items: flex-start;
    padding: 20px 10px 34px;
  }

  .login-panel {
    grid-template-columns: 1fr;
    border-radius: 18px;
  }

  .login-copy {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--page-border);
    padding: 28px 24px;
  }

  .login-box {
    padding: 22px;
  }
}
</style>
