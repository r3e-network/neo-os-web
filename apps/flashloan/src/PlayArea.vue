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

.flashloan-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
