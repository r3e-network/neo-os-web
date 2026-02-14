<template>
  <view class="theme-doomsday">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMsg"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('doomsdayErrorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <ErrorToast :show="!!errorMessage" :message="errorMessage ?? ''" type="error" @close="errorMessage = ''" />
          <view v-if="!game.address" class="wallet-prompt">
            <NeoCard variant="warning" class="text-center">
              <text class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</text>
              <NeoButton variant="primary" size="sm" @click="connectWallet">{{ t("connectWallet") }}</NeoButton>
            </NeoCard>
          </view>
          <NeoCard v-if="game.canClaim" variant="success" class="mb-4 text-center">
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
        <GameStats
          :total-pot="game.totalPot"
          :user-keys="game.userKeys"
          :round-id="game.roundId"
          :last-buyer-label="game.lastBuyerLabel"
          :is-round-active="game.isRoundActive"
          :t="t"
        />
      </template>

      <template #tab-history>
        <HistoryList :history="game.history" :t="t" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { formatNumber } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { useTicker } from "@shared/composables/useTicker";
import { messages } from "@/locale/messages";
import { MiniAppShell, NeoCard, NeoButton, ErrorToast } from "@shared/components";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import ClockFace from "./components/ClockFace.vue";
import GameStats from "./components/GameStats.vue";
import BuyKeysCard from "./components/BuyKeysCard.vue";
import HistoryList from "./components/HistoryList.vue";
import { useDoomsdayActions } from "@/composables/useDoomsdayActions";

const { t } = createUseI18n(messages)();

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

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "game", labelKey: "title", icon: "💀", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "history", labelKey: "history", icon: "📜" },
  ],
});

const activeTab = ref("game");

const appState = computed(() => ({
  roundId: game.roundId.value,
  totalPot: game.totalPot.value,
  isRoundActive: game.isRoundActive.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "tabStats", value: () => `#${game.roundId.value}` },
  { labelKey: "sidebarTotalPot", value: () => `${formatNumber(game.totalPot.value, 2)} GAS` },
  { labelKey: "sidebarYourKeys", value: () => game.userKeys.value },
  { labelKey: "sidebarTimeLeft", value: () => timer.countdown.value },
]);

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
