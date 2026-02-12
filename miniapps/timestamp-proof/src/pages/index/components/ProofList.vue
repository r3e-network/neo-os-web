<template>
  <view class="proofs-list">
    <text class="section-title">{{ t("recentProofs") }}</text>
    <view v-if="proofs.length === 0" class="empty-state">
      <text>{{ t("noProofs") }}</text>
    </view>
    <view v-else class="proof-cards">
      <view v-for="proof in proofs" :key="proof.id" class="proof-card">
        <text class="proof-id">#{{ proof.id }}</text>
        <text class="proof-timestamp">{{ formatTime(proof.timestamp) }}</text>
        <text class="proof-content">
          >{{ proof.content.slice(0, 50) }}{{ proof.content.length > 50 ? "..." : "" }}</text
        >
      </view>
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
  proofs: TimestampProof[];
}>();

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../timestamp-proof-theme.scss";

.proofs-list {
  background: var(--proof-card-bg);
  border: 1px solid var(--proof-card-border);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-5, 20px);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal);

  &:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
    border-color: var(--border-color-hover, rgba(255, 255, 255, 0.15));
  }
}

.section-title {
  font-size: var(--font-size-xl, 20px);
  font-weight: 700;
  color: var(--proof-text-primary);
  margin-bottom: var(--spacing-4, 16px);
  letter-spacing: -0.3px;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-10, 40px);
  color: var(--proof-text-muted);
}

.proof-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.proof-card {
  padding: var(--spacing-4, 16px);
  background: var(--proof-bg-secondary);
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  transition: all var(--transition-normal);

  &:hover {
    border-color: var(--proof-accent);
    transform: translateX(4px);
  }
}

.proof-id {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--proof-accent);
  display: block;
  margin-bottom: var(--spacing-1, 4px);
  font-family: monospace;
}

.proof-timestamp {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted);
  display: block;
  margin-bottom: var(--spacing-2, 8px);
}

.proof-content {
  font-size: var(--font-size-md, 14px);
  color: var(--proof-text-secondary);
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .proof-card {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }
}
</style>
