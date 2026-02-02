<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-self-loan" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
    <ErrorBoundary 
      @error="handleBoundaryError" 
      @retry="resetAndReload"
      :fallback-message="t('selfLoanErrorFallback')"
    >
      <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
        <text>{{ errorMessage }}</text>
        <view v-if="canRetryError" class="retry-actions">
          <NeoButton variant="secondary" size="sm" @click="retryLastOperation">
            {{ t('retry') }}
          </NeoButton>
        </view>
      </view>

      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <view v-if="activeTab === 'main'" class="tab-content">
        <NeoCard v-if="core.status" :variant="core.status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ core.status.msg }}</text>
        </NeoCard>

        <view v-if="!core.address" class="wallet-prompt mb-4">
          <NeoCard variant="warning" class="text-center">
            <text class="font-bold block mb-2">{{ t('connectWalletToUse') }}</text>
            <NeoButton variant="primary" size="sm" @click="connectWallet">
              {{ t('connectWallet') }}
            </NeoButton>
          </NeoCard>
        </view>

        <BorrowForm
          v-model="core.collateralAmount"
          v-model:selectedTier="core.selectedTier"
          :terms="core.borrowTerms"
          :ltv-options="core.ltvOptions"
          :platform-fee-bps="core.platformFeeBps"
          :is-loading="core.isLoading"
          :is-connected="!!core.address"
          :validation-error="validationError"
          :t="t as any"
          @takeLoan="handleTakeLoan"
        />

        <CollateralStatus
          :loan="core.loan"
          :available-collateral="core.neoBalance"
          :collateral-utilization="core.collateralUtilization"
          :t="t as any"
        />

        <PositionSummary
          :loan="core.loan"
          :terms="core.positionTerms"
          :health-factor="core.healthFactor"
          :current-l-t-v="core.currentLTV"
          :t="t as any"
        />
      </view>

      <StatsTab v-if="activeTab === 'stats'" :stats="history.stats" :loan-history="history.loanHistory" :t="t as any" />

      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>
    </ErrorBoundary>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { toFixedDecimals } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning, ErrorBoundary } from "@shared/components";
import PositionSummary from "./components/PositionSummary.vue";
import CollateralStatus from "./components/CollateralStatus.vue";
import BorrowForm from "./components/BorrowForm.vue";
import StatsTab from "./components/StatsTab.vue";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useSelfLoanCore } from "@/composables/useSelfLoanCore";
import { useSelfLoanHistory } from "@/composables/useSelfLoanHistory";

const { t } = useI18n();
const { handleError, getUserMessage, canRetry, clearError } = useErrorHandler();
const core = useSelfLoanCore();
const history = useSelfLoanHistory();

const navTabs = computed(() => [
  { id: "main", icon: "wallet", label: t("main") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("main");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const errorMessage = ref<string | null>(null);
const canRetryError = ref(false);
const validationError = ref<string | null>(null);
const lastOperation = ref<string | null>(null);

let errorClearTimer: ReturnType<typeof setTimeout> | null = null;

const showError = (msg: string, retryable = false) => {
  errorMessage.value = msg;
  canRetryError.value = retryable;
  if (errorClearTimer) clearTimeout(errorClearTimer);
  errorClearTimer = setTimeout(() => {
    errorMessage.value = null;
    canRetryError.value = false;
    errorClearTimer = null;
  }, 5000);
};

const connectWallet = async () => {
  try {
    await core.connect();
  } catch (e) {
    handleError(e, { operation: "connectWallet" });
    showError(getUserMessage(e));
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "selfLoanBoundaryError" });
  showError(t("selfLoanErrorFallback"));
};

const resetAndReload = async () => {
  clearError();
  errorMessage.value = null;
  canRetryError.value = false;
  await fetchData();
};

const retryLastOperation = () => {
  if (lastOperation.value === 'takeLoan') {
    handleTakeLoan();
  }
};

const handleTakeLoan = async (): Promise<void> => {
  if (core.isLoading.value) return;
  
  const validation = core.validateCollateral(core.collateralAmount.value, core.neoBalance.value);
  if (validation) {
    validationError.value = validation;
    core.status.value = { msg: validation, type: "error" };
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
    } catch (e) {
      handleError(e, { operation: "connectBeforeTakeLoan" });
      core.status.value = { msg: getUserMessage(e), type: "error" };
      return;
    }
  }

  if (!core.address.value) {
    core.status.value = { msg: t("connectWallet"), type: "error" };
    return;
  }

  core.isLoading.value = true;
  lastOperation.value = 'takeLoan';
  
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

    core.status.value = { msg: t("loanApproved").replace("{amount}", core.fmt(netBorrow, 2)), type: "success" };
    core.collateralAmount.value = "";
    await fetchData();
  } catch (e: any) {
    handleError(e, { operation: "takeLoan", metadata: { collateral, tier: core.selectedTier.value } });
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    core.status.value = { msg: userMsg, type: "error" };
    if (retryable) {
      showError(userMsg, true);
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
  } catch (e) {
    handleError(e, { operation: "fetchData" });
    showError(getUserMessage(e), canRetry(e));
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

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
