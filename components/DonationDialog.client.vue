<template>
  <button v-if="donation" class="ghost-btn donation-trigger" type="button" @click="visible = true">
    {{ t("donation.button") }}
  </button>

  <el-dialog
    v-model="visible"
    :title="donation?.title || t('donation.title')"
    width="680px"
  >
    <div v-if="donation" class="donation-dialog">
      <p class="donation-dialog__description">{{ donation.description }}</p>
      <div class="donation-dialog__images">
        <a
          v-for="(url, index) in donation.imageUrls"
          :key="url"
          class="donation-dialog__image"
          :href="url"
          target="_blank"
          rel="noreferrer"
        >
          <img :src="url" :alt="t('donation.imageAlt', { index: index + 1 })">
        </a>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

type Donation = {
  title: string;
  description: string;
  imageUrls: string[];
};

const { t } = usePortalI18n();
const visible = ref(false);
const donation = ref<Donation | null>(null);

async function loadDonation() {
  try {
    const result = await $fetch<{ donation: Donation | null }>("/api/public/donation");
    donation.value = result.donation;
  } catch {
    donation.value = null;
  }
}

onMounted(loadDonation);
</script>

<style scoped>
.donation-trigger {
  min-height: 36px;
}

.donation-dialog {
  display: grid;
  gap: 16px;
}

.donation-dialog__description {
  margin: 0;
  color: var(--page-text);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.donation-dialog__images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.donation-dialog__image {
  display: grid;
  place-items: center;
  min-height: 180px;
  overflow: hidden;
  border: 1px solid var(--page-border);
  border-radius: 12px;
  padding: 10px;
  background: var(--page-surface);
}

.donation-dialog__image img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
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

@media (max-width: 520px) {
  .donation-dialog__images {
    grid-template-columns: 1fr;
  }

  .donation-dialog__image {
    min-height: 140px;
  }
}
</style>
