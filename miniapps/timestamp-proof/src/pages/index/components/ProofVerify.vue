<template>
  <view class="verify-section">
    <text class="section-title">{{ t("verifyProof") }}</text>
    <input v-model="proofId" class="id-input" :placeholder="t('enterProofId')" type="number" />
    <button class="verify-button" :disabled="isVerifying || !proofId" @click="$emit('verify')">
      <text>{{ isVerifying ? t("loading") : t("verifyProof") }}</text>
    </button>

    <view v-if="verifiedProof" class="verified-proof">
      <text class="proof-status valid">{{ t("validProof") }}</text>
      <text class="proof-label">{{ t("verifiedContent") }}:</text>
      <text class="proof-content-full">{{ verifiedProof.content }}</text>
      <text class="proof-meta">{{ t("timestamp") }}: {{ formatTime(verifiedProof.timestamp) }}</text>
    </view>

    <view v-if="verifyError" class="verify-error">
      <text>{{ t("invalidProof") }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

defineProps<{
  t: (key: string) => string;
  isVerifying: boolean;
  verifiedProof: TimestampProof | null;
  verifyError: boolean;
}>();

defineEmits<{
  verify: [];
}>();

const proofId = defineModel<string>("proofId", { required: true });

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../timestamp-proof-theme.scss";

.verify-section {
  background: var(--proof-card-bg, var(--bg-card, rgba(30, 41, 59, 0.8)));
  border: 1px solid var(--proof-card-border, var(--border-color, rgba(255, 255, 255, 0.1)));
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-5, 20px);
}

.section-title {
  font-size: var(--font-size-xl, 20px);
  font-weight: 700;
  color: var(--proof-text-primary);
  margin-bottom: var(--spacing-4, 16px);
  letter-spacing: -0.3px;
}

.id-input {
  width: 100%;
  padding: var(--spacing-3, 12px);
  background: var(--proof-input-bg);
  border: 1px solid var(--proof-input-border);
  border-radius: var(--radius-md, 8px);
  color: var(--proof-text-primary);
  font-size: var(--font-size-md, 14px);
  margin-bottom: var(--spacing-4, 16px);
  transition: all var(--transition-normal);

  &:focus {
    outline: none;
    border-color: var(--proof-input-focus);
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
  }

  &::placeholder {
    color: var(--proof-text-muted);
  }
}

.verify-button {
  width: 100%;
  padding: var(--spacing-3, 14px);
  background: var(--proof-btn-primary);
  color: var(--proof-btn-primary-text);
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-lg, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);

  &:hover:not(:disabled) {
    background: var(--proof-btn-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

.verified-proof {
  margin-top: var(--spacing-5, 20px);
  padding: var(--spacing-4, 16px);
  background: var(--proof-success-bg);
  border: 1px solid var(--proof-success);
  border-radius: var(--radius-md, 8px);
}

.proof-status {
  font-size: var(--font-size-md, 14px);
  font-weight: 600;
  display: block;
  margin-bottom: var(--spacing-3, 12px);

  &.valid {
    color: var(--proof-success);
  }
}

.proof-label {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted);
  display: block;
  margin-bottom: var(--spacing-1, 4px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.proof-content-full {
  font-size: var(--font-size-md, 14px);
  color: var(--proof-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  display: block;
  margin-bottom: var(--spacing-2, 8px);
  font-family: monospace;
  background: var(--bg-tertiary, rgba(15, 23, 42, 0.6));
  padding: var(--spacing-2, 8px);
  border-radius: var(--radius-sm, 4px);
}

.proof-meta {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted);
  font-family: monospace;
}

.verify-error {
  margin-top: var(--spacing-5, 20px);
  padding: var(--spacing-4, 16px);
  background: var(--proof-error-bg);
  border: 1px solid var(--proof-error-border);
  border-radius: var(--radius-md, 8px);
  color: var(--proof-error);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .verify-button {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }

  .id-input {
    transition: none;
  }
}
</style>
