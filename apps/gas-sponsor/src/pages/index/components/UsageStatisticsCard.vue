<template>
  <NeoCard variant="accent">
    <div class="stat-grid">
      <NeoCard variant="default" class="flex-1 text-center">
        <AppIcon name="gas" :size="24" class="stat-icon" />
        <span class="stat-value">{{ formatBalance(usedQuota) }}</span>
        <span class="stat-label">{{ t("usedToday") }}</span>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <AppIcon name="target" :size="24" class="stat-icon" />
        <span class="stat-value">{{ formatBalance(remainingQuota) }}</span>
        <span class="stat-label">{{ t("available") }}</span>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <AppIcon name="chart" :size="24" class="stat-icon" />
        <span class="stat-value">{{ formatBalance(dailyLimit) }}</span>
        <span class="stat-label">{{ t("dailyLimit") }}</span>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <AppIcon name="clock" :size="24" class="stat-icon" />
        <span class="stat-value">{{ resetTime }}</span>
        <span class="stat-label">{{ t("nextReset") }}</span>
      </NeoCard>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  usedQuota: string;
  remainingQuota: number;
  dailyLimit: string;
  resetTime: string;
}>();

const { t } = createUseI18n(messages)();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-2;
}
.stat-value {
  font-size: 14px;
  font-weight: $font-weight-black;
  font-family: $font-mono;
  display: block;
}
.stat-label {
  font-size: 8px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  opacity: 0.6;
}
</style>
