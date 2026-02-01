<template>
  <NeoModal :visible="visible" :title="t('photoViewer')" :closeable="true" @close="$emit('close')">
    <view class="viewer-body">
      <image v-if="photo && !photo.encrypted" :src="photo.data" mode="aspectFit" class="viewer-img" :alt="t('viewingPhoto')" />
      <view v-else-if="photo" class="encrypted-notice">
        <text class="notice-text">{{ t("encryptedPhotoNotice") }}</text>
        <NeoButton size="sm" variant="primary" @click="$emit('decrypt')">
          {{ t("decryptToView") }}
        </NeoButton>
      </view>
    </view>
    <template #footer>
      <NeoButton v-if="showShare" size="sm" variant="secondary" @click="$emit('share')">
        {{ t("share") }}
      </NeoButton>
      <NeoButton size="sm" variant="ghost" @click="$emit('close')">
        {{ t("close") }}
      </NeoButton>
    </template>
  </NeoModal>
</template>

<script setup lang="ts">
import { NeoModal, NeoButton } from "@shared/components";

interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

const props = defineProps<{
  t: (key: string) => string;
  visible: boolean;
  photo: PhotoItem | null;
  showShare?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "decrypt"): void;
  (e: "share"): void;
}>();
</script>

<style lang="scss" scoped>
.viewer-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.viewer-img {
  width: 100%;
  max-height: 400px;
  border-radius: 12px;
}

.encrypted-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
}

.notice-text {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
