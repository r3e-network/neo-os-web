<template>
  <NeoCard variant="erobo" class="history-card">
    <text class="stats-title-glass">📜 {{ t("recentLoans") }}</text>
    <view v-if="recentLoans.length > 0" class="loans-table-glass">
      <view class="table-header-glass">
        <text class="th-glass th-loan">{{ t("loanId") }}</text>
        <text class="th-glass th-fee">{{ t("feeShort") }}</text>
        <text class="th-glass th-status">{{ t("statusLabel") }}</text>
        <text class="th-glass th-time">{{ t("timestamp") }}</text>
      </view>
      <view v-for="(loan, idx) in recentLoans" :key="idx" class="table-row-glass">
        <view class="td-glass td-loan">
          <text class="loan-id">#{{ loan.id }}</text>
          <text class="loan-amount">{{ formatNum(loan.amount) }} GAS</text>
        </view>
        <text class="td-glass td-fee">{{ formatNum(loan.fee, 4) }} GAS</text>
        <text class="td-glass td-status" :class="loan.status">{{ statusText(loan.status) }}</text>
        <text class="td-glass td-time">{{ loan.timestamp }}</text>
      </view>
    </view>
    <view v-else class="empty-state">
      <text class="empty-icon">📭</text>
      <text class="empty-text">{{ t("noHistory") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";

type LoanStatus = "success" | "failed";

const props = defineProps<{
  recentLoans: { id: number; amount: number; fee: number; status: LoanStatus; timestamp: string }[];
}>();

const { t } = createUseI18n(messages)();

const formatNum = (n: number, decimals = 2) => formatNumber(n, decimals);

const statusText = (status: LoanStatus) => {
  const map = {
    success: t("statusSuccess"),
    failed: t("statusFailed"),
  };
  return map[status] || status;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stats-title-glass {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: $spacing-4;
  display: block;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}
.loans-table-glass {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.table-header-glass {
  display: flex;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}
.th-glass {
  flex: 1;
  padding: $spacing-3;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.table-row-glass {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  &:last-child {
    border-bottom: none;
  }
}
.td-glass {
  flex: 1;
  padding: $spacing-3;
  font-size: 12px;
  font-family: $font-mono;
  font-weight: 700;
  color: var(--text-primary);
}
.td-loan {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.loan-id {
  font-size: 10px;
  opacity: 0.6;
}
.loan-amount {
  color: var(--flash-success);
}
.td-status {
  text-transform: uppercase;
  &.success {
    color: var(--flash-success);
  }
  &.failed {
    color: var(--flash-danger);
  }
}
.empty-state {
  text-align: center;
  padding: $spacing-6;
  opacity: 0.6;
  color: var(--text-primary);
}
.empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: $spacing-2;
}
.empty-text {
  font-size: 12px;
  font-weight: bold;
}
</style>
