<template>
  <div class="page-panel">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">{{ t("onboarding.title") }}</h1>
        <p class="panel-subtitle">
          {{ t("onboarding.subtitle") }}
        </p>
      </div>
      <ClientOnly>
        <AuthActions />
      </ClientOnly>
    </div>

    <section class="panel-card panel-card--strong onboarding-service">
      <label class="field-label" for="service-select">{{ t("onboarding.service") }}</label>
      <select id="service-select" v-model="selectedServiceId" class="field-input">
        <option value="">{{ t("onboarding.selectService") }}</option>
        <option
          v-for="service in accessCandidates"
          :key="service.id"
          :value="service.id"
        >
          {{ service.name }}
        </option>
      </select>
      <p v-if="selectedService" class="muted">
        {{ t("onboarding.currentService", { name: selectedService.name, hint: accessHint(selectedService) }) }}
      </p>
    </section>

    <div class="panel-grid panel-grid--two">
      <section v-if="canUseInvite" class="panel-card panel-card--strong onboarding-card">
        <h2>{{ t("onboarding.inviteTitle") }}</h2>
        <p class="muted">{{ t("onboarding.inviteHelp") }}</p>
        <label class="field-label" for="invite-code">{{ t("onboarding.inviteCode") }}</label>
        <input
          id="invite-code"
          v-model="inviteCode"
          class="field-input"
          autocomplete="off"
          placeholder="ZR-..."
        >
        <button class="primary-btn" type="button" :disabled="submitting" @click="submitInvite">
          {{ t("onboarding.useInvite") }}
        </button>
      </section>

      <section v-if="canRequestAccess" class="panel-card panel-card--strong onboarding-card">
        <h2>{{ t("onboarding.requestTitle") }}</h2>
        <p class="muted">{{ t("onboarding.requestHelp") }}</p>
        <label class="field-label" for="request-message">{{ t("onboarding.requestMessage") }}</label>
        <textarea
          id="request-message"
          v-model="message"
          class="field-textarea"
          :placeholder="t('onboarding.requestPlaceholder')"
        />
        <button class="ghost-btn" type="button" :disabled="submitting" @click="submitRequest">
          {{ t("common.submit") }}
        </button>
      </section>

      <section v-if="!canUseInvite && !canRequestAccess" class="panel-card panel-card--strong onboarding-card">
        <h2>{{ t("onboarding.notOpenTitle") }}</h2>
        <p class="muted">{{ t("onboarding.notOpenHelp") }}</p>
        <NuxtLink class="ghost-btn" to="/">{{ t("common.backToApps") }}</NuxtLink>
      </section>
    </div>

    <p v-if="notice" class="portal-note">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type AppItem = {
  id: string;
  clientId: string;
  name: string;
  canAccess: boolean;
  requiresInvite: boolean;
  requiresRequest: boolean;
  hasPendingRequest: boolean;
};

const route = useRoute();
const { t, localizeError, theme, locale } = usePortalI18n();
const inviteCode = ref("");
const message = ref("");
const notice = ref("");
const submitting = ref(false);
const apps = ref<AppItem[]>([]);
const selectedServiceId = ref(String(route.query.service_id || ""));

const selectedService = computed(() =>
  apps.value.find((service) => service.id === selectedServiceId.value)
);
const accessCandidates = computed(() =>
  apps.value.filter(
    (service) =>
      !service.canAccess &&
      !service.hasPendingRequest &&
      (service.requiresInvite || service.requiresRequest)
  )
);
const canUseInvite = computed(() =>
  selectedService.value ? selectedService.value.requiresInvite : apps.value.some((service) => service.requiresInvite)
);
const canRequestAccess = computed(() =>
  Boolean(selectedService.value?.requiresRequest && !selectedService.value.hasPendingRequest)
);

function accessHint(service: AppItem) {
  if (service.hasPendingRequest) return t("onboarding.hintPending");
  if (service.requiresInvite && service.requiresRequest) return t("onboarding.hintInviteRequest");
  if (service.requiresInvite) return t("onboarding.hintInvite");
  if (service.requiresRequest) return t("onboarding.hintRequest");
  return t("onboarding.hintNotOpen");
}

function nextLoginUrl() {
  const params = new URLSearchParams();
  let hasExternalFlow = false;
  for (const key of ["client_id", "callback", "state"]) {
    const value = route.query[key];
    if (value) {
      params.set(key, String(value));
      hasExternalFlow = true;
    }
  }
  if (!hasExternalFlow) {
    return "/";
  }
  params.set("theme", theme.value);
  params.set("locale", locale.value);

  return `/login?${params}`;
}

async function loadApps() {
  try {
    const result = await $fetch<{ apps: AppItem[] }>("/api/portal/apps");
    apps.value = result.apps;

    const clientId = String(route.query.client_id || "");
    if (!selectedServiceId.value && clientId) {
      selectedServiceId.value =
        apps.value.find((service) => service.clientId === clientId)?.id || "";
    }
  } catch (error: any) {
    notice.value = localizeError(error, "error.loadApps");
  }
}

async function submitInvite() {
  submitting.value = true;
  notice.value = "";

  try {
    await $fetch("/api/portal/onboarding", {
      method: "POST",
      body: {
        inviteCode: inviteCode.value
      }
    });
    await navigateTo(nextLoginUrl());
  } catch (error: any) {
    notice.value = localizeError(error, "error.inviteFailed");
  } finally {
    submitting.value = false;
  }
}

async function submitRequest() {
  if (!selectedServiceId.value) {
    notice.value = t("error.selectService");
    return;
  }

  submitting.value = true;
  notice.value = "";

  try {
    await $fetch("/api/portal/onboarding", {
      method: "POST",
      body: {
        message: message.value,
        serviceId: selectedServiceId.value
      }
    });
    const params = new URLSearchParams({
      service: selectedService.value?.name || "",
      theme: theme.value,
      locale: locale.value
    });
    await navigateTo(`/pending?${params}`);
  } catch (error: any) {
    notice.value = localizeError(error, "error.requestFailed");
  } finally {
    submitting.value = false;
  }
}

onMounted(loadApps);
</script>

<style scoped>
.onboarding-service {
  margin-bottom: 16px;
  padding: 20px;
}

.onboarding-service .muted {
  margin: 10px 0 0;
}

.onboarding-card {
  padding: 24px;
}

h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.onboarding-card .field-input,
.onboarding-card .field-textarea {
  margin-bottom: 14px;
}
</style>
