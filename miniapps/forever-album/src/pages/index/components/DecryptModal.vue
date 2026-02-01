<template>
  <NeoModal :visible="visible" :title="t('decryptTitle')" closeable @close="$emit('close')">
    <view class="decrypt-body">
      <NeoInput v-model="localPassword" type="password" :placeholder="t('enterPassword')" />
      <NeoButton variant="secondary" size="sm" class="decrypt-btn" :loading="decrypting" @click="$emit('decrypt', localPassword)">
        {{ decrypting ? t("decrypting") : t("decryptConfirm") }}
      </NeoButton>

      <view v-if="preview" class="decrypt-preview">
        <image :src="preview" mode="aspectFit" class="decrypt-img" :alt="t('decryptedPhoto')" />
        <NeoButton size="sm" variant="ghost" @click="$emit('preview')">
          {{ t("openPreview") }}
        </NeoButton>
      </view>
    </view>
  </NeoModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoModal, NeoButton, NeoInput } from "@shared/components";

const props = defineProps<{
  t: (key: string) => string;
  visible: boolean;
  decrypting: boolean;
  preview: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "decrypt", password: string): void;
  (e: "preview"): void;
}>();

const localPassword = ref("");

watch(() => props.visible, (newVal) => {
  if (!newVal) localPassword.value = "";
});
</script>

<style lang="scss" scoped>
.decrypt-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.decrypt-btn {
  align-self: flex-end;
}

.decrypt-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.decrypt-img {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}
</style>
