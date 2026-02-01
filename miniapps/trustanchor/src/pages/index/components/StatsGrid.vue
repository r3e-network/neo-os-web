<script setup lang="ts">
/**
 * StatsGrid - TrustAnchor Statistics Display Component
 *
 * Displays stake, pending rewards, and total rewards in a grid layout.
 *
 * @example
 * ```vue
 * <StatsGrid
 *   :my-stake="100"
 *   :pending-rewards="5"
 *   :total-rewards="50"
 * />
 * ```
 */

interface Props {
  myStake: number;
  pendingRewards: number;
  totalRewards: number;
}

defineProps<Props>();

const { t } = useI18n();
</script>

<template>
  <view class="stats-grid px-1 mb-6">
    <NeoCard variant="erobo" class="stat-card">
      <view class="stat-icon mb-2">
        <AppIcon name="wallet" :size="32" />
      </view>
      <text class="stat-label">{{ t("myStake") }}</text>
      <text class="stat-value">{{ formatNum(myStake) }} NEO</text>
    </NeoCard>

    <NeoCard variant="erobo-neo" class="stat-card">
      <view class="stat-icon mb-2">
        <AppIcon name="gift" :size="32" />
      </view>
      <text class="stat-label">{{ t("pendingRewards") }}</text>
      <text class="stat-value text-green">{{ formatNum(pendingRewards) }} GAS</text>
    </NeoCard>

    <NeoCard variant="erobo-bitcoin" class="stat-card">
      <view class="stat-icon mb-2">
        <AppIcon name="trending-up" :size="32" />
      </view>
      <text class="stat-label">{{ t("totalRewards") }}</text>
      <text class="stat-value">{{ formatNum(totalRewards) }} GAS</text>
    </NeoCard>

    <NeoCard variant="accent" class="stat-card feature-card">
      <view class="stat-icon mb-2">
        <AppIcon name="percent" :size="32" />
      </view>
      <text class="stat-label">{{ t("zeroFee") }}</text>
      <text class="stat-value-small">{{ t("zeroFeeDesc") }}</text>
    </NeoCard>
  </view>
</template>

<script lang="ts">
export default {
  name: "StatsGrid",
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  padding: 16px;
  text-align: center;
}

.stat-icon {
  color: var(--erobo-purple);
}

.stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: bold;
}

.stat-value-small {
  display: block;
  font-size: 12px;
  opacity: 0.8;
}

.stat-card.text-green .stat-value {
  color: #22c55e;
}

.feature-card {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(159, 157, 243, 0.2) 0%, rgba(123, 121, 209, 0.2) 100%);
}

.text-green {
  color: #22c55e;
}
</style>
