<template>
  <view class="proofs-list">
    <text class="section-title">{{ t("recentProofs") }}</text>
    <ItemList
      :items="proofs as unknown as Record<string, unknown>[]"
      item-key="id"
      :empty-text="t('noProofs')"
      :aria-label="t('ariaProofs')"
    >
      <template #item="{ item }">
        <text class="proof-id">#{{ (item as unknown as TimestampProof).id }}</text>
        <text class="proof-timestamp">{{ formatTime((item as unknown as TimestampProof).timestamp) }}</text>
        <text class="proof-content">
          >{{ (item as unknown as TimestampProof).content.slice(0, 50)
          }}{{ (item as unknown as TimestampProof).content.length > 50 ? "..." : "" }}</text
        >
      </template>
    </ItemList>
  </view>
</template>

<script setup lang="ts">
import { ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

defineProps<{
  proofs: TimestampProof[];
}>();

const { t } = createUseI18n(messages)();

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;
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
