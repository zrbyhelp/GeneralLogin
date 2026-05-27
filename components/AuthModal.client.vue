<template>
  <Teleport to="body">
    <div v-if="modelValue" class="auth-modal" role="dialog" aria-modal="true">
      <button class="auth-modal__backdrop" type="button" aria-label="Close" @click="close" />
      <section class="auth-modal__panel">
        <button class="auth-modal__close" type="button" :aria-label="t('common.close')" @click="close">×</button>
        <div class="auth-modal__header">
          <p class="eyebrow">{{ externalLogin ? t("login.externalLoginPrefix") + externalServiceName : t("login.eyebrow") }}</p>
          <h2>{{ mode === "login" ? t("login.accountLogin") : t("login.accountRegister") }}</h2>
          <p class="muted">{{ targetServiceName ? t("portal.authForService", { name: targetServiceName }) : t("portal.authIntro") }}</p>
        </div>

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
            <input v-model="form.account" class="field-input" autocomplete="username" :placeholder="t('login.accountPlaceholder')" />
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

          <div class="agreement-row">
            <input id="auth-agreement" v-model="agreementAccepted" type="checkbox" />
            <label for="auth-agreement">{{ t("login.agreementPrefix") }}</label>
            <button class="agreement-link" type="button" @click="termsVisible = true">
              {{ t("login.agreementLink") }}
            </button>
            <label for="auth-agreement">{{ t("login.agreementSuffix") }}</label>
          </div>

          <button class="primary-btn auth-submit" type="submit" :disabled="submitting">
            {{ mode === "login" ? t("login.accountLogin") : t("login.accountRegister") }}
          </button>
        </form>

        <div class="divider"><span>{{ t("login.or") }}</span></div>

        <button class="linuxdo-btn" type="button" :disabled="submitting" @click="startLinuxdoLogin">
          {{ t("login.linuxdoLogin") }}
        </button>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </section>

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
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";

type PublicService = {
  id: string;
  name: string;
  clientId: string;
};

const props = defineProps<{
  modelValue: boolean;
  targetServiceId?: string;
  targetServiceName?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  authenticated: [];
}>();

const route = useRoute();
const { t, localizeError, theme, locale } = usePortalI18n();
const mode = ref<"login" | "register">("login");
const submitting = ref(false);
const errorMessage = ref("");
const services = ref<PublicService[]>([]);
const termsVisible = ref(false);
const agreementAccepted = ref(false);
const form = reactive({
  account: "",
  password: "",
  name: ""
});

const clientId = computed(() => String(route.query.client_id || ""));
const callbackUrl = computed(() => String(route.query.callback || ""));
const state = computed(() => String(route.query.state || ""));
const externalLogin = computed(() => Boolean(clientId.value && callbackUrl.value));
const targetServiceName = computed(() => props.targetServiceName || "");
const externalServiceName = computed(() =>
  services.value.find((service) => service.clientId === clientId.value)?.name || t("login.unknownService")
);

function close() {
  emit("update:modelValue", false);
}

async function loadServices() {
  try {
    const result = await $fetch<{ services: PublicService[] }>("/api/public/services");
    services.value = result.services;
  } catch {
    services.value = [];
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

  if (props.targetServiceId) {
    const result = await $fetch<{
      status: "authorized" | "needs_onboarding" | "needs_access";
      redirectUrl: string;
    }>("/api/portal/authorize", {
      method: "POST",
      body: {
        serviceId: props.targetServiceId,
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

  emit("authenticated");
  close();
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
    errorMessage.value = localizeError(error, "error.authFailed");
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
  if (props.targetServiceId) {
    params.set("service_id", props.targetServiceId);
  }
  params.set("theme", theme.value);
  params.set("locale", locale.value);
  params.set("agreement_accepted", "1");
  window.location.href = `/api/auth/linuxdo/start${params.toString() ? `?${params}` : ""}`;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      errorMessage.value = "";
    }
  }
);

onMounted(loadServices);
</script>

<style scoped>
.auth-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 18px;
}

.auth-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background:
    radial-gradient(circle at 50% 15%, rgba(114, 156, 255, 0.14), transparent 34%),
    rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(16px);
  cursor: pointer;
}

.auth-modal__panel {
  position: relative;
  z-index: 1;
  width: min(460px, 100%);
  border: 1px solid var(--page-border);
  border-radius: 28px;
  padding: 26px;
  background: rgba(14, 15, 18, 0.94);
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.55);
}

.auth-modal__close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--page-border);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  color: var(--page-text);
  cursor: pointer;
  font-size: 20px;
}

.auth-modal__header {
  padding-right: 30px;
}

.auth-modal__header h2 {
  margin: 6px 0 8px;
  font-size: 34px;
  line-height: 1;
}

.auth-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin: 20px 0 16px;
  padding: 4px;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
}

.auth-tabs button {
  border: 0;
  border-radius: 999px;
  padding: 10px 12px;
  background: transparent;
  color: var(--page-muted);
  cursor: pointer;
}

.auth-tabs button.active {
  background: #f6f1e8;
  color: #101114;
}

.auth-form {
  display: grid;
  gap: 12px;
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

.agreement-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--page-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.auth-submit,
.linuxdo-btn {
  width: 100%;
}

.divider {
  position: relative;
  display: grid;
  place-items: center;
  margin: 18px 0;
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
  background: rgba(14, 15, 18, 0.94);
}

.linuxdo-btn {
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 13px 18px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--page-text);
  cursor: pointer;
}

.error-text {
  margin: 14px 0 0;
  color: #ffb4aa;
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
  border-radius: 16px;
  padding: 12px 14px;
  background: var(--page-surface);
}

.terms-section h3 {
  margin: 0 0 6px;
  font-size: 14px;
}

.terms-footnote {
  color: var(--page-muted);
  font-size: 12px;
}
</style>
