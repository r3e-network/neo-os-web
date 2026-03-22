<template>
  <div class="rate-card">
    <button
      type="button"
      class="rate-header"
      :aria-expanded="showDetails"
      :aria-label="t('exchangeRate')"
      @click="showDetails = !showDetails"
    >
      <div class="rate-info">
        <span class="rate-label">{{ t("exchangeRate") }}</span>
        <span class="rate-value">1 {{ fromSymbol }} {{ t("approxEqual") }} {{ exchangeRate }} {{ toSymbol }}</span>
      </div>
      <div class="rate-actions">
        <button type="button" class="refresh-icon-btn" :aria-label="t('exchangeRate')" @click.stop="$emit('refresh')">
          <AppIcon name="history" :size="20" />
        </button>
        <AppIcon name="chevron-right" :size="16" :rotate="showDetails ? 270 : 90" />
      </div>
    </button>

    <!-- Transaction Details Accordion -->
    <div v-if="showDetails" class="details-accordion">
      <div class="detail-row">
        <span class="detail-label">{{ t("priceImpact") }}</span>
        <span :class="['detail-value', priceImpactClass]">{{ hasPriceImpact ? priceImpact : t("notAvailable") }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">{{ t("slippage") }}</span>
        <span class="detail-value">{{ slippage }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">{{ t("liquidityPool") }}</span>
        <span class="detail-value">{{ liquidityPool }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">{{ t("minReceived") }}</span>
        <span class="detail-value">{{ minReceived }} {{ toSymbol }}</span>
      </div>
    </div>
  </div>
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

defineEmits<{
  (e: "refresh"): void;
}>();

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
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
  width: 100%;
  text-align: left;
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

.refresh-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  appearance: none;
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--swap-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(159, 157, 243, 0.15);
  }

  &:active {
    opacity: 0.5;
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

@media (max-width: 480px) {
  .rate-card {
    padding: 10px;
    margin-bottom: 16px;
    border-radius: 10px;
  }

  .rate-value {
    font-size: 12px;
  }

  .detail-value {
    font-size: 10px;
  }

  .detail-label {
    font-size: 9px;
  }
}
</style>
