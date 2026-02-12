<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";
import type { TrustAnchorStats } from "../composables/useTrustAnchor";

interface Props {
  stats: TrustAnchorStats | null;
}

defineProps<Props>();

const { t } = useI18n();
const formatNum = (n: number | string) => formatNumber(n, 2);
</script>

<template>
  <NeoCard variant="erobo" class="px-1">
    <view class="section-header mb-4">
      <text class="section-title">{{ t("philosophy") }}</text>
    </view>
    <text class="philosophy-text">{{ t("philosophyText") }}</text>
  </NeoCard>

  <NeoCard variant="erobo" class="mt-4 px-1">
    <view class="section-header mb-4">
      <text class="section-title">{{ t("statsTitle") }}</text>
    </view>

    <view class="stats-detail">
      <view class="stat-row">
        <text class="stat-label">{{ t("totalStaked") }}</text>
        <text class="stat-value">{{ formatNum(stats?.totalStaked ?? 0) }} NEO</text>
      </view>
      <view class="stat-row">
        <text class="stat-label">{{ t("delegatorsLabel") }}</text>
        <text class="stat-value">{{ stats?.totalDelegators ?? 0 }}</text>
      </view>
      <view class="stat-row">
        <text class="stat-label">{{ t("votePowerLabel") }}</text>
        <text class="stat-value">{{ formatNum(stats?.totalVotePower ?? 0) }}</text>
      </view>
      <view class="stat-row">
        <text class="stat-label">{{ t("aprLabel") }}</text>
        <text class="stat-value text-green">{{ ((stats?.estimatedApr ?? 0) * 100).toFixed(1) }}%</text>
      </view>
    </view>
  </NeoCard>

  <NeoCard variant="erobo" class="mt-4 px-1">
    <view class="section-header mb-4">
      <text class="section-title">{{ t("howItWorks") }}</text>
    </view>
    <view class="steps-list">
      <view class="step-item">
        <text class="step-num">1</text>
        <text class="step-text">{{ t("step1") }}</text>
      </view>
      <view class="step-item">
        <text class="step-num">2</text>
        <text class="step-text">{{ t("step2") }}</text>
      </view>
      <view class="step-item">
        <text class="step-num">3</text>
        <text class="step-text">{{ t("step3") }}</text>
      </view>
      <view class="step-item">
        <text class="step-num">4</text>
        <text class="step-text">{{ t("step4") }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
}

.philosophy-text {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.9;
}

.stats-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-row:last-child {
  border-bottom: none;
}

.mt-4 {
  margin-top: 16px;
}

.text-green {
  color: var(--trustanchor-success);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--erobo-purple);
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.step-text {
  font-size: 14px;
  opacity: 0.9;
}
</style>
