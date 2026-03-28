<template>
  <div class="recent-section">
    <span class="section-title">{{ t("recentTransactions") }}</span>
    <NeoCard
      v-for="tx in transactions"
      :key="tx.hash"
      variant="erobo"
      class="tx-card"
      hoverable
      @click="$emit('viewTx', tx.hash)"
    >
      <div class="tx-content">
        <div class="tx-info">
          <span class="tx-hash mono">{{ truncateHash(tx.hash) }}</span>
          <span :class="['vm-state', tx.vmState]">
            {{ tx.vmState === 'HALT' ? t('vmHalt') : t('vmFault') }}
          </span>
        </div>
        <span class="tx-time">{{ formatTime(tx.blockTime) }}</span>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  transactions: Array<{ hash: string; vmState: string; blockTime: unknown }>;
  formatTime: (time: unknown) => string;
  truncateHash: (hash: unknown) => string;
}>();

defineEmits<{
  viewTx: [hash: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  @include stat-label;
  color: var(--matrix-success, rgba(0, 229, 153, 1));
  margin-bottom: 12px;
  display: block;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.tx-card {
  cursor: pointer;
  margin-bottom: 4px;
}

.tx-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tx-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tx-hash {
  font-family: $font-mono;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tx-time {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}

.vm-state {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 100px;

  &.HALT {
    background: rgba(0, 229, 153, 0.1);
    color: var(--matrix-success, #00e599);
    border: 1px solid rgba(0, 229, 153, 0.2);
  }
  &.FAULT {
    background: rgba(239, 68, 68, 0.1);
    color: var(--matrix-error, #ef4444);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
}
</style>
