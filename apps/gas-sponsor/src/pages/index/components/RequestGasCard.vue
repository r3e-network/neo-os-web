<template>
  <NeoCard class="request-card">
    <div v-if="!isEligible" class="not-eligible-msg">
      <AppIcon name="warning" :size="40" class="warning-icon" aria-hidden="true" />
      <span class="warning-title">{{ t("notEligibleTitle") }}</span>
      <span class="warning-desc">{{ t("balanceExceeds") }}</span>
      <span class="warning-desc">{{ t("newUsersOnly") }}</span>
    </div>
    <div v-else-if="remainingQuota <= 0" class="not-eligible-msg">
      <AppIcon name="deny" :size="40" class="warning-icon" aria-hidden="true" />
      <span class="warning-title">{{ t("quotaExhausted") }}</span>
      <span class="warning-desc">{{ t("tryTomorrow") }}</span>
    </div>
    <div v-else class="request-form">
      <div class="fuel-pump-display">
        <div class="pump-screen">
          <span class="pump-label">{{ t("requestAmount") }}</span>
          <span class="pump-amount">{{ requestAmount || "0.00" }}</span>
          <span class="pump-unit">{{ t("tokenGas") }}</span>
        </div>
        <div class="pump-limits">
          <span class="limit-text">{{ t("maxRequest") }}: {{ formatBalance(maxRequestAmount) }} {{ t("tokenGas") }}</span>
          <span class="limit-text">{{ t("remaining") }}: {{ formatBalance(remainingQuota) }} {{ t("tokenGas") }}</span>
        </div>
      </div>

      <NeoInput
        :modelValue="requestAmount"
        @update:modelValue="$emit('update:requestAmount', $event)"
        type="number"
        :label="t('amountToRequest')"
        :placeholder="t('amountToRequestPlaceholder')"
        :suffix="t('tokenGas')"
      />

      <div class="quick-amounts">
        <button
          type="button"
          v-for="amount in quickAmounts"
          :key="amount"
          class="quick-btn"
          :aria-label="amount + ' ' + t('tokenGas')"
          @click="$emit('update:requestAmount', amount.toString())"
        >
          <span>{{ amount }}</span>
        </button>
      </div>

      <div class="submit-action">
        <NeoButton
          variant="primary"
          size="lg"
          block
          type="button"
          :loading="isRequesting"
          :disabled="!isEligible || remainingQuota <= 0"
          :aria-label="t('requestGas')"
          @click="$emit('request')"
        >
          <div class="btn-content">
            <AppIcon v-if="!isRequesting" name="gas" :size="20" aria-hidden="true" />
            <span>{{ isRequesting ? t("requesting") : t("requestGas") }}</span>
          </div>
        </NeoButton>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  isEligible: boolean;
  remainingQuota: number;
  requestAmount: string;
  maxRequestAmount: string;
  isRequesting: boolean;
  quickAmounts: number[];
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "update:requestAmount", value: string): void;
  (e: "request"): void;
}>();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.request-card {
  perspective: 1000px;
}

.not-eligible-msg {
  text-align: center;
  padding: 30px;
  background: var(--gas-card-danger-bg);
  border-radius: 20px;
  border: 1px solid var(--gas-card-danger-border);
  backdrop-filter: blur(10px);
}

.warning-icon {
  font-size: 40px;
  margin-bottom: 12px;
  filter: drop-shadow(var(--gas-card-danger-shadow));
}

.warning-title {
  font-weight: 800;
  font-size: 18px;
  margin-bottom: 8px;
  color: var(--gas-card-danger-text);
  display: block;
}

.warning-desc {
  font-size: 14px;
  font-weight: 500;
  color: var(--gas-text);
  margin-bottom: 4px;
  display: block;
}

.fuel-pump-display {
  background: var(--gas-pump-bg);
  border: 1px solid var(--gas-pump-border);
  border-radius: 24px;
  padding: 30px;
  margin-bottom: 24px;
  box-shadow: var(--gas-pump-shadow);
}

.pump-screen {
  background: var(--gas-pump-screen-bg);
  border-radius: 12px;
  border: 1px solid var(--gas-pump-screen-border);
  padding: 24px;
  text-align: center;
  box-shadow: var(--gas-pump-screen-shadow);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--gas-pump-screen-sheen);
  }
}

.pump-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gas-pump-label);
  letter-spacing: 0.2em;
  margin-bottom: 8px;
  display: block;
}

.pump-amount {
  font-size: 56px;
  font-weight: 800;
  font-family: monospace, ui-monospace, SFMono-Regular;
  color: var(--gas-pump-amount);
  display: block;
  line-height: 1;
  text-shadow: var(--gas-pump-amount-shadow);
  letter-spacing: -2px;
}

.pump-unit {
  font-size: 14px;
  font-weight: 700;
  color: var(--gas-text-secondary);
  margin-top: 8px;
  display: block;
  letter-spacing: 0.05em;
}

.pump-limits {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
}

.limit-text {
  font-size: 11px;
  color: var(--gas-text-muted);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.quick-amounts {
  display: flex;
  gap: 12px;
  margin: 20px 0;
}

.quick-btn {
  flex: 1;
  padding: 14px;
  background: var(--gas-quick-btn-bg);
  border: 1px solid var(--gas-quick-btn-border);
  border-radius: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: var(--gas-text);
  position: relative;
  overflow: hidden;
  appearance: none;
  border-style: solid;

  &:hover {
    background: var(--gas-quick-btn-hover-bg);
    border-color: var(--gas-quick-btn-hover-border);
    transform: translateY(-2px);
    box-shadow: var(--gas-quick-btn-hover-shadow);

    text {
      color: var(--gas-quick-btn-hover-text);
    }
  }

  &:active {
    transform: translateY(0);
    opacity: 0.8;
  }

  text {
    font-size: 13px;
    font-weight: 700;
    transition: color 0.3s;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.submit-action {
  margin-top: 16px;
}
</style>
