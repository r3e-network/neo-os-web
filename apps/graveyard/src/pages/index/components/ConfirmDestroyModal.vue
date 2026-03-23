<template>
  <ActionModal
    :visible="show"
    :title="t('confirmTitle')"
    variant="danger"
    :confirm-label="t('confirmDestroy')"
    :cancel-label="t('cancel')"
    @cancel="$emit('cancel')"
    @confirm="$emit('confirm')"
    @close="$emit('cancel')"
  >
    <div class="confirm-body">
      <AppIcon name="skull" :size="80" class="confirm-skull" aria-hidden="true" />
      <span class="confirm-text">{{ t("confirmText") }}</span>
      <div class="confirm-hash">{{ assetHash }}</div>
    </div>
  </ActionModal>
</template>

<script setup lang="ts">
import { ActionModal, AppIcon } from "@shared/components"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  show: boolean;
  assetHash: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.confirm-body {
  text-align: center;
}
.confirm-skull {
  font-size: 80px;
  display: block;
  margin-bottom: $spacing-6;
}
.confirm-text {
  font-size: 14px;
  font-weight: $font-weight-black;
  margin-bottom: $spacing-6;
  text-transform: uppercase;
}
.confirm-hash {
  font-family: $font-mono;
  font-size: 12px;
  background: var(--bg-elevated);
  padding: $spacing-4;
  border: 3px solid var(--border-color, black);
  word-break: break-all;
  font-weight: $font-weight-bold;
  color: var(--text-primary, black);
}
</style>
