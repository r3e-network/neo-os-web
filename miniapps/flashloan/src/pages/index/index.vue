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
        <ErrorToast
          :show="!!errorMessage"
          :message="errorMessage ?? ''"
          type="error"
          @close="clearErrorStatus"
        />

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

    <template #operation>
      <NeoCard variant="erobo" :title="t('statusLookup')">
        <view class="op-field">
          <NeoInput
            v-model="loanIdInput"
            :placeholder="t('loanIdPlaceholder')"
            size="sm"
          />
        </view>
        <NeoButton size="sm" variant="primary" class="op-btn" :disabled="isLoading" @click="handleLookup">
          {{ isLoading ? t('checking') : t('checkStatus') }}
        </NeoButton>
        <view v-if="loanDetails" class="op-result">
          <view class="op-stat-row">
            <text class="op-label">{{ t('statusLabel') }}</text>
            <text class="op-value">{{ loanDetails.status }}</text>
          </view>
          <view class="op-stat-row">
            <text class="op-label">{{ t('amount') }}</text>
            <text class="op-value">{{ loanDetails.amount }}</text>
          </view>
        </view>
      </NeoCard>
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, NeoInput, ErrorBoundary, ErrorToast, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

import { useFlashloanCore } from "@/composables/useFlashloanCore";
import LoanRequest from "./components/LoanRequest.vue";
import ActiveLoans from "./components/ActiveLoans.vue";
import LoanCalculator from "./components/LoanCalculator.vue";

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
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "main", icon: "⚡", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "\u{1F4D6}" },
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
      ],
    },
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
  { label: t("sidebarPoolBalance"), value: poolBalance.value ?? "—" },
  { label: t("sidebarRecentLoans"), value: recentLoans.value.length },
  { label: t("sidebarTotalLoans"), value: stats.value?.totalLoans ?? 0 },
  { label: t("sidebarTotalVolume"), value: stats.value?.totalVolume ?? "—" },
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

.op-field {
  margin-bottom: 10px;
}

.op-btn {
  width: 100%;
}

.op-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.op-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.op-label {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.op-value {
  font-size: 13px;
  font-weight: 700;
}</style>
