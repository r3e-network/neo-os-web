<template>
  <MiniAppPage
    name="flashloan"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <ErrorToast
        :show="!!errorMessage"
        :message="errorMessage ?? ''"
        type="error"
        @close="clearErrorStatus"
        role="alert"
        aria-live="assertive"
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
    </template>

    <template #tab-stats>
      <ActiveLoans :pool-balance="poolBalance" :stats="stats" :recent-loans="recentLoans" :t="t" />

      <LoanCalculator :t="t" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('statusLookup')">
        <view class="op-field">
          <NeoInput v-model="loanIdInput" :placeholder="t('loanIdPlaceholder')" size="sm" />
        </view>
        <NeoButton size="sm" variant="primary" class="op-btn" :disabled="isLoading" @click="handleLookup">
          {{ isLoading ? t("checking") : t("checkStatus") }}
        </NeoButton>
        <view v-if="loanDetails" class="op-result"></view>
        <StatsDisplay v-if="loanDetails" :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, ErrorToast } from "@shared/components";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createMiniApp } from "@shared/utils/createMiniApp";

import { useFlashloanCore } from "@/composables/useFlashloanCore";
import LoanRequest from "./components/LoanRequest.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, clearStatus } =
  createMiniApp({
    name: "flashloan",
    messages,
    template: {
      tabs: [
        { key: "main", labelKey: "main", icon: "⚡", default: true },
        { key: "stats", labelKey: "tabStats", icon: "📊" },
      ],
    },
    sidebarItems: [
      { labelKey: "sidebarPoolBalance", value: () => poolBalance.value ?? "—" },
      { labelKey: "sidebarRecentLoans", value: () => recentLoans.value.length },
      { labelKey: "sidebarTotalLoans", value: () => stats.value?.totalLoans ?? 0 },
      { labelKey: "sidebarTotalVolume", value: () => stats.value?.totalVolume ?? "—" },
    ],
    fallbackMessageKey: "flashloanErrorFallback",
  });

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
  loadData,
  lookupLoan,
  requestLoan,
} = useFlashloanCore();

const appState = computed(() => ({
  address: address.value,
  isLoading: isLoading.value,
  poolBalance: poolBalance.value,
}));

const opStats = computed(() => [
  { label: t("statusLabel"), value: loanDetails.value?.status ?? "—" },
  { label: t("amount"), value: loanDetails.value?.amount ?? "—" },
]);
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
  await loadData();
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
  await lookupLoan(loanIdInput.value, setStatus, setErrorStatus);
};

const handleRequestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
  await requestLoan(data, setStatus, clearStatus, setErrorStatus);
};

watch(chainType, () => loadData(), { immediate: true });
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
