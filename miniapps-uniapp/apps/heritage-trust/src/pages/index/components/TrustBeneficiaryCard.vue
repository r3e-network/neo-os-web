<template>
  <view class="beneficiary-card">
    <view class="beneficiary-header">
      <text class="beneficiary-icon">👤</text>
      <text class="beneficiary-label">{{ t("beneficiary") }}</text>
    </view>
    <text class="beneficiary-address">{{ trust.beneficiary }}</text>
    <view class="beneficiary-allocation">
      <text class="allocation-label">{{ t("allocation") }}:</text>
      <text class="allocation-value">100%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Trust } from "./TrustCard.vue";

defineProps<{
  trust: Trust;
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.beneficiary-card {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 24px;
}

.beneficiary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.beneficiary-label {
  @include stat-label;
  font-weight: 800;
  font-size: 10px;
  color: var(--text-secondary);
}

.beneficiary-address {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: block;
  word-break: break-all;
  color: var(--text-primary);
  opacity: 0.9;
}

.beneficiary-allocation {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
</style>
