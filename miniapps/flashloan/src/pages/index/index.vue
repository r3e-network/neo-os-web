<template>
  <MiniAppShell
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="t('overview')"
    :fallback-message="t('flashloanErrorFallback')"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload">
    <template #content>
      
        <ErrorToast :show="!!errorMessage" :message="errorMessage ?? ''" type="error" @close="clearErrorStatus" />

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
      
    </template>

    <template #tab-stats>
      <ActiveLoans :pool-balance="poolBalance" :stats="stats" :recent-loans="recentLoans" :t="t" />

      <LoanCalculator :t="t" />
    </template>

    <template #operation>
      <MiniAppOperationStats
        variant="erobo"
        :title="t('statusLookup')"
        :stats="opStats"
        stats-position="bottom"
        :show-stats="!!loanDetails">
        <view class="op-field">
          <NeoInput v-model="loanIdInput" :placeholder="t('loanIdPlaceholder')" size="sm" />
        </view>
        <NeoButton size="sm" variant="primary" class="op-btn" :disabled="isLoading" @click="handleLookup">
          {{ isLoading ? t("checking") : t("checkStatus") }}
        </NeoButton>
        <view v-if="loanDetails" class="op-result"></view>
      </MiniAppOperationStats>
    </template>
  </MiniAppShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell, MiniAppOperationStats, NeoButton, NeoInput, ErrorToast } from "@shared/components";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";

import { useFlashloanCore } from "@/composables/useFlashloanCore";
import LoanRequest from "./components/LoanRequest.vue";
import ActiveLoans from "./components/ActiveLoans.vue";
import LoanCalculator from "./components/LoanCalculator.vue";

const { t } = createUseI18n(messages)();
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

const templateConfig = createPrimaryStatsTemplateConfig(
  { key: "main", labelKey: "main", icon: "⚡", default: true },
  { statsTab: { labelKey: "tabStats" } },
);
const appState = computed(() => ({
  address: address.value,
  isLoading: isLoading.value,
  poolBalance: poolBalance.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "sidebarPoolBalance", value: () => poolBalance.value ?? "—" },
  { labelKey: "sidebarRecentLoans", value: () => recentLoans.value.length },
  { labelKey: "sidebarTotalLoans", value: () => stats.value?.totalLoans ?? 0 },
  { labelKey: "sidebarTotalVolume", value: () => stats.value?.totalVolume ?? "—" },
]);

const opStats = computed(() => [
  { label: t("statusLabel"), value: loanDetails.value?.status ?? "—" },
  { label: t("amount"), value: loanDetails.value?.amount ?? "—" },
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
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}
</style>
