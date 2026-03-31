<template>
  <NeoCard variant="erobo">
    <span class="card-title-glass">{{ t("buyKeys") }}</span>

    <!-- Key Count Selector with +/- -->
    <div class="key-selector">
      <button class="key-adjust-btn minus" type="button" @click="adjustKeys(-1)" :disabled="Number(keyCount) <= 1" aria-label="Decrease">
        <span class="adjust-icon">&minus;</span>
      </button>
      <div class="key-display">
        <span class="key-count-value">{{ keyCount }}</span>
        <span class="key-count-unit">{{ t("keysSuffix") }}</span>
      </div>
      <button class="key-adjust-btn plus" type="button" @click="adjustKeys(1)" aria-label="Increase">
        <span class="adjust-icon">&plus;</span>
      </button>
    </div>

    <!-- Quick-pick presets -->
    <div class="key-presets">
      <button v-for="n in [1, 3, 5, 10]" :key="n" class="preset-chip" :class="{ active: keyCount === String(n) }" type="button" @click="$emit('update:keyCount', String(n))">
        {{ n }}
      </button>
    </div>

    <div class="cost-row-glass">
      <span class="cost-label-glass">{{ t("estimatedCost") }}</span>
      <span class="cost-value-glass">
        <span class="cost-gas-icon" aria-hidden="true">&#x26FD;</span>
        {{ estimatedCost }} {{ t("tokenGas") }}
      </span>
    </div>
    <span class="hint-text-glass">{{ t("keyPrice") }}</span>
    <NeoButton variant="primary" size="lg" block type="button" @click="$emit('buy')" :disabled="isPaying" :aria-label="t('buyKeys')">
      {{ isPaying ? t("buying") : t("buyKeys") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

const props = defineProps<{
  keyCount: string;
  estimatedCost: string;
  isPaying: boolean;
}>();

const emit = defineEmits<{
  (e: "update:keyCount", value: string): void;
  (e: "buy"): void;
}>();

const adjustKeys = (delta: number) => {
  const current = Math.max(1, Number(props.keyCount) || 1);
  emit("update:keyCount", String(Math.max(1, current + delta)));
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.card-title-glass {
  font-size: 14px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: $spacing-4;
  padding-bottom: $spacing-2;
  display: block;
  color: var(--text-primary);
  letter-spacing: 0.1em;
}

.cost-row-glass {
  display: flex;
  justify-content: space-between;
  margin: $spacing-4 0;
  padding: $spacing-3;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.cost-label-glass {
  font-size: 12px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-primary);
}
.cost-value-glass {
  @include mono-number(18px);
  color: var(--doom-success);
}

/* Key Selector with +/- */
.key-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  margin-bottom: $spacing-4;
}

.key-adjust-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-primary);
  font-size: 20px;

  &:hover:not(:disabled) {
    background: rgba(234, 179, 8, 0.15);
    border-color: rgba(234, 179, 8, 0.3);
    box-shadow: 0 0 12px rgba(234, 179, 8, 0.2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &.plus:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
  }
}

.adjust-icon {
  font-weight: 900;
  font-size: 18px;
}

.key-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 12px;
}

.key-count-value {
  font-size: 28px;
  font-weight: 900;
  color: #eab308;
  font-family: 'Orbitron', monospace;
}

.key-count-unit {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(234, 179, 8, 0.5);
  letter-spacing: 0.1em;
}

/* Quick-pick presets */
.key-presets {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: $spacing-4;
}

.preset-chip {
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 800;
  font-family: 'Orbitron', monospace;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(234, 179, 8, 0.1);
    border-color: rgba(234, 179, 8, 0.3);
    color: #eab308;
  }

  &.active {
    background: rgba(234, 179, 8, 0.2);
    border-color: rgba(234, 179, 8, 0.5);
    color: #eab308;
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.15);
  }
}

.cost-gas-icon {
  margin-right: 4px;
}

.hint-text-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  opacity: 0.6;
  display: block;
  margin-bottom: $spacing-4;
  color: var(--text-secondary);
  text-align: center;
}
</style>
