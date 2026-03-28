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
      <div class="hero-container">
        <div class="hero-bolt" aria-hidden="true">
          <svg viewBox="0 0 64 96" class="bolt-svg">
            <path
              d="M38 2L10 42h18L22 94l32-50H36L38 2z"
              fill="url(#boltGrad)"
              stroke="rgba(255,255,255,0.2)"
              stroke-width="1.5"
            />
            <defs>
              <linearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--flash-accent-yellow, #facc15)" />
                <stop offset="100%" stop-color="var(--flash-pending, #f59e0b)" />
              </linearGradient>
            </defs>
          </svg>
          <div class="bolt-glow" />
        </div>
        <span class="hero-label">{{ t("appName") }}</span>
        <div class="hero-stats-row">
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("sidebarPoolBalance") }}</span>
            <span class="hero-stat-value">{{ poolBalance || poolBalance === 0 ? poolBalance : t("notAvailable") }}</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("sidebarTotalLoans") }}</span>
            <span class="hero-stat-value">{{ stats?.totalLoans ?? 0 }}</span>
          </div>
        </div>
        <span v-if="status" class="hero-status" :class="`hero-status--${status.type}`">
          {{ status.msg }}
        </span>
      </div>

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
        <div class="op-field">
          <NeoInput v-model="loanIdInput" :placeholder="t('loanIdPlaceholder')" size="sm" />
        </div>
        <NeoButton size="sm" variant="primary" class="op-btn" :disabled="isLoading" type="button" @click="handleLookup" :aria-label="t('checkStatus')">
          {{ isLoading ? t("checking") : t("checkStatus") }}
        </NeoButton>
        <div v-if="loanDetails" class="op-result"></div>
        <StatsDisplay v-if="loanDetails" :items="stats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { messages } from "@/locale/messages";
import { ErrorToast, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
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
      { labelKey: "sidebarPoolBalance", value: () => poolBalance.value ?? t("notAvailable") },
      { labelKey: "sidebarRecentLoans", value: () => recentLoans.value.length },
      { labelKey: "sidebarTotalLoans", value: () => stats.value?.totalLoans ?? 0 },
      { labelKey: "sidebarTotalVolume", value: () => stats.value?.totalVolume ?? t("notAvailable") },
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
const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const errorMessage = computed(() => errorStatus.value?.msg ?? null);
const canRetryError = ref(false);

const connectWallet = async () => {
  try {
    await connect();
  } catch (e) {
    handleError(e, { operation: "connectWallet" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "flashloanBoundaryError" });
  setErrorStatus(t("flashloanErrorFallback"), "error");
};

const resetAndReload = async () => {
  try {
    clearError();
    clearErrorStatus();
    canRetryError.value = false;
    await loadData();
  } catch (e) {
    // loadData handles errors internally; this catches only truly unexpected exceptions
    console.error("[flashloan] resetAndReload unexpected error:", e instanceof Error ? e.message : String(e));
  }
};
const handleLookup = async () => {
  try {
    await lookupLoan(loanIdInput.value, setStatus, setErrorStatus);
  } catch (e) {
    // lookupLoan handles errors internally; this catches only truly unexpected exceptions
    console.error("[flashloan] handleLookup unexpected error:", e instanceof Error ? e.message : String(e));
  }
};

const handleRequestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
  try {
    await requestLoan(data, setStatus, clearStatus, setErrorStatus);
  } catch (e) {
    // requestLoan handles errors internally via callbacks; this catches only truly unexpected exceptions
    console.error("[flashloan] handleRequestLoan unexpected error:", e instanceof Error ? e.message : String(e));
  }
};

const isMounted = ref(true);
const stopChainTypeWatch = watch(chainType, async () => {
  if (!isMounted.value) return;
  try {
    await loadData();
  } catch (e) {
    console.warn("[flashloan] chain type change reload failed:", e instanceof Error ? e.message : String(e));
  }
}, { immediate: true });

onUnmounted(() => {
  isMounted.value = false;
  stopChainTypeWatch();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@use "./flashloan-theme.scss" as *;

:global(body) {
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
  border-top: 1px solid var(--border-subtle);
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(180deg, rgba(250, 204, 21, 0.06) 0%, transparent 100%);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-bolt {
  position: relative;
  width: 72px;
  height: 108px;
}

.bolt-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5));
}

.bolt-glow {
  position: absolute;
  inset: -20px;
  background: radial-gradient(circle, rgba(250, 204, 21, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  z-index: -1;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-card-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 16px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle);
}

.hero-status {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 600;

  &--success {
    color: var(--flash-success, var(--accent-success, #34d399));
    background: rgba(0, 229, 153, 0.1);
  }

  &--error {
    color: var(--flash-danger, var(--accent-error, #f87171));
    background: rgba(239, 68, 68, 0.1);
  }
}

/* ── Flash Loan Hero Enhancements ── */
@keyframes flash-bolt-strike {
  0%,
  100% {
    filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5));
    opacity: 1;
  }
  5% {
    filter: drop-shadow(0 0 40px rgba(255, 255, 255, 0.9)) brightness(2);
    opacity: 1;
  }
  10% {
    filter: drop-shadow(0 0 20px rgba(250, 204, 21, 0.6));
    opacity: 0.9;
  }
  15% {
    filter: drop-shadow(0 0 35px rgba(255, 255, 255, 0.7)) brightness(1.8);
    opacity: 1;
  }
  20% {
    filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5));
    opacity: 1;
  }
}

@keyframes flash-current-flow {
  0% {
    background-position: 0% 50%;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
  }
  50% {
    background-position: 100% 50%;
    box-shadow:
      0 0 40px rgba(59, 130, 246, 0.2),
      0 0 80px rgba(250, 204, 21, 0.1);
  }
  100% {
    background-position: 0% 50%;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
  }
}

@keyframes flash-glow-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(250, 204, 21, 0.06), rgba(255, 255, 255, 0.02));
  background-size: 200% 200%;
  animation: flash-current-flow 6s ease-in-out infinite;
  border: 1px solid rgba(59, 130, 246, 0.12);
}

.bolt-svg {
  animation: flash-bolt-strike 4s ease-in-out infinite;
}

.bolt-glow {
  animation: flash-glow-pulse 3s ease-in-out infinite;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(250, 204, 21, 0.1) 40%, transparent 70%);
}

.hero-stats-row {
  box-shadow:
    0 0 20px rgba(59, 130, 246, 0.08),
    inset 0 1px 0 rgba(250, 204, 21, 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .hero-container,
  .bolt-svg,
  .bolt-glow {
    animation: none;
  }
}

@media (max-width: 480px) {
  .hero-container {
    min-height: 250px;
    padding: 24px 16px;
    gap: 12px;
  }

  .hero-bolt {
    width: 56px;
    height: 84px;
  }

  .hero-label {
    font-size: 18px;
  }

  .hero-stats-row {
    gap: 14px;
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }

  .hero-stat-value {
    font-size: 16px;
  }

  .hero-stat-divider {
    width: 100%;
    height: 1px;
    width: 80px;
  }
}

</style>
