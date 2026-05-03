<template>
  <div class="page-panel admin-page">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">管理后台</h1>
        <p class="panel-subtitle">
          后台 API 已做服务端管理员鉴权，只有 `NUXT_ADMIN_EMAILS` 中的邮箱可访问。
        </p>
      </div>
      <div class="action-row">
        <NuxtLink class="ghost-btn" to="/apps">返回服务列表</NuxtLink>
        <ClientOnly>
          <AuthActions />
        </ClientOnly>
      </div>
    </div>

    <section v-if="errorMessage" class="panel-card panel-card--strong admin-error">
      <h2>{{ errorMessage }}</h2>
      <NuxtLink class="primary-btn" to="/login">重新登录</NuxtLink>
    </section>

    <template v-else>
      <section class="stat-strip">
        <div class="stat-chip">
          <p class="stat-chip__label">用户</p>
          <p class="stat-chip__value">{{ summary.users }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">待准入用户</p>
          <p class="stat-chip__value">{{ summary.pendingUsers }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">网站服务</p>
          <p class="stat-chip__value">{{ summary.services }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">待审核申请</p>
          <p class="stat-chip__value">{{ summary.pendingRequests }}</p>
        </div>
      </section>

      <section class="panel-card panel-card--strong admin-card">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="申请审核" name="requests">
            <el-table v-loading="loading" :data="requests" stripe>
              <el-table-column label="用户" min-width="210">
                <template #default="{ row }">
                  <strong>{{ row.requester.email || row.requester.username || row.requester.id }}</strong>
                  <div class="muted">{{ row.requester.name || row.requester.status }}</div>
                </template>
              </el-table-column>
              <el-table-column label="服务" min-width="160">
                <template #default="{ row }">
                  {{ row.service?.name || "门户准入" }}
                </template>
              </el-table-column>
              <el-table-column prop="message" label="说明" min-width="260" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="requestTag(row.status)">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button
                    size="small"
                    type="success"
                    :disabled="row.status !== 'PENDING'"
                    @click="reviewRequest(row.id, 'APPROVED')"
                  >
                    通过
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :disabled="row.status !== 'PENDING'"
                    @click="reviewRequest(row.id, 'REJECTED')"
                  >
                    拒绝
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="用户权限" name="users">
            <div class="admin-toolbar">
              <el-select v-model="accessForm.userId" placeholder="选择用户" filterable>
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="displayUser(user)"
                  :value="user.id"
                />
              </el-select>
              <el-select v-model="accessForm.serviceId" placeholder="选择服务" filterable>
                <el-option
                  v-for="service in services"
                  :key="service.id"
                  :label="service.name"
                  :value="service.id"
                />
              </el-select>
              <el-button type="primary" @click="grantAccess(true)">授权服务</el-button>
              <el-button @click="grantAccess(false)">取消授权</el-button>
            </div>

            <el-table v-loading="loading" :data="users" stripe>
              <el-table-column label="用户" min-width="260">
                <template #default="{ row }">
                  <strong>{{ row.email || row.username || row.id }}</strong>
                  <div class="muted">{{ row.name || row.username || "第三方账号" }}</div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <el-tag :type="userTag(row.status)">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="服务权限" min-width="260">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-tag
                      v-for="access in row.serviceAccess.filter((item) => item.allowed)"
                      :key="access.id"
                      type="info"
                    >
                      {{ access.service.name }}
                    </el-tag>
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="success" @click="updateUser(row.id, 'APPROVED')">
                    准入
                  </el-button>
                  <el-button size="small" @click="updateUser(row.id, 'PENDING')">
                    待审
                  </el-button>
                  <el-button size="small" type="danger" plain @click="updateUser(row.id, 'SUSPENDED')">
                    停用
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="邀请码" name="invites">
            <div class="form-grid admin-form-grid">
              <label>
                <span class="field-label">名称</span>
                <input v-model="inviteForm.label" class="field-input" placeholder="例如：五月内测" />
              </label>
              <label>
                <span class="field-label">可用次数</span>
                <input v-model.number="inviteForm.maxUses" class="field-input" type="number" min="1" />
              </label>
              <label>
                <span class="field-label">过期时间</span>
                <input v-model="inviteForm.expiresAt" class="field-input" type="datetime-local" />
              </label>
              <label class="checkbox-line">
                <input v-model="inviteForm.grantsAllServices" type="checkbox" />
                <span>使用后授权全部已启用服务</span>
              </label>
            </div>
            <div class="action-row admin-actions">
              <button class="primary-btn" type="button" @click="createInvite">生成邀请码</button>
              <span v-if="lastInviteCode" class="badge badge--ok">新邀请码：{{ lastInviteCode }}</span>
            </div>

            <el-table v-loading="loading" :data="invites" stripe>
              <el-table-column prop="label" label="名称" min-width="180" />
              <el-table-column label="使用" width="120">
                <template #default="{ row }">{{ row.usedCount }} / {{ row.maxUses }}</template>
              </el-table-column>
              <el-table-column label="授权全部服务" width="140">
                <template #default="{ row }">{{ row.grantsAllServices ? "是" : "否" }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="创建人" min-width="180">
                <template #default="{ row }">{{ row.createdBy?.email || row.createdBy?.name || "-" }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="网站服务" name="services">
            <div class="form-grid admin-form-grid">
              <label>
                <span class="field-label">服务名称</span>
                <input v-model="serviceForm.name" class="field-input" placeholder="Docs / CRM / Demo" />
              </label>
              <label>
                <span class="field-label">Slug</span>
                <input v-model="serviceForm.slug" class="field-input" placeholder="docs" />
              </label>
              <label>
                <span class="field-label">入口地址</span>
                <input v-model="serviceForm.homeUrl" class="field-input" placeholder="https://app.example.com" />
              </label>
              <label>
                <span class="field-label">说明</span>
                <input v-model="serviceForm.description" class="field-input" placeholder="给用户看的服务描述" />
              </label>
              <label class="wide-field">
                <span class="field-label">允许的回调地址，每行一个</span>
                <textarea
                  v-model="serviceForm.callbackUrlsText"
                  class="field-textarea"
                  placeholder="https://app.example.com/auth/callback"
                />
              </label>
            </div>
            <div class="action-row admin-actions">
              <button class="primary-btn" type="button" @click="createService">创建服务</button>
              <span v-if="lastServiceSecret" class="badge badge--warn">新服务密钥：{{ lastServiceSecret }}</span>
            </div>

            <el-table v-loading="loading" :data="services" stripe>
              <el-table-column label="服务" min-width="220">
                <template #default="{ row }">
                  <strong>{{ row.name }}</strong>
                  <div class="muted">{{ row.slug }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="clientId" label="Client ID" min-width="240" />
              <el-table-column label="回调地址" min-width="280">
                <template #default="{ row }">
                  <div v-for="url in row.callbackUrls" :key="url" class="muted">{{ url }}</div>
                </template>
              </el-table-column>
              <el-table-column label="启用" width="100">
                <template #default="{ row }">
                  <el-switch v-model="row.enabled" @change="updateService(row)" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" @click="rotateSecret(row.id)">轮换密钥</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
type UserStatus = "PENDING" | "APPROVED" | "SUSPENDED";

const activeTab = ref("requests");
const loading = ref(true);
const errorMessage = ref("");
const summary = reactive({
  users: 0,
  pendingUsers: 0,
  services: 0,
  pendingRequests: 0,
  invites: 0
});
const users = ref<any[]>([]);
const services = ref<any[]>([]);
const invites = ref<any[]>([]);
const requests = ref<any[]>([]);
const lastInviteCode = ref("");
const lastServiceSecret = ref("");

const accessForm = reactive({
  userId: "",
  serviceId: ""
});

const inviteForm = reactive({
  label: "",
  maxUses: 1,
  expiresAt: "",
  grantsAllServices: false
});

const serviceForm = reactive({
  name: "",
  slug: "",
  description: "",
  homeUrl: "",
  callbackUrlsText: ""
});

function userTag(status: UserStatus) {
  if (status === "APPROVED") return "success";
  if (status === "SUSPENDED") return "danger";
  return "warning";
}

function requestTag(status: RequestStatus) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function splitCallbackUrls(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayUser(user: any) {
  return user.email || user.username || user.name || user.id;
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [summaryResult, userResult, serviceResult, inviteResult, requestResult] =
      await Promise.all([
        $fetch<typeof summary>("/api/admin/summary"),
        $fetch<{ users: any[] }>("/api/admin/users"),
        $fetch<{ services: any[] }>("/api/admin/services"),
        $fetch<{ invites: any[] }>("/api/admin/invites"),
        $fetch<{ requests: any[] }>("/api/admin/requests")
      ]);

    Object.assign(summary, summaryResult);
    users.value = userResult.users;
    services.value = serviceResult.services;
    invites.value = inviteResult.invites;
    requests.value = requestResult.requests;
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || "后台数据加载失败";
  } finally {
    loading.value = false;
  }
}

async function updateUser(id: string, status: UserStatus) {
  await $fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: { status }
  });
  ElMessage.success("用户状态已更新");
  await loadAll();
}

async function grantAccess(allowed: boolean) {
  if (!accessForm.userId || !accessForm.serviceId) {
    ElMessage.warning("请选择用户和服务");
    return;
  }

  await $fetch("/api/admin/access", {
    method: "POST",
    body: {
      userId: accessForm.userId,
      serviceId: accessForm.serviceId,
      allowed
    }
  });
  ElMessage.success(allowed ? "服务已授权" : "服务授权已取消");
  await loadAll();
}

async function reviewRequest(id: string, status: RequestStatus) {
  await $fetch(`/api/admin/requests/${id}`, {
    method: "PATCH",
    body: { status }
  });
  ElMessage.success(status === "APPROVED" ? "申请已通过" : "申请已拒绝");
  await loadAll();
}

async function createInvite() {
  const result = await $fetch<{ code: string }>("/api/admin/invites", {
    method: "POST",
    body: {
      label: inviteForm.label,
      maxUses: inviteForm.maxUses,
      expiresAt: inviteForm.expiresAt || undefined,
      grantsAllServices: inviteForm.grantsAllServices
    }
  });

  lastInviteCode.value = result.code;
  inviteForm.label = "";
  inviteForm.maxUses = 1;
  inviteForm.expiresAt = "";
  inviteForm.grantsAllServices = false;
  ElMessage.success("邀请码已生成，请立即保存显示出的明文邀请码");
  await loadAll();
}

async function createService() {
  const result = await $fetch<{ clientSecret: string }>("/api/admin/services", {
    method: "POST",
    body: {
      name: serviceForm.name,
      slug: serviceForm.slug,
      description: serviceForm.description,
      homeUrl: serviceForm.homeUrl,
      callbackUrls: splitCallbackUrls(serviceForm.callbackUrlsText)
    }
  });

  lastServiceSecret.value = result.clientSecret;
  serviceForm.name = "";
  serviceForm.slug = "";
  serviceForm.description = "";
  serviceForm.homeUrl = "";
  serviceForm.callbackUrlsText = "";
  ElMessage.success("服务已创建，请立即保存显示出的 clientSecret");
  await loadAll();
}

async function updateService(row: any) {
  await $fetch(`/api/admin/services/${row.id}`, {
    method: "PATCH",
    body: {
      enabled: row.enabled
    }
  });
  ElMessage.success("服务状态已更新");
  await loadAll();
}

async function rotateSecret(id: string) {
  const result = await $fetch<{ clientSecret: string }>(
    `/api/admin/services/${id}/secret`,
    { method: "POST" }
  );
  lastServiceSecret.value = result.clientSecret;
  ElMessage.success("服务密钥已轮换，请立即保存新密钥");
}

onMounted(loadAll);
</script>

<style scoped>
.admin-page {
  padding-bottom: 72px;
}

.admin-card {
  margin-top: 16px;
  padding: 18px;
}

.admin-error {
  width: min(540px, 100%);
  padding: 28px;
}

.admin-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto auto;
  gap: 10px;
  margin-bottom: 14px;
}

.admin-form-grid {
  margin-bottom: 12px;
}

.wide-field {
  grid-column: 1 / -1;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--page-muted);
}

.admin-actions {
  margin: 12px 0 18px;
}

@media (max-width: 980px) {
  .admin-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
