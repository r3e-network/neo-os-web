<template>
  <NeoCard variant="erobo" class="gallery-card">
    <view v-if="loading" class="loading-state">
      <text>{{ t("loading") }}</text>
    </view>
    <view v-else class="gallery-grid">
      <view v-for="photo in photos" :key="photo.id" class="photo-item" @click="$emit('view', photo)">
        <image v-if="!photo.encrypted" :src="photo.data" mode="aspectFill" class="photo-img" :alt="t('albumPhoto')" />
        <view v-else class="photo-locked">
          <text class="lock-label">{{ t("encrypted") }}</text>
        </view>
        <view v-if="photo.encrypted" class="lock-icon">{{ t("encrypted") }}</view>
      </view>

      <view class="photo-item placeholder" @click="$emit('upload')">
        <text class="plus-icon">+</text>
        <text class="add-label">{{ t("addPhoto") }}</text>
      </view>
    </view>

    <view v-if="!loading && photos.length === 0" class="empty-state">
      <text class="empty-title">{{ t("emptyTitle") }}</text>
      <text class="empty-desc">{{ t("emptyDesc") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

defineProps<{
  t: (key: string) => string;
  photos: PhotoItem[];
  loading: boolean;
}>();

defineEmits<{
  (e: "view", photo: PhotoItem): void;
  (e: "upload"): void;
}>();
</script>

<style scoped lang="scss">
.gallery-card {
  padding: 16px;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.photo-item {
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
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
