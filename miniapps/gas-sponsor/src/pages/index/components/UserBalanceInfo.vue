<template>
  <NeoCard>
    <view v-if="loading" class="loading">
      <text>{{ t("checkingEligibility") }}</text>
    </view>
    <view v-else>
      <view class="info-row">
        <text class="info-label">{{ t("walletAddress") }}</text>
        <text class="info-value mono">{{ shortenAddress(userAddress) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">{{ t("gasBalance") }}</text>
        <text class="info-value highlight">{{ formatBalance(gasBalance) }} GAS</text>
      </view>
      <view class="info-row">
        <text class="info-label">{{ t("eligibility") }}</text>
        <text :class="['info-value', 'badge', isEligible ? 'eligible' : 'not-eligible']">
          {{ isEligible ? "✓ " + t("eligible") : "✗ " + t("notEligible") }}
        </text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

const props = defineProps<{
  loading: boolean;
  userAddress: string;
  gasBalance: string;
  isEligible: boolean;
  t: (key: string) => string;
}>();

const shortenAddress = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : props.t("notConnected"));
const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--gas-divider);
  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gas-text-secondary);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  font-family: $font-family;
  color: var(--gas-text);

  &.mono {
    font-family: $font-mono;
    opacity: 0.8;
  }

  &.highlight {
    color: var(--gas-highlight);
    text-shadow: var(--gas-highlight-shadow);
  }

  &.badge {
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;

    &.eligible {
      background: var(--gas-badge-eligible-bg);
      color: var(--gas-badge-eligible-text);
      border: 1px solid var(--gas-badge-eligible-border);
    }

    &.not-eligible {
      background: var(--gas-badge-ineligible-bg);
      color: var(--gas-badge-ineligible-text);
      border: 1px solid var(--gas-badge-ineligible-border);
    }
  }
}
</style>
