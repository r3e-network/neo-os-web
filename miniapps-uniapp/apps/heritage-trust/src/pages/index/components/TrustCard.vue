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
    <TrustAssetSection :trust="trust" />

    <!-- Beneficiary Card -->
    <TrustBeneficiaryCard :trust="trust" />

    <!-- Trigger Conditions -->
    <TrustTriggerTimeline :trust="trust" />

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
        <NeoButton
          v-if="!trust.executed"
          variant="warning"
          size="sm"
          :disabled="!trust.canExecute"
          @click="$emit('execute', trust)"
        >
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
import { NeoButton, NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import TrustAssetSection from "./TrustAssetSection.vue";
import TrustBeneficiaryCard from "./TrustBeneficiaryCard.vue";
import TrustTriggerTimeline from "./TrustTriggerTimeline.vue";

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
}>();

const { t } = createUseI18n(messages)();

defineEmits(["heartbeat", "claimYield", "execute", "claimReleased"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

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
  color: var(--heritage-success);
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
  color: var(--heritage-purple);
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
    color: var(--heritage-success);
    border-color: rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 15px rgba(0, 229, 153, 0.1);
  }
  &.pending {
    background: rgba(255, 222, 89, 0.05);
    color: var(--heritage-gold);
    border-color: rgba(255, 222, 89, 0.2);
  }
  &.triggered {
    background: rgba(239, 68, 68, 0.05);
    color: var(--heritage-danger);
    border-color: rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.1);
  }
  &.executed {
    background: rgba(148, 163, 184, 0.05);
    color: var(--heritage-muted);
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
