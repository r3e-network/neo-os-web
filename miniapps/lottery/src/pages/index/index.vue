<template>
  <view class="theme-lottery">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="errorStatus"
      :fireworks-active="showFireworks"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('lotteryErrorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <!-- Wallet Prompt -->
          <view v-if="!address && activeTab === 'game'" class="wallet-prompt-container">
            <NeoCard variant="warning" class="mb-4 text-center">
              <text class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</text>
              <NeoButton variant="primary" size="sm" @click="connectWallet">
                {{ t("connectWallet") }}
              </NeoButton>
            </NeoCard>
          </view>

          <!-- Unscratched Tickets Reminder -->
          <view v-if="unscratchedTickets.length > 0" class="mb-6 px-1">
            <NeoCard variant="accent" class="border-gold">
              <view class="flex items-center justify-between">
                <view>
                  <text class="mb-1 text-lg font-bold">{{ t("ticketsWaiting") }}</text>
                  <text class="text-sm opacity-80">{{
                    t("ticketsWaitingDesc", { count: unscratchedTickets.length })
                  }}</text>
                </view>
                <NeoButton size="sm" variant="primary" @click="playUnscratched(unscratchedTickets[0])">
                  {{ t("playNow") }}
                </NeoButton>
              </view>
            </NeoCard>
          </view>

          <GameCardGrid
            :instant-types="instantTypes"
            :is-loading="isLoading"
            :buying-type="buyingType"
            :is-connected="!!address"
            :t="t"
            @buy="handleBuy"
          />
        
      </template>

      <template #operation>
        <MiniAppOperationStats variant="erobo" :title="t('game')" :stats="lotteryStats" stats-position="bottom">
          <view class="action-buttons">
            <NeoButton
              v-if="instantTypes.length > 0"
              variant="primary"
              size="lg"
              block
              :loading="!!buyingType"
              :disabled="!address"
              @click="handleBuy(instantTypes[0])"
            >
              {{ t("ticketsBought") }}
            </NeoButton>
            <NeoButton
              v-if="unscratchedTickets.length > 0"
              variant="secondary"
              size="lg"
              block
              @click="playUnscratched(unscratchedTickets[0])"
            >
              {{ t("playNow") }}
            </NeoButton>
          </view>
        </MiniAppOperationStats>
      </template>

      <template #tab-winners>
        <WinnersTab :winners="winners" :format-num="formatNum" :t="t" />
      </template>

      <template #tab-stats>
        <StatsTab
          :total-tickets="totalTickets"
          :prize-pool="prizePool"
          :user-tickets="userTickets"
          :user-winnings="userWinnings"
          :format-num="formatNum"
          :t="t"
        />
      </template>
    </MiniAppShell>

    <!-- Scratch Modal -->
    <ScratchModal
      v-if="activeTicket"
      :is-open="!!activeTicket"
      :type-info="activeTicketTypeInfo"
      :ticket-id="activeTicket.id"
      :on-reveal="onReveal"
      @close="closeModal"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { MiniAppShell, MiniAppOperationStats, NeoButton, NeoCard } from "@shared/components";
import ScratchModal from "./components/ScratchModal.vue";
import GameCardGrid from "./components/GameCardGrid.vue";
import WinnersTab from "./components/WinnersTab.vue";
import StatsTab from "./components/StatsTab.vue";
import { useLotteryTypes, type LotteryTypeInfo } from "../../shared/composables/useLotteryTypes";
import { useScratchCard, type ScratchTicket } from "../../shared/composables/useScratchCard";
import { useLotteryState } from "./composables/useLotteryState";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();
const { handleError, canRetry, clearError } = useErrorHandler();

const { instantTypes, getLotteryType } = useLotteryTypes();
const { buyTicket, revealTicket, loadPlayerTickets, unscratchedTickets, playerTickets, isLoading } = useScratchCard();
const { address, connect } = useWallet() as WalletSDK;

const {
  activeTab,
  buyingType,
  showFireworks,
  winners,
  totalTickets,
  prizePool,
  formatNum,
  loadPlatformStats,
  loadWinners,
} = useLotteryState(t);

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true },
    { key: "winners", labelKey: "winners", icon: "\uD83D\uDCCB" },
    { key: "stats", labelKey: "stats", icon: "\uD83D\uDCCA" },
  ],
  fireworks: true,
});

const appState = computed(() => ({
  totalTickets: totalTickets.value,
  prizePool: prizePool.value,
  userTickets: playerTickets.value.length,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "totalTickets", value: () => totalTickets.value },
  { labelKey: "totalPaidOut", value: () => `${formatNum(prizePool.value)} GAS` },
  { labelKey: "ticketsBought", value: () => playerTickets.value.length },
  { labelKey: "totalWinnings", value: () => `${formatNum(userWinnings.value)} GAS` },
]);

const userTickets = computed(() => playerTickets.value.length);
const userWinnings = computed(() => playerTickets.value.reduce((acc, t) => acc + (t.prize || 0), 0));

const lotteryStats = computed(() => [
  { label: t("totalTickets"), value: totalTickets.value },
  { label: t("ticketsBought"), value: playerTickets.value.length },
  { label: t("totalWinnings"), value: `${formatNum(userWinnings.value)} GAS` },
]);

const activeTicket = ref<ScratchTicket | null>(null);
const activeTicketTypeInfo = computed(() => {
  if (!activeTicket.value) return instantTypes.value[0];
  return getLotteryType(activeTicket.value.type) || instantTypes.value[0];
});

const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const canRetryError = ref(false);
const lastOperation = ref<string | null>(null);

const connectWallet = async () => {
  try {
    await connect();
  } catch (e: unknown) {
    handleError(e, { operation: "connectWallet" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "lotteryBoundaryError" });
  setErrorStatus(t("lotteryErrorFallback"), "error");
};

const resetAndReload = async () => {
  clearError();
  clearErrorStatus();
  canRetryError.value = false;

  try {
    await Promise.all([loadPlatformStats(), loadWinners(), address.value ? loadPlayerTickets() : Promise.resolve()]);
  } catch (e: unknown) {
    handleError(e, { operation: "resetAndReload" });
  }
};

// Actions
const handleBuy = async (gameType: LotteryTypeInfo) => {
  if (!address.value) {
    try {
      await connect();
    } catch (e: unknown) {
      handleError(e, { operation: "connectBeforeBuy" });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
      return;
    }
  }

  if (!address.value) {
    setErrorStatus(t("connectWalletToPlay"), "error");
    return;
  }

  buyingType.value = gameType.type;
  lastOperation.value = "buy";

  try {
    const result = await buyTicket(gameType.type);
    const newTicket = playerTickets.value.find((t) => t.id === result.ticketId);
    if (newTicket) {
      activeTicket.value = newTicket;
    }
  } catch (e: unknown) {
    handleError(e, { operation: "buyTicket", metadata: { gameType: gameType.type } });
    const userMsg = formatErrorMessage(e, t("error"));
    const retryable = canRetry(e);
    setErrorStatus(userMsg, "error");
    canRetryError.value = retryable;
  } finally {
    buyingType.value = null;
  }
};

const playUnscratched = (ticket: ScratchTicket) => {
  activeTicket.value = ticket;
};

const onReveal = async (ticketId: string) => {
  try {
    const res = await revealTicket(ticketId);
    if (res.isWinner) {
      showFireworks.value = true;
      fireworksTimer = setTimeout(() => {
        fireworksTimer = null;
        showFireworks.value = false;
      }, 3000);
    }

    Promise.all([loadPlatformStats(), loadWinners()]).catch((e) => {
      handleError(e, { operation: "reloadStatsAfterReveal" });
    });

    return res;
  } catch (e: unknown) {
    handleError(e, { operation: "revealTicket", metadata: { ticketId } });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
    throw e;
  }
};

const closeModal = () => {
  activeTicket.value = null;
};

let fireworksTimer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (fireworksTimer) {
    clearTimeout(fireworksTimer);
    fireworksTimer = null;
  }
});

// Lifecycle
onMounted(() => {
  if (address.value) {
    loadPlayerTickets().catch((e) => {
      handleError(e, { operation: "loadPlayerTickets" });
    });
  }

  Promise.all([loadPlatformStats(), loadWinners()]).catch((e) => {
    handleError(e, { operation: "loadInitialStats" });
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
    canRetryError.value = canRetry(e);
  });
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./lottery-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.wallet-prompt-container {
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
