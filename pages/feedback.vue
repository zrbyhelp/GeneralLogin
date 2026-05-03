<template>
  <div class="page-panel feedback-page" :class="{ 'feedback-page--embed': embed }">
    <section class="panel-card panel-card--strong feedback-card">
      <span class="badge">{{ t("feedback.title") }}</span>
      <h1>{{ t("feedback.title") }}</h1>
      <p class="muted">{{ t("feedback.subtitle") }}</p>

      <form v-if="!submitted" class="feedback-form" @submit.prevent="submitFeedback">
        <label>
          <span class="field-label">{{ t("feedback.type") }}</span>
          <select v-model="form.type" class="field-input">
            <option value="suggestion">{{ t("feedback.typeSuggestion") }}</option>
            <option value="complaint">{{ t("feedback.typeComplaint") }}</option>
            <option value="bug">{{ t("feedback.typeBug") }}</option>
          </select>
        </label>

        <label v-if="!clientServiceLocked">
          <span class="field-label">{{ t("feedback.service") }}</span>
          <select v-model="selectedServiceId" class="field-input" :disabled="servicesLoading">
            <option value="">
              {{ servicesLoading ? t("feedback.loadingServices") : t("feedback.noSpecificService") }}
            </option>
            <option
              v-for="service in services"
              :key="service.id"
              :value="service.id"
            >
              {{ service.name }}
            </option>
          </select>
        </label>

        <label>
          <span class="field-label">{{ t("feedback.content") }}</span>
          <textarea
            v-model="form.content"
            class="field-textarea"
            :placeholder="t('feedback.contentPlaceholder')"
          />
        </label>

        <label>
          <span class="field-label">{{ t("admin.feedbackContact") }}</span>
          <input
            v-model="form.contact"
            class="field-input"
            :placeholder="t('feedback.contactPlaceholder')"
          >
        </label>

        <button class="primary-btn" type="submit" :disabled="submitting">
          {{ t("feedback.submit") }}
        </button>
      </form>

      <div v-else class="feedback-success">
        <h2>{{ t("feedback.success") }}</h2>
        <div class="action-row">
          <button v-if="embed" class="ghost-btn" type="button" @click="closeWindow">
            {{ t("common.close") }}
          </button>
          <NuxtLink v-else class="ghost-btn" to="/login">{{ t("common.login") }}</NuxtLink>
        </div>
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

type PublicService = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
};

const route = useRoute();
const { t, localizeError } = usePortalI18n();
const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref("");
const embed = computed(() => String(route.query.embed || "") === "1");
const clientId = computed(() => String(route.query.client_id || route.query.clientId || ""));
const clientServiceLocked = computed(() => Boolean(clientId.value));
const services = ref<PublicService[]>([]);
const servicesLoading = ref(false);
const selectedServiceId = ref(clientServiceLocked.value ? "" : String(route.query.service_id || ""));
const form = reactive({
  type: "suggestion",
  content: "",
  contact: ""
});

function selectServiceFromQuery() {
  if (clientId.value) {
    selectedServiceId.value =
      services.value.find((service) => service.clientId === clientId.value)?.id || "";
    return;
  }

  if (selectedServiceId.value) {
    return;
  }

  const serviceSlug = String(route.query.service_slug || "");
  if (serviceSlug) {
    selectedServiceId.value =
      services.value.find((service) => service.slug === serviceSlug)?.id || "";
  }
}

async function loadServices() {
  servicesLoading.value = true;

  try {
    const result = await $fetch<{ services: PublicService[] }>("/api/public/services");
    services.value = result.services;
    selectServiceFromQuery();
  } catch {
    services.value = [];
  } finally {
    servicesLoading.value = false;
  }
}

async function submitFeedback() {
  submitting.value = true;
  errorMessage.value = "";

  try {
    await $fetch("/api/public/feedback", {
      method: "POST",
      body: {
        type: form.type,
        content: form.content,
        contact: form.contact || undefined,
        serviceId: selectedServiceId.value || undefined,
        clientId: clientId.value || undefined,
        serviceSlug: !selectedServiceId.value && route.query.service_slug
          ? String(route.query.service_slug)
          : undefined,
        userId: route.query.user_id ? String(route.query.user_id) : undefined,
        sourceUrl: route.query.source_url ? String(route.query.source_url) : undefined
      }
    });
    submitted.value = true;
  } catch (error: any) {
    errorMessage.value = localizeError(error, "error.feedbackFailed");
  } finally {
    submitting.value = false;
  }
}

function closeWindow() {
  window.close();
}

onMounted(() => {
  if (!clientServiceLocked.value) {
    loadServices();
  }
});
</script>

<style scoped>
.feedback-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
}

.feedback-page--embed {
  min-height: auto;
  padding: 16px;
}

.feedback-card {
  width: min(640px, 100%);
  padding: 28px;
}

h1 {
  margin: 14px 0 8px;
  font-size: 34px;
}

.feedback-form {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.feedback-form .primary-btn {
  width: 100%;
}

.feedback-success {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.error-text {
  margin: 14px 0 0;
  color: #b91c1c;
}
</style>
