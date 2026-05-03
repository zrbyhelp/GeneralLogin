<template>
  <div class="page-panel">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">加入申请</h1>
        <p class="panel-subtitle">
          新用户需要填写邀请码，或提交申请等待管理员审核。
        </p>
      </div>
      <ClientOnly>
        <AuthActions />
      </ClientOnly>
    </div>

    <div class="panel-grid panel-grid--two">
      <section class="panel-card panel-card--strong onboarding-card">
        <h2>邀请码加入</h2>
        <p class="muted">管理员发放的邀请码可以直接完成用户准入。</p>
        <label class="field-label" for="invite-code">邀请码</label>
        <input
          id="invite-code"
          v-model="inviteCode"
          class="field-input"
          autocomplete="off"
          placeholder="ZR-..."
        >
        <button class="primary-btn" type="button" :disabled="submitting" @click="submitInvite">
          使用邀请码
        </button>
      </section>

      <section class="panel-card panel-card--strong onboarding-card">
        <h2>提交申请</h2>
        <p class="muted">没有邀请码时，说明用途和需要访问的服务。</p>
        <label class="field-label" for="request-message">申请说明</label>
        <textarea
          id="request-message"
          v-model="message"
          class="field-textarea"
          placeholder="例如：我是某某项目成员，需要访问内部演示站。"
        />
        <button class="ghost-btn" type="button" :disabled="submitting" @click="submitRequest">
          提交申请
        </button>
      </section>
    </div>

    <p v-if="notice" class="portal-note">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const route = useRoute();
const inviteCode = ref("");
const message = ref("");
const notice = ref("");
const submitting = ref(false);

function nextLoginUrl() {
  const params = new URLSearchParams();
  for (const key of ["client_id", "callback", "state"]) {
    const value = route.query[key];
    if (value) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/apps";
}

async function submitInvite() {
  submitting.value = true;
  notice.value = "";

  try {
    await $fetch("/api/portal/onboarding", {
      method: "POST",
      body: {
        inviteCode: inviteCode.value,
        clientId: route.query.client_id || undefined
      }
    });
    await navigateTo(nextLoginUrl());
  } catch (error: any) {
    notice.value = error?.data?.statusMessage || error?.message || "邀请码验证失败";
  } finally {
    submitting.value = false;
  }
}

async function submitRequest() {
  submitting.value = true;
  notice.value = "";

  try {
    await $fetch("/api/portal/onboarding", {
      method: "POST",
      body: {
        message: message.value,
        clientId: route.query.client_id || undefined
      }
    });
    await navigateTo("/pending");
  } catch (error: any) {
    notice.value = error?.data?.statusMessage || error?.message || "申请提交失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
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
