<template>
  <NeoModal :visible="visible" :title="t('wpTitle')" variant="warning" :closeable="true" @close="$emit('close')">
    <view class="wallet-prompt">
      <text class="wallet-prompt__desc">
        {{ message || t("wpDescription") }}
      </text>

      <NeoButton variant="primary" size="lg" class="wallet-prompt__btn" :loading="loading" @click="handleConnect">
        <AppIcon name="wallet" :size="18" />
        {{ t("wpConnect") }}
      </NeoButton>
    </view>

    <template #footer>
      <NeoButton variant="ghost" size="sm" @click="$emit('close')">
        {{ t("wpCancel") }}
      </NeoButton>
    </template>
  </NeoModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import NeoModal from "./NeoModal.vue";
import NeoButton from "./NeoButton.vue";
import AppIcon from "./AppIcon.vue";
import { useI18n } from "@shared/composables/useI18n";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  message?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "connect"): void;
}>();

const loading = ref(false);

const handleConnect = async () => {
  loading.value = true;
  emit("connect");
};
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.wallet-prompt {
  text-align: center;

  &__desc {
    display: block;
    margin-bottom: $space-5;
    color: var(--text-secondary);
    font-size: $font-size-sm;
    line-height: 1.5;
  }

  &__btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
  }
}
</style>
