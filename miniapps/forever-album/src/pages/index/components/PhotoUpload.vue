<template>
  <ActionModal :visible="visible" :title="t('uploadPhoto')" @close="$emit('close')">
    <view class="upload-body">
      <view class="upload-grid">
        <view v-for="item in images" :key="item.id" class="upload-item">
          <image :src="item.dataUrl" mode="aspectFill" class="upload-img" :alt="t('uploadPreview')" />
          <view class="remove-btn" role="button" :aria-label="t('cancel')" @click.stop="$emit('remove', item.id)"
            >×</view
          >
        </view>
        <view
          v-if="images.length < maxPhotos"
          class="upload-item upload-placeholder"
          role="button"
          tabindex="0"
          :aria-label="t('selectMore')"
          @click="$emit('choose')"
        >
          <text class="upload-plus">+</text>
          <text class="upload-tip">{{ t("selectMore") }}</text>
        </view>
      </view>

      <view class="upload-meta">
        <text>{{ t("uploadHint", { count: images.length, max: maxPhotos }) }}</text>
        <text class="upload-meta__size">
          {{ t("sizeHint", { size: formatBytes(totalSize), max: formatBytes(maxBytes) }) }}
        </text>
      </view>

      <view class="form-group">
        <text class="label">{{ t("encryptPhoto") }}</text>
        <switch :checked="encrypted" @change="$emit('update:encrypted', $event.detail.value)" />
      </view>

      <view v-if="encrypted" class="form-group column">
        <NeoInput v-model="localPassword" type="password" :placeholder="t('enterPassword')" />
        <text class="hint">{{ t("encryptionNote") }}</text>
      </view>
    </view>

    <template #actions>
      <NeoButton variant="ghost" size="sm" @click="$emit('close')">
        {{ t("cancel") }}
      </NeoButton>
      <NeoButton
        variant="primary"
        size="sm"
        :disabled="images.length === 0 || uploading"
        :loading="uploading"
        @click="$emit('confirm')"
      >
        {{ uploading ? t("uploading") : t("confirm") }}
      </NeoButton>
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ActionModal, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { UploadItem } from "@/types";

const props = defineProps<{
  visible: boolean;
  images: UploadItem[];
  maxPhotos: number;
  maxBytes: number;
  totalSize: number;
  encrypted: boolean;
  password: string;
  uploading: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "remove", id: string): void;
  (e: "choose"): void;
  (e: "confirm"): void;
  (e: "update:encrypted", value: boolean): void;
  (e: "update:password", value: string): void;
}>();

const localPassword = ref(props.password);

watch(localPassword, (newVal) => {
  emit("update:password", newVal);
});

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
};
</script>

<style scoped lang="scss">
@use "@shared/styles/mixins.scss" as *;
.upload-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 10px;
}
.upload-item {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  aspect-ratio: 1 / 1;
}
.upload-img {
  width: 100%;
  height: 100%;
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--border-color);
  background: transparent;
}
.upload-plus {
  font-size: 22px;
  color: var(--text-secondary);
}
.upload-tip {
  font-size: 10px;
  color: var(--text-muted);
}
.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--album-remove-bg);
  color: var(--album-remove-text);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-meta {
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.upload-meta__size {
  color: var(--text-muted);
}
.form-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.form-group.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.label {
  font-size: 12px;
  color: var(--text-secondary);
}
.hint {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
