<template>
  <div class="page-panel">
    <section class="panel-card panel-card--strong relogin-card">
      <h1>重新登录</h1>
      <p class="muted">正在清理当前会话并重新进入登录流程。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

const route = useRoute();

function buildLoginUrl() {
  const params = new URLSearchParams();
  for (const key of ["client_id", "callback", "state"]) {
    const value = route.query[key];
    if (value) {
      params.set(key, String(value));
    }
  }

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
