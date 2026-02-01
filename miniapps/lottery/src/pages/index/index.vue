<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-lottery" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <ErrorBoundary 
      @error="handleBoundaryError" 
      @retry="resetAndReload"
      :fallback-message="t('lotteryErrorFallback')"
    >
      <!-- Error Toast -->
      <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
        <text>{{ errorMessage }}</text>
        <view v-if="canRetryError" class="retry-actions">
          <NeoButton variant="secondary" size="sm" @click="retryLastOperation">
            {{ t('retry') }}
          </NeoButton>
        </view>
      </view>

      <!-- Wallet Prompt -->
      <view v-if="!address && activeTab === 'game'" class="wallet-prompt-container">
        <NeoCard variant="warning" class="text-center mb-4">
          <text class="font-bold block mb-2">{{ t('connectWalletToPlay') }}</text>
          <NeoButton variant="primary" size="sm" @click="connectWallet">
            {{ t('connectWallet') }}
          </NeoButton>
        </NeoCard>
      </view>

      <!-- Games Tab (Main) -->
      <view v-if="activeTab === 'game'" class="tab-content scrollable">
        <!-- Unscratched Tickets Reminder -->
        <view v-if="unscratchedTickets.length > 0" class="mb-6 px-1">
          <NeoCard variant="accent" class="border-gold">
            <view class="flex justify-between items-center">
              <view>
                <text class="font-bold text-lg mb-1">{{ t("ticketsWaiting") }}</text>
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

        <view class="grid-layout px-1">
          <view
            v-for="game in instantTypes"
            :key="game.key"
            class="game-card h-full relative overflow-hidden group rounded-2xl flex flex-col p-4"
            :class="[`card-${game.key.replace('neo-', '')}`]"
          >
            <!-- Shiny Animated Layer -->
            <view class="shine-effect absolute inset-0 pointer-events-none z-0" />

            <view class="game-header text-center mb-1 z-10 relative">
              <text class="game-title text-sm font-black tracking-tighter uppercase opacity-80 decoration-2 text-white">
                {{ game.name }}
              </text>
              <view class="flex justify-center mt-1">
                <text
                  class="game-price-tag text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-white/90 border border-white/10 uppercase tracking-widest"
                >
                  {{ game.priceDisplay }}
                </text>
              </view>
            </view>

            <!-- Premium Ticket Visual Area -->
            <view class="game-visual relative h-32 flex items-center justify-center my-3">
              <!-- Pulsing Glow behind icon -->
              <view
                class="pulsar absolute w-20 h-20 rounded-full blur-3xl opacity-60"
                :style="{ backgroundColor: game.color }"
              />

              <view
                class="relative z-10 flex flex-col items-center transform transition-all duration-300 group-hover:scale-110"
              >
                <AppIcon name="ticket" :size="56" class="mb-1 ticket-icon" />
                <text class="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">PREMIUM</text>
              </view>
            </view>

            <view class="game-stats mb-5 text-center z-10 relative mt-auto">
              <text class="block text-[10px] uppercase font-bold opacity-70 text-white tracking-[0.1em] mb-1"
                >JACKPOT</text
              >
              <text class="block text-3xl font-black text-white glow-text leading-none italic">
                {{ game.maxJackpotDisplay.split(" ")[0] }}
                <text class="text-xs italic ml-1 opacity-70">GAS</text>
              </text>
            </view>

            <NeoButton
              class="w-full z-10 relative buy-button"
              variant="primary"
              :loading="isLoading && buyingType === game.type"
              :disabled="isLoading || !address"
              @click="handleBuy(game)"
            >
              <view class="flex items-center gap-2">
                <text class="font-black italic uppercase text-xs">{{ t("buyTicket") }}</text>
                <AppIcon name="arrow-right" :size="14" />
              </view>
            </NeoButton>

            <view class="mt-3 min-h-[32px] flex items-center justify-center">
              <text class="text-center text-[10px] leading-tight font-medium opacity-60 text-white px-2">
                {{ game.description }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- Winners Tab -->
      <view v-if="activeTab === 'winners'" class="tab-content scrollable">
        <NeoCard variant="erobo">
          <view class="winners-list">
            <text v-if="winners.length === 0" class="empty-text text-center text-glass py-8">{{ t("noWinners") }}</text>
            <view
              v-for="(w, i) in winners"
              :key="i"
              class="winner-item glass-panel mb-2 p-3 flex justify-between items-center rounded-lg bg-white/5"
            >
              <view class="flex items-center gap-3">
                <view class="winner-medal w-8 h-8 flex items-center justify-center rounded-full bg-black/20">
                  <text>{{ i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️" }}</text>
                </view>
                <view>
                  <text class="block text-sm font-bold">{{ shortenAddress(w.address) }}</text>
                  <text class="block text-xs opacity-60">{{ t("roundLabel", { round: w.round }) }}</text>
                </view>
              </view>
              <text class="text-green-400 font-bold">{{ formatNum(w.prize) }} GAS</text>
            </view>
          </view>
        </NeoCard>
      </view>

      <!-- Stats Tab -->
      <view v-if="activeTab === 'stats'" class="tab-content scrollable">
        <view class="stats-grid mb-6 grid grid-cols-2 gap-4">
          <NeoCard variant="erobo-neo" class="stat-box text-center">
            <text class="block text-2xl font-bold mb-1">{{ totalTickets }}</text>
            <text class="block text-xs opacity-60">{{ t("totalTickets") }}</text>
          </NeoCard>
          <NeoCard variant="erobo" class="stat-box text-center">
            <text class="block text-2xl font-bold mb-1 text-gold">{{ formatNum(prizePool) }}</text>
            <text class="block text-xs opacity-60">{{ t("totalPaidOut") }}</text>
          </NeoCard>
        </view>

        <NeoCard variant="erobo" class="p-4">
          <text class="section-title block mb-4 font-bold border-b border-white/10 pb-2">{{ t("yourStats") }}</text>
          <view class="flex justify-between mb-2">
            <text class="opacity-80">{{ t("ticketsBought") }}</text>
            <text class="font-bold">{{ userTickets }}</text>
          </view>
          <view class="flex justify-between">
            <text class="opacity-80">{{ t("totalWinnings") }}</text>
            <text class="font-bold text-green-400">{{ formatNum(userWinnings) }} GAS</text>
          </view>
        </NeoCard>
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>
    </ErrorBoundary>

    <!-- Scratch Modal -->
    <ScratchModal
      v-if="activeTicket"
      :is-open="!!activeTicket"
      :type-info="activeTicketTypeInfo"
      :ticket-id="activeTicket.id"
      :on-reveal="onReveal"
      @close="closeModal"
    />

    <Fireworks :active="showFireworks" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { ResponsiveLayout, NeoDoc, NeoButton, NeoCard, NeoStats, ChainWarning, ErrorBoundary } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import ScratchModal from "./components/ScratchModal.vue";
import { useLotteryTypes, type LotteryTypeInfo } from "../../shared/composables/useLotteryTypes";
import { useScratchCard, type ScratchTicket } from "../../shared/composables/useScratchCard";
import { useLotteryState } from "./composables/useLotteryState";
import { useErrorHandler } from "@shared/composables/useErrorHandler";

const { t } = useI18n();
const { handleError, getUserMessage, canRetry, clearError } = useErrorHandler();

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
  shortenAddress,
  loadPlatformStats,
  loadWinners,
} = useLotteryState(t);

const navTabs = computed(() => [
  { id: "game", icon: "game", label: t("game") },
  { id: "winners", icon: "award", label: t("winners") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const userTickets = computed(() => playerTickets.value.length);
const userWinnings = computed(() => playerTickets.value.reduce((acc, t) => acc + (t.prize || 0), 0));

const activeTicket = ref<ScratchTicket | null>(null);
const activeTicketTypeInfo = computed(() => {
  if (!activeTicket.value) return instantTypes.value[0];
  return getLotteryType(activeTicket.value.type) || instantTypes.value[0];
});

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures: any[] = [];

const errorMessage = ref<string | null>(null);
const canRetryError = ref(false);
const lastOperation = ref<string | null>(null);

let errorClearTimer: ReturnType<typeof setTimeout> | null = null;

const showError = (msg: string, retryable = false) => {
  errorMessage.value = msg;
  canRetryError.value = retryable;
  if (errorClearTimer) clearTimeout(errorClearTimer);
  errorClearTimer = setTimeout(() => {
    errorMessage.value = null;
    canRetryError.value = false;
    errorClearTimer = null;
  }, 5000);
};

const connectWallet = async () => {
  try {
    await connect();
  } catch (e) {
    handleError(e, { operation: "connectWallet" });
    showError(getUserMessage(e));
  }
};

const handleBoundaryError = (error: Error) => {
  handleError(error, { operation: "lotteryBoundaryError" });
  showError(t("lotteryErrorFallback"));
};

const resetAndReload = async () => {
  clearError();
  errorMessage.value = null;
  canRetryError.value = false;
  
  try {
    await Promise.all([
      loadPlatformStats(),
      loadWinners(),
      address.value ? loadPlayerTickets() : Promise.resolve(),
    ]);
  } catch (e) {
    handleError(e, { operation: "resetAndReload" });
  }
};

const retryLastOperation = () => {
  if (lastOperation.value === 'buy' && activeTicketTypeInfo.value) {
    // Cannot retry exact same ticket type, but can refresh
    resetAndReload();
  }
};

// Actions
const handleBuy = async (gameType: LotteryTypeInfo) => {
  // Wallet connection check
  if (!address.value) {
    try {
      await connect();
    } catch (e) {
      handleError(e, { operation: "connectBeforeBuy" });
      showError(getUserMessage(e));
      return;
    }
  }

  if (!address.value) {
    showError(t("connectWalletToPlay"));
    return;
  }

  buyingType.value = gameType.type;
  lastOperation.value = 'buy';
  
  try {
    const result = await buyTicket(gameType.type);
    const newTicket = playerTickets.value.find((t) => t.id === result.ticketId);
    if (newTicket) {
      activeTicket.value = newTicket;
    }
  } catch (e) {
    handleError(e, { operation: "buyTicket", metadata: { gameType: gameType.type } });
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    showError(userMsg, retryable);
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
      setTimeout(() => (showFireworks.value = false), 3000);
    }
    
    // Reload stats asynchronously
    Promise.all([
      loadPlatformStats(),
      loadWinners(),
    ]).catch(e => {
      // Non-critical - just log
      handleError(e, { operation: "reloadStatsAfterReveal" });
    });
    
    return res;
  } catch (e) {
    handleError(e, { operation: "revealTicket", metadata: { ticketId } });
    showError(getUserMessage(e));
    throw e;
  }
};

const closeModal = () => {
  activeTicket.value = null;
};

// Lifecycle
onMounted(() => {
  if (address.value) {
    loadPlayerTickets().catch(e => {
      handleError(e, { operation: "loadPlayerTickets" });
    });
  }
  
  Promise.all([
    loadPlatformStats(),
    loadWinners(),
  ]).catch(e => {
    handleError(e, { operation: "loadInitialStats" });
    showError(getUserMessage(e), canRetry(e));
  });
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./lottery-theme.scss";

.wallet-prompt-container {
  padding: 0 16px;
  margin-top: 8px;
}

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-error, rgba(239, 68, 68, 0.95));
  color: white;
  padding: 12px 24px;
  border-radius: 99px;
  font-weight: 700;
  font-size: 14px;
  backdrop-filter: blur(10px);
  z-index: 3000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px;
  padding-bottom: 30px;
}

.game-card {
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--lottery-card-shadow);
  border: 1px solid var(--lottery-card-border);
}

.game-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: var(--lottery-card-shadow-hover);
  border: 1px solid var(--lottery-card-border-hover);
}

/* Tier Specific Styling */
.card-bronze {
  background: var(--lottery-bronze-bg);
  box-shadow: var(--lottery-bronze-shadow);
}
.card-silver {
  background: var(--lottery-silver-bg);
  box-shadow: var(--lottery-silver-shadow);
}
.card-gold {
  background: var(--lottery-gold-bg);
  box-shadow: var(--lottery-gold-shadow);
  border: 1px solid var(--lottery-gold-border);
}
.card-platinum {
  background: var(--lottery-platinum-bg);
  box-shadow: var(--lottery-platinum-shadow);
  border: 1px solid var(--lottery-platinum-border);
}
.card-diamond {
  background: var(--lottery-diamond-bg);
  box-shadow: var(--lottery-diamond-shadow);
  border: 1px solid var(--lottery-diamond-border);
}

/* Visual Effects */
.shine-effect {
  background: var(--lottery-shine-gradient);
  background-size: 250% 250%;
  animation: shine 6s infinite linear;
}

@keyframes shine {
  0% {
    background-position: 200% 200%;
  }
  100% {
    background-position: -200% -200%;
  }
}

.pulsar {
  animation: pulse 4s infinite ease-in-out;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.buy-button {
  background: var(--lottery-buy-bg) !important;
  border: 1px solid var(--lottery-buy-border) !important;
  backdrop-filter: blur(10px);
  height: 44px;
  border-radius: 12px !important;
  transition: all 0.3s ease;
}

.buy-button:active {
  background: var(--lottery-buy-bg-active) !important;
  transform: translateY(2px);
}

.card-gold .buy-button {
  border-color: var(--lottery-buy-border-gold) !important;
}
.card-platinum .buy-button {
  border-color: var(--lottery-buy-border-platinum) !important;
}
.card-diamond .buy-button {
  border-color: var(--lottery-buy-border-diamond) !important;
  font-size: 14px;
}

.glow-text {
  text-shadow: var(--lottery-glow-text);
  letter-spacing: -1px;
}

.ticket-icon {
  color: var(--lottery-ticket-icon);
  filter: var(--lottery-ticket-shadow);
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}


// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
