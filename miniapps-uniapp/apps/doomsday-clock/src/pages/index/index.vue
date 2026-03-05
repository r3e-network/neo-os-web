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
      <view v-if="!game.address" class="wallet-prompt">
        <NeoCard variant="warning" class="text-center">
          <text class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</text>
          <NeoButton variant="primary" size="sm" @click="connectWallet">{{ t("connectWallet") }}</NeoButton>
        </NeoCard>
      </view>
      <NeoCard v-if="game.canClaim" variant="success" class="mb-4 text-center" role="alert" aria-live="assertive">
        <text class="mb-2 block text-xl font-bold">{{ t("youWon") }}</text>
        <text class="mb-4 block text-lg">{{ formatNumber(game.totalPot, 2) }} GAS</text>
        <NeoButton variant="primary" size="lg" block :loading="game.isClaiming" @click="handleClaimPrize">{{
          t("claimPrize")
        }}</NeoButton>
      </NeoCard>
      <ClockFace
        :danger-level="timer.dangerLevel"
        :danger-level-text="timer.dangerLevelText"
        :should-pulse="timer.shouldPulse"
        :countdown="timer.countdown"
        :danger-progress="timer.dangerProgress"
        :current-event-description="currentEventDescription"
        :t="t"
      />
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
import { MiniAppPage, NeoCard, NeoButton, ErrorToast } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import ClockFace from "./components/ClockFace.vue";
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
const timerTicker = useTicker(() => timer.updateNow(), 1000);

onMounted(async () => {
  await refreshData();
  timerTicker.start();
});

watch(game.address, async () => await game.loadUserKeys());
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./doomsday-clock-theme.scss";
:global(page) {
  background: var(--bg-primary);
}
.wallet-prompt {
  margin-bottom: 16px;
}
</style>
