<template>
  <div class="auth-actions">
    <template v-if="user">
      <el-dropdown trigger="click" @command="handleCommand">
        <button class="account-button" type="button">
          <span class="account-avatar">
            <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="">
            <span v-else>{{ avatarInitial }}</span>
          </span>
          <span class="auth-actions__name">{{ displayName }}</span>
        </button>
        <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">{{ t("common.profile") }}</el-dropdown-item>
              <el-dropdown-item command="password">{{ t("common.changePassword") }}</el-dropdown-item>
              <el-dropdown-item command="locale">
                {{ locale === "zh" ? t("common.en") : t("common.zh") }}
              </el-dropdown-item>
            <el-dropdown-item divided command="logout">{{ t("common.logout") }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <NuxtLink v-else class="ghost-btn auth-actions__button" to="/login">{{ t("common.login") }}</NuxtLink>

    <el-dialog v-model="profileVisible" :title="t('profile.title')" width="430px">
      <div class="profile-form">
        <div class="avatar-editor">
          <span class="profile-avatar">
            <img v-if="profileForm.avatarUrl" :src="profileForm.avatarUrl" alt="">
            <span v-else>{{ avatarInitial }}</span>
          </span>
          <div>
            <button class="ghost-btn compact-btn" type="button" :disabled="uploadingAvatar" @click="chooseAvatar">
              {{ t("common.upload") }}
            </button>
            <p class="muted avatar-help">{{ t("profile.avatarHelp") }}</p>
            <input ref="avatarInput" class="hidden-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadAvatar">
          </div>
        </div>

        <label>
          <span class="field-label">{{ t("common.name") }}</span>
          <input v-model="profileForm.name" class="field-input" :placeholder="t('profile.namePlaceholder')">
        </label>
      </div>
      <template #footer>
        <button class="ghost-btn compact-btn" type="button" @click="profileVisible = false">
          {{ t("common.cancel") }}
        </button>
        <button class="primary-btn compact-btn" type="button" :disabled="savingProfile" @click="saveProfile">
          {{ t("common.save") }}
        </button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordVisible" :title="t('profile.passwordTitle')" width="430px">
      <div class="profile-form">
        <label>
          <span class="field-label">{{ t("common.currentPassword") }}</span>
          <input
            v-model="passwordForm.currentPassword"
            class="field-input"
            type="password"
            autocomplete="current-password"
            :placeholder="t('profile.currentPasswordPlaceholder')"
          >
        </label>
        <label>
          <span class="field-label">{{ t("common.newPassword") }}</span>
          <input
            v-model="passwordForm.newPassword"
            class="field-input"
            type="password"
            autocomplete="new-password"
            :placeholder="t('profile.newPasswordPlaceholder')"
          >
        </label>
      </div>
      <template #footer>
        <button class="ghost-btn compact-btn" type="button" @click="passwordVisible = false">
          {{ t("common.cancel") }}
        </button>
        <button class="primary-btn compact-btn" type="button" :disabled="savingPassword" @click="savePassword">
          {{ t("common.save") }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus/es/components/message/index";
import { computed, onMounted, reactive, ref } from "vue";

type User = {
  id: string;
  account?: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

const user = ref<User | null>(null);
const profileVisible = ref(false);
const passwordVisible = ref(false);
const savingProfile = ref(false);
const savingPassword = ref(false);
const uploadingAvatar = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);
const { t, localizeError, locale, setLocale } = usePortalI18n();

const profileForm = reactive({
  name: "",
  avatarUrl: ""
});

const passwordForm = reactive({
  currentPassword: "",
  newPassword: ""
});

const displayName = computed(
  () =>
    user.value?.name ||
    user.value?.account ||
    user.value?.username ||
    user.value?.email ||
    t("common.profile")
);
const avatarInitial = computed(() => displayName.value.trim().slice(0, 1).toUpperCase() || "U");

async function load() {
  try {
    const result = await $fetch<{ user: User }>("/api/auth/me");
    user.value = result.user;
  } catch {
    user.value = null;
  }
}

function openProfile() {
  if (!user.value) {
    return;
  }

  profileForm.name = user.value.name || "";
  profileForm.avatarUrl = user.value.avatarUrl || "";
  profileVisible.value = true;
}

function openPassword() {
  passwordForm.currentPassword = "";
  passwordForm.newPassword = "";
  passwordVisible.value = true;
}

function chooseAvatar() {
  avatarInput.value?.click();
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  uploadingAvatar.value = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const result = await $fetch<{ user: User }>("/api/auth/avatar", {
      method: "POST",
      body: form
    });

    user.value = result.user;
    profileForm.avatarUrl = result.user.avatarUrl || "";
    ElMessage.success(t("notice.avatarUploaded"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.avatarFailed"));
  } finally {
    uploadingAvatar.value = false;
    input.value = "";
  }
}

async function saveProfile() {
  savingProfile.value = true;
  try {
    const result = await $fetch<{ user: User }>("/api/auth/profile", {
      method: "PATCH",
      body: {
        name: profileForm.name,
        avatarUrl: profileForm.avatarUrl
      }
    });

    user.value = result.user;
    profileVisible.value = false;
    ElMessage.success(t("notice.profileSaved"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.profileFailed"));
  } finally {
    savingProfile.value = false;
  }
}

async function savePassword() {
  savingPassword.value = true;
  try {
    const result = await $fetch<{ user: User }>("/api/auth/password", {
      method: "PATCH",
      body: {
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword
      }
    });

    user.value = result.user;
    passwordVisible.value = false;
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    ElMessage.success(t("notice.passwordChanged"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.passwordFailed"));
  } finally {
    savingPassword.value = false;
  }
}

async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await navigateTo("/login");
}

async function handleCommand(command: string) {
  if (command === "profile") {
    openProfile();
  } else if (command === "password") {
    openPassword();
  } else if (command === "locale") {
    setLocale(locale.value === "zh" ? "en" : "zh");
  } else if (command === "logout") {
    await logout();
  }
}

onMounted(load);
</script>

<style scoped>
.auth-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.account-button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 260px;
  border: 1px solid var(--page-border);
  border-radius: 12px;
  padding: 6px 10px 6px 6px;
  background: var(--page-surface-strong);
  color: var(--page-text);
  cursor: pointer;
}

.account-avatar,
.profile-avatar {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--page-border);
  border-radius: 50%;
  background: var(--page-surface-muted);
  color: var(--page-text);
  font-weight: 700;
}

.account-avatar {
  width: 30px;
  height: 30px;
  font-size: 13px;
}

.profile-avatar {
  width: 68px;
  height: 68px;
  font-size: 24px;
}

.account-avatar img,
.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-actions__name {
  min-width: 0;
  overflow: hidden;
  color: var(--page-text);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auth-actions__button {
  padding: 8px 12px;
}

.profile-form {
  display: grid;
  gap: 14px;
}

.avatar-editor {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar-help {
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.compact-btn {
  min-height: 36px;
  padding: 8px 12px;
}

.hidden-input {
  display: none;
}

:deep(.el-dialog) {
  max-width: calc(100vw - 28px);
  border-radius: 14px;
  background: var(--page-surface-strong);
}

:deep(.el-dialog__title),
:deep(.el-dialog__body) {
  color: var(--page-text);
}
</style>
