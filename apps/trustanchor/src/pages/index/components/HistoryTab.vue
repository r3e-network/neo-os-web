<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";
import type { TrustAnchorStats } from "../composables/useTrustAnchor";

interface Props {
  stats: TrustAnchorStats | null;
}

defineProps<Props>();

const { t } = createUseI18n(messages)();
const formatNum = (n: number | string) => formatNumber(n, 2);
</script>

<template>
  <NeoCard variant="erobo" class="px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("philosophy") }}</span>
    </div>
    <span class="philosophy-text">{{ t("philosophyText") }}</span>
  </NeoCard>

  <NeoCard variant="erobo" class="mt-4 px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("statsTitle") }}</span>
    </div>

    <div class="stats-detail">
      <div class="stat-row">
        <span class="stat-label">{{ t("totalStaked") }}</span>
        <span class="stat-value">{{ formatNum(stats?.totalStaked ?? 0) }} NEO</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ t("agentsLabel") }}</span>
        <span class="stat-value">{{ stats?.agentCount ?? 0 }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ t("rpsLabel") }}</span>
        <span class="stat-value">{{ stats?.rps ?? "0" }}</span>
      </div>
    </div>
  </NeoCard>

  <NeoCard variant="erobo" class="mt-4 px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("howItWorks") }}</span>
    </div>
    <div class="steps-list">
      <div class="step-item">
        <span class="step-num">1</span>
        <span class="step-text">{{ t("step1") }}</span>
      </div>
      <div class="step-item">
        <span class="step-num">2</span>
        <span class="step-text">{{ t("step2") }}</span>
      </div>
      <div class="step-item">
        <span class="step-num">3</span>
        <span class="step-text">{{ t("step3") }}</span>
      </div>
      <div class="step-item">
        <span class="step-num">4</span>
        <span class="step-text">{{ t("step4") }}</span>
      </div>
    </div>
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
