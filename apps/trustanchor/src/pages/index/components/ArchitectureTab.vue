<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";
import type { TrustAnchorStats } from "../composables/useTrustAnchor";

defineProps<{
  stats: TrustAnchorStats | null;
  slotCount: number;
}>();

const { t } = createUseI18n(messages)();
const formatNum = (n: number | string) => formatNumber(n, 2);
</script>

<template>
  <NeoCard variant="erobo" class="px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("philosophy") }}</span>
    </div>
    <span class="copy-text">{{ t("philosophyText") }}</span>
  </NeoCard>

  <NeoCard variant="erobo" class="mt-4 px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("liveAccountingTitle") }}</span>
    </div>
    <div class="stats-detail">
      <div class="stat-row">
        <span class="stat-label">{{ t("totalStaked") }}</span>
        <span class="stat-value">{{ formatNum(stats?.totalStaked ?? 0) }} {{ t("tokenNeo") }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ t("rewardPerStake") }}</span>
        <span class="stat-value">{{ stats?.rps ?? "0" }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ t("agentAccountsLabel") }}</span>
        <span class="stat-value">{{ slotCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ t("defaultIngressLabel") }}</span>
        <span class="stat-value">21</span>
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

  <NeoCard variant="erobo" class="mt-4 px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("adminControlTitle") }}</span>
    </div>
    <div class="admin-points">
      <span class="admin-point">{{ t("adminControl1") }}</span>
      <span class="admin-point">{{ t("adminControl2") }}</span>
      <span class="admin-point">{{ t("adminControl3") }}</span>
    </div>
  </NeoCard>
</template>

<style lang="scss" scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: 800;
}

.copy-text {
  font-size: 14px;
  line-height: 1.7;
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
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 12px;
  opacity: 0.66;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  text-align: right;
}

.steps-list,
.admin-points {
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
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.18);
  color: #10b981;
  font-size: 12px;
  font-weight: 800;
}

.step-text,
.admin-point {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.9;
}
</style>
