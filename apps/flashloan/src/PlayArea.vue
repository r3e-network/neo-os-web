<template>
  <div class="flashloan-play-area">
    <!-- Hero Section -->
    <FlashloanHero :t="t" :pool-balance="poolBalance" :total-loans="totalLoans" />

    <!-- Loan Request / Lookup -->
    <LoanRequest
      v-model:loanId="loanIdInput"
      :loan-details="loanDetails"
      :is-loading="isLoading"
      :validation-error="validationError"
      :is-connected="isConnected"
      :status="null"
      :t="t"
      @connect="handleConnect"
      @lookup="handleLookup"
      @request-loan="handleRequestLoan"
    />

    <!-- Stats Tab Content: Activity + Calculator -->
    <ActiveLoans :pool-balance="poolBalance" :stats="statsObj" :recent-loans="recentLoans" :t="t" />
    <LoanCalculator :t="t" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Flash Loan
 *
 * Composes FlashloanHero, LoanRequest, ActiveLoans, and LoanCalculator.
 * Data flows in via props from defineMiniApp's render function.
 * Actions are dispatched via the injected action registry.
 */
import { computed, inject, ref } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import FlashloanHero from "./components/FlashloanHero.vue";
import LoanRequest from "./pages/index/components/LoanRequest.vue";
import ActiveLoans from "./pages/index/components/ActiveLoans.vue";
import LoanCalculator from "./pages/index/components/LoanCalculator.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const poolBalance = computed(() => Number(props.state.poolBalance?.value ?? 0));
const totalLoans = computed(() => Number(props.state.totalLoans?.value ?? 0));
const loanDetails = computed(() => (props.state.loanDetails?.value as Record<string, unknown> | null) ?? null);
const isLoading = computed(() => Boolean(props.state.isLoading?.value ?? false));
const validationError = computed(() => (props.state.validationError?.value as string | null) ?? null);
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const recentLoans = computed(() =>
  (props.state.recentLoans?.value as Array<{ id: number; amount: number; fee: number; status: "success" | "failed"; timestamp: string }>) ?? [],
);
const statsObj = computed(() => ({
  totalLoans: Number(props.state.totalLoans?.value ?? 0),
  totalVolume: Number(props.state.totalVolume?.value ?? 0),
  totalFees: Number(props.state.totalFees?.value ?? 0),
}));

const loanIdInput = ref("");

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleConnect = async () => {
  const handler = actions.get("connect");
  if (handler) await handler();
};

const handleLookup = async () => {
  const handler = actions.get("lookupLoan");
  if (handler) await handler(loanIdInput.value);
};

const handleRequestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
  const handler = actions.get("requestLoan");
  if (handler) await handler(data);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/flashloan-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

.flashloan-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: var(--flash-font, 'Space Grotesk', sans-serif);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 40px,
        var(--flash-grid, rgba(59, 130, 246, 0.06)) 40px,
        var(--flash-grid, rgba(59, 130, 246, 0.06)) 41px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 40px,
        var(--flash-grid, rgba(59, 130, 246, 0.06)) 40px,
        var(--flash-grid, rgba(59, 130, 246, 0.06)) 41px
      );
    pointer-events: none;
    z-index: 0;
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    animation: flash-pulse 4s ease-in-out infinite;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

@keyframes flash-pulse {
  0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
}

@keyframes lightning-strike {
  0%, 90%, 100% { opacity: 0; }
  92%, 96% { opacity: 1; }
  94% { opacity: 0.3; }
}

:deep(.neo-card) {
  font-family: var(--flash-font, 'Space Grotesk', sans-serif);
  background: var(--flash-panel, rgba(12, 18, 34, 0.9));
  border: 1px solid var(--flash-panel-border, rgba(59, 130, 246, 0.25));
  border-radius: 14px;
  box-shadow: var(--flash-panel-shadow, 0 0 24px rgba(59, 130, 246, 0.1));
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--flash-lightning-gradient, linear-gradient(135deg, #3B82F6 0%, #FBBF24 100%));
    opacity: 0.6;
  }

  &:hover {
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow:
      0 0 32px rgba(59, 130, 246, 0.15),
      0 0 0 1px rgba(251, 191, 36, 0.05);
  }
}

:deep(.neo-btn--primary) {
  font-family: var(--flash-font, 'Space Grotesk', sans-serif);
  background: var(--flash-lightning-gradient, linear-gradient(135deg, #3B82F6 0%, #FBBF24 100%));
  color: var(--flash-button-text, #000);
  font-weight: 700;
  border: none;
  border-radius: 12px;
  box-shadow: var(--flash-button-shadow, 0 0 20px rgba(251, 191, 36, 0.4));
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 13px;
  transition: all 0.15s ease;

  &:hover {
    box-shadow: var(--flash-electric-glow, 0 0 30px rgba(251, 191, 36, 0.25), 0 0 60px rgba(59, 130, 246, 0.1));
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: var(--flash-button-shadow-pressed);
  }
}

:deep(.neo-btn--secondary) {
  font-family: var(--flash-font, 'Space Grotesk', sans-serif);
  background: var(--flash-surface, rgba(10, 15, 28, 0.7));
  border: 1px solid var(--flash-panel-border, rgba(59, 130, 246, 0.25));
  color: var(--flash-accent-yellow, #FBBF24);
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-size: 12px;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .flashloan-play-area::after {
    animation: none;
  }
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
