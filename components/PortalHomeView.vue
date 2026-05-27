<template>
  <div class="portal-page">
    <header class="portal-nav">
      <NuxtLink class="portal-brand" to="/">
        <span class="portal-brand__mark">ZR</span>
        <span>{{ appName }}</span>
      </NuxtLink>
      <nav class="portal-nav__links" aria-label="portal links">
        <button type="button" @click="scrollToApps">{{ t("portal.apps") }}</button>
        <button type="button" @click="feedbackVisible = true">{{ t("login.feedback") }}</button>
        <div class="portal-docs" :class="{ open: docsMenuOpen }">
          <button type="button" @click="docsMenuOpen = !docsMenuOpen">
            {{ t("login.docsList") }}
          </button>
          <div v-if="docsMenuOpen" class="portal-docs__menu">
            <a href="/docs/" target="_blank" rel="noreferrer">{{ t("portal.docsPlatform") }}</a>
            <a
              v-for="service in docsServices"
              :key="service.id"
              :href="service.docsUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ serviceTitle(service) }}{{ t("portal.docsServiceSuffix") }}
            </a>
            <div v-if="docsServices.length === 0" class="portal-docs__empty">
              {{ t("login.noDocs") }}
            </div>
          </div>
        </div>
      </nav>
      <div class="portal-nav__actions">
        <NuxtLink v-if="me?.isAdmin" class="ghost-btn portal-admin-link" to="/admin">{{ t("apps.admin") }}</NuxtLink>
        <ClientOnly v-if="me">
          <AuthActions />
        </ClientOnly>
        <button v-else class="primary-btn portal-signin" type="button" @click="openAuth()">
          {{ t("common.login") }}
        </button>
      </div>
    </header>

    <main class="portal-main">
      <section class="portal-hero">
        <div class="portal-hero__copy">
          <p class="eyebrow">{{ t("portal.eyebrow") }}</p>
          <h1>
            <span>{{ t("portal.titleLine1") }}</span>
            <span>{{ t("portal.titleLine2") }}</span>
          </h1>
          <div class="portal-hero__actions">
            <button class="primary-btn" type="button" @click="openFeatured">
              {{ t("portal.start") }}
            </button>
            <button class="ghost-btn" type="button" @click="scrollToApps">
              {{ t("portal.explore") }}
            </button>
          </div>
        </div>

        <article class="portal-spotlight">
          <div class="portal-spotlight__media">
            <video
              v-if="featuredService?.videoUrl && featuredService.mediaType === 'video'"
              :src="featuredService.videoUrl"
              autoplay
              muted
              loop
              playsinline
            />
            <img
              v-else-if="featuredService?.coverImageUrl"
              :src="featuredService.coverImageUrl"
              :alt="serviceTitle(featuredService)"
            >
            <div v-else class="portal-media-fallback">
              <span>{{ serviceInitial(featuredService) }}</span>
            </div>
          </div>
          <div class="portal-spotlight__body">
            <div class="portal-card__tags">
              <span v-for="tag in serviceTags(featuredService)" :key="tag">{{ tag }}</span>
            </div>
            <h2>{{ serviceTitle(featuredService) }}</h2>
            <p>{{ serviceIntro(featuredService) }}</p>
            <button class="primary-btn" type="button" @click="openService(featuredService)">
              {{ t("portal.openApp") }}
            </button>
          </div>
        </article>
      </section>

      <section ref="appsSection" class="portal-showcase">
        <div class="portal-section-heading">
          <p class="eyebrow">{{ t("portal.showcaseEyebrow") }}</p>
          <h2>{{ t("portal.showcaseTitle") }}</h2>
        </div>

        <div v-if="loading" class="panel-card panel-card--strong portal-empty">
          {{ t("login.loadingServices") }}
        </div>
        <div v-else-if="services.length === 0" class="panel-card panel-card--strong portal-empty">
          {{ t("login.noServices") }}
        </div>
        <div v-else class="portal-app-grid">
          <article v-for="service in services" :key="service.id" class="portal-app-card">
            <div class="portal-app-card__media">
              <video
                v-if="service.videoUrl && service.mediaType === 'video'"
                :src="service.videoUrl"
                muted
                loop
                playsinline
                @mouseenter="playVideo"
                @mouseleave="pauseVideo"
              />
              <img v-else-if="service.coverImageUrl" :src="service.coverImageUrl" :alt="serviceTitle(service)">
              <div v-else class="portal-media-fallback portal-media-fallback--small">
                <span>{{ serviceInitial(service) }}</span>
              </div>
            </div>
            <div class="portal-app-card__body">
              <div class="portal-card__tags">
                <span v-for="tag in serviceTags(service)" :key="tag">{{ tag }}</span>
              </div>
              <h3>{{ serviceTitle(service) }}</h3>
              <p>{{ serviceIntro(service) }}</p>
              <div class="portal-app-card__footer">
                <span class="status-pill" :class="`status-pill--${service.status}`">
                  {{ service.status === "online" ? t("login.serviceOnline") : t("login.serviceOffline") }}
                </span>
                <button class="ghost-btn" type="button" @click="openService(service)">
                  {{ t("portal.openApp") }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <ClientOnly>
      <AuthModal
        v-model="authVisible"
        :target-service-id="selectedService?.id"
        :target-service-name="selectedService ? serviceTitle(selectedService) : ''"
        @authenticated="loadUser"
      />
    </ClientOnly>

    <div v-if="feedbackVisible" class="portal-modal" role="dialog" aria-modal="true">
      <button class="portal-modal__backdrop" type="button" aria-label="Close" @click="feedbackVisible = false" />
      <section class="portal-modal__panel">
        <FeedbackPanel embed @close="feedbackVisible = false" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus/es/components/message/index";
import { computed, onMounted, ref, watch } from "vue";

type PortalService = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  description?: string | null;
  displayTitle?: string | null;
  shortIntro?: string | null;
  coverImageUrl?: string | null;
  videoUrl?: string | null;
  mediaType?: string | null;
  tags?: string[];
  featured?: boolean;
  host?: string;
  status: "online" | "offline";
  docsUrl?: string | null;
};

const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const { t, localizeError, theme, locale } = usePortalI18n();
const appName = computed(() => runtimeConfig.public.appName || "ZR-AI服务");
const loading = ref(true);
const services = ref<PortalService[]>([]);
const feedbackVisible = ref(false);
const docsMenuOpen = ref(false);
const selectedService = ref<PortalService | null>(null);
const authVisible = ref(false);
const authorizing = ref(false);
const appsSection = ref<HTMLElement | null>(null);
const me = ref<{ isAdmin?: boolean } | null>(null);
const featuredService = computed(() =>
  services.value.find((service) => service.featured) || services.value[0] || null
);
const docsServices = computed(() => services.value.filter((service) => service.docsUrl));

function serviceTitle(service?: PortalService | null) {
  return service?.displayTitle || service?.name || appName.value;
}

function serviceIntro(service?: PortalService | null) {
  return service?.shortIntro || service?.description || t("apps.defaultDescription");
}

function serviceTags(service?: PortalService | null) {
  const tags = service?.tags?.filter(Boolean) || [];
  if (tags.length) {
    return tags.slice(0, 4);
  }

  const fallback = service?.host || service?.slug || "portal";
  return fallback ? [fallback] : [];
}

function serviceInitial(service?: PortalService | null) {
  return serviceTitle(service).trim().slice(0, 2).toUpperCase() || "ZR";
}

function openAuth(service?: PortalService | null) {
  selectedService.value = service || null;
  authVisible.value = true;
}

async function openService(service?: PortalService | null) {
  if (!service) {
    openAuth();
    return;
  }

  if (!me.value) {
    openAuth(service);
    return;
  }

  authorizing.value = true;

  try {
    const result = await $fetch<{
      status: "authorized" | "needs_onboarding" | "needs_access";
      redirectUrl: string;
    }>("/api/portal/authorize", {
      method: "POST",
      body: {
        serviceId: service.id,
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
    if (error?.statusCode === 401 || error?.response?.status === 401) {
      me.value = null;
      openAuth(service);
      return;
    }

    ElMessage.error(localizeError(error, "error.serviceAuthorizeFailed"));
  } finally {
    authorizing.value = false;
  }
}

function openFeatured() {
  openService(featuredService.value);
}

function scrollToApps() {
  appsSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function playVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  video.play().catch(() => null);
}

function pauseVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  video.pause();
}

async function load() {
  loading.value = true;

  try {
    const result = await $fetch<{ services: PortalService[] }>("/api/public/services");
    services.value = result.services;
  } catch {
    services.value = [];
  } finally {
    loading.value = false;
  }

  await loadUser();

  const serviceId = String(route.query.service_id || "");
  const externalLogin = Boolean(route.query.client_id && route.query.callback);
  const target = services.value.find((service) => service.id === serviceId) || null;
  if (target && me.value && externalLogin) {
    await openService(target);
    return;
  }

  if (externalLogin) {
    openAuth(target);
  }
}

watch(
  () => route.fullPath,
  () => {
    docsMenuOpen.value = false;
  }
);

async function loadUser() {
  try {
    const result = await $fetch<{ user: { isAdmin?: boolean } }>("/api/auth/me");
    me.value = result.user;
  } catch {
    me.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.portal-page {
  position: relative;
  min-height: 100vh;
  color: var(--page-text);
}

.portal-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(1180px, calc(100vw - 28px));
  margin: 0 auto;
  padding: 18px 0;
}

.portal-brand,
.portal-nav__links,
.portal-nav__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.portal-brand {
  color: var(--page-text);
  font-weight: 800;
}

.portal-brand__mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: #f6f1e8;
  color: #0c0d10;
  font-size: 13px;
}

.portal-nav__links {
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
}

.portal-nav__links button,
.portal-nav__links a {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  background: transparent;
  color: var(--page-muted);
  cursor: pointer;
  font-size: 13px;
}

.portal-nav__links button:hover,
.portal-nav__links a:hover {
  color: var(--page-text);
}

.portal-docs {
  position: relative;
}

.portal-docs__menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 45;
  display: grid;
  gap: 6px;
  width: min(280px, calc(100vw - 32px));
  border: 1px solid var(--page-border);
  border-radius: 16px;
  padding: 8px;
  background: rgba(13, 15, 18, 0.94);
  box-shadow: 0 22px 64px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
}

.portal-docs__menu a,
.portal-docs__empty {
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--page-muted);
  font-size: 13px;
  line-height: 1.35;
}

.portal-docs__menu a:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--page-text);
}

.portal-docs__empty {
  cursor: default;
}

.portal-signin,
.portal-admin-link,
:deep(.account-button) {
  min-height: 40px;
}

.portal-main {
  width: min(1180px, calc(100vw - 28px));
  margin: 0 auto;
  padding: 34px 0 80px;
}

.portal-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 1fr);
  align-items: center;
  gap: clamp(24px, 5vw, 72px);
  min-height: calc(100vh - 110px);
}

.portal-hero__copy h1 {
  display: grid;
  gap: clamp(14px, 1.8vw, 26px);
  max-width: 760px;
  margin: 0;
  font-size: clamp(52px, 7.6vw, 112px);
  line-height: 0.88;
  letter-spacing: 0;
}

.portal-hero__copy h1 span {
  display: block;
}

.portal-hero__copy p:not(.eyebrow) {
  max-width: 560px;
  margin: 24px 0 0;
  color: var(--page-muted);
  font-size: 18px;
  line-height: 1.7;
}

.portal-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.portal-spotlight,
.portal-app-card {
  overflow: hidden;
  border: 1px solid var(--page-border);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.055);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(22px);
}

.portal-spotlight__media {
  aspect-ratio: 16 / 10;
  background: #0c0d10;
}

.portal-spotlight__media video,
.portal-spotlight__media img,
.portal-app-card__media video,
.portal-app-card__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-media-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 280px;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(240, 227, 204, 0.16), rgba(95, 148, 255, 0.12)),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 18px);
}

.portal-media-fallback span {
  color: rgba(246, 241, 232, 0.88);
  font-size: clamp(54px, 8vw, 108px);
  font-weight: 800;
}

.portal-media-fallback--small {
  min-height: 180px;
}

.portal-media-fallback--small span {
  font-size: 56px;
}

.portal-spotlight__body,
.portal-app-card__body {
  padding: 24px;
}

.portal-spotlight__body h2,
.portal-app-card__body h3 {
  margin: 12px 0 8px;
  font-size: 32px;
  line-height: 1.05;
}

.portal-app-card__body h3 {
  font-size: 24px;
}

.portal-spotlight__body p,
.portal-app-card__body p {
  margin: 0;
  color: var(--page-muted);
  line-height: 1.7;
}

.portal-spotlight__body .primary-btn {
  margin-top: 20px;
}

.portal-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.portal-card__tags span,
.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  padding: 4px 9px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--page-muted);
  font-size: 12px;
  font-weight: 700;
}

.status-pill--online {
  color: #b9f7d4;
}

.status-pill--offline {
  color: #ffb4aa;
}

.portal-showcase {
  padding-top: 40px;
}

.portal-section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}

.portal-section-heading h2 {
  margin: 0;
  font-size: clamp(34px, 5vw, 64px);
  line-height: 0.95;
}

.portal-app-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.portal-app-card__media {
  aspect-ratio: 16 / 10;
  background: #0c0d10;
}

.portal-app-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 22px;
}

.portal-empty {
  min-height: 220px;
  display: grid;
  place-items: center;
  padding: 28px;
}

.portal-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 18px;
}

.portal-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(18px);
  cursor: pointer;
}

.portal-modal__panel {
  position: relative;
  z-index: 1;
  width: min(680px, 100%);
  max-height: calc(100vh - 36px);
  overflow: auto;
}

@media (max-width: 960px) {
  .portal-nav {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .portal-nav__links {
    order: 3;
    width: 100%;
    justify-content: space-between;
  }

  .portal-docs__menu {
    right: auto;
    left: 0;
  }

  .portal-hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-top: 34px;
  }

  .portal-app-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .portal-nav__actions {
    width: 100%;
  }

  .portal-signin,
  .portal-admin-link {
    flex: 1;
  }

  .portal-hero__copy h1 {
    font-size: 54px;
  }
}
</style>
