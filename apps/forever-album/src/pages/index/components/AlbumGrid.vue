<template>
  <NeoCard variant="erobo" class="gallery-card">
    <div v-if="loading" class="loading-state">
      <span>{{ t("loading") }}</span>
    </div>
    <div v-else class="gallery-grid">
      <button
        v-for="photo in photos"
        :key="photo.id"
        type="button"
        class="photo-item"
        :aria-label="photo.encrypted ? t('encrypted') : t('albumPhoto')"
        @click="$emit('view', photo)"
      >
        <img v-if="!photo.encrypted" :src="photo.data" mode="aspectFill" class="photo-img" :alt="t('albumPhoto')" />
        <div v-else class="photo-locked">
          <span class="lock-label">{{ t("encrypted") }}</span>
        </div>
        <div v-if="photo.encrypted" class="lock-icon" aria-hidden="true">{{ t("encrypted") }}</div>
      </button>

      <button
        type="button"
        class="photo-item placeholder"
        :aria-label="t('addPhoto')"
        @click="$emit('upload')"
      >
        <span class="plus-icon" aria-hidden="true">+</span>
        <span class="add-label">{{ t("addPhoto") }}</span>
      </button>
    </div>

    <div v-if="!loading && photos.length === 0" class="empty-state">
      <span class="empty-title">{{ t("emptyTitle") }}</span>
      <span class="empty-desc">{{ t("emptyDesc") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { PhotoItem } from "@/types";

defineProps<{
  photos: PhotoItem[];
  loading: boolean;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "view", photo: PhotoItem): void;
  (e: "upload"): void;
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/mixins.scss" as *;
.gallery-card {
  padding: 16px;
}
.gallery-grid {
  @include grid-layout(3, 12px);
}

@media (max-width: 480px) {
  .gallery-card {
    padding: 12px;
  }

  .gallery-grid {
    @include grid-layout(3, 8px);
  }
}

@media (max-width: 360px) {
  .gallery-grid {
    @include grid-layout(2, 6px);
  }
}
.photo-item {
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  appearance: none;
  padding: 0;
  cursor: pointer;
}
.photo-img {
  width: 100%;
  height: 100%;
}
.photo-locked {
  width: 100%;
  height: 100%;
  background: var(--album-locked-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--album-lock-text);
}
.lock-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--album-lock-bg);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  color: var(--album-lock-text);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.placeholder {
  border: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  gap: 6px;
  appearance: none;
  padding: 0;
  cursor: pointer;
}
.plus-icon {
  font-size: 32px;
  color: var(--text-secondary);
  font-weight: 300;
}
.add-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
.empty-state {
  margin-top: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.empty-title {
  font-size: 13px;
  font-weight: 700;
}
.empty-desc {
  font-size: 11px;
  color: var(--text-muted);
}
.loading-state {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
