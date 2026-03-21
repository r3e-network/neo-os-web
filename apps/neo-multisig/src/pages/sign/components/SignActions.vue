<template>
  <div class="actions">
    <NeoButton
      v-if="!isComplete && !hasUserSigned"
      variant="primary"
      size="lg"
      block
      type="button"
      :disabled="isProcessing"
      :aria-label="isProcessing ? t('buttonSigning') : t('buttonSign')"
      @click="$emit('sign')"
    >
      {{ isProcessing ? t("buttonSigning") : t("buttonSign") }}
    </NeoButton>

    <NeoButton
      v-if="isComplete && status !== 'broadcasted'"
      variant="success"
      size="lg"
      block
      type="button"
      :disabled="isProcessing"
      :aria-label="isProcessing ? t('buttonBroadcasting') : t('buttonBroadcast')"
      @click="$emit('broadcast')"
    >
      {{ isProcessing ? t("buttonBroadcasting") : t("buttonBroadcast") }}
    </NeoButton>

    <div v-if="broadcastTxId" class="broadcast-success">
      <span class="success-text">{{ t("broadcastedTitle") }}</span>
      <button
        type="button"
        class="tx-id"
        :aria-label="t('copy')"
        @click="$emit('copy', broadcastTxId)"
      >
        {{ t("broadcastedTxid") }}: {{ broadcastTxId }}
      </button>
    </div>
  </div>
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
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}
</style>
