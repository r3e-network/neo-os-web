<template>
  <div v-if="signature" class="result-card" role="status" aria-live="polite">
    <NeoCard variant="erobo-neo">
      <div class="result-header">
        <span class="result-title">{{ t("signatureResult") }}</span>
        <button type="button" class="copy-btn" :aria-label="t('copySignature')" @click="$emit('copy', signature)">
          <span class="copy-text">{{ t("copy") }}</span>
        </button>
      </div>
      <span class="result-text">{{ signature }}</span>
    </NeoCard>
  </div>

  <div v-if="txHash" class="result-card" role="status" aria-live="polite">
    <NeoCard variant="erobo-purple">
      <div class="result-header">
        <span class="result-title">{{ t("broadcastResult") }}</span>
        <button type="button" class="copy-btn" :aria-label="t('copyTxHash')" @click="$emit('copy', txHash)">
          <span class="copy-text">{{ t("copy") }}</span>
        </button>
      </div>
      <span class="result-text">{{ txHash }}</span>
      <span class="success-msg">{{ t("broadcastSuccess") }}</span>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  signature: string;
  txHash: string;
}>();

defineEmits<{
  copy: [text: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.result-card {
  width: 100%;
  max-width: 400px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.result-text {
  font-size: 12px;
  font-family: $font-mono;
  word-break: break-all;
  color: var(--text-primary);
}

.copy-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 11px;
}

.success-msg {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--accent-success, #10b981);
}
</style>
