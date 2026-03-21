<template>
  <div class="price-grid">
    <NeoCard :title="t('tokenNeo')" class="price-card" variant="erobo-neo">
      <div class="price-body">
        <span class="price-val">{{ t("currencySymbol") }}{{ prices.neo.usd.toFixed(2) }}</span>
        <div :class="['change-badge', prices.neo.usd_24h_change >= 0 ? 'up' : 'down']">
          <span
            >{{ prices.neo.usd_24h_change >= 0 ? t("trendUp") : t("trendDown") }}
            {{ Math.abs(prices.neo.usd_24h_change).toFixed(2) }}%</span
          >
        </div>
      </div>
    </NeoCard>

    <NeoCard :title="t('tokenGas')" class="price-card" variant="erobo-bitcoin">
      <div class="price-body">
        <span class="price-val">{{ t("currencySymbol") }}{{ prices.gas.usd.toFixed(2) }}</span>
        <div :class="['change-badge', prices.gas.usd_24h_change >= 0 ? 'up' : 'down']">
          <span
            >{{ prices.gas.usd_24h_change >= 0 ? t("trendUp") : t("trendDown") }}
            {{ Math.abs(prices.gas.usd_24h_change).toFixed(2) }}%</span
          >
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

export interface TokenPrice {
  usd: number;
  usd_24h_change: number;
}

export interface Prices {
  neo: TokenPrice;
  gas: TokenPrice;
}

defineProps<{
  prices: Prices;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.price-grid {
  @include grid-layout(2, 16px);
  margin-bottom: 24px;
}

.price-card {
  height: 100%;
}

.price-body {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  height: 100%;
  justify-content: center;
}

.price-val {
  font-size: 32px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
}

.change-badge {
  padding: 6px 12px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
  letter-spacing: 0.05em;

  &.up {
    background: rgba(0, 229, 153, 0.1);
    color: var(--treasury-positive);
    border: 1px solid rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.1);
  }

  &.down {
    background: rgba(239, 68, 68, 0.1);
    color: var(--treasury-negative);
    border: 1px solid rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
  }
}
</style>
