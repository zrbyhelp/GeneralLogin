<template>
  <div class="login-page">
    <div v-if="externalLogin" class="external-login-banner">
      {{ t("login.externalLoginPrefix") }}{{ externalServiceName }}
    </div>

    <section class="login-panel">
      <div class="login-copy">
        <p class="eyebrow">{{ t("login.eyebrow") }}</p>
        <h1>{{ appName }}</h1>
        <div class="managed-tags" :aria-label="t('login.managedServicesLabel')">
          <span v-if="!servicesReady">{{ t("login.loadingServices") }}</span>
          <template v-else>
            <span
              v-for="service in managedServices"
              :key="service.id"
              class="service-tag"
              :title="serviceTitle(service)"
            >
              <i class="status-dot" :class="`status-dot--${service.status}`" aria-hidden="true" />
              {{ service.name }}
            </span>
            <span v-if="managedServices.length === 0">{{ t("login.noServices") }}</span>
          </template>
        </div>
        <div class="login-links" aria-label="portal links">
          <button type="button" @click="openCredits">{{ t("login.openSourceCredits") }}</button>
          <button type="button" @click="openDocs">{{ t("login.docsList") }}</button>
          <NuxtLink to="/feedback">{{ t("login.feedback") }}</NuxtLink>
          <a
            class="github-link"
            href="https://github.com/zrbyhelp"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49v-1.74c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.04.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.16 10.16 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
            </svg>
          </a>
        </div>
      </div>

      <div class="login-box">
        <div class="auth-tabs" role="tablist" :aria-label="t('login.authModeLabel')">
          <button :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">
            {{ t("login.loginTab") }}
          </button>
          <button :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">
            {{ t("login.registerTab") }}
          </button>
        </div>

        <form class="auth-form" @submit.prevent="submitEmailAuth">
          <label v-if="mode === 'register'">
            <span class="field-label">{{ t("common.name") }}</span>
            <input v-model="form.name" class="field-input" autocomplete="name" :placeholder="t('login.namePlaceholder')" />
          </label>
          <label>
            <span class="field-label">{{ t("common.account") }}</span>
            <input
              v-model="form.account"
              class="field-input"
              autocomplete="username"
              :placeholder="t('login.accountPlaceholder')"
            />
          </label>
          <label>
            <span class="field-label">{{ t("common.password") }}</span>
            <input
              v-model="form.password"
              class="field-input"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              :placeholder="t('login.passwordPlaceholder')"
              type="password"
            />
          </label>

          <div class="agreement-box">
            <div class="agreement-row">
              <input id="login-agreement" v-model="agreementAccepted" type="checkbox" />
              <label for="login-agreement">{{ t("login.agreementPrefix") }}</label>
              <button class="agreement-link" type="button" @click="termsVisible = true">
                {{ t("login.agreementLink") }}
              </button>
              <label for="login-agreement">{{ t("login.agreementSuffix") }}</label>
            </div>
          </div>

          <button class="primary-btn auth-submit" type="submit" :disabled="submitting || !agreementAccepted">
            {{ mode === "login" ? t("login.accountLogin") : t("login.accountRegister") }}
          </button>
        </form>

        <div class="divider"><span>{{ t("login.or") }}</span></div>

        <button class="linuxdo-btn" type="button" :disabled="submitting || !agreementAccepted" @click="startLinuxdoLogin">
          {{ t("login.linuxdoLogin") }}
        </button>

        <div class="login-preferences">
          <button
            class="theme-toggle"
            type="button"
            :aria-label="theme === 'light' ? t('common.themeDark') : t('common.themeLight')"
            :title="theme === 'light' ? t('common.themeDark') : t('common.themeLight')"
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

          <div class="language-text-toggle" :aria-label="t('common.language')">
            <button
              type="button"
              :class="{ active: locale === 'zh' }"
              @click="setLocale('zh')"
            >
              {{ t("common.zh") }}
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              :class="{ active: locale === 'en' }"
              @click="setLocale('en')"
            >
              {{ t("common.en") }}
            </button>
          </div>
        </div>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </div>
    </section>

    <el-dialog v-model="creditsVisible" :title="t('login.openSourceCredits')" width="460px">
      <div v-if="openSourceCredits.length" class="credits-list">
        <a
          v-for="credit in openSourceCredits"
          :key="credit.id"
          class="credit-link"
          :href="credit.url"
          target="_blank"
          rel="noreferrer"
        >
          {{ credit.name }}
        </a>
      </div>
      <p v-else class="muted">{{ t("login.noCredits") }}</p>
      <p class="credits-footer">{{ t("login.openSourceThanks") }}</p>
    </el-dialog>

    <el-dialog v-model="docsVisible" :title="t('login.docsList')" width="520px">
      <div class="dialog-list">
        <a href="/docs/">{{ t("login.portalDocs") }}</a>
        <a
          v-for="service in docsServices"
          :key="service.id"
          :href="service.docsUrl || '#'"
          target="_blank"
          rel="noreferrer"
        >
          {{ service.name }}
        </a>
      </div>
      <p v-if="docsServices.length === 0" class="muted docs-note">{{ t("login.noDocs") }}</p>
    </el-dialog>

    <el-dialog v-model="termsVisible" :title="t('login.agreementTitle')" width="680px">
      <div class="terms-copy">
        <p>{{ t("login.agreementIntro") }}</p>
        <section class="terms-section">
          <h3>{{ t("login.agreementDataTitle") }}</h3>
          <p>{{ t("login.agreementDataBody") }}</p>
        </section>
        <section class="terms-section">
          <h3>{{ t("login.agreementUseTitle") }}</h3>
          <p>{{ t("login.agreementUseBody") }}</p>
        </section>
        <section class="terms-section">
          <h3>{{ t("login.agreementContentTitle") }}</h3>
          <p>{{ t("login.agreementContentBody") }}</p>
        </section>
        <section class="terms-section">
          <h3>{{ t("login.agreementResponsibilityTitle") }}</h3>
          <p>{{ t("login.agreementResponsibilityBody") }}</p>
        </section>
        <p class="terms-footnote">{{ t("login.agreementFooter") }}</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

type PublicService = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  host: string;
  docsUrl?: string | null;
  status: "online" | "offline";
};

type OpenSourceCredit = {
  id: string;
  name: string;
  url: string;
};

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { t, localizeError, theme, locale, toggleTheme, setLocale } = usePortalI18n();
const appName = computed(() => runtimeConfig.public.appName || "ZR-AI服务");
const mode = ref<"login" | "register">("login");
const submitting = ref(false);
const errorMessage = ref("");
const form = reactive({
  account: "",
  password: "",
  name: ""
});
const servicesReady = ref(false);
const creditsVisible = ref(false);
const docsVisible = ref(false);
const termsVisible = ref(false);
const agreementAccepted = ref(false);

const clientId = computed(() => String(route.query.client_id || ""));
const callbackUrl = computed(() => String(route.query.callback || ""));
const state = computed(() => String(route.query.state || ""));
const externalLogin = computed(() => Boolean(clientId.value && callbackUrl.value));
const managedServices = ref<PublicService[]>([]);
const openSourceCredits = ref<OpenSourceCredit[]>([]);
const externalServiceName = computed(() =>
  managedServices.value.find((service) => service.clientId === clientId.value)?.name || t("login.unknownService")
);
const docsServices = computed(() =>
  managedServices.value.filter((service) => Boolean(service.docsUrl))
);

async function loadManagedServices() {
  try {
    const result = await $fetch<{ services: PublicService[] }>("/api/public/services");
    managedServices.value = result.services;
  } catch {
    managedServices.value = [];
  }
}

async function loadOpenSourceCredits() {
  try {
    const result = await $fetch<{ credits: OpenSourceCredit[] }>("/api/public/open-source-credits");
    openSourceCredits.value = result.credits;
  } catch {
    openSourceCredits.value = [];
  }
}

function openCredits() {
  creditsVisible.value = true;
  if (!openSourceCredits.value.length) {
    loadOpenSourceCredits();
  }
}

function openDocs() {
  docsVisible.value = true;
}

function serviceTitle(service: PublicService) {
  const status = service.status === "online"
    ? t("login.serviceOnline")
    : t("login.serviceOffline");
  return `${service.host || service.slug} · ${status}`;
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
        state: state.value || undefined,
        theme: theme.value,
        locale: locale.value
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
  if (me.isAdmin) {
    await navigateTo("/admin");
    return;
  }

  await navigateTo("/apps");
}

async function submitEmailAuth() {
  errorMessage.value = "";

  if (!agreementAccepted.value) {
    errorMessage.value = t("error.agreementRequired");
    return;
  }

  submitting.value = true;

  try {
    const endpoint = mode.value === "login" ? "/api/auth/login" : "/api/auth/register";
    await $fetch(endpoint, {
      method: "POST",
      body: {
        account: form.account,
        password: form.password,
        name: form.name || undefined,
        agreementAccepted: true
      }
    });
    await continueAfterAuth();
  } catch (error: any) {
    errorMessage.value =
      localizeError(error, "error.authFailed");
  } finally {
    submitting.value = false;
  }
}

function startLinuxdoLogin() {
  errorMessage.value = "";

  if (!agreementAccepted.value) {
    errorMessage.value = t("error.agreementRequired");
    return;
  }

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
  params.set("theme", theme.value);
  params.set("locale", locale.value);
  params.set("agreement_accepted", "1");
  window.location.href = `/api/auth/linuxdo/start${params.toString() ? `?${params}` : ""}`;
}

onMounted(async () => {
  await loadManagedServices();
  await loadOpenSourceCredits();
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

.external-login-banner {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 20;
  max-width: min(620px, calc(100vw - 28px));
  border: 1px solid rgba(33, 88, 245, 0.2);
  border-radius: 999px;
  padding: 10px 16px;
  background: var(--page-surface-strong);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
  color: var(--page-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  transform: translateX(-50%);
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
  gap: 7px;
  min-height: 34px;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 7px 13px;
  background: var(--page-surface-strong);
  color: var(--page-muted);
  font-size: 13px;
  font-weight: 700;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
}

.status-dot--online {
  background: #10b981;
}

.status-dot--offline {
  background: #ef4444;
}

.login-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.login-links button,
.login-links a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--page-surface-strong);
  color: var(--page-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.login-links .github-link {
  width: 36px;
  padding: 8px;
}

.github-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.dialog-list {
  display: grid;
  gap: 10px;
}

.dialog-list a {
  display: flex;
  align-items: center;
  min-height: 40px;
  border: 1px solid var(--page-border);
  border-radius: 12px;
  padding: 9px 12px;
  background: var(--page-surface);
  color: var(--page-text);
}

.credits-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.credit-link {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 36px;
  border: 1px solid var(--page-border);
  border-radius: 12px;
  padding: 8px 12px;
  background: var(--page-surface);
  color: var(--page-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.credits-footer {
  margin: 14px 0 0;
  color: var(--page-muted);
  font-size: 13px;
  line-height: 1.6;
}

.docs-note {
  margin: 12px 0 0;
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

.agreement-box {
  padding: 2px 0;
}

.agreement-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--page-muted);
  font-size: 12px;
  line-height: 1.55;
}

.agreement-row input {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin: 2px 2px 0 0;
  accent-color: var(--page-accent);
}

.agreement-row label {
  cursor: pointer;
}

.agreement-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--page-accent);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
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

.auth-submit:disabled,
.linuxdo-btn:disabled {
  cursor: not-allowed;
  filter: grayscale(0.35);
  opacity: 0.62;
  transform: none;
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

.auth-submit:disabled:hover,
.linuxdo-btn:disabled:hover {
  transform: none;
}

.error-text {
  margin: 14px 0 0;
  color: #b91c1c;
}

.terms-copy {
  display: grid;
  gap: 12px;
  color: var(--page-text);
  line-height: 1.7;
}

.terms-copy p {
  margin: 0;
}

.terms-section {
  border: 1px solid var(--page-border);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--page-surface);
}

.terms-section h3 {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.4;
}

.terms-footnote {
  color: var(--page-muted);
  font-size: 12px;
}

.small-note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .login-page {
    align-items: flex-start;
    padding: 64px 10px 34px;
  }

  .external-login-banner {
    top: 12px;
    border-radius: 14px;
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
