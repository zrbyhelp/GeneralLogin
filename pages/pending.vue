<template>
  <div class="page-panel">
    <section class="panel-card panel-card--strong pending-card">
      <span class="badge badge--warn">{{ t("pending.badge") }}</span>
      <h1>{{ t("pending.title") }}</h1>
      <p class="muted">
        {{ t("pending.text") }}
      </p>
      <div class="action-row">
        <NuxtLink class="ghost-btn" to="/apps">{{ t("pending.refresh") }}</NuxtLink>
        <NuxtLink class="ghost-btn" to="/login">{{ t("pending.backLogin") }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = usePortalI18n();
</script>

<style scoped>
.pending-card {
  width: min(560px, 100%);
  margin-top: clamp(80px, 18vh, 180px);
  padding: 32px;
}

h1 {
  margin: 14px 0 10px;
  font-size: 38px;
}
</style>
