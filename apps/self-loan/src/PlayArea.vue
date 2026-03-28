<template>
  <div class="loan-play-area">
    <!-- ── Wallet Prompt ── -->
    <div v-if="!isConnected" class="wallet-prompt mb-4">
      <NeoCard variant="warning" class="text-center">
        <span class="mb-2 block font-bold">{{ t("connectWalletToUse") }}</span>
        <NeoButton type="button" variant="primary" size="sm" @click="handleAction('connectWallet')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <!-- ── Hero Container ── -->
    <div class="hero-container">
      <!-- Split Collateral Dashboard -->
      <div class="hero-split-display">
        <!-- Left: Locked NEO -->
        <div class="hero-asset-card locked">
          <div class="asset-icon-ring">
            <span class="asset-icon" aria-hidden="true">&#x1F512;</span>
          </div>
          <span class="asset-amount">{{ collateralDisplay }}</span>
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
            <span class="gauge-value">{{ healthFactorDisplay }}</span>
            <span class="gauge-label">{{ t("healthFactor") }}</span>
          </div>
        </div>

        <!-- Right: Borrowed GAS -->
        <div class="hero-asset-card borrowed">
          <div class="asset-icon-ring">
            <span class="asset-icon" aria-hidden="true">&#x2197;</span>
          </div>
          <span class="asset-amount">{{ borrowedDisplay }}</span>
          <span class="asset-token">{{ t("tokenGas") }}</span>
          <span class="asset-label">{{ t("totalBorrowed") }}</span>
        </div>
      </div>

      <!-- LTV Bar -->
      <div class="hero-ltv-bar">
        <div class="ltv-header">
          <span class="ltv-label">{{ t("ltvLabel") }}</span>
          <span class="ltv-value">{{ currentLTVDisplay }}</span>
        </div>
        <div class="ltv-track">
          <div class="ltv-fill" :style="{ width: `${Math.min(currentLTV, 100)}%` }" />
          <div class="ltv-zones">
            <div class="zone safe" />
            <div class="zone warn" />
            <div class="zone danger" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Presentation-only component for Self-Loan
 *
 * Renders the collateral dashboard with locked NEO, borrowed GAS,
 * health gauge, and LTV bar display. All computation lives in
 * composables/useSelfLoan.ts; this component only reads from props.state.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings (all pre-computed in composable, read-only here) ──
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const collateralDisplay = computed(() => String(props.state.collateralDisplay?.value ?? "0"));
const borrowedDisplay = computed(() => String(props.state.borrowedDisplay?.value ?? "0"));
const healthFactorDisplay = computed(() => String(props.state.healthFactorDisplay?.value ?? t("notAvailable")));
const currentLTVDisplay = computed(() => String(props.state.currentLTVDisplay?.value ?? t("notAvailable")));
const currentLTV = computed(() => Number(props.state.currentLTV?.value ?? 0));
const healthColor = computed(() => String(props.state.healthColor?.value ?? "rgba(255,255,255,0.2)"));
const healthArc = computed(() => Number(props.state.healthArc?.value ?? 0));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleAction = async (name: string) => {
  const handler = actions.get(name);
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.loan-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
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
    color: var(--checkbook-locked-asset, #fbbf24);
  }
  .borrowed & {
    color: var(--checkbook-borrowed-asset, #34d399);
  }
}

.asset-amount {
  font-size: 18px;
  font-weight: 900;
  font-family: $font-mono;

  .locked & {
    color: var(--checkbook-locked-asset, #fbbf24);
  }
  .borrowed & {
    color: var(--checkbook-borrowed-asset, #34d399);
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
  background: linear-gradient(90deg, var(--checkbook-success, #34d399), var(--checkbook-warning, #fbbf24), var(--checkbook-danger, #f87171));
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

@keyframes lock-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
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

@media (prefers-reduced-motion: reduce) {
  .hero-health-gauge {
    animation: none;
  }
  .asset-icon {
    animation: none;
  }
}
</style>
