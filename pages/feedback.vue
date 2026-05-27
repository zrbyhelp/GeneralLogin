<template>
  <div class="page-panel feedback-page" :class="{ 'feedback-page--embed': embed }">
    <FeedbackPanel :embed="embed" @close="closeWindow" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const embed = computed(() => String(route.query.embed || "") === "1");

function closeWindow() {
  window.close();
}
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
</style>
