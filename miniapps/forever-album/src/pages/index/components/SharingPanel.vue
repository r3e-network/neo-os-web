<template>
  <NeoModal :visible="visible" :title="t('sharePhoto')" :closeable="true" @close="$emit('close')">
    <view class="share-body">
      <view class="share-preview" v-if="photo">
        <image :src="photo.data" mode="aspectFill" class="share-thumb" :alt="t('sharePreviewImage')" />
        <text class="share-label">{{ t("sharePreview") }}</text>
      </view>

      <view class="share-options">
        <text class="options-title">{{ t("shareOptions") }}</text>
        <view class="option-list" role="radiogroup" :aria-label="t('shareOptions')">
          <view class="option-item" role="radio" tabindex="0" :aria-checked="shareMethod === 'link'" :aria-label="t('shareViaLink')" @click="shareMethod = 'link'">
            <view :class="['option-radio', { active: shareMethod === 'link' }]" aria-hidden="true"></view>
            <text class="option-label">{{ t("shareViaLink") }}</text>
          </view>
          <view class="option-item" role="radio" tabindex="0" :aria-checked="shareMethod === 'address'" :aria-label="t('shareToAddress')" @click="shareMethod = 'address'">
            <view :class="['option-radio', { active: shareMethod === 'address' }]" aria-hidden="true"></view>
            <text class="option-label">{{ t("shareToAddress") }}</text>
          </view>
        </view>
      </view>

      <view v-if="shareMethod === 'address'" class="address-input">
        <NeoInput v-model="recipientAddress" :placeholder="t('recipientAddress')" />
      </view>

      <view class="share-note">
        <text class="note-text">{{ t("shareNote") }}</text>
      </view>
    </view>

    <template #footer>
      <NeoButton size="sm" variant="ghost" @click="$emit('close')">
        {{ t("cancel") }}
      </NeoButton>
      <NeoButton size="sm" variant="primary" :loading="sharing" @click="handleShare">
        {{ sharing ? t("sharing") : t("confirmShare") }}
      </NeoButton>
    </template>
  </NeoModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoModal, NeoButton, NeoInput } from "@shared/components";
import type { PhotoItem } from "@/types";

const props = defineProps<{
  t: (key: string) => string;
  visible: boolean;
  photo: PhotoItem | null;
  sharing: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "share", method: string, address?: string): void;
}>();

const shareMethod = ref("link");
const recipientAddress = ref("");

const handleShare = () => {
  emit("share", shareMethod.value, shareMethod.value === "address" ? recipientAddress.value : undefined);
  recipientAddress.value = "";
};
</script>

<style lang="scss" scoped>
.share-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card);
  border-radius: 12px;
}

.share-thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
}

.share-label {
  font-size: 14px;
  color: var(--text-primary);
}

.share-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-card);
  }
}

.option-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  transition: all 0.2s;

  &.active {
    border-color: var(--primary-color);
    background: var(--primary-color);
    box-shadow: inset 0 0 0 3px var(--bg-primary);
  }
}

.option-label {
  font-size: 14px;
  color: var(--text-primary);
}

.address-input {
  margin-top: 8px;
}

.share-note {
  padding: 10px;
  background: var(--bg-card);
  border-radius: 8px;
}

.note-text {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
