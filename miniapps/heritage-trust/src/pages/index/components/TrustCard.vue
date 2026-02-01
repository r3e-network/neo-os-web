<template>
  <NeoCard variant="erobo" class="trust-document-card">
    <view class="official-banner">{{ t("officialTrust") }}</view>
    
    <!-- Document Header -->
    <view class="document-header">
      <view class="document-seal">
        <text class="seal-icon">{{ trust.icon }}</text>
        <text class="seal-text">{{ t("sealed") }}</text>
      </view>
      <view class="document-status" :class="trust.status">
        <text class="status-dot">●</text>
        <text class="status-text">{{ t(trust.status) }}</text>
      </view>
    </view>

    <!-- Trust Title -->
    <view class="document-title">
      <text class="title-text">{{ trust.name }}</text>
      <text class="title-subtitle">{{ t("trustDocument") }}</text>
    </view>

    <!-- Asset Allocation -->
    <view class="asset-section">
      <view class="asset-header">
        <text class="asset-label">{{ t("totalAssets") }}</text>
      </view>
      <view class="dual-assets">
        <view class="asset-item neo">
          <AppIcon name="neo" :size="20" class="asset-icon" />
          <view class="asset-info">
            <text class="asset-amount">{{ trust.neoValue }}</text>
            <text class="asset-symbol">NEO</text>
          </view>
          <view v-if="trust.neoValue > 0" class="stake-badge">
            <text class="stake-icon">🍔</text>
            <text class="stake-text">STAKED</text>
          </view>
        </view>
        <view v-if="trust.gasPrincipal > 0" class="asset-item gas">
          <AppIcon name="gas" :size="20" class="asset-icon" />
          <view class="asset-info">
            <text class="asset-amount">{{ trust.gasPrincipal.toFixed(4) }}</text>
            <text class="asset-symbol">GAS</text>
          </view>
        </view>
      </view>
      <view class="release-summary">
        <text class="release-label">{{ t("releasePlan") }}</text>
        <text v-if="trust.releaseMode === 'rewards_only'" class="release-value">{{ t("releaseRewardsOnlySummary") }}</text>
        <text v-else-if="trust.releaseMode === 'fixed'" class="release-value">
          {{ t("releaseFixedSummary", { neo: trust.monthlyNeo, gas: trust.monthlyGas.toFixed(4) }) }}
        </text>
        <text v-else class="release-value">{{ t("releaseNeoRewardsSummary", { neo: trust.monthlyNeo }) }}</text>
      </view>
    </view>

    <!-- Beneficiary Card -->
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

    <!-- Trigger Conditions -->
    <view class="trigger-section">
      <view class="trigger-header">
        <text class="trigger-icon">⏱️</text>
        <text class="trigger-label">{{ t("triggerCondition") }}</text>
      </view>
      <view class="trigger-timeline">
        <view class="timeline-item">
          <view class="timeline-dot active"></view>
          <view class="timeline-content">
            <text class="timeline-title">{{ t("trustCreated") }}</text>
            <text class="timeline-date">{{ trust.createdTime }}</text>
          </view>
        </view>
        <view class="timeline-line"></view>
        <view v-if="!trust.executed" class="timeline-item">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">{{ t("inactivityPeriod") }}</text>
            <text class="timeline-date">
              {{ trust.daysRemaining > 0 ? `${trust.daysRemaining} ${t("days")}` : t("ready") }}
            </text>
          </view>
        </view>
        <view v-else class="timeline-item">
          <view class="timeline-dot active"></view>
          <view class="timeline-content">
            <text class="timeline-title">{{ t("releaseSchedule") }}</text>
            <view class="release-progress">
              <text class="progress-text">{{ t("readyToClaim") }}: {{ trust.accruedYield.toFixed(4) }} GAS</text>
            </view>
          </view>
        </view>
        <view class="timeline-line"></view>
        <view class="timeline-item">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">{{ t("trustActivates") }}</text>
            <text class="timeline-date">{{ trust.deadline }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="document-actions">
      <template v-if="trust.role === 'owner'">
        <NeoButton v-if="!trust.executed" variant="secondary" size="sm" @click="$emit('heartbeat', trust)">
          {{ t("heartbeat") }}
        </NeoButton>
        <NeoButton v-if="!trust.executed" variant="primary" size="sm" @click="$emit('claimYield', trust)">
          {{ t("claimYield") }}
        </NeoButton>
      </template>
      <template v-else>
        <NeoButton v-if="!trust.executed" variant="warning" size="sm" :disabled="!trust.canExecute" @click="$emit('execute', trust)">
          {{ t("executeTrust") }}
        </NeoButton>
        <NeoButton v-else variant="primary" size="sm" @click="$emit('claimReleased', trust)">
          {{ t("claimReleased") }}
        </NeoButton>
      </template>
    </view>

    <!-- Document Footer -->
    <view class="document-footer">
      <text class="footer-text">{{ t("documentId") }}: {{ trust.id }}</text>
      <text class="footer-signature">✍️ {{ t("digitalSignature") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { AppIcon, NeoButton, NeoCard } from "@shared/components";

export interface Trust {
  id: string;
  name: string;
  beneficiary: string;
  neoValue: number;
  gasPrincipal: number;
  accruedYield: number;
  claimedYield: number;
  monthlyNeo: number;
  monthlyGas: number;
  onlyRewards: boolean;
  releaseMode: "fixed" | "neo_rewards" | "rewards_only";
  totalNeoReleased: number;
  totalGasReleased: number;
  createdTime: string;
  icon: string;
  status: "active" | "pending" | "triggered" | "executed";
  daysRemaining: number;
  deadline: string;
  canExecute: boolean;
  role: "owner" | "beneficiary";
  executed: boolean;
}

defineProps<{
  trust: Trust;
  t: (key: string) => string;
}>();

defineEmits(["heartbeat", "claimYield", "execute", "claimReleased"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.trust-document-card {
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
  background: var(--heritage-card-bg) !important;
  border: 1px solid var(--heritage-card-border) !important;
}

.official-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: linear-gradient(to right, rgba(0, 229, 153, 0.1), transparent, rgba(0, 229, 153, 0.1));
  color: #00e599;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(0, 229, 153, 0.2);
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 36px 0 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--heritage-divider);
}

.document-seal {
  background: rgba(159, 157, 243, 0.08);
  color: #9f9df3;
  padding: 6px 16px;
  border-radius: 12px;
  border: 1px solid rgba(159, 157, 243, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.seal-icon {
  font-size: 16px;
}

.seal-text {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.document-status {
  padding: 6px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: 800;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  &.active {
    background: rgba(0, 229, 153, 0.05);
    color: #00e599;
    border-color: rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 15px rgba(0, 229, 153, 0.1);
  }
  &.pending {
    background: rgba(255, 222, 89, 0.05);
    color: #ffde59;
    border-color: rgba(255, 222, 89, 0.2);
  }
  &.triggered {
    background: rgba(239, 68, 68, 0.05);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.1);
  }
  &.executed {
    background: rgba(148, 163, 184, 0.05);
    color: #94a3b8;
    border-color: rgba(148, 163, 184, 0.2);
  }
}

.document-title {
  text-align: left;
  margin: 20px 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 16px;
}

.title-text {
  font-size: 22px;
  font-weight: 900;
  display: block;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.title-subtitle {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  display: block;
  opacity: 0.6;
}

.asset-section {
  margin-bottom: 24px;
}

.asset-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.asset-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}

.dual-assets {
  display: flex;
  gap: 12px;
}

.release-summary {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.release-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}

.release-value {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.4;
}

.asset-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
  position: relative;

  &.neo {
    border-color: rgba(0, 229, 153, 0.15);
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.05), transparent);
  }

  &.gas {
    border-color: rgba(255, 222, 89, 0.15);
    background: linear-gradient(135deg, rgba(255, 222, 89, 0.05), transparent);
  }
}

.asset-info {
  display: flex;
  flex-direction: column;
}

.stake-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  background: #00e599;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.stake-icon {
  font-size: 8px;
}

.stake-text {
  font-size: 8px;
  font-weight: 900;
  color: #000;
  letter-spacing: 0.05em;
}

.asset-amount {
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--text-primary);
  line-height: 1;
}

.asset-symbol {
  font-size: 9px;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-top: 2px;
}

.release-progress {
  margin-top: 4px;
}

.progress-text {
  font-size: 10px;
  color: #00e599;
  font-weight: 700;
}

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
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
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

.trigger-section {
  background: rgba(255, 255, 255, 0.01);
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  margin-bottom: 24px;
}

.trigger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.trigger-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.trigger-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  
  &.active {
    background: #00e599;
    border-color: rgba(0, 229, 153, 0.4);
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.3);
  }
}

.timeline-content {
  display: flex;
  justify-content: space-between;
  flex: 1;
}

.timeline-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.8;
}

.timeline-date {
  font-size: 11px;
  color: #ffde59;
  font-weight: 700;
}

.document-actions {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

:deep(.neo-button) {
  flex: 1;
}

.document-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 12px;
  color: var(--text-secondary);
  opacity: 0.5;
}

.footer-signature {
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 12px;
  border-radius: 20px;
  color: var(--text-primary);
  opacity: 1;
}
</style>
