<template>
  <GradientCard variant="erobo">
    <view class="stats-display">
      <view class="stat-row">
        <view class="stat-icon">📅</view>
        <text class="stat-label">{{ t("totalSessions") }}</text>
        <text class="stat-value">{{ stats?.totalSessions || 0 }}</text>
      </view>
      <view class="stat-divider" />
      <view class="stat-row">
        <view class="stat-icon">💎</view>
        <text class="stat-label">{{ t("totalRewards") }}</text>
        <text class="stat-value gold">{{ formatGas(stats?.totalPaid || 0n, 3) }} GAS</text>
      </view>
    </view>
  </GradientCard>
</template>

<script setup lang="ts">
import { GradientCard } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import type { GameStats } from "../../composables/useTurtleGame";

interface Props {
  stats: GameStats | null;
  t: Function;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.stats-display {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 16px;
}

.stat-row {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 16px;
  margin-bottom: 2px;
  filter: drop-shadow(0 0 5px var(--turtle-icon-glow));
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--turtle-text-muted);
  display: block;
}

.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--turtle-primary);

  &.gold {
    color: var(--turtle-accent);
  }
}

.stat-divider {
  width: 1px;
  height: 30px;
  background: var(--turtle-border);
}
</style>
