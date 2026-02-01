<template>
  <NeoCard variant="erobo">
    <view class="stats-grid-neo">
      <view class="stat-item-neo">
        <text class="stat-label-neo">{{ t("totalDonated") }}</text>
        <text class="stat-value-neo">{{ formatNum(totalDonated) }} GAS</text>
      </view>
    </view>
  </NeoCard>

  <NeoCard v-if="recentTips.length > 0" variant="erobo-neo">
    <view class="recent-tips-glass">
      <view v-for="tip in recentTips" :key="tip.id" class="recent-tip-item-glass">
        <text class="recent-tip-emoji">✨</text>
        <view class="recent-tip-info">
          <text class="recent-tip-to-glass">{{ tip.to }}</text>
          <text class="recent-tip-time-glass">{{ tip.time }}</text>
        </view>
        <text class="recent-tip-amount-glass">{{ tip.amount }} GAS</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import type { RecentTip } from "../composables/useDevTippingStats";

interface Props {
  totalDonated: number;
  recentTips: RecentTip[];
  formatNum: (n: number) => string;
  t: Function;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.stats-grid-neo {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.stat-item-neo {
  text-align: center;
}

.stat-label-neo {
  color: var(--cafe-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.stat-value-neo {
  font-size: 28px;
  color: var(--cafe-neon);
  font-family: "JetBrains Mono", monospace;
  font-weight: bold;
  text-shadow: var(--cafe-neon-glow-strong);
}

.recent-tips-glass {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-tip-item-glass {
  background: var(--cafe-input-bg);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 2px solid var(--cafe-neon);
}

.recent-tip-to-glass {
  color: var(--cafe-text-strong);
  font-weight: bold;
  font-size: 14px;
}

.recent-tip-time-glass {
  color: var(--cafe-muted);
  font-size: 10px;
}

.recent-tip-amount-glass {
  margin-left: auto;
  color: var(--cafe-neon);
  font-family: "JetBrains Mono", monospace;
  font-weight: bold;
}
</style>
