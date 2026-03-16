<template>
  <MiniAppPage
    name="coin-flip"
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
          <CoinArena :display-outcome="displayOutcome" :is-flipping="isFlipping" :result="result" />
        </div>

        <!-- Side Labels -->
        <div class="hero-sides">
          <div :class="['side-badge', { active: displayOutcome === 'heads' || (!displayOutcome && !isFlipping) }]">
            <span class="side-icon">👑</span>
            <span class="side-text">HEADS</span>
          </div>
          <div class="side-vs">VS</div>
          <div :class="['side-badge', { active: displayOutcome === 'tails' }]">
            <span class="side-icon">🌙</span>
            <span class="side-text">TAILS</span>
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
import "../../static/coin-flip.css";
import { computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton, StatsTab } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import CoinArena from "./components/CoinArena.vue";
import BetControls from "./components/BetControls.vue";
import ResultOverlay from "./components/ResultOverlay.vue";
import { useCoinFlipGame } from "./composables/useCoinFlipGame";

const wallet = useWallet() as WalletSDK;
const { address } = wallet;

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage } = createMiniApp({
  name: "coin-flip",
  messages,
  template: {
    tabs: [{ key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true }],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "totalGames", value: () => totalGames.value },
    { labelKey: "wins", value: () => wins.value },
    { labelKey: "losses", value: () => losses.value },
    { labelKey: "totalWon", value: () => `${formatNum(totalWon.value)} GAS` },
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
} = useCoinFlipGame(wallet, t);

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
  { label: t("totalWon"), value: `${formatNum(totalWon.value)} GAS`, icon: "💰" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./coin-flip-theme.scss" as *;

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
  border: 1px dashed rgba(0, 229, 153, 0.12);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: arena-spin 40s linear infinite;
}

.arena-ring-2 {
  width: 220px;
  height: 220px;
  border-color: rgba(251, 191, 36, 0.08);
  animation-direction: reverse;
  animation-duration: 30s;
}

.arena-ambient {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(0, 229, 153, 0.1) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  transition: all 0.5s ease;

  &.flipping {
    width: 250px;
    height: 250px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.3s ease;
  opacity: 0.5;

  &.active {
    opacity: 1;
    background: rgba(0, 229, 153, 0.06);
    border-color: rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.1);
  }
}

.side-icon {
  font-size: 20px;
}

.side-text {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.6);
}

.side-vs {
  font-size: 12px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.15em;
}

/* ── Record Stats ── */
.hero-record {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.7);

  .win & {
    color: #34d399;
  }
  .loss & {
    color: #f87171;
  }
  .total & {
    color: rgba(255, 255, 255, 0.5);
  }
}

.record-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
}

.record-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
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
    box-shadow: 0 0 15px rgba(0, 229, 153, 0.2);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 229, 153, 0.5);
  }
}

.hero-container {
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.08) 0%, transparent 60%);
}

.coin-display {
  animation: coin-float 3s ease-in-out infinite;
  filter: drop-shadow(0 8px 24px rgba(0, 229, 153, 0.25));
}

.hero-record {
  animation: glow-pulse 4s ease-in-out infinite;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 229, 153, 0.3);
  }
}

.side-badge {
  transition: all 0.2s ease;
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
  }
  &.active {
    box-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
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
