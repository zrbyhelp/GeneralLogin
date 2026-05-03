<template>
  <div class="page-panel">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">可访问服务</h1>
        <p class="panel-subtitle">只有后台授予权限的网站服务会显示在这里。</p>
      </div>
      <div class="action-row">
        <NuxtLink v-if="me?.isAdmin" class="ghost-btn" to="/admin">管理后台</NuxtLink>
        <ClientOnly>
          <AuthActions />
        </ClientOnly>
      </div>
    </div>

    <section v-if="loading" class="panel-card panel-card--strong empty-state">
      正在加载服务...
    </section>

    <section v-else-if="errorMessage" class="panel-card panel-card--strong empty-state">
      <h2>{{ errorMessage }}</h2>
      <div class="action-row">
        <NuxtLink class="primary-btn" to="/login">重新登录</NuxtLink>
        <NuxtLink class="ghost-btn" to="/onboarding">提交申请</NuxtLink>
      </div>
    </section>

    <section v-else-if="apps.length === 0" class="panel-card panel-card--strong empty-state">
      <h2>暂无可访问服务</h2>
      <p class="muted">{{ me?.isAdmin ? "当前没有配置可访问服务，可以先进入后台维护。" : "请联系管理员授权，或提交访问申请。" }}</p>
      <div class="action-row">
        <NuxtLink v-if="me?.isAdmin" class="primary-btn" to="/admin">管理后台</NuxtLink>
        <NuxtLink class="ghost-btn" to="/onboarding">提交申请</NuxtLink>
      </div>
    </section>

    <section v-else class="apps-grid">
      <article v-for="app in apps" :key="app.id" class="panel-card app-card">
        <div>
          <span class="badge badge--ok">{{ app.slug }}</span>
          <h2>{{ app.name }}</h2>
          <p class="muted">{{ app.description || "已授权的网站服务" }}</p>
        </div>
        <button class="primary-btn" type="button" @click="launch(app)">
          进入服务
        </button>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

type AppItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  homeUrl: string;
  defaultCallbackUrl: string;
};

const loading = ref(true);
const errorMessage = ref("");
const apps = ref<AppItem[]>([]);
const me = ref<{ isAdmin: boolean; status: string } | null>(null);

async function load() {
  loading.value = true;
  errorMessage.value = "";

  try {
    me.value = await $fetch("/api/portal/me");
    if (me.value.status === "PENDING") {
      await navigateTo("/onboarding");
      return;
    }

    const result = await $fetch<{ apps: AppItem[] }>("/api/portal/apps");
    apps.value = result.apps;
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.response?.status === 401) {
      await navigateTo("/login");
      return;
    }

    errorMessage.value = error?.data?.statusMessage || error?.message || "服务列表加载失败";
  } finally {
    loading.value = false;
  }
}

async function launch(app: AppItem) {
  if (!app.defaultCallbackUrl) {
    window.location.href = app.homeUrl;
    return;
  }

  const state = crypto.randomUUID();
  const result = await $fetch<{
    status: "authorized" | "needs_onboarding" | "needs_access";
    redirectUrl: string;
  }>("/api/portal/authorize", {
    method: "POST",
    body: {
      serviceId: app.id,
      callbackUrl: app.defaultCallbackUrl,
      state
    }
  });

  if (result.status === "authorized") {
    await navigateTo(result.redirectUrl, { external: true });
    return;
  }

  await navigateTo(result.redirectUrl);
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
