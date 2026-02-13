<template>
  <view class="theme-coin-flip">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :fireworks-active="showWinOverlay"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Game content - LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetGame" :fallback-message="t('gameErrorFallback')">
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
          <CoinArena
            :display-outcome="displayOutcome"
            :is-flipping="isFlipping"
            :result="result"
            :t="t as (key: string) => string"
          />

          <!-- Result Modal -->
          <ResultOverlay
            :visible="showWinOverlay"
            :win-amount="winAmount"
            :t="t as (key: string) => string"
            @close="showWinOverlay = false"
          />
        </ErrorBoundary>
      </template>

      <!-- RIGHT panel: Bet Controls -->
      <template #operation>
        <BetControls
          v-model:choice="choice"
          v-model:betAmount="betAmount"
          :is-flipping="isFlipping"
          :can-bet="canBet"
          :validation-error="validationError"
          :t="t as (key: string) => string"
          @flip="handleFlip"
        />
      </template>

      <!-- Stats tab -->
      <template #tab-stats>
        <NeoCard variant="erobo" class="mb-6">
          <NeoStats :stats="gameStats" />
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import "../../static/coin-flip.css";
import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import {
  MiniAppTemplate,
  NeoCard,
  NeoStats,
  NeoButton,
  SidebarPanel,
  type StatItem,
  ErrorBoundary,
} from "@shared/components";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import CoinArena from "./components/CoinArena.vue";
import BetControls from "./components/BetControls.vue";
import ResultOverlay from "./components/ResultOverlay.vue";
import { useCoinFlipGame } from "./composables/useCoinFlipGame";

const { t } = createUseI18n(messages)();
const wallet = useWallet() as WalletSDK;
const { address } = wallet;

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

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true },
    { key: "stats", labelKey: "stats", icon: "\uD83D\uDCCA" },
  ],
  fireworks: true,
});

const activeTab = ref("game");

const gameStats = computed<StatItem[]>(() => [
  { label: t("totalGames"), value: wins.value + losses.value },
  { label: t("wins"), value: wins.value, variant: "success" },
  { label: t("losses"), value: losses.value, variant: "danger" },
  { label: t("totalWon"), value: `${formatNum(totalWon.value)} GAS`, variant: "accent" },
]);

const sidebarItems = computed(() => [
  { label: t("totalGames"), value: totalGames.value },
  { label: t("wins"), value: wins.value },
  { label: t("losses"), value: losses.value },
  { label: t("totalWon"), value: `${formatNum(totalWon.value)} GAS` },
]);

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
