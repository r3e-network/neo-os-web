<template>
  <div class="rate-card" v-if="exchangeRate && !loading">
    <div class="rate-row">
      <span class="rate-label">{{ t("exchangeRate") }}</span>
      <span class="rate-value">1 {{ fromSymbol }} = {{ exchangeRate }} {{ toSymbol }}</span>
    </div>
    <div class="rate-row">
      <span class="rate-label">{{ t("slippage") }}</span>
      <span class="rate-value slippage">{{ slippage }}</span>
    </div>
    <div class="rate-row">
      <span class="rate-label">{{ t("minReceived") }}</span>
      <span class="rate-value">{{ minReceived }} {{ toSymbol }}</span>
    </div>
    <button
      type="button"
      class="refresh-btn"
      :aria-label="t('refreshRate')"
      @click="$emit('refresh')"
    >
      <span class="refresh-icon" aria-hidden="true">↻</span>
      {{ t("refreshRate") }}
    </button>
  </div>
  <div class="rate-card loading" v-else>
    <span class="rate-loading-text">{{ loading ? t("loadingRate") : t("rateUnavailable") }}</span>
    <button
      type="button"
      class="refresh-btn"
      :aria-label="t('refreshRate')"
      @click="$emit('refresh')"
    >
      <span class="refresh-icon" aria-hidden="true">↻</span>
      {{ t("refreshRate") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  exchangeRate: string;
  fromSymbol: string;
  toSymbol: string;
  slippage: string;
  minReceived: string;
  loading: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "refresh"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.rate-card {
  background: var(--swap-card-soft);
  border: 1px solid var(--swap-panel-border);
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;

  &.loading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

@media (max-width: 480px) {
  .rate-card {
    padding: 12px;
    border-radius: 12px;
  }

  .refresh-btn {
    margin-top: 8px;
    padding: 6px 10px;
    font-size: 9px;
  }
}

.rate-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--swap-rate-border);

  &:last-of-type {
    border-bottom: none;
  }
}

.rate-label {
  font-size: 12px;
  color: var(--swap-text-muted);
}

.rate-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--swap-text);
  font-family: $font-mono;

  &.slippage {
    color: var(--swap-accent);
  }
}

.rate-loading-text {
  font-size: 12px;
  color: var(--swap-text-subtle);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--swap-text-muted);
  padding: 8px 12px;
  border: 1px solid var(--swap-panel-border-strong);
  border-radius: 8px;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;
  appearance: none;
  background: transparent;

  &:hover {
    color: var(--swap-accent);
    border-color: var(--swap-chip-hover-border);
  }

  &:focus-visible {
    outline: 2px solid var(--swap-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(159, 157, 243, 0.15);
  }
}

.refresh-icon {
  font-size: 14px;
}
</style>
