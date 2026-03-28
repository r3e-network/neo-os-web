<template>
  <div v-if="!address" class="connect-prompt">
    <span class="connect-text">{{ t("connectWallet") }}</span>
  </div>

  <NeoCard variant="erobo" :title="t('signTitle')" class="operation-card">
    <div class="input-group">
      <NeoInput
        type="textarea"
        :modelValue="message"
        :label="t('messageLabel')"
        :placeholder="t('messagePlaceholder')"
        @update:modelValue="$emit('update:message', $event)"
      />
      <div class="char-count">{{ message.length }}/1000</div>
    </div>

    <div class="actions">
      <NeoButton type="button" variant="primary" block :loading="isSigning" @click="$emit('sign')" :disabled="!message || !address">
        {{ t("signBtn") }}
      </NeoButton>
      <NeoButton type="button" variant="ghost" block :loading="isBroadcasting" @click="$emit('broadcast')" :disabled="!message || !address" class="broadcast-btn">
        {{ t("broadcastBtn") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  message: string;
  address: string;
  isSigning: boolean;
  isBroadcasting: boolean;
}>();

defineEmits<{
  "update:message": [value: string];
  sign: [];
  broadcast: [];
}>();
</script>

<style lang="scss" scoped>
.connect-prompt {
  padding: 20px;
  text-align: center;
}

.connect-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.operation-card {
  width: 100%;
  max-width: 400px;
}

.input-group {
  position: relative;
}

.char-count {
  text-align: right;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.broadcast-btn {
  margin-top: 4px;
}
</style>
