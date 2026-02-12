<template>
  <view class="theme-doomsday">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMsg"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary
          @error="handleBoundaryError"
          @retry="resetAndReload"
          :fallback-message="t('doomsdayErrorFallback')"
        >
          <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
            <text>{{ errorMessage }}</text>
            <view v-if="canRetryError" class="retry-actions">
              <NeoButton variant="secondary" size="sm" @click="retryLastOperation">{{ t("retry") }}</NeoButton>
            </view>
          </view>
          <view v-if="!game.address" class="wallet-prompt">
            <NeoCard variant="warning" class="text-center">
              <text class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</text>
              <NeoButton variant="primary" size="sm" @click="connectWallet">{{ t("connectWallet") }}</NeoButton>
            </NeoCard>
          </view>
          <NeoCard
            v-if="statusMsg"
            :variant="statusMsg.type === 'error' ? 'danger' : 'success'"
            class="mb-4 text-center"
          >
            <text class="font-bold">{{ statusMsg.msg }}</text>
          </NeoCard>
          <NeoCard v-if="game.canClaim" variant="success" class="mb-4 text-center">
            <text class="mb-2 block text-xl font-bold">{{ t("youWon") }}</text>
            <text class="mb-4 block text-lg">{{ formatNumber(game.totalPot, 2) }} GAS</text>
            <NeoButton variant="primary" size="lg" block :loading="game.isClaiming" @click="handleClaimPrize">{{
              t("claimPrize")
            }}</NeoButton>
          </NeoCard>
          <BuyKeysCard
            v-else-if="game.isRoundActive"
            v-model:keyCount="game.keyCount"
            :estimated-cost="game.estimatedCost"
            :is-paying="game.isPaying"
            :validation-error="game.keyValidationError"
            :t="t"
            @buy="handleBuyKeys"
          />
          <ClockFace
            :danger-level="timer.dangerLevel"
            :danger-level-text="timer.dangerLevelText"
            :should-pulse="timer.shouldPulse"
            :countdown="timer.countdown"
            :danger-progress="timer.dangerProgress"
            :current-event-description="currentEventDescription"
            :t="t"
          />
        </ErrorBoundary>
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
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { formatNumber } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import ClockFace from "./components/ClockFace.vue";
import GameStats from "./components/GameStats.vue";
import BuyKeysCard from "./components/BuyKeysCard.vue";
import HistoryList from "./components/HistoryList.vue";
import { useDoomsdayActions } from "@/composables/useDoomsdayActions";

const { t } = useI18n();

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

const templateConfig: MiniAppTemplateConfig = {
  contentType: "timer-hero",
  tabs: [
    { key: "game", labelKey: "title", icon: "💀", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "history", labelKey: "history", icon: "📜" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const activeTab = ref("game");

const appState = computed(() => ({
  roundId: game.roundId.value,
  totalPot: game.totalPot.value,
  isRoundActive: game.isRoundActive.value,
}));

const sidebarItems = computed(() => [
  { label: t("tabStats"), value: `#${game.roundId.value}` },
  { label: "Total Pot", value: `${formatNumber(game.totalPot.value, 2)} GAS` },
  { label: "Your Keys", value: game.userKeys.value },
  { label: "Time Left", value: timer.countdown.value },
]);

let interval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await refreshData();
  interval = setInterval(() => timer.updateNow(), 1000);
});

watch(game.address, async () => await game.loadUserKeys());

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./doomsday-clock-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap");
:global(page) {
  background: var(--bg-primary);
}
.wallet-prompt {
  margin-bottom: 16px;
}
.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--doom-danger);
  color: var(--doom-button-text);
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 14px;
  z-index: 3000;
  box-shadow: var(--doom-shadow), var(--doom-accent-glow);
  animation: toast-in 0.3s ease-out;
  max-width: 90%;
  text-align: center;
}
.error-toast.error-retryable {
  padding-bottom: 48px;
}
.retry-actions {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
}
@keyframes toast-in {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}
.tab-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--doom-bg);
  background-image:
    linear-gradient(var(--doom-grid), var(--doom-grid)),
    radial-gradient(circle at 1px 1px, var(--doom-grid-dot) 1px, transparent 0);
  background-size:
    auto,
    4px 4px;
  min-height: 100vh;
  position: relative;
  font-family: "Share Tech Mono", monospace;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.theme-doomsday :deep(.neo-card) {
  background: linear-gradient(135deg, var(--doom-panel) 0%, var(--doom-panel-deep) 100%) !important;
  border: 1px solid var(--doom-border) !important;
  border-radius: 4px !important;
  box-shadow: var(--doom-shadow), var(--doom-shadow-glow) !important;
  color: var(--doom-text) !important;
  position: relative;
  &::after {
    content: "";
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    background: var(--doom-border);
    box-shadow: 0 0 5px var(--doom-border);
  }
  &.variant-danger {
    border-color: var(--doom-danger) !important;
    background: linear-gradient(135deg, var(--doom-danger-bg-start) 0%, var(--doom-danger-bg-end) 100%) !important;
    &::after {
      background: var(--doom-danger);
      box-shadow: 0 0 5px var(--doom-danger);
    }
  }
  &.variant-warning {
    border-color: var(--doom-accent) !important;
    background: linear-gradient(135deg, var(--doom-panel) 0%, var(--doom-panel-deep) 100%) !important;
  }
}
.theme-doomsday :deep(.neo-button) {
  border-radius: 2px !important;
  text-transform: uppercase;
  font-weight: 700 !important;
  font-family: "Share Tech Mono", monospace !important;
  letter-spacing: 0.1em;
  position: relative;
  overflow: hidden;
  &.variant-primary {
    background: var(--doom-accent) !important;
    color: var(--doom-button-text) !important;
    border: none !important;
    box-shadow: var(--doom-accent-glow) !important;
    &:active {
      transform: translateY(2px);
      box-shadow: var(--doom-accent-glow-pressed) !important;
    }
    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        var(--doom-scanline),
        var(--doom-scanline) 2px,
        transparent 2px,
        transparent 4px
      );
      pointer-events: none;
    }
  }
  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--doom-accent) !important;
    color: var(--doom-accent) !important;
    &:hover {
      background: var(--doom-hover) !important;
    }
  }
}
</style>
