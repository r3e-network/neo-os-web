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
      <div v-if="!core.address.value" class="wallet-prompt mb-4">
        <NeoCard variant="warning" class="text-center">
          <span class="mb-2 block font-bold">{{ t("connectWalletToUse") }}</span>
          <NeoButton type="button" variant="primary" size="sm" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </div>

      <div class="hero-container">
        <!-- Split Collateral Dashboard -->
        <div class="hero-split-display">
          <!-- Left: Locked NEO -->
          <div class="hero-asset-card locked">
            <div class="asset-icon-ring">
              <span class="asset-icon" aria-hidden="true">🔒</span>
            </div>
            <span class="asset-amount">{{ fmt(core.loan.value?.collateralLocked ?? 0) }}</span>
            <span class="asset-token">{{ t("tokenNeo") }}</span>
            <span class="asset-label">{{ t("locked") }}</span>
          </div>

          <!-- Center: Health Gauge -->
          <div class="hero-health-gauge" aria-hidden="true">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                :stroke="healthColor"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="`${healthArc} 327`"
                transform="rotate(-90 60 60)"
                class="gauge-arc"
              />
            </svg>
            <div class="gauge-center">
              <span class="gauge-value">{{ core.healthFactor.value ?? t("notAvailable") }}</span>
              <span class="gauge-label">{{ t("healthFactor") }}</span>
            </div>
          </div>

          <!-- Right: Borrowed GAS -->
          <div class="hero-asset-card borrowed">
            <div class="asset-icon-ring">
              <span class="asset-icon" aria-hidden="true">↗</span>
            </div>
            <span class="asset-amount">{{ fmt(core.loan.value?.borrowed ?? 0) }}</span>
            <span class="asset-token">{{ t("tokenGas") }}</span>
            <span class="asset-label">{{ t("totalBorrowed") }}</span>
          </div>
        </div>

        <!-- LTV Bar -->
        <div class="hero-ltv-bar">
          <div class="ltv-header">
            <span class="ltv-label">{{ t("ltvLabel") }}</span>
            <span class="ltv-value">{{ core.currentLTV.value != null ? `${core.currentLTV.value}%` : t("notAvailable") }}</span>
          </div>
          <div class="ltv-track">
            <div class="ltv-fill" :style="{ width: `${Math.min(core.currentLTV.value ?? 0, 100)}%` }" />
            <div class="ltv-zones">
              <div class="zone safe" />
              <div class="zone warn" />
              <div class="zone danger" />
            </div>
          </div>
        </div>
      </div>

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
        v-model="core.collateralAmount"
        v-model:selectedTier="core.selectedTier"
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
        <div class="stats-card">
          <span class="stats-title">{{ t("loanHistory") }}</span>
          <div v-for="item in history.loanHistory.value" :key="item.timestamp" class="history-item">
            <span>{{ item.icon }} {{ item.label }}: {{ fmt(item.amount as number) }} {{ t("tokenGas") }} - {{ item.timestamp }}</span>
          </div>
          <span v-if="history.loanHistory.value.length === 0" class="empty-text">{{ t("noHistory") }}</span>
        </div>
      </StatsTab>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton, StatsTab } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import PositionSummary from "./components/PositionSummary.vue";
import BorrowForm from "./components/BorrowForm.vue";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useSelfLoanCore } from "@/composables/useSelfLoanCore";
import { useSelfLoanHistory } from "@/composables/useSelfLoanHistory";

const { handleError, canRetry, clearError } = useErrorHandler();
const core = useSelfLoanCore();
const history = useSelfLoanHistory({
  address: core.address,
  ensureContractAddress: core.ensureContractAddress,
  loadLoanPosition: core.loadLoanPosition,
});
const fmt = (n: number, d = 2) => formatNumber(n, d);

const healthColor = computed(() => {
  const hf = core.healthFactor.value;
  if (hf == null) return "rgba(255,255,255,0.2)";
  if (hf >= 1.5) return "var(--checkbook-success)";
  if (hf >= 1.2) return "var(--checkbook-warning)";
  return "var(--checkbook-danger)";
});

const healthArc = computed(() => {
  const hf = core.healthFactor.value;
  if (hf == null) return 0;
  return Math.min(hf / 2, 1) * 327;
});

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
    { labelKey: "sidebarNeoBalance", value: () => core.neoBalance.value ?? t("notAvailable") },
    { labelKey: "healthFactor", value: () => core.healthFactor.value ?? t("notAvailable") },
    { labelKey: "currentLTV", value: () => (core.currentLTV.value != null ? `${core.currentLTV.value}%` : t("notAvailable")) },
  ],
  fallbackMessageKey: "selfLoanErrorFallback",
  statusTimeoutMs: 5000,
});

const appState = computed(() => ({
  hasLoan: !!core.loan.value,
  isConnected: !!core.address.value,
}));
const canRetryError = ref(false);
const validationError = ref<string | null>(null);

const statsRowItems = computed<StatsDisplayItem[]>(() => [
  { label: t("totalLoans"), value: history.stats.value.totalLoans },
  { label: t("totalBorrowed"), value: `${fmt(history.stats.value.totalBorrowed)} ${t("tokenGas")}` },
  { label: t("totalRepaid"), value: `${fmt(history.stats.value.totalRepaid)} ${t("tokenGas")}` },
]);

const handleTakeLoan = async () => {
  validationError.value = core.validateCollateral(core.collateralAmount.value, core.neoBalance.value) ?? null;
  if (validationError.value) {
    setStatus(validationError.value, "error");
    return;
  }
  await core.takeLoan(loadData, (e, retryable) => {
    canRetryError.value = retryable;
  });
};

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
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./self-loan-theme.scss" as *;

:global(body) {
  background: var(--checkbook-bg);
  font-family: var(--font-family-mono, "Courier New", monospace);
}

.wallet-prompt {
  margin-bottom: 16px;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 12px;
  gap: 24px;
}

/* ── Split Display ── */
.hero-split-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
}

.hero-asset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex: 1;
  max-width: 120px;
  transition: all 0.3s ease;

  &.locked {
    border-color: rgba(251, 191, 36, 0.15);
    &:hover {
      box-shadow: 0 0 15px rgba(251, 191, 36, 0.1);
    }
  }
  &.borrowed {
    border-color: rgba(52, 211, 153, 0.15);
    &:hover {
      box-shadow: 0 0 15px rgba(52, 211, 153, 0.1);
    }
  }
}

.asset-icon-ring {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;

  .locked & {
    border-color: rgba(251, 191, 36, 0.3);
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.15);
  }
  .borrowed & {
    border-color: rgba(52, 211, 153, 0.3);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.15);
  }
}

.asset-icon {
  font-size: 16px;

  .locked & {
    color: var(--checkbook-locked-asset);
  }
  .borrowed & {
    color: var(--checkbook-borrowed-asset);
  }
}

.asset-amount {
  font-size: 18px;
  font-weight: 900;
  font-family: $font-mono;

  .locked & {
    color: var(--checkbook-locked-asset);
  }
  .borrowed & {
    color: var(--checkbook-borrowed-asset);
  }
}

.asset-token {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--checkbook-asset-token, rgba(255, 255, 255, 0.4));
}

.asset-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
}

/* ── Health Gauge ── */
.hero-health-gauge {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.gauge-svg {
  width: 100%;
  height: 100%;
}

.gauge-arc {
  transition:
    stroke-dasharray 0.8s ease,
    stroke 0.5s ease;
}

.gauge-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gauge-value {
  font-size: 18px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
}

.gauge-label {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

/* ── LTV Bar ── */
.hero-ltv-bar {
  width: 100%;
  max-width: 320px;
}

.ltv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ltv-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

.ltv-value {
  font-size: 14px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
}

.ltv-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ltv-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--checkbook-success), var(--checkbook-warning), var(--checkbook-danger));
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}

.ltv-zones {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 1;
}

.zone {
  flex: 1;
  &.safe {
    background: rgba(52, 211, 153, 0.06);
  }
  &.warn {
    background: rgba(251, 191, 36, 0.06);
  }
  &.danger {
    background: rgba(248, 113, 113, 0.06);
  }
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

@media (max-width: 480px) {
  .hero-split-display {
    gap: 8px;
  }
  .hero-asset-card {
    padding: 12px 8px;
  }
  .asset-amount {
    font-size: 15px;
  }
  .hero-health-gauge {
    width: 80px;
    height: 80px;
  }
}

/* ── Enhanced Animations ── */
@keyframes health-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 8px rgba(0, 229, 153, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(0, 229, 153, 0.6));
  }
}

@keyframes asset-shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes lock-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-health-gauge {
    animation: none;
  }
  .asset-icon {
    animation: none;
  }
}

.hero-container {
  background:
    radial-gradient(ellipse at 30% 50%, rgba(0, 229, 153, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 50%, rgba(99, 102, 241, 0.06) 0%, transparent 50%);
}

.hero-health-gauge {
  animation: health-pulse 3s ease-in-out infinite;
}

.hero-asset-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}

.asset-icon {
  animation: lock-bounce 4s ease-in-out infinite;
}

.hero-ltv-bar {
  box-shadow: 0 0 12px rgba(0, 229, 153, 0.2);
  transition: box-shadow 0.3s ease;
  &:hover {
    box-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
  }
}
</style>
