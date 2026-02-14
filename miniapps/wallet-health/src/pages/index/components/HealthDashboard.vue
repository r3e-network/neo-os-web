<template>
  <view class="health-dashboard">
    <MiniAppTabStats variant="erobo-neo" :stats="stats" />

    <NeoCard variant="erobo" class="balance-card">
      <view class="section-header">
        <text class="section-title">{{ t("sectionBalances") }}</text>
        <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="$emit('refresh')">
          {{ t("refresh") }}
        </NeoButton>
      </view>

      <view class="balance-grid">
        <view class="balance-item">
          <text class="balance-label">NEO</text>
          <text class="balance-value">{{ neoDisplay }}</text>
        </view>
        <view class="balance-item">
          <text class="balance-label">GAS</text>
          <text class="balance-value">{{ gasDisplay }}</text>
        </view>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { MiniAppTabStats, NeoCard, NeoButton } from "@shared/components";
import type { StatItem } from "@shared/components";

defineProps<{
  stats: StatItem[];
  neoDisplay: string;
  gasDisplay: string;
  isRefreshing: boolean;
  t: (key: string) => string;
}>();

defineEmits(["refresh"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.health-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.balance-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.balance-item {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 12px;
}

.balance-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--health-muted);
}

.balance-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--health-accent-strong);
}

@media (max-width: 767px) {
  .section-title {
    font-size: 16px;
  }
  .balance-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .balance-value {
    font-size: 16px;
  }
}
</style>
