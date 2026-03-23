<template>
  <MiniAppPage
    name="fogplay"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :fireworks-active="showWinOverlay"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetGame"
  >
    <!-- Game content - LEFT panel -->
    <template #content>
      <!-- Wallet Connection Warning -->
      <div v-if="!address" class="wallet-warning">
        <NeoCard variant="warning" class="text-center">
          <span class="font-bold">{{ t("connectWalletToPlay") }}</span>
          <NeoButton variant="primary" size="sm" class="mt-2" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </div>

      <div class="hero-container">
        <!-- Arena Background -->
        <div class="hero-arena-bg">
          <div class="arena-ring" />
          <div class="arena-ring arena-ring-2" />
          <div :class="['arena-ambient', { flipping: isFlipping }]" />
        </div>

        <!-- 3D Coin Display -->
        <div class="hero-coin-stage">
          <CoinArena :display-outcome="displayOutcome" :is-flipping="isFlipping" :result="result" :t="t" />
        </div>

        <!-- Side Labels -->
        <div class="hero-sides">
          <div :class="['side-badge', { active: displayOutcome === 'heads' || (!displayOutcome && !isFlipping) }]">
            <AppIcon name="legend" :size="20" class="side-icon" aria-hidden="true" />
            <span class="side-text">{{ t("heads") }}</span>
          </div>
          <div class="side-vs">{{ t("vs") }}</div>
          <div :class="['side-badge', { active: displayOutcome === 'tails' }]">
            <AppIcon name="moon" :size="20" class="side-icon" aria-hidden="true" />
            <span class="side-text">{{ t("tails") }}</span>
          </div>
        </div>

        <!-- Win/Loss Stats Bar -->
        <div class="hero-record">
          <div class="record-item win">
            <span class="record-count">{{ wins }}</span>
            <span class="record-label">{{ t("wins") }}</span>
          </div>
          <div class="record-divider" />
          <div class="record-item total">
            <span class="record-count">{{ totalGames }}</span>
            <span class="record-label">{{ t("totalGames") }}</span>
          </div>
          <div class="record-divider" />
          <div class="record-item loss">
            <span class="record-count">{{ losses }}</span>
            <span class="record-label">{{ t("losses") }}</span>
          </div>
        </div>
      </div>

      <!-- Result Modal -->
      <ResultOverlay :visible="showWinOverlay" :win-amount="winAmount" @close="showWinOverlay = false" />
    </template>

    <!-- RIGHT panel: Bet Controls -->
    <template #operation>
      <BetControls
        v-model:choice="choice"
        v-model:betAmount="betAmount"
        :is-flipping="isFlipping"
        :can-bet="canBet"
        :validation-error="validationError"
        @flip="handleFlip"
      />
    </template>

    <!-- Stats tab -->
    <template #tab-stats>
      <StatsTab :grid-items="gameStats" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import "../../static/fogplay.css";
import { computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { messages } from "@/locale/messages";
import { AppIcon, MiniAppPage, NeoCard, NeoButton, StatsTab } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import CoinArena from "./components/CoinArena.vue";
import BetControls from "./components/BetControls.vue";
import ResultOverlay from "./components/ResultOverlay.vue";
import { useFogPlayGame } from "./composables/useFogPlayGame";

const wallet = useWallet() as WalletSDK;
const { address } = wallet;

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage } = createMiniApp({
  name: "fogplay",
  messages,
  template: {
    tabs: [{ key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true }],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "totalGames", value: () => totalGames.value },
    { labelKey: "wins", value: () => wins.value },
    { labelKey: "losses", value: () => losses.value },
    { labelKey: "totalWon", value: () => `${formatNum(totalWon.value)} ${t("tokenGas")}` },
  ],
  fallbackMessageKey: "gameErrorFallback",
});

const {
  betAmount,
  choice,
  totalWon,
  isFlipping,
  result,
  displayOutcome,
  showWinOverlay,
  winAmount,
  errorMessage,
  validationError,
  canRetryError,
  canBet,
  wins,
  losses,
  totalGames,
  formatNum,
  connectWallet,
  resetGame,
  handleBoundaryError,
  retryOperation,
  handleFlip,
} = useFogPlayGame(wallet, t);

const appState = computed(() => ({
  totalGames: wins.value + losses.value,
  wins: wins.value,
  losses: losses.value,
  totalWon: totalWon.value,
}));

const gameStats = computed<StatsDisplayItem[]>(() => [
  { label: t("totalGames"), value: totalGames.value, icon: "🎮" },
  { label: t("wins"), value: wins.value, icon: "🏆" },
  { label: t("losses"), value: losses.value, icon: "💔" },
  { label: t("totalWon"), value: `${formatNum(totalWon.value)} ${t("tokenGas")}`, icon: "💰" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./fogplay-theme.scss" as *;

@include page-background(var(--coin-bg-primary));

.wallet-warning {
  margin-bottom: 16px;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 16px;
  gap: 20px;
  position: relative;
  overflow: hidden;
}

/* ── Arena Background ── */
.hero-arena-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.arena-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 280px;
  height: 280px;
  border: 1px dashed var(--coin-arena-ring);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: arena-spin 40s linear infinite;
}

.arena-ring-2 {
  width: 220px;
  height: 220px;
  border-color: var(--coin-arena-ring-2);
  animation-direction: reverse;
  animation-duration: 30s;
}

.arena-ambient {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, var(--coin-arena-ambient) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  transition: all 0.5s ease;

  &.flipping {
    width: 250px;
    height: 250px;
    background: radial-gradient(circle, var(--coin-arena-ambient-flip) 0%, transparent 70%);
  }
}

/* ── Coin Stage ── */
.hero-coin-stage {
  position: relative;
  z-index: 2;
}

/* ── Side Labels ── */
.hero-sides {
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 2;
}

.side-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 12px;
  background: var(--coin-record-bg);
  border: 1px solid var(--coin-record-border);
  transition: all 0.3s ease;
  opacity: 0.5;

  &.active {
    opacity: 1;
    background: var(--coin-side-active-bg);
    border-color: var(--coin-side-active-border);
    box-shadow: 0 0 12px var(--coin-side-glow);
  }
}

.side-icon {
  font-size: 20px;
}

.side-text {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--coin-text-muted);
}

.side-vs {
  font-size: 12px;
  font-weight: 900;
  color: var(--coin-text-muted-light);
  letter-spacing: 0.15em;
}

/* ── Record Stats ── */
.hero-record {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--coin-record-bg);
  border: 1px solid var(--coin-record-border);
  border-radius: 12px;
  z-index: 2;
}

.record-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.record-count {
  font-size: 20px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--coin-text-light);

  .win & {
    color: var(--coin-win);
  }
  .loss & {
    color: var(--coin-loss);
  }
  .total & {
    color: var(--coin-text-muted-light);
  }
}

.record-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--coin-text-muted-light);
}

.record-divider {
  width: 1px;
  height: 28px;
  background: var(--coin-record-divider);
}

@keyframes arena-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes coin-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes result-flash {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 15px var(--coin-glow-pulse);
  }
  50% {
    box-shadow: 0 0 30px var(--coin-glow-pulse-strong);
  }
}

@media (prefers-reduced-motion: reduce) {
  .arena-ring {
    animation: none;
  }

  .arena-ring-2 {
    animation: none;
  }

  .coin-display {
    animation: none;
  }

  .hero-record {
    animation: none;
  }
}

.hero-container {
  background: radial-gradient(ellipse at center, var(--coin-hero-bg) 0%, transparent 60%);
}

.coin-display {
  animation: coin-float 3s ease-in-out infinite;
  filter: drop-shadow(0 8px 24px var(--coin-glow-green));
}

.hero-record {
  animation: glow-pulse 4s ease-in-out infinite;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--coin-hover-glow);
  }
}

.side-badge {
  transition: all 0.2s ease;
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px var(--coin-border-faint);
  }
  &.active {
    box-shadow: 0 0 20px var(--coin-side-glow);
  }
}

@media (max-width: 480px) {
  .hero-sides {
    gap: 10px;
  }
  .side-badge {
    padding: 6px 12px;
  }
  .hero-record {
    gap: 12px;
    padding: 10px 18px;
  }
}
</style>
