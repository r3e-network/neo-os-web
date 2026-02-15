<template>
  <view class="rate-card">
    <view
      class="rate-header"
      role="button"
      :aria-expanded="showDetails"
      :aria-label="t('exchangeRate')"
      tabindex="0"
      @click="showDetails = !showDetails"
      @keydown.enter="showDetails = !showDetails"
    >
      <view class="rate-info">
        <text class="rate-label">{{ t("exchangeRate") }}</text>
        <text class="rate-value">1 {{ fromSymbol }} ≈ {{ exchangeRate }} {{ toSymbol }}</text>
      </view>
      <view class="rate-actions">
        <AppIcon
          name="history"
          :size="20"
          class="refresh-icon"
          role="button"
          :aria-label="t('exchangeRate')"
          tabindex="0"
          @click.stop="$emit('refresh')"
          @keydown.enter.stop="$emit('refresh')"
        />
        <AppIcon name="chevron-right" :size="16" :rotate="showDetails ? 270 : 90" />
      </view>
    </view>

    <!-- Transaction Details Accordion -->
    <view v-if="showDetails" class="details-accordion">
      <view class="detail-row">
        <text class="detail-label">{{ t("priceImpact") }}</text>
        <text :class="['detail-value', priceImpactClass]">{{ hasPriceImpact ? priceImpact : t("notAvailable") }}</text>
      </view>
      <view class="detail-row">
        <text class="detail-label">{{ t("slippage") }}</text>
        <text class="detail-value">{{ slippage }}</text>
      </view>
      <view class="detail-row">
        <text class="detail-label">{{ t("liquidityPool") }}</text>
        <text class="detail-value">{{ liquidityPool }}</text>
      </view>
      <view class="detail-row">
        <text class="detail-label">{{ t("minReceived") }}</text>
        <text class="detail-value">{{ minReceived }} {{ toSymbol }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  fromSymbol: string;
  toSymbol: string;
  exchangeRate: string;
  priceImpact?: string | null;
  slippage: string;
  liquidityPool: string;
  minReceived: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["refresh"]);

const showDetails = ref(false);

const hasPriceImpact = computed(() => {
  const impact = parseFloat(props.priceImpact ?? "");
  return Number.isFinite(impact);
});

const priceImpactClass = computed(() => {
  const impact = parseFloat(props.priceImpact ?? "");
  if (!Number.isFinite(impact)) return "impact-na";
  if (impact < 1) return "impact-low";
  if (impact < 3) return "impact-medium";
  return "impact-high";
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.rate-card {
  background: var(--swap-card-soft);
  border: 1px solid var(--swap-panel-border);
  padding: 12px;
  margin-bottom: 24px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.rate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.rate-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--swap-text-muted);
  letter-spacing: 0.1em;
  display: block;
}

.rate-value {
  font-weight: 700;
  font-size: 13px;
  font-family: $font-mono;
  color: var(--text-primary);
}

.rate-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-icon {
  cursor: pointer;
  transition: opacity 0.2s;
  &:active {
    opacity: 0.6;
  }
}

.details-accordion {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--swap-rate-border);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.detail-label {
  font-size: 10px;
  color: var(--swap-text-muted);
  font-weight: 500;
}

.detail-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);

  &.impact-low {
    color: var(--swap-impact-low);
  }
  &.impact-medium {
    color: var(--swap-impact-medium);
  }
  &.impact-high {
    color: var(--swap-impact-high);
  }
  &.impact-na {
    color: var(--text-secondary);
  }
}
</style>
