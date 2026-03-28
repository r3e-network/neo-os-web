<template>
  <div class="neoburger-shell">
    <div class="hero-container">
      <HeroSection
        :total-staked-display="totalStakedDisplay"
        :total-staked-usd-text="totalStakedUsdText"
        :apr-display="aprDisplay"
      />
      <HeroConversion
        :t="t"
        :neo-balance="neoBalance"
        :b-neo-balance="bNeoBalance"
      />
    </div>

    <StatsPanel @switch-to-jazz="switchToJazz" @open-link="openExternal" />

    <!-- Station Panel (Operation Panel Inline) -->
    <StationPanel
      ref="stationPanelRef"
      v-model:mode="homeMode"
      :wallet-connected="walletConnected"
      :can-submit="swapCanSubmit"
      :loading="loading"
      :primary-action-label="t('swap')"
      :jazz-action-label="t('claimRewards')"
      :daily-rewards="0"
      :weekly-rewards="0"
      :monthly-rewards="0"
      :total-rewards="0"
      :total-rewards-usd-text="''"
      @set-amount="setSwapAmount"
      @primary-action="handlePrimaryAction"
      @jazz-action="handleJazzAction"
    >
      <template #swap-interface>
        <SwapInterface
          :swap-mode="swapMode"
          :neo-balance="neoBalance"
          :b-neo-balance="bNeoBalance"
          :swap-amount="swapAmount"
          :swap-output="swapOutput"
          :swap-usd-text="swapUsdText"
          @update:swap-amount="updateSwapAmount"
          @toggle-mode="toggleSwapMode"
        />
      </template>
    </StationPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import HeroSection from "./components/HeroSection.vue";
import HeroConversion from "./components/HeroConversion.vue";
import StationPanel from "./components/StationPanel.vue";
import StatsPanel from "./components/StatsPanel.vue";
import SwapInterface from "./components/SwapInterface.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const neoBalance = computed(() => props.state.neoBalance?.value as number | null);
const bNeoBalance = computed(() => props.state.bNeoBalance?.value as number | null);
const walletConnected = computed(() => Boolean(props.state.walletConnected?.value ?? false));
const totalStakedDisplay = computed(() => String(props.state.totalStakedDisplay?.value ?? ""));
const totalStakedUsdText = computed(() => String(props.state.totalStakedUsdText?.value ?? ""));
const aprDisplay = computed(() => String(props.state.aprDisplay?.value ?? ""));
const loading = computed(() => Boolean(props.state.loading?.value ?? false));
const swapMode = computed(() => String(props.state.swapMode?.value ?? "stake"));
const swapAmount = computed(() => String(props.state.swapAmount?.value ?? ""));
const swapOutput = computed(() => String(props.state.swapOutput?.value ?? ""));
const swapUsdText = computed(() => String(props.state.swapUsdText?.value ?? ""));
const swapCanSubmit = computed(() => Boolean(props.state.swapCanSubmit?.value ?? false));

const homeMode = ref<"burger" | "jazz">("burger");
const stationPanelRef = ref<{ setMode?: (mode: string) => void } | null>(null);

const switchToJazz = () => {
  homeMode.value = "jazz";
  stationPanelRef.value?.setMode?.("jazz");
};

const setSwapAmount = (amount: string) => {
  if (props.state.swapAmount) {
    (props.state.swapAmount as Ref<string>).value = amount;
  }
};

const updateSwapAmount = (amount: string) => {
  if (props.state.swapAmount) {
    (props.state.swapAmount as Ref<string>).value = amount;
  }
};

const toggleSwapMode = () => {
  if (props.state.swapMode) {
    const current = (props.state.swapMode as Ref<string>).value;
    (props.state.swapMode as Ref<string>).value = current === "stake" ? "unstake" : "stake";
  }
};

const handlePrimaryAction = async () => {
  const handler = walletConnected.value ? actions.get("swap") : actions.get("connectWallet");
  if (handler) await handler();
};

const handleJazzAction = async () => {
  const handler = walletConnected.value ? actions.get("claimRewards") : actions.get("connectWallet");
  if (handler) await handler();
};

const openExternal = (url: string) => {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") window.location.href = url;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/neoburger-theme.scss" as *;
@use "./pages/index/neoburger-deep-overrides.scss" as *;

:global(body) {
  background: var(--burger-bg);
}

.neoburger-shell {
  padding: 20px 18px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: var(--font-family-display, "Manrope", "Outfit", sans-serif);
  color: var(--burger-text);
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(180, 83, 9, 0.06), rgba(251, 191, 36, 0.08));
  background-size: 200% 200%;
  animation: burger-warm-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(245, 158, 11, 0.08),
    inset 0 1px 0 rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.1);
  border-radius: 20px;
  padding: 32px 20px;
}

@keyframes burger-warm-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container {
    animation: none;
  }
}
</style>
