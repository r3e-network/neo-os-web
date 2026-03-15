<template>
  <ActionModal :visible="visible" :title="t('photoViewer')" @close="$emit('close')">
    <div class="viewer-body">
      <img
        v-if="photo && !photo.encrypted"
        :src="photo.data"
        mode="aspectFit"
        class="viewer-img"
        :alt="t('viewingPhoto')"
      />
      <div v-else-if="photo" class="encrypted-notice">
        <span class="notice-text">{{ t("encryptedPhotoNotice") }}</span>
        <NeoButton size="sm" variant="primary" @click="$emit('decrypt')">
          {{ t("decryptToView") }}
        </NeoButton>
      </div>
    </div>
    <template #actions>
      <NeoButton v-if="showShare" size="sm" variant="secondary" @click="$emit('share')">
        {{ t("share") }}
      </NeoButton>
      <NeoButton size="sm" variant="ghost" @click="$emit('close')">
        {{ t("close") }}
      </NeoButton>
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ActionModal, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { PhotoItem } from "@/types";

const props = defineProps<{
  visible: boolean;
  photo: PhotoItem | null;
  showShare?: boolean;
}>();

const { t } = createUseI18n(messages)();

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
