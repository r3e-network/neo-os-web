<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <ErrorBoundary 
      @error="handleBoundaryError" 
      @retry="resetAndReload"
      :fallback-message="t('flashloanErrorFallback')"
    >
      <!-- Error Toast with Retry -->
      <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
        <text>{{ errorMessage }}</text>
        <view v-if="canRetryError" class="retry-actions">
          <NeoButton variant="secondary" size="sm" @click="retryLastOperation">
            {{ t('retry') }}
          </NeoButton>
        </view>
      </view>

      <!-- Main Tab -->
      <view v-if="activeTab === 'main'" class="tab-content theme-flashloan">
        <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

        <LoanRequest
          v-model:loanId="loanIdInput"
          :loan-details="loanDetails"
          :is-loading="isLoading"
          :validation-error="validationError"
          :is-connected="!!address"
          :status="status"
          :t="t"
          @connect="connectWallet"
          @lookup="handleLookup"
          @request-loan="handleRequestLoan"
        />
      </view>

      <!-- Stats Tab -->
      <view v-if="activeTab === 'stats'" class="tab-content scrollable theme-flashloan">
        <ActiveLoans
          :pool-balance="poolBalance"
          :stats="stats"
          :recent-loans="recentLoans"
          :t="t"
        />

        <LoanCalculator :t="t" />
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content scrollable theme-flashloan">
        <FlashloanDocs :t="t" :contract-address="contractAddress" />
      </view>
    </ErrorBoundary>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoButton, ChainWarning, ErrorBoundary } from "@shared/components";
import { useErrorHandler } from "@shared/composables/useErrorHandler";

import { useFlashloanCore } from "@/composables/useFlashloanCore";
import LoanRequest from "./components/LoanRequest.vue";
import ActiveLoans from "./components/ActiveLoans.vue";
import LoanCalculator from "./components/LoanCalculator.vue";
import FlashloanDocs from "./components/FlashloanDocs.vue";

const { t } = useI18n();
const { handleError, getUserMessage, canRetry, clearError } = useErrorHandler();

const {
  address,
  connect,
  chainType,
  contractAddress,
  poolBalance,
  loanIdInput,
  loanDetails,
  stats,
  recentLoans,
  isLoading,
  validationError,
  lastOperation,
  navTabs,
  validateLoanId,
  validateLoanRequest,
  fetchData,
  ensureContractAddress,
  toFixed8,
  buildLoanDetails,
  invokeRead,
  invokeContract,
} = useFlashloanCore();

const activeTab = ref("main");
const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
const errorMessage = ref<string | null>(null);
const canRetryError = ref(false);

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
    await connect();
  } catch (e) {
    handleError(e, { operation: "connectWallet" });
    showError(getUserMessage(e));
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "flashloanBoundaryError" });
  showError(t("flashloanErrorFallback"));
};

const resetAndReload = async () => {
  clearError();
  errorMessage.value = null;
  canRetryError.value = false;
  await fetchData();
};

const retryLastOperation = () => {
  if (lastOperation.value === 'lookup') {
    handleLookup();
  } else if (lastOperation.value === 'requestLoan' && loanDetails.value) {
    handleRequestLoan({
      amount: "0",
      callbackContract: "",
      callbackMethod: ""
    });
  }
};

const handleLookup = async () => {
  const validation = validateLoanId(loanIdInput.value);
  if (validation) {
    validationError.value = validation;
    status.value = { msg: validation, type: "error" };
    return;
  }
  validationError.value = null;

  const loanId = Number(loanIdInput.value);
  lastOperation.value = 'lookup';

  try {
    isLoading.value = true;
    const contract = await ensureContractAddress();
    
    try {
      const res = await invokeRead({
        contractAddress: contract,
        operation: "getLoan",
        args: [{ type: "Integer", value: String(loanId) }],
      });

      const parsed = await import("@shared/utils/neo").then(m => m.parseInvokeResult(res));
      const details = buildLoanDetails(parsed, loanId);
      if (!details) {
        loanDetails.value = null;
        status.value = { msg: t("loanNotFound"), type: "error" };
        return;
      }

      loanDetails.value = details;
      status.value = { msg: t("loanStatusLoaded"), type: "success" };
    } catch (e) {
      handleError(e, { operation: "lookupLoan", metadata: { loanId } });
      throw e;
    }
  } catch (e: any) {
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    status.value = { msg: userMsg, type: "error" };
    if (retryable) {
      showError(userMsg, true);
    }
  } finally {
    isLoading.value = false;
  }
};

const handleRequestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
  if (!address.value) {
    try {
      await connect();
    } catch (e) {
      handleError(e, { operation: "connectBeforeRequestLoan" });
      status.value = { msg: getUserMessage(e), type: "error" };
      return;
    }
  }

  if (!address.value) {
    status.value = { msg: t("connectWallet"), type: "error" };
    return;
  }

  const validation = validateLoanRequest(data);
  if (validation) {
    validationError.value = validation;
    status.value = { msg: validation, type: "error" };
    return;
  }
  validationError.value = null;

  isLoading.value = true;
  status.value = null;
  lastOperation.value = 'requestLoan';

  try {
    const contract = await ensureContractAddress();
    const amountInt = toFixed8(data.amount);

    await invokeContract({
      scriptHash: contract,
      operation: "RequestLoan",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: amountInt },
        { type: "Hash160", value: data.callbackContract },
        { type: "String", value: data.callbackMethod },
      ],
    });

    status.value = { msg: t("loanRequested"), type: "success" };
    await fetchData();
  } catch (e: any) {
    handleError(e, { operation: "requestLoan", metadata: { amount: data.amount } });
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    status.value = { msg: userMsg, type: "error" };
    if (retryable) {
      showError(userMsg, true);
    }
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => fetchData());
watch(chainType, () => fetchData());
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./flashloan-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.95);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  font-family: "Consolas", "Monaco", monospace;
  z-index: 3000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 10px rgba(239, 68, 68, 0.5);
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
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--flash-gradient);
  min-height: 100vh;
  position: relative;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--flash-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--flash-grid) 1px, transparent 1px);
    background-size: 50px 50px;
    z-index: 10;
    pointer-events: none;
  }
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
