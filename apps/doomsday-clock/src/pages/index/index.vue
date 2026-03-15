<template>
  <MiniAppPage
    name="doomsday-clock"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="statusMsg"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <ErrorToast :show="!!errorMessage" :message="errorMessage ?? ''" type="error" @close="errorMessage = ''" />
      <div v-if="!game.address" class="wallet-prompt">
        <NeoCard variant="warning" class="text-center">
          <span class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</span>
          <NeoButton variant="primary" size="sm" @click="connectWallet">{{ t("connectWallet") }}</NeoButton>
        </NeoCard>
      </div>

      <div class="hero-container">
        <!-- Danger Ring -->
        <div :class="['danger-ring', timer.dangerLevel, { pulse: timer.shouldPulse }]">
          <div class="ring-inner">
            <div class="ring-glow" />
            <!-- Countdown Timer -->
            <div class="hero-countdown" aria-live="polite" role="timer">
              <span class="countdown-digits">{{ timer.countdown }}</span>
              <span class="countdown-label">{{ t("timeUntilEvent") }}</span>
            </div>
          </div>
        </div>

        <!-- Prize Pool -->
        <div class="hero-prize-pool">
          <span class="prize-label">PRIZE POOL</span>
          <span class="prize-amount">{{ formatNumber(game.totalPot, 2) }} GAS</span>
        </div>

        <!-- Claim Banner -->
        <div v-if="game.canClaim" class="hero-claim-banner" role="alert" aria-live="assertive">
          <span class="claim-text">{{ t("youWon") }}</span>
          <NeoButton variant="primary" size="lg" block :loading="game.isClaiming" @click="handleClaimPrize">
            {{ t("claimPrize") }}
          </NeoButton>
        </div>

        <!-- Danger Meter -->
        <div class="hero-danger-meter">
          <div class="meter-header">
            <span class="meter-label-left">{{ t("safe") }}</span>
            <div :class="['danger-badge', timer.dangerLevel]">
              <span>{{ timer.dangerLevelText }}</span>
            </div>
            <span class="meter-label-right">{{ t("critical") }}</span>
          </div>
          <div class="meter-track">
            <div :class="['meter-fill', timer.dangerLevel]" :style="{ width: timer.dangerProgress + '%' }" />
            <div class="meter-glow-point" :style="{ left: timer.dangerProgress + '%' }" />
          </div>
        </div>
      </div>
    </template>

    <template #operation>
      <BuyKeysCard
        v-if="game.isRoundActive && !game.canClaim"
        v-model:keyCount="game.keyCount"
        :estimated-cost="game.estimatedCost"
        :is-paying="game.isPaying"
        :validation-error="game.keyValidationError"
        :t="t"
        @buy="handleBuyKeys"
      />
    </template>

    <template #tab-stats>
      <NeoCard variant="erobo-neo">
        <StatsDisplay :items="gameStatsGrid" layout="grid" :columns="3" />
        <StatsDisplay :items="gameStatsRows" layout="rows" />
      </NeoCard>
    </template>

    <template #tab-history>
      <HistoryList :history="game.history" :t="t" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { formatNumber } from "@shared/utils/format";
import { useTicker } from "@shared/composables/useTicker";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton, ErrorToast, StatsDisplay } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import BuyKeysCard from "./components/BuyKeysCard.vue";
import HistoryList from "./components/HistoryList.vue";
import { useDoomsdayActions } from "@/composables/useDoomsdayActions";

const {
  game,
  timer,
  errorMessage,
  canRetryError,
  statusMsg,
  currentEventDescription,
  connectWallet,
  handleBoundaryError,
  resetAndReload,
  retryLastOperation,
  handleBuyKeys,
  handleClaimPrize,
  refreshData,
} = useDoomsdayActions();

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage } = createMiniApp({
  name: "doomsday-clock",
  messages,
  template: {
    tabs: [
      { key: "game", labelKey: "title", icon: "💀", default: true },
      { key: "stats", labelKey: "tabStats", icon: "📊" },
      { key: "history", labelKey: "history", icon: "📜" },
    ],
  },
  sidebarItems: [
    { labelKey: "tabStats", value: () => `#${game.roundId.value}` },
    { labelKey: "sidebarTotalPot", value: () => `${formatNumber(game.totalPot.value, 2)} GAS` },
    { labelKey: "sidebarYourKeys", value: () => game.userKeys.value },
    { labelKey: "sidebarTimeLeft", value: () => timer.countdown.value },
  ],
  fallbackMessageKey: "doomsdayErrorFallback",
});

const appState = computed(() => ({
  roundId: game.roundId.value,
  totalPot: game.totalPot.value,
  isRoundActive: game.isRoundActive.value,
}));

const gameStatsGrid = computed<StatsDisplayItem[]>(() => [
  { label: t("round"), value: `#${game.roundId.value}`, icon: "🔄" },
  { label: t("totalPot"), value: `${formatNumber(game.totalPot.value, 2)} GAS`, icon: "💰" },
  { label: t("yourKeys"), value: game.userKeys.value, icon: "🔑" },
]);

const gameStatsRows = computed<StatsDisplayItem[]>(() => [
  { label: t("lastBuyer"), value: game.lastBuyerLabel.value },
  {
    label: t("roundStatus"),
    value: game.isRoundActive.value ? t("activeRound") : t("inactiveRound"),
    variant: game.isRoundActive.value ? "success" : "accent",
  },
]);

const timerTicker = useTicker(() => timer.updateNow(), 1000);

onMounted(async () => {
  await refreshData();
  timerTicker.start();
});

watch(game.address, async () => await game.loadUserKeys());
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./doomsday-clock-theme.scss" as *;
:global(body) {
  background: var(--bg-primary);
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
  gap: 24px;
  padding: 24px 16px;
}

/* ── Danger Ring ── */
.danger-ring {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(
    from 0deg,
    rgba(16, 185, 129, 0.15),
    rgba(245, 158, 11, 0.15),
    rgba(239, 68, 68, 0.15),
    rgba(16, 185, 129, 0.15)
  );
  border: 3px solid rgba(255, 255, 255, 0.1);
  transition: all 0.5s ease;

  &::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid transparent;
    animation: ring-rotate 8s linear infinite;
  }

  &.low {
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow:
      0 0 30px rgba(16, 185, 129, 0.15),
      inset 0 0 30px rgba(16, 185, 129, 0.05);
    &::before {
      border-top-color: rgba(16, 185, 129, 0.6);
    }
  }
  &.medium {
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow:
      0 0 30px rgba(245, 158, 11, 0.15),
      inset 0 0 30px rgba(245, 158, 11, 0.05);
    &::before {
      border-top-color: rgba(245, 158, 11, 0.6);
    }
  }
  &.high {
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow:
      0 0 40px rgba(239, 68, 68, 0.2),
      inset 0 0 30px rgba(239, 68, 68, 0.05);
    &::before {
      border-top-color: rgba(239, 68, 68, 0.6);
    }
  }
  &.critical {
    border-color: rgba(239, 68, 68, 0.6);
    box-shadow:
      0 0 50px rgba(239, 68, 68, 0.35),
      inset 0 0 40px rgba(239, 68, 68, 0.1);
    &::before {
      border-top-color: rgba(239, 68, 68, 0.8);
    }
  }
  &.pulse {
    animation: danger-pulse 1s ease-in-out infinite alternate;
  }
}

.ring-inner {
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.ring-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(165, 180, 252, 0.08) 0%, transparent 70%);
}

.hero-countdown {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.countdown-digits {
  font-size: 32px;
  font-weight: 900;
  font-family: $font-mono;
  letter-spacing: 0.04em;
  line-height: 1;
  background: linear-gradient(180deg, #fff 0%, #a5b4fc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px rgba(165, 180, 252, 0.5));

  .critical & {
    background: linear-gradient(180deg, #fff 0%, #f87171 100%);
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 12px rgba(248, 113, 113, 0.6));
  }
}

.countdown-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Prize Pool ── */
.hero-prize-pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.prize-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.4);
}

.prize-amount {
  font-size: 28px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(135deg, #fbbf24, #f59e0b, #d97706);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
}

/* ── Claim Banner ── */
.hero-claim-banner {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.08));
  border: 1px solid rgba(16, 185, 129, 0.3);
  text-align: center;
  animation: claim-glow 2s ease-in-out infinite alternate;
}

.claim-text {
  display: block;
  font-size: 18px;
  font-weight: 900;
  color: #34d399;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Danger Meter ── */
.hero-danger-meter {
  width: 100%;
  max-width: 320px;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.meter-label-left,
.meter-label-right {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
}

.danger-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);

  &.low {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }
  &.medium {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }
  &.high {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  &.critical {
    background: rgba(239, 68, 68, 0.3);
    color: #f87171;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  }
}

.meter-track {
  height: 6px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  position: relative;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.meter-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
  &.low {
    background: linear-gradient(90deg, #10b981, #34d399);
  }
  &.medium {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }
  &.high {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }
  &.critical {
    background: linear-gradient(90deg, #dc2626, #ef4444);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  }
}

.meter-glow-point {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  transition: left 0.5s ease;
}

@keyframes ring-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes danger-pulse {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.03);
  }
}

@keyframes claim-glow {
  0% {
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.1);
  }
  100% {
    box-shadow: 0 0 25px rgba(16, 185, 129, 0.25);
  }
}

@media (max-width: 480px) {
  .danger-ring {
    width: 180px;
    height: 180px;
  }
  .ring-inner {
    width: 155px;
    height: 155px;
  }
  .countdown-digits {
    font-size: 26px;
  }
  .prize-amount {
    font-size: 22px;
  }
}
</style>
