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
@import url('https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

:global(body) {
  background: var(--burger-bg);
}

.neoburger-shell {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 300px;
  font-family: 'Rubik', var(--font-family-display, "Manrope", "Outfit", sans-serif);
  color: var(--burger-text);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #92400E, #F59E0B, #65A30D, #F59E0B, #92400E);
    background-size: 200% 100%;
    animation: burger-stripe-slide 6s linear infinite;
    border-radius: 0 0 4px 4px;
    z-index: 2;
  }
}

@keyframes burger-stripe-slide {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  text-align: center;
  gap: 18px;
  background:
    linear-gradient(180deg,
      rgba(146, 64, 14, 0.12) 0%,
      rgba(245, 158, 11, 0.08) 30%,
      rgba(101, 163, 13, 0.06) 60%,
      rgba(245, 158, 11, 0.1) 100%
    );
  background-size: 100% 200%;
  animation: burger-stack-gradient 8s ease-in-out infinite;
  box-shadow:
    0 12px 40px rgba(146, 64, 14, 0.1),
    inset 0 1px 0 rgba(245, 158, 11, 0.15),
    inset 0 -1px 0 rgba(146, 64, 14, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 24px;
  padding: 32px 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg,
      #92400E 0%, #F59E0B 25%, #65A30D 50%, #F59E0B 75%, #92400E 100%
    );
    border-radius: 24px 24px 0 0;
    opacity: 0.7;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg,
      #92400E 0%, #D4790E 50%, #92400E 100%
    );
    border-radius: 0 0 24px 24px;
    opacity: 0.5;
  }
}

@keyframes burger-stack-gradient {
  0% { background-position: 50% 0%; }
  50% { background-position: 50% 100%; }
  100% { background-position: 50% 0%; }
}

:deep(.neo-card) {
  font-family: 'Rubik', 'Manrope', sans-serif;
  border-radius: 18px;
  border: 1px solid rgba(245, 158, 11, 0.12);
  background: var(--burger-surface, #1f1a14);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(245, 158, 11, 0.06);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(245, 158, 11, 0.2);
    box-shadow:
      0 12px 36px rgba(146, 64, 14, 0.12),
      inset 0 1px 0 rgba(245, 158, 11, 0.08);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--primary) {
  font-family: 'Rubik', sans-serif;
  background: linear-gradient(135deg, #65A30D 0%, #F59E0B 100%);
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(101, 163, 13, 0.3);
  transition: all 0.25s ease;
  letter-spacing: 0.01em;

  &:hover {
    box-shadow: 0 8px 28px rgba(101, 163, 13, 0.4);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: 'Rubik', sans-serif;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.18);
  color: var(--burger-gold, #fbbf24);
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(245, 158, 11, 0.14);
    border-color: rgba(245, 158, 11, 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .neoburger-shell::before,
  .hero-container {
    animation: none;
  }
  :deep(.neo-card):hover,
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
