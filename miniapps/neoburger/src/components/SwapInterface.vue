<template>
  <view class="swap-panel">
    <view class="swap-block">
      <view class="swap-row">
        <text class="swap-label">{{ t("from") }}</text>
        <text class="swap-hint">
          {{ t("balance") }}:
          {{ formatAmount(swapMode === "stake" ? neoBalance : bNeoBalance) }}
          {{ swapMode === "stake" ? t("tokenNeo") : t("tokenBneo") }}
        </text>
      </view>
      <view class="swap-input">
        <view class="swap-asset">
          <image
            class="swap-asset-icon"
            :src="swapMode === 'stake' ? '/static/neoburger-neo-logo.svg' : '/static/neoburger-bneo-logo.svg'"
            mode="widthFix"
            :alt="swapMode === 'stake' ? t('neoAlt') : t('bneoAlt')"
          />
          <text class="swap-asset-label">{{ swapMode === "stake" ? t("tokenNeo") : t("tokenBneo") }}</text>
        </view>
        <NeoInput
          :modelValue="swapAmount"
          @update:modelValue="emit('update:swapAmount', $event)"
          type="number"
          :placeholder="t('inputPlaceholder')"
          class="swap-input-field"
        />
      </view>
      <text class="swap-usd">{{ swapUsdText }}</text>
    </view>

    <button class="swap-toggle" @click="emit('toggleMode')">
      <image
        class="swap-toggle-icon"
        src="/static/neoburger-placeholder.svg"
        mode="widthFix"
        :alt="t('swapToggleAlt')"
      />
    </button>

    <view class="swap-block">
      <view class="swap-row">
        <text class="swap-label">{{ t("to") }}</text>
        <text class="swap-hint">{{ t("estimatedOutput") }}</text>
      </view>
      <view class="swap-output">
        <view class="swap-asset">
          <image
            class="swap-asset-icon"
            :src="swapMode === 'stake' ? '/static/neoburger-bneo-logo.svg' : '/static/neoburger-neo-logo.svg'"
            mode="widthFix"
            :alt="swapMode === 'stake' ? t('bneoAlt') : t('neoAlt')"
          />
          <text class="swap-asset-label">{{ swapMode === "stake" ? t("tokenBneo") : t("tokenNeo") }}</text>
        </view>
        <text class="swap-output-value">{{ swapOutput }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import { NeoInput } from "@shared/components";

const { t } = useI18n();

defineProps<{
  swapMode: "stake" | "unstake";
  neoBalance: number;
  bNeoBalance: number;
  swapAmount: string;
  swapOutput: string;
  swapUsdText: string;
}>();

const emit = defineEmits<{
  (e: "update:swapAmount", value: string): void;
  (e: "toggleMode"): void;
}>();

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
</script>

<style lang="scss" scoped>
.swap-panel {
  display: grid;
  gap: 14px;
}

.swap-block {
  background: var(--burger-surface-alt);
  border-radius: 18px;
  border: 1px solid var(--burger-border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.swap-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--burger-text-muted);
  font-weight: 700;
}

.swap-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.swap-asset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--burger-surface);
  border: 1px solid var(--burger-border);
  font-weight: 700;
  font-size: 12px;
}

.swap-asset-icon {
  width: 18px;
}

.swap-input-field {
  flex: 1;
  min-width: 0;
}

.swap-usd {
  font-size: 12px;
  color: var(--burger-text-muted);
}

.swap-toggle {
  align-self: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--burger-accent);
  box-shadow: var(--burger-accent-shadow-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.swap-toggle-icon {
  width: 18px;
}

.swap-output {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--burger-surface);
  border: 1px dashed var(--burger-border-dashed);
}

.swap-output-value {
  font-weight: 700;
  font-size: 16px;
}
</style>
