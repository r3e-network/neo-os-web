<template>
  <MiniAppPage
    name="self-loan"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="core.status.value"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <!-- Main Tab (default) — LEFT panel -->
    <template #content>
      <view v-if="!core.address.value" class="wallet-prompt mb-4">
        <NeoCard variant="warning" class="text-center">
          <text class="mb-2 block font-bold">{{ t("connectWalletToUse") }}</text>
          <NeoButton variant="primary" size="sm" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </view>

      <CollateralStatus
        :loan="core.loan.value"
        :available-collateral="core.neoBalance.value"
        :collateral-utilization="core.collateralUtilization.value"
        :t="t"
      />

      <PositionSummary
        :loan="core.loan.value"
        :terms="core.positionTerms.value"
        :health-factor="core.healthFactor.value"
        :current-l-t-v="core.currentLTV.value"
        :t="t"
      />
    </template>

    <!-- Main Tab — RIGHT panel -->
    <template #operation>
      <BorrowForm
        v-model="core.collateralAmount.value"
        v-model:selectedTier="core.selectedTier.value"
        :terms="core.borrowTerms.value"
        :ltv-options="core.ltvOptions.value"
        :platform-fee-bps="core.platformFeeBps.value"
        :is-loading="core.isLoading.value"
        :is-connected="!!core.address.value"
        :validation-error="validationError"
        :t="t"
        @takeLoan="handleTakeLoan"
      />
    </template>

    <!-- Stats Tab -->
    <template #tab-stats>
      <StatsTab :row-items="statsRowItems" :rows-title="t('loanStatsTitle')">
        <view class="stats-card">
          <text class="stats-title">{{ t("loanHistory") }}</text>
          <view v-for="(item, idx) in history.loanHistory.value" :key="idx" class="history-item">
            <text>{{ item.icon }} {{ item.label }}: {{ fmt(item.amount as number) }} GAS - {{ item.timestamp }}</text>
          </view>
          <text v-if="history.loanHistory.value.length === 0" class="empty-text">{{ t("noHistory") }}</text>
        </view>
      </StatsTab>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
import PositionSummary from "./components/PositionSummary.vue";
import CollateralStatus from "./components/CollateralStatus.vue";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useSelfLoanCore } from "@/composables/useSelfLoanCore";
import { useSelfLoanHistory } from "@/composables/useSelfLoanHistory";

const { handleError, canRetry, clearError } = useErrorHandler();
const core = useSelfLoanCore();
const history = useSelfLoanHistory();

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "self-loan",
  messages,
  template: {
    tabs: [
      { key: "main", labelKey: "main", icon: "💰", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "sidebarHasLoan", value: () => (core.loan.value ? t("sidebarYes") : t("sidebarNo")) },
    { labelKey: "sidebarNeoBalance", value: () => core.neoBalance.value ?? "—" },
    { labelKey: "healthFactor", value: () => core.healthFactor.value ?? "—" },
    { labelKey: "currentLTV", value: () => (core.currentLTV.value != null ? `${core.currentLTV.value}%` : "—") },
  ],
  fallbackMessageKey: "selfLoanErrorFallback",
  statusTimeoutMs: 5000,
});

const appState = computed(() => ({
  hasLoan: !!core.loan.value,
  isConnected: !!core.address.value,
}));
const canRetryError = ref(false);
const connectWallet = async () => {
  try {
    await core.connect();
  } catch (e: unknown) {
    handleError(e, { operation: "connectWallet" });
    setStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const resetAndReload = async () => {
  clearError();
  clearStatus();
  canRetryError.value = false;
  await loadData();
};
const loadData = async () => {
  try {
    if (!core.address.value) {
      await core.connect();
    }
    if (!core.address.value) return;

    await core.loadBalance();
    await core.loadPlatformStats();
    await history.loadHistory();
  } catch (e: unknown) {
    handleError(e, { operation: "loadData" });
    setStatus(formatErrorMessage(e, t("error")), "error");
    canRetryError.value = canRetry(e);
  }
};

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./self-loan-theme.scss";

:global(page) {
  background: var(--checkbook-bg);
  font-family: var(--font-family-mono, "Courier New", monospace);
}

.wallet-prompt {
  margin-bottom: 16px;
}

.stats-card {
  background: var(--bg-card);
  border: $border-width-md solid var(--border-color);
  box-shadow: $shadow-md;
  padding: $spacing-4;
  margin-bottom: $spacing-3;
}

.stats-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--neo-green);
  text-transform: uppercase;
  display: block;
  margin-bottom: $spacing-3;
}

.history-item {
  padding: $spacing-2 0;
  border-bottom: $border-width-sm dashed var(--border-color);
  font-size: $font-size-sm;
  color: var(--text-primary);
  &:last-child {
    border-bottom: none;
  }
}

.empty-text {
  font-style: italic;
  color: var(--text-muted);
  text-align: center;
  display: block;
  padding: $spacing-4;
}
</style>
