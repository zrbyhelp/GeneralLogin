<template>
  <div class="page-panel">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">{{ t("apps.title") }}</h1>
        <p class="panel-subtitle">{{ t("apps.subtitle") }}</p>
      </div>
      <div class="action-row">
        <NuxtLink v-if="me?.isAdmin" class="ghost-btn" to="/admin">{{ t("apps.admin") }}</NuxtLink>
        <ClientOnly>
          <AuthActions />
        </ClientOnly>
      </div>
    </div>

    <section v-if="loading" class="panel-card panel-card--strong empty-state">
      {{ t("apps.loading") }}
    </section>

    <section v-else-if="errorMessage" class="panel-card panel-card--strong empty-state">
      <h2>{{ errorMessage }}</h2>
      <div class="action-row">
        <NuxtLink class="primary-btn" to="/login">{{ t("common.relogin") }}</NuxtLink>
        <NuxtLink class="ghost-btn" to="/onboarding">{{ t("apps.requestAccess") }}</NuxtLink>
      </div>
    </section>

    <section v-else-if="apps.length === 0" class="panel-card panel-card--strong empty-state">
      <h2>{{ t("apps.emptyTitle") }}</h2>
      <p class="muted">{{ me?.isAdmin ? t("apps.emptyAdmin") : t("apps.emptyUser") }}</p>
      <div class="action-row">
        <NuxtLink v-if="me?.isAdmin" class="primary-btn" to="/admin">{{ t("apps.admin") }}</NuxtLink>
      </div>
    </section>

    <section v-else class="apps-grid">
      <article v-for="app in apps" :key="app.id" class="panel-card app-card">
        <div>
          <div class="app-card__badges">
            <span class="badge" :class="app.canAccess ? 'badge--ok' : 'badge--warn'">
              {{ app.canAccess ? t("apps.canAccess") : accessLabel(app) }}
            </span>
            <span class="badge">{{ app.slug }}</span>
          </div>
          <h2>{{ app.name }}</h2>
          <p class="muted">{{ app.description || t("apps.defaultDescription") }}</p>
        </div>
        <div class="action-row">
          <button v-if="app.canAccess" class="primary-btn" type="button" @click="launch(app)">
            {{ t("apps.enter") }}
          </button>
          <button
            v-else-if="app.hasPendingRequest"
            class="ghost-btn"
            type="button"
            disabled
          >
            {{ t("apps.waiting") }}
          </button>
          <button
            v-else
            class="ghost-btn"
            type="button"
            :disabled="!app.requiresInvite && !app.requiresRequest"
            @click="openAccess(app)"
          >
            {{ actionLabel(app) }}
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus/es/components/message/index";
import { onMounted, ref } from "vue";

type AppItem = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  description?: string | null;
  homeUrl: string;
  defaultCallbackUrl: string;
  canAccess: boolean;
  hasPendingRequest: boolean;
  requiresInvite: boolean;
  requiresRequest: boolean;
};

const loading = ref(true);
const errorMessage = ref("");
const apps = ref<AppItem[]>([]);
const me = ref<{ isAdmin: boolean; status: string } | null>(null);
const { t, localizeError, theme, locale } = usePortalI18n();

async function load() {
  loading.value = true;
  errorMessage.value = "";

  try {
    me.value = await $fetch<{ isAdmin: boolean; status: string }>("/api/portal/me");
    const result = await $fetch<{ apps: AppItem[] }>("/api/portal/apps");
    apps.value = result.apps;
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.response?.status === 401) {
      await navigateTo("/login");
      return;
    }

    errorMessage.value = localizeError(error, "error.loadServices");
  } finally {
    loading.value = false;
  }
}

function accessLabel(app: AppItem) {
  if (app.hasPendingRequest) return t("apps.pending");
  if (app.requiresInvite && app.requiresRequest) return t("apps.needInviteRequest");
  if (app.requiresInvite) return t("apps.needInvite");
  if (app.requiresRequest) return t("apps.needRequest");
  return t("apps.notOpen");
}

function actionLabel(app: AppItem) {
  if (app.requiresInvite && app.requiresRequest) return t("apps.getAccess");
  if (app.requiresInvite) return t("apps.fillInvite");
  if (app.requiresRequest) return t("apps.requestAccess");
  return t("apps.cannotAccess");
}

async function openAccess(app: AppItem) {
  if (!app.requiresInvite && !app.requiresRequest) {
    return;
  }

  await navigateTo(`/onboarding?service_id=${encodeURIComponent(app.id)}`);
}

function createStateToken() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  return `state_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

async function launch(app: AppItem) {
  if (!app.defaultCallbackUrl) {
    try {
      window.location.href = new URL(app.homeUrl).toString();
    } catch {
      ElMessage.error(t("notice.invalidHomeUrl"));
    }
    return;
  }

  const state = createStateToken();
  try {
    const result = await $fetch<{
      status: "authorized" | "needs_onboarding" | "needs_access";
      redirectUrl: string;
    }>("/api/portal/authorize", {
      method: "POST",
      body: {
        serviceId: app.id,
        callbackUrl: app.defaultCallbackUrl,
        state,
        theme: theme.value,
        locale: locale.value
      }
    });

    if (result.status === "authorized") {
      await navigateTo(result.redirectUrl, { external: true });
      return;
    }

    await navigateTo(result.redirectUrl);
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.serviceAuthorizeFailed"));
  }
}

onMounted(load);
</script>

<style scoped>
.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.app-card {
  min-height: 220px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.app-card h2 {
  margin: 14px 0 8px;
  font-size: 24px;
}

.app-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ghost-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  transform: none;
}

.empty-state {
  min-height: 220px;
  padding: 28px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  text-align: center;
}
</style>
