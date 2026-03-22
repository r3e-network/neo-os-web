<template>
  <ActionModal :visible="visible" :title="t('wpTitle')" variant="warning" :closeable="true" @close="$emit('close')">
    <div class="wallet-prompt" role="status" aria-live="polite">
      <span class="wallet-prompt__desc">
        {{ message || t("wpDescription") }}
      </span>

      <NeoButton variant="primary" size="lg" type="button" class="wallet-prompt__btn" :loading="loading" @click="handleConnect" :aria-label="t('wpConnect')">
        <AppIcon name="wallet" :size="18" />
        {{ t("wpConnect") }}
      </NeoButton>
    </div>

    <template #actions>
      <NeoButton variant="ghost" size="sm" type="button" @click="$emit('close')" :aria-label="t('wpCancel')">
        {{ t("wpCancel") }}
      </NeoButton>
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ActionModal from "./ActionModal.vue";
import NeoButton from "./NeoButton.vue";
import AppIcon from "./AppIcon.vue";
import { useI18n } from "@shared/composables/useI18n";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    visible: boolean;
    message?: string | null;
  }>(),
  {
    message: null,
  }
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "connect"): void;
}>();

const loading = ref(false);

const handleConnect = async () => {
  loading.value = true;
  try {
    emit("connect");
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.wallet-prompt {
  text-align: center;

  &__desc {
    display: block;
    margin-bottom: $spacing-5;
    color: var(--text-secondary);
    font-size: $font-size-sm;
    line-height: 1.5;
  }

  &__btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
  }
}
</style>
