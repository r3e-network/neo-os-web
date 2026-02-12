<template>
  <view class="theme-self-loan">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="core.status.value"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab (default) — LEFT panel -->
      <template #content>
        <ErrorBoundary
          @error="handleBoundaryError"
          @retry="resetAndReload"
          :fallback-message="t('selfLoanErrorFallback')"
        >
          <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
            <text>{{ errorMessage }}</text>
            <view v-if="canRetryError" class="retry-actions">
              <NeoButton variant="secondary" size="sm" @click="retryLastOperation">
                {{ t("retry") }}
              </NeoButton>
            </view>
          </view>

          <NeoCard
            v-if="core.status.value"
            :variant="core.status.value?.type === 'error' ? 'danger' : 'success'"
            class="mb-4 text-center"
          >
            <text class="font-bold">{{ core.status.value?.msg }}</text>
          </NeoCard>

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
        </ErrorBoundary>
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
        <StatsTab :stats="history.stats.value" :loan-history="history.loanHistory.value" :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { toFixedDecimals } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import PositionSummary from "./components/PositionSummary.vue";
import CollateralStatus from "./components/CollateralStatus.vue";
import BorrowForm from "./components/BorrowForm.vue";
import StatsTab from "./components/StatsTab.vue";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useSelfLoanCore } from "@/composables/useSelfLoanCore";
import { useSelfLoanHistory } from "@/composables/useSelfLoanHistory";

const { t } = useI18n();
const { handleError, canRetry, clearError } = useErrorHandler();
const core = useSelfLoanCore();
const history = useSelfLoanHistory();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "main", icon: "💰", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("main");

const appState = computed(() => ({
  hasLoan: !!core.loan.value,
  isConnected: !!core.address.value,
}));

const sidebarItems = computed(() => [
  { label: "Has Loan", value: core.loan.value ? "Yes" : "No" },
  { label: "NEO Balance", value: core.neoBalance.value ?? "—" },
  { label: "Health Factor", value: core.healthFactor.value ?? "—" },
  { label: "Current LTV", value: core.currentLTV.value != null ? `${core.currentLTV.value}%` : "—" },
]);

const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const errorMessage = computed(() => errorStatus.value?.msg ?? null);
const canRetryError = ref(false);
const validationError = ref<string | null>(null);
const lastOperation = ref<string | null>(null);

const connectWallet = async () => {
  try {
    await core.connect();
  } catch (e: unknown) {
    handleError(e, { operation: "connectWallet" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "selfLoanBoundaryError" });
  setErrorStatus(t("selfLoanErrorFallback"), "error");
};

const resetAndReload = async () => {
  clearError();
  clearErrorStatus();
  canRetryError.value = false;
  await fetchData();
};

const retryLastOperation = () => {
  if (lastOperation.value === "takeLoan") {
    handleTakeLoan();
  }
};

const handleTakeLoan = async (): Promise<void> => {
  if (core.isLoading.value) return;

  const validation = core.validateCollateral(core.collateralAmount.value, core.neoBalance.value);
  if (validation) {
    validationError.value = validation;
    core.setStatus(validation, "error");
    return;
  }
  validationError.value = null;

  const collateral = Number(toFixedDecimals(core.collateralAmount.value, 0));
  const ltvPercent = core.selectedLtvPercent.value;
  const feeBps = core.platformFeeBps.value;
  const grossBorrow = (collateral * ltvPercent) / 100;
  const feeAmount = (grossBorrow * feeBps) / 10000;
  const netBorrow = Math.max(grossBorrow - feeAmount, 0);

  if (!core.address.value) {
    try {
      await core.connect();
    } catch (e: unknown) {
      handleError(e, { operation: "connectBeforeTakeLoan" });
      core.setStatus(formatErrorMessage(e, t("error")), "error");
      return;
    }
  }

  if (!core.address.value) {
    core.setStatus(t("connectWallet"), "error");
    return;
  }

  core.isLoading.value = true;
  lastOperation.value = "takeLoan";

  try {
    const selfLoanAddress = await core.ensureContractAddress();

    await core.invokeContract({
      scriptHash: selfLoanAddress,
      operation: "CreateLoan",
      args: [
        { type: "Hash160", value: core.address.value },
        { type: "Integer", value: collateral },
        { type: "Integer", value: core.selectedTier.value },
      ],
    });

    core.setStatus(t("loanApproved").replace("{amount}", core.fmt(netBorrow, 2)), "success");
    core.collateralAmount.value = "";
    await fetchData();
  } catch (e: unknown) {
    handleError(e, { operation: "takeLoan", metadata: { collateral, tier: core.selectedTier.value } });
    const userMsg = formatErrorMessage(e, t("error"));
    const retryable = canRetry(e);
    core.setStatus(userMsg, "error");
    if (retryable) {
      setErrorStatus(userMsg, "error");
      canRetryError.value = true;
    }
  } finally {
    core.isLoading.value = false;
  }
};

const fetchData = async () => {
  try {
    if (!core.address.value) {
      await core.connect();
    }
    if (!core.address.value) return;

    await core.fetchBalance();
    await core.loadPlatformStats();
    await history.loadHistory();
  } catch (e: unknown) {
    handleError(e, { operation: "fetchData" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
    canRetryError.value = canRetry(e);
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./self-loan-theme.scss";

:global(page) {
  background: var(--checkbook-bg);
  font-family: "Courier New", Courier, monospace;
}

.wallet-prompt {
  margin-bottom: 16px;
}

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--checkbook-danger-bg, rgba(239, 68, 68, 0.95));
  color: var(--checkbook-button-text);
  padding: 12px 24px;
  border-radius: 2px;
  font-weight: 700;
  font-size: 14px;
  font-family: "Courier New", Courier, monospace;
  z-index: 3000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: toast-in 0.3s ease-out;
  max-width: 90%;
  text-align: center;
}

.error-toast.error-retryable {
  padding-bottom: 48px;
}

.retry-actions {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes toast-in {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

.tab-content {
  padding: 16px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background-color: var(--checkbook-bg);
  background-image: repeating-linear-gradient(transparent, transparent 19px, var(--checkbook-line) 20px);
  background-attachment: local;
}

:deep(.neo-card) {
  background: var(--checkbook-card-bg) !important;
  border: 1px solid var(--checkbook-line) !important;
  border-radius: 2px !important;
  box-shadow: var(--checkbook-card-shadow) !important;
  color: var(--checkbook-text) !important;
  font-family: "Courier New", Courier, monospace !important;
  margin-bottom: 20px !important;

  &.variant-danger {
    border-color: var(--checkbook-danger-border) !important;
    background: var(--checkbook-danger-bg) !important;
  }

  &.variant-warning {
    border-color: var(--checkbook-accent) !important;
  }
}

:deep(.neo-button) {
  border-radius: 4px !important;
  font-family: "Courier New", Courier, monospace !important;
  font-weight: 700 !important;
  text-transform: capitalize !important;
  letter-spacing: 0 !important;

  &.variant-primary {
    background: var(--checkbook-accent) !important;
    color: var(--checkbook-button-text) !important;
    border: none !important;

    &:active {
      opacity: 0.8;
    }
  }
}

:deep(input),
:deep(.neo-input) {
  font-family: "Courier New", Courier, monospace !important;
  border: none !important;
  border-bottom: 1px solid var(--checkbook-line) !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding-left: 0 !important;
  color: var(--checkbook-text) !important;

  &:focus {
    border-bottom: 2px solid var(--checkbook-accent) !important;
    box-shadow: none !important;
  }
}

:deep(.text-center) {
  text-align: center;
}

:deep(.font-bold) {
  font-weight: bold;
}

</style>
