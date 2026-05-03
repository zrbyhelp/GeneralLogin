<template>
  <div class="page-panel admin-page">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">{{ t("admin.title") }}</h1>
        <p class="panel-subtitle">
          {{ t("admin.subtitle") }}
        </p>
      </div>
      <div class="action-row">
        <NuxtLink class="ghost-btn" to="/apps">{{ t("admin.backApps") }}</NuxtLink>
        <ClientOnly>
          <AuthActions />
        </ClientOnly>
      </div>
    </div>

    <section v-if="errorMessage" class="panel-card panel-card--strong admin-error">
      <h2>{{ errorMessage }}</h2>
      <NuxtLink class="primary-btn" to="/login">{{ t("common.relogin") }}</NuxtLink>
    </section>

    <template v-else>
      <section class="stat-strip">
        <div class="stat-chip">
          <p class="stat-chip__label">{{ t("admin.statUsers") }}</p>
          <p class="stat-chip__value">{{ summary.users }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">{{ t("admin.statSuspendedUsers") }}</p>
          <p class="stat-chip__value">{{ summary.suspendedUsers }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">{{ t("admin.statServices") }}</p>
          <p class="stat-chip__value">{{ summary.services }}</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip__label">{{ t("admin.statPendingRequests") }}</p>
          <p class="stat-chip__value">{{ summary.pendingRequests }}</p>
        </div>
      </section>

      <section class="panel-card panel-card--strong admin-card">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('admin.tabRequests')" name="requests">
            <el-table v-loading="loading" :data="requests" stripe>
              <el-table-column :label="t('common.user')" min-width="210">
                <template #default="{ row }">
                  <strong>{{ row.requester.account || row.requester.email || row.requester.username || row.requester.id }}</strong>
                  <div class="muted">{{ row.requester.name || row.requester.status }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.service')" min-width="160">
                <template #default="{ row }">
                  {{ row.service?.name || "-" }}
                </template>
              </el-table-column>
              <el-table-column prop="message" :label="t('admin.requestMessage')" min-width="260" />
              <el-table-column :label="t('common.status')" width="120">
                <template #default="{ row }">
                  <el-tag :type="requestTag(row.status)">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.actions')" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button
                    size="small"
                    type="success"
                    :disabled="row.status !== 'PENDING'"
                    @click="reviewRequest(row.id, 'APPROVED')"
                  >
                    {{ t("admin.approve") }}
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :disabled="row.status !== 'PENDING'"
                    @click="reviewRequest(row.id, 'REJECTED')"
                  >
                    {{ t("admin.reject") }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabUsers')" name="users">
            <el-table v-loading="loading" :data="users" stripe>
              <el-table-column :label="t('common.user')" min-width="260">
                <template #default="{ row }">
                  <strong>{{ row.account || row.email || row.username || row.id }}</strong>
                  <div class="muted">{{ row.name || row.email || row.username || t("common.thirdPartyAccount") }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.status')" width="130">
                <template #default="{ row }">
                  <el-tag :type="userTag(row.status)">{{ userStatusText(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.serviceAccess')" min-width="260">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-tag
                      v-for="access in allowedServiceAccess(row)"
                      :key="access.id"
                      type="info"
                    >
                      {{ access.service.name }}
                    </el-tag>
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.actions')" width="160" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.status === 'SUSPENDED'"
                    size="small"
                    type="success"
                    @click="updateUser(row.id, 'ACTIVE')"
                  >
                    {{ t("common.enabled") }}
                  </el-button>
                  <el-button v-else size="small" type="danger" plain @click="updateUser(row.id, 'SUSPENDED')">
                    {{ t("common.disabled") }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabInvites')" name="invites">
            <div class="form-grid admin-form-grid">
              <label>
                <span class="field-label">{{ t("admin.inviteLabel") }}</span>
                <input v-model="inviteForm.label" class="field-input" :placeholder="t('admin.inviteLabelPlaceholder')" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.maxUses") }}</span>
                <input v-model.number="inviteForm.maxUses" class="field-input" type="number" min="1" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.expiresAt") }}</span>
                <input v-model="inviteForm.expiresAt" class="field-input" type="datetime-local" />
              </label>
              <label class="wide-field">
                <span class="field-label">{{ t("admin.inviteServices") }}</span>
                <el-select v-model="inviteForm.serviceIds" multiple filterable :placeholder="t('admin.inviteServicesPlaceholder')">
                  <el-option
                    v-for="service in inviteableServices"
                    :key="service.id"
                    :label="service.name"
                    :value="service.id"
                  />
                </el-select>
              </label>
            </div>
            <div class="action-row admin-actions">
              <button class="primary-btn" type="button" @click="createInvite">{{ t("admin.createInvite") }}</button>
              <span v-if="lastInviteCode" class="badge badge--ok">{{ t("admin.newInvite", { code: lastInviteCode }) }}</span>
            </div>

            <el-table v-loading="loading" :data="invites" stripe>
              <el-table-column prop="label" :label="t('common.name')" min-width="180" />
              <el-table-column :label="t('admin.uses')" width="120">
                <template #default="{ row }">{{ row.usedCount }} / {{ row.maxUses }}</template>
              </el-table-column>
              <el-table-column :label="t('admin.authorizedServices')" min-width="240">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-tag v-for="service in row.services" :key="service.id" type="info">
                      {{ service.name }}
                    </el-tag>
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.status')" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? t("common.enabled") : t("common.disabled") }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.createdBy')" min-width="180">
                <template #default="{ row }">{{ row.createdBy?.account || row.createdBy?.email || row.createdBy?.name || "-" }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabServices')" name="services">
            <div class="form-grid admin-form-grid">
              <label>
                <span class="field-label">{{ t("admin.serviceName") }}</span>
                <input v-model="serviceForm.name" class="field-input" :placeholder="t('admin.serviceNamePlaceholder')" />
              </label>
              <label>
                <span class="field-label">Slug</span>
                <input v-model="serviceForm.slug" class="field-input" placeholder="docs" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.homeUrl") }}</span>
                <input v-model="serviceForm.homeUrl" class="field-input" placeholder="https://app.example.com" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.healthCheckUrl") }}</span>
                <input v-model="serviceForm.healthCheckUrl" class="field-input" :placeholder="t('admin.healthCheckUrlPlaceholder')" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.docsUrl") }}</span>
                <input v-model="serviceForm.docsUrl" class="field-input" :placeholder="t('admin.docsUrlPlaceholder')" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.serviceDescription") }}</span>
                <input v-model="serviceForm.description" class="field-input" :placeholder="t('admin.serviceDescriptionPlaceholder')" />
              </label>
              <label class="wide-field">
                <span class="field-label">{{ t("admin.callbackUrls") }}</span>
                <textarea
                  v-model="serviceForm.callbackUrlsText"
                  class="field-textarea"
                  placeholder="https://app.example.com/auth/callback"
                />
              </label>
              <label class="checkbox-line">
                <input v-model="serviceForm.allowDirectAccess" type="checkbox" />
                <span>{{ t("admin.allowDirect") }}</span>
              </label>
              <label class="checkbox-line">
                <input v-model="serviceForm.allowInviteAccess" type="checkbox" />
                <span>{{ t("admin.allowInvite") }}</span>
              </label>
              <label class="checkbox-line">
                <input v-model="serviceForm.allowAccessRequest" type="checkbox" />
                <span>{{ t("admin.allowRequest") }}</span>
              </label>
            </div>
            <div class="action-row admin-actions">
              <button class="primary-btn" type="button" @click="createService">{{ t("admin.createService") }}</button>
              <span v-if="lastServiceSecret" class="badge badge--warn">{{ t("admin.newSecret", { secret: lastServiceSecret }) }}</span>
            </div>

            <el-table v-loading="loading" :data="services" stripe>
              <el-table-column :label="t('common.service')" min-width="220">
                <template #default="{ row }">
                  <strong>{{ row.name }}</strong>
                  <div class="muted">{{ row.slug }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="clientId" :label="t('admin.clientId')" min-width="240" />
              <el-table-column :label="t('admin.callback')" min-width="280">
                <template #default="{ row }">
                  <div v-for="url in row.callbackUrls" :key="url" class="muted">{{ url }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.docsUrl')" min-width="220">
                <template #default="{ row }">
                  <a v-if="row.docsUrl" class="muted inline-link" :href="row.docsUrl" target="_blank" rel="noreferrer">
                    {{ row.docsUrl }}
                  </a>
                  <span v-else class="muted">-</span>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.enabled')" width="100">
                <template #default="{ row }">
                  <el-switch v-model="row.enabled" @change="updateService(row)" />
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.accessModes')" min-width="220">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-tag :type="row.allowDirectAccess ? 'success' : 'info'">{{ t("admin.direct") }}</el-tag>
                    <el-tag :type="row.allowInviteAccess ? 'success' : 'info'">{{ t("admin.invite") }}</el-tag>
                    <el-tag :type="row.allowAccessRequest ? 'success' : 'info'">{{ t("admin.request") }}</el-tag>
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.switches')" width="230">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-switch v-model="row.allowDirectAccess" :active-text="t('admin.direct')" @change="updateService(row)" />
                    <el-switch v-model="row.allowInviteAccess" :active-text="t('admin.invite')" @change="updateService(row)" />
                    <el-switch v-model="row.allowAccessRequest" :active-text="t('admin.request')" @change="updateService(row)" />
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.actions')" width="160" fixed="right">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" @click="openServiceEdit(row)">{{ t("admin.editService") }}</el-button>
                    <el-button size="small" @click="rotateSecret(row.id)">{{ t("admin.rotateSecret") }}</el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabOpenSource')" name="open-source">
            <div class="form-grid admin-form-grid">
              <label>
                <span class="field-label">{{ t("admin.openSourceName") }}</span>
                <input v-model="openSourceForm.name" class="field-input" placeholder="Vue / Nuxt / Prisma" />
              </label>
              <label>
                <span class="field-label">{{ t("admin.openSourceUrl") }}</span>
                <input v-model="openSourceForm.url" class="field-input" placeholder="https://github.com/..." />
              </label>
              <label>
                <span class="field-label">{{ t("admin.sortOrder") }}</span>
                <input v-model.number="openSourceForm.sortOrder" class="field-input" type="number" />
              </label>
              <label class="checkbox-line">
                <input v-model="openSourceForm.enabled" type="checkbox" />
                <span>{{ t("common.enabled") }}</span>
              </label>
            </div>
            <div class="action-row admin-actions">
              <button class="primary-btn" type="button" @click="saveOpenSourceCredit">
                {{ openSourceForm.id ? t("common.save") : t("admin.createOpenSource") }}
              </button>
              <button v-if="openSourceForm.id" class="ghost-btn" type="button" @click="resetOpenSourceForm">
                {{ t("common.cancel") }}
              </button>
            </div>

            <el-table v-loading="loading" :data="openSourceCredits" stripe>
              <el-table-column prop="name" :label="t('common.name')" min-width="180" />
              <el-table-column :label="t('admin.openSourceUrl')" min-width="260">
                <template #default="{ row }">
                  <a class="muted inline-link" :href="row.url" target="_blank" rel="noreferrer">{{ row.url }}</a>
                </template>
              </el-table-column>
              <el-table-column prop="sortOrder" :label="t('admin.sortOrder')" width="110" />
              <el-table-column :label="t('common.status')" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? t("common.enabled") : t("common.disabled") }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.actions')" width="170" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" @click="editOpenSourceCredit(row)">{{ t("common.edit") }}</el-button>
                  <el-button size="small" type="danger" plain @click="deleteOpenSourceCredit(row.id)">{{ t("common.delete") }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabFeedback')" name="feedback">
            <el-table v-loading="loading" :data="feedbackList" stripe>
              <el-table-column :label="t('admin.feedbackType')" width="120">
                <template #default="{ row }">{{ feedbackTypeText(row.type) }}</template>
              </el-table-column>
              <el-table-column :label="t('admin.feedbackContent')" min-width="300">
                <template #default="{ row }">
                  <div class="feedback-content">{{ row.content }}</div>
                  <div v-if="row.contact" class="muted">{{ t("admin.feedbackContact") }}：{{ row.contact }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.service')" min-width="160">
                <template #default="{ row }">{{ row.service?.name || "-" }}</template>
              </el-table-column>
              <el-table-column :label="t('common.user')" min-width="170">
                <template #default="{ row }">
                  {{ row.user?.account || row.user?.name || row.user?.username || row.user?.email || "-" }}
                </template>
              </el-table-column>
              <el-table-column :label="t('common.status')" width="120">
                <template #default="{ row }">
                  <el-tag :type="feedbackTag(row.status)">{{ feedbackStatusText(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="t('common.actions')" width="210" fixed="right">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" @click="updateFeedback(row.id, 'REVIEWING')">{{ t("admin.markReviewing") }}</el-button>
                    <el-button size="small" type="success" @click="updateFeedback(row.id, 'RESOLVED')">{{ t("admin.markResolved") }}</el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>

    <el-dialog v-model="serviceEditVisible" :title="t('admin.editService')" width="640px">
      <div class="form-grid admin-form-grid">
        <label>
          <span class="field-label">{{ t("admin.serviceName") }}</span>
          <input v-model="serviceEditForm.name" class="field-input" />
        </label>
        <label>
          <span class="field-label">Slug</span>
          <input v-model="serviceEditForm.slug" class="field-input" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.homeUrl") }}</span>
          <input v-model="serviceEditForm.homeUrl" class="field-input" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.healthCheckUrl") }}</span>
          <input v-model="serviceEditForm.healthCheckUrl" class="field-input" :placeholder="t('admin.healthCheckUrlPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.docsUrl") }}</span>
          <input v-model="serviceEditForm.docsUrl" class="field-input" :placeholder="t('admin.docsUrlPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.serviceDescription") }}</span>
          <input v-model="serviceEditForm.description" class="field-input" />
        </label>
        <label class="wide-field">
          <span class="field-label">{{ t("admin.callbackUrls") }}</span>
          <textarea v-model="serviceEditForm.callbackUrlsText" class="field-textarea" />
        </label>
      </div>
      <template #footer>
        <button class="ghost-btn" type="button" @click="serviceEditVisible = false">{{ t("common.cancel") }}</button>
        <button class="primary-btn" type="button" @click="saveServiceEdit">{{ t("admin.saveService") }}</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus/es/components/message/index";
import { computed, onMounted, reactive, ref } from "vue";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
type UserStatus = "ACTIVE" | "SUSPENDED";
type FeedbackStatus = "NEW" | "REVIEWING" | "RESOLVED";

const activeTab = ref("requests");
const loading = ref(true);
const errorMessage = ref("");
const { t, localizeError } = usePortalI18n();
const summary = reactive({
  users: 0,
  suspendedUsers: 0,
  services: 0,
  pendingRequests: 0,
  invites: 0
});
const users = ref<any[]>([]);
const services = ref<any[]>([]);
const invites = ref<any[]>([]);
const requests = ref<any[]>([]);
const openSourceCredits = ref<any[]>([]);
const feedbackList = ref<any[]>([]);
const lastInviteCode = ref("");
const lastServiceSecret = ref("");
const serviceEditVisible = ref(false);

const inviteForm = reactive({
  label: "",
  maxUses: 1,
  expiresAt: "",
  serviceIds: [] as string[]
});

const serviceForm = reactive({
  name: "",
  slug: "",
  description: "",
  homeUrl: "",
  healthCheckUrl: "",
  docsUrl: "",
  callbackUrlsText: "",
  allowDirectAccess: false,
  allowInviteAccess: true,
  allowAccessRequest: true
});

const serviceEditForm = reactive({
  id: "",
  name: "",
  slug: "",
  description: "",
  homeUrl: "",
  healthCheckUrl: "",
  docsUrl: "",
  callbackUrlsText: ""
});

const openSourceForm = reactive({
  id: "",
  name: "",
  url: "",
  sortOrder: 0,
  enabled: true
});

function userTag(status: UserStatus) {
  if (status === "SUSPENDED") return "danger";
  return "success";
}

function userStatusText(status: UserStatus) {
  return status === "SUSPENDED" ? t("common.disabled") : t("common.enabled");
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

function feedbackTag(status: FeedbackStatus) {
  if (status === "RESOLVED") return "success";
  if (status === "REVIEWING") return "warning";
  return "info";
}

function feedbackStatusText(status: FeedbackStatus) {
  if (status === "RESOLVED") return t("admin.feedbackStatusResolved");
  if (status === "REVIEWING") return t("admin.feedbackStatusReviewing");
  return t("admin.feedbackStatusNew");
}

function feedbackTypeText(type: string) {
  if (type === "complaint") return t("feedback.typeComplaint");
  if (type === "bug") return t("feedback.typeBug");
  return t("feedback.typeSuggestion");
}

const inviteableServices = computed(() =>
  services.value.filter((service) => service.enabled && service.allowInviteAccess)
);

function allowedServiceAccess(row: any) {
  return row.serviceAccess.filter((item: any) => item.allowed);
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [
      summaryResult,
      userResult,
      serviceResult,
      inviteResult,
      requestResult,
      openSourceResult,
      feedbackResult
    ] =
      await Promise.all([
        $fetch<typeof summary>("/api/admin/summary"),
        $fetch<{ users: any[] }>("/api/admin/users"),
        $fetch<{ services: any[] }>("/api/admin/services"),
        $fetch<{ invites: any[] }>("/api/admin/invites"),
        $fetch<{ requests: any[] }>("/api/admin/requests"),
        $fetch<{ credits: any[] }>("/api/admin/open-source-credits"),
        $fetch<{ feedback: any[] }>("/api/admin/feedback")
      ]);

    Object.assign(summary, summaryResult);
    users.value = userResult.users;
    services.value = serviceResult.services;
    invites.value = inviteResult.invites;
    requests.value = requestResult.requests;
    openSourceCredits.value = openSourceResult.credits;
    feedbackList.value = feedbackResult.feedback;
  } catch (error: any) {
    errorMessage.value = localizeError(error, "error.loadAdmin");
  } finally {
    loading.value = false;
  }
}

async function updateUser(id: string, status: UserStatus) {
  await $fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: { status }
  });
  ElMessage.success(t("notice.userStatusUpdated"));
  await loadAll();
}

async function reviewRequest(id: string, status: RequestStatus) {
  await $fetch(`/api/admin/requests/${id}`, {
    method: "PATCH",
    body: { status }
  });
  ElMessage.success(status === "APPROVED" ? t("notice.requestApproved") : t("notice.requestRejected"));
  await loadAll();
}

async function createInvite() {
  const result = await $fetch<{ code: string }>("/api/admin/invites", {
    method: "POST",
    body: {
      label: inviteForm.label,
      maxUses: inviteForm.maxUses,
      expiresAt: inviteForm.expiresAt || undefined,
      serviceIds: inviteForm.serviceIds
    }
  });

  lastInviteCode.value = result.code;
  inviteForm.label = "";
  inviteForm.maxUses = 1;
  inviteForm.expiresAt = "";
  inviteForm.serviceIds = [];
  ElMessage.success(t("notice.inviteCreated"));
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
      healthCheckUrl: serviceForm.healthCheckUrl || undefined,
      docsUrl: serviceForm.docsUrl || undefined,
      callbackUrls: splitCallbackUrls(serviceForm.callbackUrlsText),
      allowDirectAccess: serviceForm.allowDirectAccess,
      allowInviteAccess: serviceForm.allowInviteAccess,
      allowAccessRequest: serviceForm.allowAccessRequest
    }
  });

  lastServiceSecret.value = result.clientSecret;
  serviceForm.name = "";
  serviceForm.slug = "";
  serviceForm.description = "";
  serviceForm.homeUrl = "";
  serviceForm.healthCheckUrl = "";
  serviceForm.docsUrl = "";
  serviceForm.callbackUrlsText = "";
  serviceForm.allowDirectAccess = false;
  serviceForm.allowInviteAccess = true;
  serviceForm.allowAccessRequest = true;
  ElMessage.success(t("notice.serviceCreated"));
  await loadAll();
}

function openServiceEdit(row: any) {
  serviceEditForm.id = row.id;
  serviceEditForm.name = row.name || "";
  serviceEditForm.slug = row.slug || "";
  serviceEditForm.description = row.description || "";
  serviceEditForm.homeUrl = row.homeUrl || "";
  serviceEditForm.healthCheckUrl = row.healthCheckUrl || "";
  serviceEditForm.docsUrl = row.docsUrl || "";
  serviceEditForm.callbackUrlsText = (row.callbackUrls || []).join("\n");
  serviceEditVisible.value = true;
}

async function saveServiceEdit() {
  await $fetch(`/api/admin/services/${serviceEditForm.id}`, {
    method: "PATCH",
    body: {
      name: serviceEditForm.name,
      slug: serviceEditForm.slug,
      description: serviceEditForm.description,
      homeUrl: serviceEditForm.homeUrl,
      healthCheckUrl: serviceEditForm.healthCheckUrl,
      docsUrl: serviceEditForm.docsUrl,
      callbackUrls: splitCallbackUrls(serviceEditForm.callbackUrlsText)
    }
  });
  serviceEditVisible.value = false;
  ElMessage.success(t("notice.serviceSaved"));
  await loadAll();
}

async function updateService(row: any) {
  await $fetch(`/api/admin/services/${row.id}`, {
    method: "PATCH",
    body: {
      enabled: row.enabled,
      allowDirectAccess: row.allowDirectAccess,
      allowInviteAccess: row.allowInviteAccess,
      allowAccessRequest: row.allowAccessRequest
    }
  });
  ElMessage.success(t("notice.serviceUpdated"));
  await loadAll();
}

async function rotateSecret(id: string) {
  const result = await $fetch<{ clientSecret: string }>(
    `/api/admin/services/${id}/secret`,
    { method: "POST" }
  );
  lastServiceSecret.value = result.clientSecret;
  ElMessage.success(t("notice.secretRotated"));
}

function resetOpenSourceForm() {
  openSourceForm.id = "";
  openSourceForm.name = "";
  openSourceForm.url = "";
  openSourceForm.sortOrder = 0;
  openSourceForm.enabled = true;
}

function editOpenSourceCredit(row: any) {
  openSourceForm.id = row.id;
  openSourceForm.name = row.name || "";
  openSourceForm.url = row.url || "";
  openSourceForm.sortOrder = row.sortOrder || 0;
  openSourceForm.enabled = row.enabled !== false;
}

async function saveOpenSourceCredit() {
  try {
    const body = {
      name: openSourceForm.name,
      url: openSourceForm.url,
      sortOrder: openSourceForm.sortOrder,
      enabled: openSourceForm.enabled
    };
    if (openSourceForm.id) {
      await $fetch(`/api/admin/open-source-credits/${openSourceForm.id}`, {
        method: "PATCH",
        body
      });
    } else {
      await $fetch("/api/admin/open-source-credits", {
        method: "POST",
        body
      });
    }

    resetOpenSourceForm();
    ElMessage.success(t("notice.openSourceSaved"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.openSourceFailed"));
  }
}

async function deleteOpenSourceCredit(id: string) {
  await $fetch(`/api/admin/open-source-credits/${id}`, {
    method: "DELETE"
  });
  ElMessage.success(t("notice.openSourceDeleted"));
  await loadAll();
}

async function updateFeedback(id: string, status: FeedbackStatus) {
  await $fetch(`/api/admin/feedback/${id}`, {
    method: "PATCH",
    body: { status }
  });
  ElMessage.success(t("notice.feedbackUpdated"));
  await loadAll();
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

.admin-form-grid {
  margin-bottom: 12px;
}

.admin-form-grid :deep(.el-select) {
  width: 100%;
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

.inline-link {
  word-break: break-all;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.feedback-content {
  max-width: 520px;
  white-space: pre-wrap;
}

</style>
