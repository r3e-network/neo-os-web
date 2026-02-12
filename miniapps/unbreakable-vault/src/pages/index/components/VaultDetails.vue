<template>
  <NeoCard variant="erobo" class="vault-details">
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("vaultStatus") }}</text>
      <text class="detail-value">{{ statusLabel(details.status) }}</text>
    </view>
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("difficultyLabel") }}</text>
      <text class="detail-value">{{ details.difficultyName }}</text>
    </view>
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("creator") }}</text>
      <text class="detail-value mono">{{ formatAddress(details.creator) }}</text>
    </view>
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("bountyLabel") }}</text>
      <text class="detail-value">{{ formatGas(details.bounty) }} GAS</text>
    </view>
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("expiryLabel") }}</text>
      <text class="detail-value">{{ formatExpiryDate(details.expiryTime) }}</text>
    </view>
    <view class="vault-detail-row" v-if="details.status === 'active'">
      <text class="detail-label">{{ t("remainingDaysLabel") }}</text>
      <text class="detail-value">{{ details.remainingDays }}</text>
    </view>
    <view class="vault-detail-row">
      <text class="detail-label">{{ t("attempts") }}</text>
      <text class="detail-value">{{ details.attempts }}</text>
    </view>
    <view class="vault-detail-row" v-if="details.broken">
      <text class="detail-label">{{ t("winner") }}</text>
      <text class="detail-value mono">{{ formatAddress(details.winner) }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatAddress, formatGas } from "@shared/utils/format";

const props = defineProps<{
  t: (key: string) => string;
  details: {
    id: string;
    creator: string;
    bounty: number;
    attempts: number;
    broken: boolean;
    expired: boolean;
    status: string;
    winner: string;
    difficultyName: string;
    expiryTime: number;
    remainingDays: number;
  };
}>();

const formatExpiryDate = (expiryTime: number): string => {
  if (!expiryTime) return "-";
  return new Date(expiryTime * 1000).toLocaleDateString();
};

const statusLabel = (status: string): string => {
  if (status === "broken") return props.t("broken");
  if (status === "expired") return props.t("expired");
  if (status === "claimable") return props.t("claimable");
  return props.t("active");
};
</script>

<style lang="scss" scoped>
.vault-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.vault-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--vault-divider);
  padding-bottom: 8px;
}
.vault-detail-row:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: 12px;
  text-transform: uppercase;
}
.detail-value {
  font-weight: 700;
  font-size: 14px;
}
.mono {
  font-family: monospace;
}
</style>
