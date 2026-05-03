<template>
  <div class="page-panel">
    <section class="panel-card panel-card--strong relogin-card">
      <h1>{{ t("relogin.title") }}</h1>
      <p class="muted">{{ t("relogin.text") }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

const route = useRoute();
const { t, theme, locale } = usePortalI18n();

function buildLoginUrl() {
  const params = new URLSearchParams();
  for (const key of ["client_id", "callback", "state"]) {
    const value = route.query[key];
    if (value) {
      params.set(key, String(value));
    }
  }
  params.set("theme", theme.value);
  params.set("locale", locale.value);

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

onMounted(async () => {
  await $fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  await navigateTo(buildLoginUrl());
});
</script>

<style scoped>
.relogin-card {
  width: min(520px, 100%);
  margin-top: clamp(80px, 18vh, 180px);
  padding: 30px;
}

h1 {
  margin: 0 0 10px;
  font-size: 34px;
}
</style>
