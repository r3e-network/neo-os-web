<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
  >
    <!-- Desktop Sidebar -->
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <template #content>
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
              {{ t("retry") }}
            </NeoButton>
          </view>
        </view>

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
      </ErrorBoundary>
    </template>

    <template #tab-stats>
      <ActiveLoans :pool-balance="poolBalance" :stats="stats" :recent-loans="recentLoans" :t="t" />

      <LoanCalculator :t="t" />
    </template>

    <template #tab-docs>
      <FlashloanDocs :t="t" :contract-address="contractAddress" />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoButton, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

import { useFlashloanCore } from "@/composables/useFlashloanCore";
import LoanRequest from "./components/LoanRequest.vue";
import ActiveLoans from "./components/ActiveLoans.vue";
import LoanCalculator from "./components/LoanCalculator.vue";
import FlashloanDocs from "./components/FlashloanDocs.vue";

const { t } = useI18n();
const { handleError, canRetry, clearError } = useErrorHandler();

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
  validateLoanId,
  validateLoanRequest,
  fetchData,
  ensureContractAddress,
  toFixed8,
  buildLoanDetails,
  invokeRead,
  invokeContract,
} = useFlashloanCore();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "swap-interface",
  tabs: [
    { key: "main", labelKey: "main", icon: "⚡", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
  },
};
const activeTab = ref("main");
const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isLoading: isLoading.value,
  poolBalance: poolBalance.value,
}));

const sidebarItems = computed(() => [
  { label: "Pool Balance", value: poolBalance.value ?? "—" },
  { label: "Recent Loans", value: recentLoans.value.length },
  { label: "Total Loans", value: stats.value?.totalLoans ?? 0 },
  { label: "Total Volume", value: stats.value?.totalVolume ?? "—" },
]);
const { status, setStatus, clearStatus } = useStatusMessage();
const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const errorMessage = computed(() => errorStatus.value?.msg ?? null);
const canRetryError = ref(false);

const connectWallet = async () => {
  try {
    await connect();
  } catch (e: unknown) {
    handleError(e, { operation: "connectWallet" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "flashloanBoundaryError" });
  setErrorStatus(t("flashloanErrorFallback"), "error");
};

const resetAndReload = async () => {
  clearError();
  clearErrorStatus();
  canRetryError.value = false;
  await fetchData();
};

const retryLastOperation = () => {
  if (lastOperation.value === "lookup") {
    handleLookup();
  } else if (lastOperation.value === "requestLoan" && loanDetails.value) {
    handleRequestLoan({
      amount: "0",
      callbackContract: "",
      callbackMethod: "",
    });
  }
};

const handleLookup = async () => {
  const validation = validateLoanId(loanIdInput.value);
  if (validation) {
    validationError.value = validation;
    setStatus(validation, "error");
    return;
  }
  validationError.value = null;

  const loanId = Number(loanIdInput.value);
  lastOperation.value = "lookup";

  try {
    isLoading.value = true;
    const contract = await ensureContractAddress();

    try {
      const res = await invokeRead({
        scriptHash: contract,
        operation: "getLoan",
        args: [{ type: "Integer", value: String(loanId) }],
      });

      const parsed = await import("@shared/utils/neo").then((m) => m.parseInvokeResult(res));
      const details = buildLoanDetails(parsed, loanId);
      if (!details) {
        loanDetails.value = null;
        setStatus(t("loanNotFound"), "error");
        return;
      }

      loanDetails.value = details;
      setStatus(t("loanStatusLoaded"), "success");
    } catch (e: unknown) {
      handleError(e, { operation: "lookupLoan", metadata: { loanId } });
      throw e;
    }
  } catch (e: unknown) {
    const userMsg = formatErrorMessage(e, t("error"));
    const retryable = canRetry(e);
    setStatus(userMsg, "error");
    if (retryable) {
      setErrorStatus(userMsg, "error");
      canRetryError.value = true;
    }
  } finally {
    isLoading.value = false;
  }
};

const handleRequestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
  if (!address.value) {
    try {
      await connect();
    } catch (e: unknown) {
      handleError(e, { operation: "connectBeforeRequestLoan" });
      setStatus(formatErrorMessage(e, t("error")), "error");
      return;
    }
  }

  if (!address.value) {
    setStatus(t("connectWallet"), "error");
    return;
  }

  const validation = validateLoanRequest(data);
  if (validation) {
    validationError.value = validation;
    setStatus(validation, "error");
    return;
  }
  validationError.value = null;

  isLoading.value = true;
  clearStatus();
  lastOperation.value = "requestLoan";

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

    setStatus(t("loanRequested"), "success");
    await fetchData();
  } catch (e: unknown) {
    handleError(e, { operation: "requestLoan", metadata: { amount: data.amount } });
    const userMsg = formatErrorMessage(e, t("error"));
    const retryable = canRetry(e);
    setStatus(userMsg, "error");
    if (retryable) {
      setErrorStatus(userMsg, "error");
      canRetryError.value = true;
    }
  } finally {
    isLoading.value = false;
  }
};

watch(chainType, () => fetchData(), { immediate: true });
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
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.3),
    0 0 10px rgba(239, 68, 68, 0.5);
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

</style>
