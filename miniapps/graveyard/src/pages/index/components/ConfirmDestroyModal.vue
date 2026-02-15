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
    <view class="confirm-body">
      <view class="confirm-skull">💀</view>
      <text class="confirm-text">{{ t("confirmText") }}</text>
      <view class="confirm-hash">{{ assetHash }}</view>
    </view>
  </ActionModal>
</template>

<script setup lang="ts">
import { ActionModal } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  show: boolean;
  assetHash: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["cancel", "confirm"]);
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
