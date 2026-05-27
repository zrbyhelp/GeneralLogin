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
        <NuxtLink class="ghost-btn" to="/">{{ t("admin.backApps") }}</NuxtLink>
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

      <section class="panel-card panel-card--strong server-card">
        <div class="server-card__header">
          <div>
            <h2 class="server-card__title">{{ t("admin.serverInfo") }}</h2>
            <p class="server-card__meta">
              {{ t("admin.serverUpdatedAt", { time: formatDateTime(serverInfo.sampledAt) }) }}
            </p>
          </div>
          <button class="ghost-btn compact-admin-btn" type="button" :disabled="serverLoading" @click="loadServerInfo">
            {{ serverLoading ? t("common.loading") : t("admin.refreshServerInfo") }}
          </button>
        </div>

        <p v-if="serverError" class="server-card__error">{{ serverError }}</p>

        <div class="server-metrics">
          <div v-for="metric in serverMetrics" :key="metric.key" class="server-metric">
            <div class="server-metric__header">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.percent }}%</strong>
            </div>
            <el-progress :percentage="metric.percent" :color="metric.color" :show-text="false" />
            <p class="server-metric__detail">{{ metric.detail }}</p>
          </div>
        </div>

        <div class="server-facts">
          <div>
            <span>{{ t("admin.hostname") }}</span>
            <strong>{{ serverInfo.hostname || "-" }}</strong>
          </div>
          <div>
            <span>{{ t("admin.platform") }}</span>
            <strong>{{ serverInfo.platform || "-" }} / {{ serverInfo.arch || "-" }}</strong>
          </div>
          <div>
            <span>{{ t("admin.nodeVersion") }}</span>
            <strong>{{ serverInfo.nodeVersion || "-" }}</strong>
          </div>
          <div>
            <span>{{ t("admin.uptime") }}</span>
            <strong>{{ formatUptime(serverInfo.uptimeSeconds) }}</strong>
          </div>
        </div>
      </section>

      <section class="panel-card panel-card--strong admin-card">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('admin.tabRequests')" name="requests">
            <div class="admin-toolbar">
              <input
                v-model="requestQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.requestSearchPlaceholder')"
                @keyup.enter="applyFilters(requestQuery)"
              />
              <select v-model="requestQuery.status" class="field-input admin-filter" @change="applyFilters(requestQuery)">
                <option value="">{{ t("admin.allStatuses") }}</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <select v-model="requestQuery.serviceId" class="field-input admin-filter" @change="applyFilters(requestQuery)">
                <option value="">{{ t("admin.allServices") }}</option>
                <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
                  {{ service.name }}
                </option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(requestQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(requestQuery)">
                {{ t("common.reset") }}
              </button>
            </div>

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
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="requestQuery.total"
                :current-page="requestQuery.page"
                :page-size="requestQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(requestQuery, $event)"
                @size-change="setPageSize(requestQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabUsers')" name="users">
            <div class="admin-toolbar">
              <input
                v-model="userQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.userSearchPlaceholder')"
                @keyup.enter="applyFilters(userQuery)"
              />
              <select v-model="userQuery.status" class="field-input admin-filter" @change="applyFilters(userQuery)">
                <option value="">{{ t("admin.allStatuses") }}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
              <select v-model="userQuery.serviceId" class="field-input admin-filter" @change="applyFilters(userQuery)">
                <option value="">{{ t("admin.allServices") }}</option>
                <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
                  {{ service.name }}
                </option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(userQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(userQuery)">
                {{ t("common.reset") }}
              </button>
            </div>

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
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="userQuery.total"
                :current-page="userQuery.page"
                :page-size="userQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(userQuery, $event)"
                @size-change="setPageSize(userQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabInvites')" name="invites">
            <div class="admin-toolbar">
              <button class="primary-btn compact-admin-btn" type="button" @click="openInviteCreate">
                {{ t("admin.createInvite") }}
              </button>
              <span v-if="lastInviteNotice" class="badge badge--ok">{{ lastInviteNotice }}</span>
              <input
                v-model="inviteQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.inviteSearchPlaceholder')"
                @keyup.enter="applyFilters(inviteQuery)"
              />
              <select v-model="inviteQuery.enabled" class="field-input admin-filter" @change="applyFilters(inviteQuery)">
                <option value="">{{ t("admin.allEnabledStates") }}</option>
                <option value="enabled">{{ t("common.enabled") }}</option>
                <option value="disabled">{{ t("common.disabled") }}</option>
              </select>
              <select v-model="inviteQuery.serviceId" class="field-input admin-filter" @change="applyFilters(inviteQuery)">
                <option value="">{{ t("admin.allServices") }}</option>
                <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
                  {{ service.name }}
                </option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(inviteQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(inviteQuery)">
                {{ t("common.reset") }}
              </button>
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
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="inviteQuery.total"
                :current-page="inviteQuery.page"
                :page-size="inviteQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(inviteQuery, $event)"
                @size-change="setPageSize(inviteQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabServices')" name="services">
            <div class="admin-toolbar">
              <button class="primary-btn compact-admin-btn" type="button" @click="openServiceCreate">
                {{ t("admin.createService") }}
              </button>
              <span v-if="lastServiceSecret" class="badge badge--warn">{{ t("admin.newSecret", { secret: lastServiceSecret }) }}</span>
              <input
                v-model="serviceQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.serviceSearchPlaceholder')"
                @keyup.enter="applyFilters(serviceQuery)"
              />
              <select v-model="serviceQuery.enabled" class="field-input admin-filter" @change="applyFilters(serviceQuery)">
                <option value="">{{ t("admin.allEnabledStates") }}</option>
                <option value="enabled">{{ t("common.enabled") }}</option>
                <option value="disabled">{{ t("common.disabled") }}</option>
              </select>
              <select v-model="serviceQuery.accessMode" class="field-input admin-filter" @change="applyFilters(serviceQuery)">
                <option value="">{{ t("admin.allAccessModes") }}</option>
                <option value="direct">{{ t("admin.direct") }}</option>
                <option value="invite">{{ t("admin.invite") }}</option>
                <option value="request">{{ t("admin.request") }}</option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(serviceQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(serviceQuery)">
                {{ t("common.reset") }}
              </button>
            </div>

            <el-table v-loading="loading" :data="services" stripe>
              <el-table-column :label="t('common.service')" min-width="220">
                <template #default="{ row }">
                  <strong>{{ row.displayTitle || row.name }}</strong>
                  <div class="muted">{{ row.slug }} · {{ row.featured ? t("admin.featured") : t("portal.showcaseEyebrow") }}</div>
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
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="serviceQuery.total"
                :current-page="serviceQuery.page"
                :page-size="serviceQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(serviceQuery, $event)"
                @size-change="setPageSize(serviceQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabAnnouncements')" name="announcements">
            <div class="admin-toolbar">
              <button class="primary-btn compact-admin-btn" type="button" @click="openAnnouncementCreate">
                {{ t("admin.createAnnouncement") }}
              </button>
              <input
                v-model="announcementQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.announcementSearchPlaceholder')"
                @keyup.enter="applyFilters(announcementQuery)"
              />
              <select v-model="announcementQuery.enabled" class="field-input admin-filter" @change="applyFilters(announcementQuery)">
                <option value="">{{ t("admin.allEnabledStates") }}</option>
                <option value="enabled">{{ t("common.enabled") }}</option>
                <option value="disabled">{{ t("common.disabled") }}</option>
              </select>
              <select v-model="announcementQuery.serviceId" class="field-input admin-filter" @change="applyFilters(announcementQuery)">
                <option value="">{{ t("admin.allServices") }}</option>
                <option :value="globalAnnouncementServiceId">{{ t("admin.announcementAllServices") }}</option>
                <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
                  {{ service.name }}
                </option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(announcementQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(announcementQuery)">
                {{ t("common.reset") }}
              </button>
            </div>

            <el-table v-loading="loading" :data="announcements" stripe>
              <el-table-column :label="t('admin.announcementTitle')" min-width="210">
                <template #default="{ row }">
                  <strong>{{ row.title }}</strong>
                  <div class="muted">{{ formatDateTime(row.createdAt) }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.announcementContent')" min-width="320">
                <template #default="{ row }">
                  <div class="feedback-content">{{ row.content }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('admin.announcementScope')" min-width="170">
                <template #default="{ row }">
                  <el-tag :type="row.serviceId ? 'info' : 'success'">
                    {{ row.service?.name || t("admin.announcementAllServices") }}
                  </el-tag>
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
                  <el-button size="small" @click="openAnnouncementEdit(row)">{{ t("common.edit") }}</el-button>
                  <el-button size="small" type="danger" plain @click="deleteAnnouncement(row.id)">{{ t("common.delete") }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="announcementQuery.total"
                :current-page="announcementQuery.page"
                :page-size="announcementQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(announcementQuery, $event)"
                @size-change="setPageSize(announcementQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabOpenSource')" name="open-source">
            <div class="admin-toolbar">
              <button class="primary-btn compact-admin-btn" type="button" @click="openOpenSourceCreate">
                {{ t("admin.createOpenSource") }}
              </button>
              <input
                v-model="openSourceQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.openSourceSearchPlaceholder')"
                @keyup.enter="applyFilters(openSourceQuery)"
              />
              <select v-model="openSourceQuery.enabled" class="field-input admin-filter" @change="applyFilters(openSourceQuery)">
                <option value="">{{ t("admin.allEnabledStates") }}</option>
                <option value="enabled">{{ t("common.enabled") }}</option>
                <option value="disabled">{{ t("common.disabled") }}</option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(openSourceQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(openSourceQuery)">
                {{ t("common.reset") }}
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
                  <el-button size="small" @click="openOpenSourceEdit(row)">{{ t("common.edit") }}</el-button>
                  <el-button size="small" type="danger" plain @click="deleteOpenSourceCredit(row.id)">{{ t("common.delete") }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="openSourceQuery.total"
                :current-page="openSourceQuery.page"
                :page-size="openSourceQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(openSourceQuery, $event)"
                @size-change="setPageSize(openSourceQuery, $event)"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabDonation')" name="donation">
            <div class="donation-admin">
              <div class="admin-toolbar">
                <label class="checkbox-line donation-admin__enabled">
                  <input v-model="donationForm.enabled" type="checkbox" />
                  <span>{{ t("common.enabled") }}</span>
                </label>
                <button
                  class="ghost-btn compact-admin-btn"
                  type="button"
                  :disabled="donationUploading || donationForm.imageUrls.length >= maxDonationImages"
                  @click="chooseDonationImage"
                >
                  {{ donationUploading ? t("common.loading") : t("admin.uploadDonationImage") }}
                </button>
                <span class="muted donation-admin__help">
                  {{ t("admin.donationUploadHelp", { count: donationForm.imageUrls.length, max: maxDonationImages }) }}
                </span>
                <input
                  ref="donationImageInput"
                  class="hidden-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  @change="uploadDonationImage"
                />
              </div>

              <div class="form-grid admin-form-grid">
                <label>
                  <span class="field-label">{{ t("admin.donationTitle") }}</span>
                  <input
                    v-model="donationForm.title"
                    class="field-input"
                    maxlength="80"
                    :placeholder="t('admin.donationTitlePlaceholder')"
                  />
                </label>
                <label class="wide-field">
                  <span class="field-label">{{ t("admin.donationDescription") }}</span>
                  <textarea
                    v-model="donationForm.description"
                    class="field-textarea donation-admin__textarea"
                    maxlength="2000"
                    :placeholder="t('admin.donationDescriptionPlaceholder')"
                  />
                </label>
              </div>

              <div v-if="donationForm.imageUrls.length" class="donation-admin__images">
                <article
                  v-for="(url, index) in donationForm.imageUrls"
                  :key="url"
                  class="donation-admin__image"
                >
                  <a :href="url" target="_blank" rel="noreferrer">
                    <img :src="url" :alt="t('donation.imageAlt', { index: index + 1 })">
                  </a>
                  <button class="danger-btn compact-admin-btn" type="button" @click="removeDonationImage(index)">
                    {{ t("common.delete") }}
                  </button>
                </article>
              </div>
              <p v-else class="portal-note">{{ t("admin.donationNoImages") }}</p>

              <div class="action-row donation-admin__actions">
                <button class="primary-btn compact-admin-btn" type="button" :disabled="donationSaving" @click="saveDonation">
                  {{ donationSaving ? t("common.loading") : t("common.save") }}
                </button>
                <span class="muted">
                  {{ t("admin.donationUpdatedAt", { time: formatDateTime(donationUpdatedAt) }) }}
                </span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('admin.tabFeedback')" name="feedback">
            <div class="admin-toolbar">
              <input
                v-model="feedbackQuery.q"
                class="field-input admin-search"
                :placeholder="t('admin.feedbackSearchPlaceholder')"
                @keyup.enter="applyFilters(feedbackQuery)"
              />
              <select v-model="feedbackQuery.status" class="field-input admin-filter" @change="applyFilters(feedbackQuery)">
                <option value="">{{ t("admin.allStatuses") }}</option>
                <option value="NEW">{{ t("admin.feedbackStatusNew") }}</option>
                <option value="REVIEWING">{{ t("admin.feedbackStatusReviewing") }}</option>
                <option value="RESOLVED">{{ t("admin.feedbackStatusResolved") }}</option>
              </select>
              <select v-model="feedbackQuery.type" class="field-input admin-filter" @change="applyFilters(feedbackQuery)">
                <option value="">{{ t("admin.allFeedbackTypes") }}</option>
                <option value="suggestion">{{ t("feedback.typeSuggestion") }}</option>
                <option value="complaint">{{ t("feedback.typeComplaint") }}</option>
                <option value="bug">{{ t("feedback.typeBug") }}</option>
              </select>
              <select v-model="feedbackQuery.serviceId" class="field-input admin-filter" @change="applyFilters(feedbackQuery)">
                <option value="">{{ t("admin.allServices") }}</option>
                <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
                  {{ service.name }}
                </option>
              </select>
              <button class="ghost-btn compact-admin-btn" type="button" @click="applyFilters(feedbackQuery)">
                {{ t("common.search") }}
              </button>
              <button class="ghost-btn compact-admin-btn" type="button" @click="resetFilters(feedbackQuery)">
                {{ t("common.reset") }}
              </button>
            </div>

            <el-table v-loading="loading" :data="feedbackList" stripe>
              <el-table-column :label="t('admin.feedbackType')" width="120">
                <template #default="{ row }">{{ feedbackTypeText(row.type) }}</template>
              </el-table-column>
              <el-table-column :label="t('admin.feedbackContent')" min-width="300">
                <template #default="{ row }">
                  <div class="feedback-content">{{ row.content }}</div>
                  <div v-if="row.contact" class="muted">{{ t("admin.feedbackContact") }}: {{ row.contact }}</div>
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
            <div class="admin-pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="feedbackQuery.total"
                :current-page="feedbackQuery.page"
                :page-size="feedbackQuery.pageSize"
                :page-sizes="pageSizes"
                @current-change="setPage(feedbackQuery, $event)"
                @size-change="setPageSize(feedbackQuery, $event)"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>

    <el-dialog v-model="inviteDialogVisible" :title="t('admin.createInvite')" width="680px">
      <div class="form-grid admin-form-grid">
        <label>
          <span class="field-label">{{ t("admin.inviteLabel") }}</span>
          <input v-model="inviteForm.label" class="field-input" :placeholder="t('admin.inviteLabelPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.maxUses") }}</span>
          <input v-model.number="inviteForm.maxUses" class="field-input" type="number" min="1" />
        </label>
        <label class="wide-field">
          <span class="field-label">{{ t("admin.inviteGenerationMode") }}</span>
          <el-radio-group v-model="inviteGenerationMode">
            <el-radio label="single">{{ t("admin.inviteGenerationSingle") }}</el-radio>
            <el-radio label="batch">{{ t("admin.inviteGenerationBatch") }}</el-radio>
          </el-radio-group>
        </label>
        <label v-if="inviteGenerationMode === 'batch'">
          <span class="field-label">{{ t("admin.inviteQuantity") }}</span>
          <input
            v-model.number="inviteQuantity"
            class="field-input"
            type="number"
            min="2"
            :placeholder="t('admin.inviteQuantityPlaceholder')"
          />
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
      <template #footer>
        <button class="ghost-btn" type="button" @click="inviteDialogVisible = false">{{ t("common.cancel") }}</button>
        <button class="primary-btn" type="button" @click="createInvite">{{ t("admin.createInvite") }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="serviceDialogVisible"
      :title="serviceForm.id ? t('admin.editService') : t('admin.createService')"
      width="680px"
    >
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
        <label>
          <span class="field-label">{{ t("admin.displayTitle") }}</span>
          <input v-model="serviceForm.displayTitle" class="field-input" :placeholder="t('admin.displayTitlePlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.shortIntro") }}</span>
          <input v-model="serviceForm.shortIntro" class="field-input" :placeholder="t('admin.shortIntroPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.coverImageUrl") }}</span>
          <input v-model="serviceForm.coverImageUrl" class="field-input" :placeholder="t('admin.coverImageUrlPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.videoUrl") }}</span>
          <input v-model="serviceForm.videoUrl" class="field-input" :placeholder="t('admin.videoUrlPlaceholder')" />
        </label>
        <label>
          <span class="field-label">{{ t("admin.mediaType") }}</span>
          <select v-model="serviceForm.mediaType" class="field-input">
            <option value="image">{{ t("admin.mediaImage") }}</option>
            <option value="video">{{ t("admin.mediaVideo") }}</option>
          </select>
        </label>
        <label>
          <span class="field-label">{{ t("admin.sortOrder") }}</span>
          <input v-model.number="serviceForm.showcaseOrder" class="field-input" type="number" />
        </label>
        <label class="wide-field">
          <span class="field-label">{{ t("admin.tags") }}</span>
          <input v-model="serviceForm.tagsText" class="field-input" :placeholder="t('admin.tagsPlaceholder')" />
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
          <input v-model="serviceForm.enabled" type="checkbox" />
          <span>{{ t("common.enabled") }}</span>
        </label>
        <label class="checkbox-line">
          <input v-model="serviceForm.featured" type="checkbox" />
          <span>{{ t("admin.featured") }}</span>
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
      <template #footer>
        <button class="ghost-btn" type="button" @click="serviceDialogVisible = false">{{ t("common.cancel") }}</button>
        <button class="primary-btn" type="button" @click="saveService">{{ serviceForm.id ? t("admin.saveService") : t("admin.createService") }}</button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="announcementDialogVisible"
      :title="announcementForm.id ? t('admin.editAnnouncement') : t('admin.createAnnouncement')"
      width="640px"
    >
      <div class="form-grid admin-form-grid">
        <label>
          <span class="field-label">{{ t("admin.announcementTitle") }}</span>
          <input
            v-model="announcementForm.title"
            class="field-input"
            :placeholder="t('admin.announcementTitlePlaceholder')"
          />
        </label>
        <label>
          <span class="field-label">{{ t("admin.announcementService") }}</span>
          <select v-model="announcementForm.serviceId" class="field-input">
            <option value="">{{ t("admin.announcementAllServices") }}</option>
            <option v-for="service in serviceOptions" :key="service.id" :value="service.id">
              {{ service.name }}
            </option>
          </select>
        </label>
        <label>
          <span class="field-label">{{ t("admin.sortOrder") }}</span>
          <input v-model.number="announcementForm.sortOrder" class="field-input" type="number" />
        </label>
        <label class="checkbox-line">
          <input v-model="announcementForm.enabled" type="checkbox" />
          <span>{{ t("common.enabled") }}</span>
        </label>
        <label class="wide-field">
          <span class="field-label">{{ t("admin.announcementContent") }}</span>
          <textarea
            v-model="announcementForm.content"
            class="field-textarea"
            :placeholder="t('admin.announcementContentPlaceholder')"
          />
        </label>
      </div>
      <template #footer>
        <button class="ghost-btn" type="button" @click="announcementDialogVisible = false">{{ t("common.cancel") }}</button>
        <button class="primary-btn" type="button" @click="saveAnnouncement">
          {{ announcementForm.id ? t("common.save") : t("admin.createAnnouncement") }}
        </button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="openSourceDialogVisible"
      :title="openSourceForm.id ? t('admin.editOpenSource') : t('admin.createOpenSource')"
      width="560px"
    >
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
      <template #footer>
        <button class="ghost-btn" type="button" @click="openSourceDialogVisible = false">{{ t("common.cancel") }}</button>
        <button class="primary-btn" type="button" @click="saveOpenSourceCredit">
          {{ openSourceForm.id ? t("common.save") : t("admin.createOpenSource") }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus/es/components/message/index";
import { computed, onMounted, reactive, ref } from "vue";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
type UserStatus = "ACTIVE" | "PENDING" | "APPROVED" | "SUSPENDED";
type FeedbackStatus = "NEW" | "REVIEWING" | "RESOLVED";

type ResourceUsage = {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  path?: string;
};

type ServerInfo = {
  sampledAt: string;
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptimeSeconds: number;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
  };
  memory: ResourceUsage;
  disk: ResourceUsage | null;
};

type ServerMetric = {
  key: string;
  label: string;
  percent: number;
  detail: string;
  color: string;
};

type ListQuery = {
  page: number;
  pageSize: number;
  total: number;
  q: string;
  status?: string;
  serviceId?: string;
  enabled?: string;
  accessMode?: string;
  type?: string;
};

type ServiceOption = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  allowInviteAccess: boolean;
};

type DonationSetting = {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  enabled: boolean;
  updatedAt: string | null;
};

const activeTab = ref("requests");
const loading = ref(true);
const errorMessage = ref("");
const { t, localizeError, locale } = usePortalI18n();
const pageSizes = [10, 20, 50, 100];
const maxDonationImages = 12;
const globalAnnouncementServiceId = "__global";
const summary = reactive({
  users: 0,
  suspendedUsers: 0,
  services: 0,
  pendingRequests: 0,
  invites: 0
});
const serverLoading = ref(true);
const serverError = ref("");
const serverInfo = reactive<ServerInfo>({
  sampledAt: "",
  hostname: "",
  platform: "",
  arch: "",
  nodeVersion: "",
  uptimeSeconds: 0,
  cpu: {
    model: "",
    cores: 0,
    usagePercent: 0
  },
  memory: {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  },
  disk: null
});
const users = ref<any[]>([]);
const services = ref<any[]>([]);
const invites = ref<any[]>([]);
const requests = ref<any[]>([]);
const openSourceCredits = ref<any[]>([]);
const announcements = ref<any[]>([]);
const feedbackList = ref<any[]>([]);
const serviceOptions = ref<ServiceOption[]>([]);
const lastServiceSecret = ref("");
const inviteDialogVisible = ref(false);
const serviceDialogVisible = ref(false);
const announcementDialogVisible = ref(false);
const openSourceDialogVisible = ref(false);
const donationSaving = ref(false);
const donationUploading = ref(false);
const donationUpdatedAt = ref("");
const donationImageInput = ref<HTMLInputElement | null>(null);

const requestQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  status: "",
  serviceId: ""
});
const userQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  status: "",
  serviceId: ""
});
const inviteQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  enabled: "",
  serviceId: ""
});
const serviceQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  enabled: "",
  accessMode: ""
});
const openSourceQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  enabled: ""
});
const announcementQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  enabled: "",
  serviceId: ""
});
const feedbackQuery = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  q: "",
  status: "",
  type: "",
  serviceId: ""
});

const inviteForm = reactive({
  label: "",
  maxUses: 1,
  expiresAt: "",
  serviceIds: [] as string[]
});
const inviteGenerationMode = ref<"single" | "batch">("single");
const inviteQuantity = ref(2);
const lastInviteNotice = ref("");

const serviceForm = reactive({
  id: "",
  name: "",
  slug: "",
  description: "",
  displayTitle: "",
  shortIntro: "",
  coverImageUrl: "",
  videoUrl: "",
  mediaType: "image",
  tagsText: "",
  showcaseOrder: 0,
  featured: false,
  homeUrl: "",
  healthCheckUrl: "",
  docsUrl: "",
  callbackUrlsText: "",
  enabled: true,
  allowDirectAccess: false,
  allowInviteAccess: true,
  allowAccessRequest: true
});

const openSourceForm = reactive({
  id: "",
  name: "",
  url: "",
  sortOrder: 0,
  enabled: true
});

const announcementForm = reactive({
  id: "",
  title: "",
  content: "",
  serviceId: "",
  sortOrder: 0,
  enabled: true
});

const donationForm = reactive({
  title: "",
  description: "",
  imageUrls: [] as string[],
  enabled: false
});

function userTag(status: UserStatus) {
  if (status === "SUSPENDED") return "danger";
  if (status === "PENDING") return "warning";
  return "success";
}

function userStatusText(status: UserStatus) {
  if (status === "SUSPENDED") return t("common.disabled");
  if (status === "PENDING") return "PENDING";
  if (status === "APPROVED") return "APPROVED";
  return t("common.enabled");
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return index === 0 ? `${Math.round(value)} ${units[index]}` : `${value.toFixed(1)} ${units[index]}`;
}

function formatUptime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (locale.value === "en") {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || parts.length > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0 || parts.length > 0) parts.push(`${hours} 小时`);
  parts.push(`${minutes} 分钟`);
  return parts.join(" ");
}

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false
  }).format(new Date(value));
}

const serverMetrics = computed<ServerMetric[]>(() => {
  const disk = serverInfo.disk;
  return [
    {
      key: "cpu",
      label: t("admin.cpuUsage"),
      percent: serverInfo.cpu.usagePercent,
      detail: t("admin.cpuDetail", {
        cores: serverInfo.cpu.cores,
        model: serverInfo.cpu.model || "-"
      }),
      color: "#2158f5"
    },
    {
      key: "memory",
      label: t("admin.memoryUsage"),
      percent: serverInfo.memory.usagePercent,
      detail: t("admin.memoryDetail", {
        used: formatBytes(serverInfo.memory.used),
        total: formatBytes(serverInfo.memory.total)
      }),
      color: "#0f766e"
    },
    {
      key: "disk",
      label: t("admin.diskUsage"),
      percent: disk?.usagePercent || 0,
      detail: disk
        ? t("admin.diskDetail", {
            used: formatBytes(disk.used),
            total: formatBytes(disk.total),
            path: disk.path || "-"
          })
        : t("admin.diskUnavailable"),
      color: "#b45309"
    }
  ];
});

const inviteableServices = computed(() =>
  serviceOptions.value.filter((service) => service.enabled && service.allowInviteAccess)
);

function allowedServiceAccess(row: any) {
  return row.serviceAccess.filter((item: any) => item.allowed);
}

function splitTags(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function listQueryParams(state: ListQuery) {
  const params: Record<string, string | number> = {
    page: state.page,
    pageSize: state.pageSize
  };

  for (const key of ["q", "status", "serviceId", "enabled", "accessMode", "type"] as const) {
    const value = state[key];
    if (value) {
      params[key] = value;
    }
  }

  return params;
}

function resetListFilters(state: ListQuery) {
  state.q = "";
  if ("status" in state) state.status = "";
  if ("serviceId" in state) state.serviceId = "";
  if ("enabled" in state) state.enabled = "";
  if ("accessMode" in state) state.accessMode = "";
  if ("type" in state) state.type = "";
  state.page = 1;
}

function setPage(state: ListQuery, page: number) {
  state.page = page;
  loadAll();
}

function setPageSize(state: ListQuery, pageSize: number) {
  state.page = 1;
  state.pageSize = pageSize;
  loadAll();
}

function applyFilters(state: ListQuery) {
  state.page = 1;
  loadAll();
}

function resetFilters(state: ListQuery) {
  resetListFilters(state);
  loadAll();
}

function setDonationForm(donation: DonationSetting) {
  donationForm.title = donation.title || "";
  donationForm.description = donation.description || "";
  donationForm.imageUrls = [...(donation.imageUrls || [])].slice(0, maxDonationImages);
  donationForm.enabled = donation.enabled === true;
  donationUpdatedAt.value = donation.updatedAt || "";
}

function formatInviteFileStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function downloadInviteCodes(codes: string[]) {
  if (!codes.length) {
    throw new Error("No invite codes to download");
  }

  const content = `${codes.join("\n")}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invite-codes-${formatInviteFileStamp()}.txt`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      announcementResult,
      openSourceResult,
      feedbackResult,
      serviceOptionResult,
      donationResult
    ] = await Promise.all([
      $fetch<typeof summary>("/api/admin/summary"),
      $fetch<{ users: any[]; total: number }>("/api/admin/users", { query: listQueryParams(userQuery) }),
      $fetch<{ services: any[]; total: number }>("/api/admin/services", { query: listQueryParams(serviceQuery) }),
      $fetch<{ invites: any[]; total: number }>("/api/admin/invites", { query: listQueryParams(inviteQuery) }),
      $fetch<{ requests: any[]; total: number }>("/api/admin/requests", { query: listQueryParams(requestQuery) }),
      $fetch<{ announcements: any[]; total: number }>("/api/admin/announcements", { query: listQueryParams(announcementQuery) }),
      $fetch<{ credits: any[]; total: number }>("/api/admin/open-source-credits", { query: listQueryParams(openSourceQuery) }),
      $fetch<{ feedback: any[]; total: number }>("/api/admin/feedback", { query: listQueryParams(feedbackQuery) }),
      $fetch<{ services: ServiceOption[] }>("/api/admin/service-options"),
      $fetch<{ donation: DonationSetting }>("/api/admin/donation")
    ]);

    Object.assign(summary, summaryResult);
    users.value = userResult.users;
    userQuery.total = userResult.total;
    services.value = serviceResult.services;
    serviceQuery.total = serviceResult.total;
    invites.value = inviteResult.invites;
    inviteQuery.total = inviteResult.total;
    requests.value = requestResult.requests;
    requestQuery.total = requestResult.total;
    announcements.value = announcementResult.announcements;
    announcementQuery.total = announcementResult.total;
    openSourceCredits.value = openSourceResult.credits;
    openSourceQuery.total = openSourceResult.total;
    feedbackList.value = feedbackResult.feedback;
    feedbackQuery.total = feedbackResult.total;
    serviceOptions.value = serviceOptionResult.services;
    setDonationForm(donationResult.donation);
  } catch (error: any) {
    errorMessage.value = localizeError(error, "error.loadAdmin");
  } finally {
    loading.value = false;
  }
}

async function updateUser(id: string, status: UserStatus) {
  try {
    await $fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: { status }
    });
    ElMessage.success(t("notice.userStatusUpdated"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

async function reviewRequest(id: string, status: RequestStatus) {
  try {
    await $fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      body: { status }
    });
    ElMessage.success(status === "APPROVED" ? t("notice.requestApproved") : t("notice.requestRejected"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

function resetInviteForm() {
  inviteForm.label = "";
  inviteForm.maxUses = 1;
  inviteForm.expiresAt = "";
  inviteForm.serviceIds = [];
  inviteGenerationMode.value = "single";
  inviteQuantity.value = 2;
}

function openInviteCreate() {
  resetInviteForm();
  inviteDialogVisible.value = true;
}

async function createInvite() {
  try {
    const body: Record<string, string | number | string[] | undefined> = {
      label: inviteForm.label,
      maxUses: inviteForm.maxUses,
      expiresAt: inviteForm.expiresAt || undefined,
      serviceIds: inviteForm.serviceIds
    };

    if (inviteGenerationMode.value === "batch") {
      const quantity = Math.floor(Number(inviteQuantity.value));
      if (!Number.isFinite(quantity) || quantity < 2) {
        ElMessage.error(t("error.inviteQuantityInvalid"));
        return;
      }

      if (quantity > 500) {
        ElMessage.error(t("error.inviteQuantityTooLarge", { max: 500 }));
        return;
      }

      body.generationMode = "batch";
      body.quantity = quantity;
    }

    const result = await $fetch<{ code?: string; codes?: string[]; createdCount?: number }>("/api/admin/invites", {
      method: "POST",
      body
    });

    if (result.codes?.length) {
      try {
        downloadInviteCodes(result.codes);
      } catch {
        ElMessage.error(t("error.inviteDownloadFailed"));
      }
      lastInviteNotice.value = t("admin.batchInviteReady", {
        count: result.createdCount || result.codes.length
      });
      ElMessage.success(
        t("notice.inviteBatchCreated", {
          count: result.createdCount || result.codes.length
        })
      );
    } else if (result.code) {
      lastInviteNotice.value = t("admin.newInvite", { code: result.code });
      ElMessage.success(t("notice.inviteCreated"));
    } else {
      throw new Error("Invalid invite response");
    }

    resetInviteForm();
    inviteDialogVisible.value = false;
    inviteQuery.page = 1;
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

function resetServiceForm() {
  serviceForm.id = "";
  serviceForm.name = "";
  serviceForm.slug = "";
  serviceForm.description = "";
  serviceForm.displayTitle = "";
  serviceForm.shortIntro = "";
  serviceForm.coverImageUrl = "";
  serviceForm.videoUrl = "";
  serviceForm.mediaType = "image";
  serviceForm.tagsText = "";
  serviceForm.showcaseOrder = 0;
  serviceForm.featured = false;
  serviceForm.homeUrl = "";
  serviceForm.healthCheckUrl = "";
  serviceForm.docsUrl = "";
  serviceForm.callbackUrlsText = "";
  serviceForm.enabled = true;
  serviceForm.allowDirectAccess = false;
  serviceForm.allowInviteAccess = true;
  serviceForm.allowAccessRequest = true;
}

function openServiceCreate() {
  resetServiceForm();
  serviceDialogVisible.value = true;
}

function openServiceEdit(row: any) {
  serviceForm.id = row.id;
  serviceForm.name = row.name || "";
  serviceForm.slug = row.slug || "";
  serviceForm.description = row.description || "";
  serviceForm.displayTitle = row.displayTitle || "";
  serviceForm.shortIntro = row.shortIntro || "";
  serviceForm.coverImageUrl = row.coverImageUrl || "";
  serviceForm.videoUrl = row.videoUrl || "";
  serviceForm.mediaType = row.mediaType === "video" ? "video" : "image";
  serviceForm.tagsText = (row.tags || []).join(", ");
  serviceForm.showcaseOrder = Number(row.showcaseOrder || 0);
  serviceForm.featured = Boolean(row.featured);
  serviceForm.homeUrl = row.homeUrl || "";
  serviceForm.healthCheckUrl = row.healthCheckUrl || "";
  serviceForm.docsUrl = row.docsUrl || "";
  serviceForm.callbackUrlsText = (row.callbackUrls || []).join("\n");
  serviceForm.enabled = row.enabled !== false;
  serviceForm.allowDirectAccess = Boolean(row.allowDirectAccess);
  serviceForm.allowInviteAccess = row.allowInviteAccess !== false;
  serviceForm.allowAccessRequest = row.allowAccessRequest !== false;
  serviceDialogVisible.value = true;
}

async function saveService() {
  try {
    const body = {
      name: serviceForm.name,
      slug: serviceForm.slug,
      description: serviceForm.description,
      displayTitle: serviceForm.displayTitle,
      shortIntro: serviceForm.shortIntro,
      coverImageUrl: serviceForm.coverImageUrl,
      videoUrl: serviceForm.videoUrl,
      mediaType: serviceForm.mediaType,
      tags: splitTags(serviceForm.tagsText),
      showcaseOrder: Number(serviceForm.showcaseOrder || 0),
      featured: serviceForm.featured,
      homeUrl: serviceForm.homeUrl,
      healthCheckUrl: serviceForm.healthCheckUrl,
      docsUrl: serviceForm.docsUrl,
      callbackUrls: splitCallbackUrls(serviceForm.callbackUrlsText),
      enabled: serviceForm.enabled,
      allowDirectAccess: serviceForm.allowDirectAccess,
      allowInviteAccess: serviceForm.allowInviteAccess,
      allowAccessRequest: serviceForm.allowAccessRequest
    };

    if (serviceForm.id) {
      await $fetch(`/api/admin/services/${serviceForm.id}`, {
        method: "PATCH",
        body
      });
      ElMessage.success(t("notice.serviceSaved"));
    } else {
      const result = await $fetch<{ clientSecret: string }>("/api/admin/services", {
        method: "POST",
        body
      });
      lastServiceSecret.value = result.clientSecret;
      serviceQuery.page = 1;
      ElMessage.success(t("notice.serviceCreated"));
    }

    resetServiceForm();
    serviceDialogVisible.value = false;
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

async function updateService(row: any) {
  try {
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
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
    await loadAll();
  }
}

async function rotateSecret(id: string) {
  try {
    const result = await $fetch<{ clientSecret: string }>(
      `/api/admin/services/${id}/secret`,
      { method: "POST" }
    );
    lastServiceSecret.value = result.clientSecret;
    ElMessage.success(t("notice.secretRotated"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

function resetAnnouncementForm() {
  announcementForm.id = "";
  announcementForm.title = "";
  announcementForm.content = "";
  announcementForm.serviceId = "";
  announcementForm.sortOrder = 0;
  announcementForm.enabled = true;
}

function openAnnouncementCreate() {
  resetAnnouncementForm();
  announcementDialogVisible.value = true;
}

function openAnnouncementEdit(row: any) {
  announcementForm.id = row.id;
  announcementForm.title = row.title || "";
  announcementForm.content = row.content || "";
  announcementForm.serviceId = row.serviceId || "";
  announcementForm.sortOrder = row.sortOrder || 0;
  announcementForm.enabled = row.enabled !== false;
  announcementDialogVisible.value = true;
}

async function saveAnnouncement() {
  try {
    const body = {
      title: announcementForm.title,
      content: announcementForm.content,
      serviceId: announcementForm.serviceId || null,
      sortOrder: announcementForm.sortOrder,
      enabled: announcementForm.enabled
    };

    if (announcementForm.id) {
      await $fetch(`/api/admin/announcements/${announcementForm.id}`, {
        method: "PATCH",
        body
      });
    } else {
      await $fetch("/api/admin/announcements", {
        method: "POST",
        body
      });
      announcementQuery.page = 1;
    }

    resetAnnouncementForm();
    announcementDialogVisible.value = false;
    ElMessage.success(t("notice.announcementSaved"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.announcementFailed"));
  }
}

async function deleteAnnouncement(id: string) {
  try {
    await $fetch(`/api/admin/announcements/${id}`, {
      method: "DELETE"
    });
    ElMessage.success(t("notice.announcementDeleted"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

function resetOpenSourceForm() {
  openSourceForm.id = "";
  openSourceForm.name = "";
  openSourceForm.url = "";
  openSourceForm.sortOrder = 0;
  openSourceForm.enabled = true;
}

function openOpenSourceCreate() {
  resetOpenSourceForm();
  openSourceDialogVisible.value = true;
}

function openOpenSourceEdit(row: any) {
  openSourceForm.id = row.id;
  openSourceForm.name = row.name || "";
  openSourceForm.url = row.url || "";
  openSourceForm.sortOrder = row.sortOrder || 0;
  openSourceForm.enabled = row.enabled !== false;
  openSourceDialogVisible.value = true;
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
      openSourceQuery.page = 1;
    }

    resetOpenSourceForm();
    openSourceDialogVisible.value = false;
    ElMessage.success(t("notice.openSourceSaved"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.openSourceFailed"));
  }
}

async function deleteOpenSourceCredit(id: string) {
  try {
    await $fetch(`/api/admin/open-source-credits/${id}`, {
      method: "DELETE"
    });
    ElMessage.success(t("notice.openSourceDeleted"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

function chooseDonationImage() {
  donationImageInput.value?.click();
}

function removeDonationImage(index: number) {
  donationForm.imageUrls.splice(index, 1);
}

async function uploadDonationImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  if (donationForm.imageUrls.length >= maxDonationImages) {
    ElMessage.error(t("error.donationImageLimit", { max: maxDonationImages }));
    input.value = "";
    return;
  }

  donationUploading.value = true;

  try {
    const form = new FormData();
    form.append("file", file);
    const result = await $fetch<{ file: { url: string } }>("/api/admin/donation/upload", {
      method: "POST",
      body: form
    });

    if (!donationForm.imageUrls.includes(result.file.url)) {
      donationForm.imageUrls.push(result.file.url);
    }
    ElMessage.success(t("notice.donationImageUploaded"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.donationUploadFailed"));
  } finally {
    donationUploading.value = false;
    input.value = "";
  }
}

async function saveDonation() {
  donationSaving.value = true;

  try {
    const result = await $fetch<{ donation: DonationSetting }>("/api/admin/donation", {
      method: "PATCH",
      body: {
        title: donationForm.title,
        description: donationForm.description,
        imageUrls: donationForm.imageUrls,
        enabled: donationForm.enabled
      }
    });

    setDonationForm(result.donation);
    ElMessage.success(t("notice.donationSaved"));
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.donationFailed"));
  } finally {
    donationSaving.value = false;
  }
}

async function updateFeedback(id: string, status: FeedbackStatus) {
  try {
    await $fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      body: { status }
    });
    ElMessage.success(t("notice.feedbackUpdated"));
    await loadAll();
  } catch (error: any) {
    ElMessage.error(localizeError(error, "error.operationFailed"));
  }
}

async function loadServerInfo() {
  serverLoading.value = true;
  serverError.value = "";

  try {
    const result = await $fetch<ServerInfo>("/api/admin/server-info");
    Object.assign(serverInfo, result);
  } catch (error: any) {
    serverError.value = localizeError(error, "error.loadServerInfo");
  } finally {
    serverLoading.value = false;
  }
}

onMounted(() => {
  void loadAll();
  void loadServerInfo();
});
</script>

<style scoped>
.admin-page {
  padding-bottom: 72px;
}

.admin-card {
  margin-top: 16px;
  padding: 18px;
}

.server-card {
  margin-top: 16px;
  padding: 18px;
}

.server-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.server-card__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.server-card__meta {
  margin: 6px 0 0;
  color: var(--page-muted);
  font-size: 13px;
}

.server-card__error {
  margin: 0 0 12px;
  color: #b91c1c;
  font-size: 13px;
}

html[data-theme="dark"] .server-card__error {
  color: #fca5a5;
}

.server-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.server-metric {
  padding: 14px;
  border-radius: 14px;
  background: var(--page-surface-soft);
  border: 1px solid var(--page-border);
}

.server-metric__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.server-metric__header span {
  font-size: 13px;
  color: var(--page-muted);
}

.server-metric__header strong {
  font-size: 18px;
  line-height: 1;
}

.server-metric__detail {
  margin: 8px 0 0;
  color: var(--page-muted);
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.server-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.server-facts div {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--page-surface-soft);
  border: 1px solid var(--page-border);
}

.server-facts span {
  display: block;
  margin-bottom: 6px;
  color: var(--page-muted);
  font-size: 12px;
}

.server-facts strong {
  display: block;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.admin-error {
  width: min(540px, 100%);
  padding: 28px;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.admin-search {
  flex: 1 1 240px;
  min-width: 180px;
}

.admin-filter {
  width: 180px;
  min-width: 150px;
}

.compact-admin-btn {
  min-height: 44px;
  white-space: nowrap;
}

.compact-admin-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  transform: none;
}

.admin-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  overflow-x: auto;
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

.inline-link {
  word-break: break-all;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.feedback-content {
  max-width: 520px;
  white-space: pre-wrap;
}

.hidden-input {
  display: none;
}

.donation-admin {
  display: grid;
  gap: 14px;
}

.donation-admin__enabled {
  min-width: 104px;
}

.donation-admin__help {
  font-size: 13px;
}

.donation-admin__textarea {
  min-height: 150px;
}

.donation-admin__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.donation-admin__image {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--page-border);
  border-radius: 12px;
  background: var(--page-surface-soft);
}

.donation-admin__image a {
  display: grid;
  place-items: center;
  min-height: 160px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--page-surface-strong);
}

.donation-admin__image img {
  display: block;
  width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.donation-admin__actions {
  padding-top: 2px;
}

@media (max-width: 960px) {
  .server-metrics,
  .server-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-toolbar {
    align-items: stretch;
  }

  .server-card__header {
    flex-direction: column;
  }

  .server-metrics,
  .server-facts {
    grid-template-columns: 1fr;
  }

  .admin-search,
  .admin-filter,
  .compact-admin-btn {
    width: 100%;
    flex: 1 1 100%;
  }
}
</style>
