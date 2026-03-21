<template>
  <NeoCard variant="erobo" class="vault-details">
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("vaultStatus") }}</span>
      <span class="detail-value">{{ statusLabel(details.status) }}</span>
    </div>
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("difficultyLabel") }}</span>
      <span class="detail-value">{{ details.difficultyName }}</span>
    </div>
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("creator") }}</span>
      <span class="detail-value mono">{{ details.creator ? formatAddress(details.creator) : t("notAvailable") }}</span>
    </div>
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("bountyLabel") }}</span>
      <span class="detail-value">{{ formatGas(details.bounty) }} {{ t("tokenGas") }}</span>
    </div>
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("expiryLabel") }}</span>
      <span class="detail-value">{{ formatExpiryDate(details.expiryTime) }}</span>
    </div>
    <div class="vault-detail-row" v-if="details.status === 'active'">
      <span class="detail-label">{{ t("remainingDaysLabel") }}</span>
      <span class="detail-value">{{ details.remainingDays }}</span>
    </div>
    <div class="vault-detail-row">
      <span class="detail-label">{{ t("attempts") }}</span>
      <span class="detail-value">{{ details.attempts }}</span>
    </div>
    <div class="vault-detail-row" v-if="details.broken">
      <span class="detail-label">{{ t("winner") }}</span>
      <span class="detail-value mono">{{ details.winner ? formatAddress(details.winner) : t("notAvailable") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatAddress, formatGas } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
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

const { t } = createUseI18n(messages)();

const formatExpiryDate = (expiryTime: number): string => {
  if (!expiryTime) return t("notAvailable");
  return new Date(expiryTime * 1000).toLocaleDateString("en");
};

const statusLabel = (status: string): string => {
  if (status === "broken") return t("broken");
  if (status === "expired") return t("expired");
  if (status === "claimable") return t("claimable");
  return t("active");
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
