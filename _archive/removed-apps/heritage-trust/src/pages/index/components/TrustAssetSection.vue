<template>
  <div class="asset-section">
    <div class="asset-header">
      <span class="asset-label">{{ t("totalAssets") }}</span>
    </div>
    <div class="dual-assets">
      <div class="asset-item neo">
        <AppIcon name="neo" :size="20" class="asset-icon" />
        <div class="asset-info">
          <span class="asset-amount">{{ trust.neoValue }}</span>
          <span class="asset-symbol">NEO</span>
        </div>
        <div v-if="trust.neoValue > 0" class="stake-badge">
          <span class="stake-icon">🍔</span>
          <span class="stake-text">STAKED</span>
        </div>
      </div>
      <div v-if="trust.gasPrincipal > 0" class="asset-item gas">
        <AppIcon name="gas" :size="20" class="asset-icon" />
        <div class="asset-info">
          <span class="asset-amount">{{ trust.gasPrincipal.toFixed(4) }}</span>
          <span class="asset-symbol">GAS</span>
        </div>
      </div>
    </div>
    <div class="release-summary">
      <span class="release-label">{{ t("releasePlan") }}</span>
      <span v-if="trust.releaseMode === 'rewards_only'" class="release-value">{{
        t("releaseRewardsOnlySummary")
      }}</span>
      <span v-else-if="trust.releaseMode === 'fixed'" class="release-value">
        {{ t("releaseFixedSummary", { neo: trust.monthlyNeo, gas: trust.monthlyGas.toFixed(4) }) }}
      </span>
      <span v-else class="release-value">{{ t("releaseNeoRewardsSummary", { neo: trust.monthlyNeo }) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Trust } from "./TrustCard.vue";

defineProps<{
  trust: Trust;
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.asset-section {
  margin-bottom: 24px;
}

.asset-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.asset-label {
  @include stat-label;
  font-weight: 800;
}

.dual-assets {
  display: flex;
  gap: 12px;
}

.release-summary {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.release-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}

.release-value {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.4;
}

.asset-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
  position: relative;

  &.neo {
    border-color: rgba(0, 229, 153, 0.15);
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.05), transparent);
  }

  &.gas {
    border-color: rgba(255, 222, 89, 0.15);
    background: linear-gradient(135deg, rgba(255, 222, 89, 0.05), transparent);
  }
}

.asset-info {
  display: flex;
  flex-direction: column;
}

.stake-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  background: var(--heritage-success);
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.stake-icon {
  font-size: 8px;
}

.stake-text {
  font-size: 8px;
  font-weight: 900;
  color: var(--heritage-on-success);
  letter-spacing: 0.05em;
}

.asset-amount {
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--text-primary);
  line-height: 1;
}

.asset-symbol {
  font-size: 9px;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-top: 2px;
}
</style>
