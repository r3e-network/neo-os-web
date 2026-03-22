<template>
  <NeoCard variant="default">
    <div class="eligibility-check">
      <div class="check-item">
        <span class="check-icon">
          <AppIcon :name="parseFloat(gasBalance) < 0.1 ? 'check' : 'fail'" :size="16" :aria-label="parseFloat(gasBalance) < 0.1 ? t('statusPass') : t('statusFail')" />
        </span>
        <span class="check-text">{{ t("balanceCheck") }} ({{ formatBalance(gasBalance) }} {{ t("tokenGas") }})</span>
      </div>
      <div class="check-item">
        <span class="check-icon">
          <AppIcon :name="remainingQuota > 0 ? 'check' : 'fail'" :size="16" :aria-label="remainingQuota > 0 ? t('statusPass') : t('statusFail')" />
        </span>
        <span class="check-text">{{ t("quotaCheck") }} ({{ formatBalance(remainingQuota) }} {{ t("tokenGas") }})</span>
      </div>
      <div class="check-item">
        <span class="check-icon">
          <AppIcon :name="userAddress ? 'check' : 'fail'" :size="16" :aria-label="userAddress ? t('statusPass') : t('statusFail')" />
        </span>
        <span class="check-text">{{ t("walletCheck") }}</span>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  gasBalance: string;
  remainingQuota: number;
  userAddress: string;
}>();

const { t } = createUseI18n(messages)();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.eligibility-check {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}
.check-item {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  font-size: 10px;
  font-weight: $font-weight-bold;
}
.check-icon {
  font-weight: $font-weight-black;
  color: var(--neo-green);
}
</style>
