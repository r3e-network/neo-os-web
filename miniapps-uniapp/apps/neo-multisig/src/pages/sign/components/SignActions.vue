<template>
  <view class="actions">
    <NeoButton
      v-if="!isComplete && !hasUserSigned"
      variant="primary"
      size="lg"
      block
      :disabled="isProcessing"
      @click="$emit('sign')"
    >
      {{ isProcessing ? t("buttonSigning") : t("buttonSign") }}
    </NeoButton>

    <NeoButton
      v-if="isComplete && status !== 'broadcasted'"
      variant="success"
      size="lg"
      block
      :disabled="isProcessing"
      @click="$emit('broadcast')"
    >
      {{ isProcessing ? t("buttonBroadcasting") : t("buttonBroadcast") }}
    </NeoButton>

    <view v-if="broadcastTxId" class="broadcast-success">
      <text class="success-text">{{ t("broadcastedTitle") }}</text>
      <text
        class="tx-id"
        role="button"
        :aria-label="t('copy')"
        tabindex="0"
        @click="$emit('copy', broadcastTxId)"
        @keydown.enter="$emit('copy', broadcastTxId)"
      >
        {{ t("broadcastedTxid") }}: {{ broadcastTxId }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  isComplete: boolean;
  hasUserSigned: boolean;
  isProcessing: boolean;
  status: string;
  broadcastTxId: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  sign: [];
  broadcast: [];
  copy: [value: string];
}>();
</script>

<style lang="scss" scoped>
.actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.broadcast-success {
  margin-top: 16px;
  text-align: center;
}

.success-text {
  color: var(--multisig-accent);
  font-weight: 700;
}

.tx-id {
  font-size: 12px;
  color: var(--text-secondary);
  text-decoration: underline;
  display: block;
  margin-top: 4px;
}
</style>
