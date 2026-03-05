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
      <view v-if="!address" class="wallet-warning">
        <NeoCard variant="warning" class="text-center">
          <text class="font-bold">{{ t("connectWalletToPlay") }}</text>
          <NeoButton variant="primary" size="sm" class="mt-2" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </view>

      <!-- Coin Arena -->
      <CoinArena :display-outcome="displayOutcome" :is-flipping="isFlipping" :result="result" />

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
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import CoinArena from "./components/CoinArena.vue";
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./coin-flip-theme.scss";

@include page-background(var(--coin-bg-primary));

.wallet-warning {
  margin-bottom: 16px;
}
</style>
