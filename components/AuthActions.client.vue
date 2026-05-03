<template>
  <div class="auth-actions">
    <template v-if="user">
      <span class="auth-actions__name">{{ displayName }}</span>
      <button class="ghost-btn auth-actions__button" type="button" @click="logout">
        退出
      </button>
    </template>
    <NuxtLink v-else class="ghost-btn auth-actions__button" to="/login">登录</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type User = {
  email?: string | null;
  username?: string | null;
  name?: string | null;
};

const user = ref<User | null>(null);
const displayName = computed(
  () => user.value?.name || user.value?.username || user.value?.email || "账号"
);

async function load() {
  try {
    const result = await $fetch<{ user: User }>("/api/auth/me");
    user.value = result.user;
  } catch {
    user.value = null;
  }
}

async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await navigateTo("/login");
}

onMounted(load);
</script>

<style scoped>
.auth-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.auth-actions__name {
  max-width: 220px;
  overflow: hidden;
  color: var(--page-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auth-actions__button {
  padding: 8px 12px;
}
</style>
