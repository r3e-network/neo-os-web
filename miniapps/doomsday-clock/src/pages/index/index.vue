<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>
    <view class="theme-doomsday">
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('doomsdayErrorFallback')">
        <view v-if="errorMessage" class="error-toast" :class="{ 'error-retryable': canRetryError }">
          <text>{{ errorMessage }}</text>
          <view v-if="canRetryError" class="retry-actions">
            <NeoButton variant="secondary" size="sm" @click="retryLastOperation">{{ t('retry') }}</NeoButton>
          </view>
        </view>
        <view v-if="activeTab === 'game'" class="tab-content">
          <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />
          <view v-if="!game.address" class="wallet-prompt">
            <NeoCard variant="warning" class="text-center">
              <text class="font-bold block mb-2">{{ t('connectWalletToPlay') }}</text>
              <NeoButton variant="primary" size="sm" @click="connectWallet">{{ t('connectWallet') }}</NeoButton>
            </NeoCard>
          </view>
          <NeoCard v-if="game.status" :variant="game.status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
            <text class="font-bold">{{ game.status.msg }}</text>
          </NeoCard>
          <NeoCard v-if="game.canClaim" variant="success" class="mb-4 text-center">
            <text class="text-xl font-bold block mb-2">{{ t("youWon") }}</text>
            <text class="block mb-4 text-lg">{{ formatNumber(game.totalPot, 2) }} GAS</text>
            <NeoButton variant="primary" size="lg" block :loading="game.isClaiming" @click="handleClaimPrize">{{ t("claimPrize") }}</NeoButton>
          </NeoCard>
          <BuyKeysCard v-else-if="game.isRoundActive" v-model:keyCount="game.keyCount" :estimated-cost="game.estimatedCost" :is-paying="game.isPaying" :validation-error="game.keyValidationError" :t="t as any" @buy="handleBuyKeys" />
          <ClockFace :danger-level="timer.dangerLevel" :danger-level-text="timer.dangerLevelText" :should-pulse="timer.shouldPulse" :countdown="timer.countdown" :danger-progress="timer.dangerProgress" :current-event-description="currentEventDescription" :t="t as any" />
        </view>
        <view v-if="activeTab === 'history'" class="tab-content scrollable">
          <HistoryList :history="game.history" :t="t as any" />
        </view>
        <view v-if="activeTab === 'stats'" class="tab-content">
          <GameStats :total-pot="game.totalPot" :user-keys="game.userKeys" :round-id="game.roundId" :last-buyer-label="game.lastBuyerLabel" :is-round-active="game.isRoundActive" :t="t as any" />
        </view>
        <view v-if="activeTab === 'docs'" class="tab-content scrollable">
          <NeoDoc :title="t('title')" :subtitle="t('docSubtitle')" :description="t('docDescription')" :steps="docSteps" :features="docFeatures" />
        </view>
      </ErrorBoundary>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { formatNumber } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoCard, NeoDoc, NeoButton, ChainWarning, ErrorBoundary } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useDoomsdayGame } from "@/composables/useDoomsdayGame";
import { useDoomsdayTimer } from "@/composables/useDoomsdayTimer";
import ClockFace from "./components/ClockFace.vue";
import GameStats from "./components/GameStats.vue";
import BuyKeysCard from "./components/BuyKeysCard.vue";
import HistoryList from "./components/HistoryList.vue";

const { t } = useI18n();
const { handleError, getUserMessage, canRetry, clearError } = useErrorHandler();
const game = useDoomsdayGame();
const timer = useDoomsdayTimer();

const navTabs = computed<NavTab[]>(() => [
  { id: "game", icon: "game", label: t("title") },
  { id: "stats", icon: "chart", label: t("tabStats") },
  { id: "history", icon: "time", label: t("history") },
  { id: "docs", icon: "book", label: t("docs") },
]);
const activeTab = ref("game");
const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [{ name: t("feature1Name"), desc: t("feature1Desc") }, { name: t("feature2Name"), desc: t("feature2Desc") }]);

const errorMessage = ref<string | null>(null);
const canRetryError = ref(false);
const lastOperation = ref<string | null>(null);
let errorClearTimer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

const showError = (msg: string, retryable = false) => {
  errorMessage.value = msg;
  canRetryError.value = retryable;
  if (errorClearTimer) clearTimeout(errorClearTimer);
  errorClearTimer = setTimeout(() => { errorMessage.value = null; canRetryError.value = false; errorClearTimer = null; }, 5000);
};

const currentEventDescription = computed(() => {
  if (!game.isRoundActive.value) return t("inactiveRound");
  return game.lastBuyer.value ? `${game.lastBuyerLabel.value} ${t("winnerDeclared")}` : t("roundStarted");
});

const connectWallet = async () => { try { await game.connect(); } catch (e) { handleError(e, { operation: "connectWallet" }); showError(getUserMessage(e)); } };
const handleBoundaryError = (error: Error) => { handleError(error, { operation: "doomsdayBoundaryError" }); showError(t("doomsdayErrorFallback")); };
const resetAndReload = async () => { clearError(); errorMessage.value = null; canRetryError.value = false; await refreshData(); };
const retryLastOperation = () => { if (lastOperation.value === 'buyKeys') handleBuyKeys(); else if (lastOperation.value === 'claimPrize') handleClaimPrize(); };

const showStatus = (msg: string, type: string) => { game.status.value = { msg, type }; setTimeout(() => (game.status.value = null), 4000); };

const handleBuyKeys = async () => {
  if (game.isPaying.value) return;
  const validation = game.validateKeyCount(game.keyCount.value);
  if (validation) { game.keyValidationError.value = validation; showStatus(validation, "error"); return; }
  game.keyValidationError.value = null;
  const count = Math.max(0, Math.floor(Number(game.keyCount.value) || 0));
  if (count <= 0) { showStatus(t("error"), "error"); return; }
  if (!game.address.value) { try { await game.connect(); } catch (e) { handleError(e, { operation: "connectBeforeBuyKeys" }); showError(getUserMessage(e)); return; } }
  if (!game.address.value) { showError(t("connectWalletToPlay")); return; }
  lastOperation.value = 'buyKeys';
  try {
    await game.ensureContractAddress();
    const costRaw = game.calculateKeyCostFormula(BigInt(count), game.totalKeysInRound.value);
    const costGas = Number(costRaw) / 1e8;
    const { receiptId, invoke } = await game.processPayment(costGas.toString(), `keys:${game.roundId.value}:${count}`);
    if (!receiptId) throw new Error(t("receiptMissing"));
    await invoke("buyKeysWithCost", [{ type: "Hash160", value: game.address.value as string }, { type: "Integer", value: count }, { type: "Integer", value: costRaw.toString() }, { type: "Integer", value: String(receiptId) }], game.contractAddress.value as string);
    game.keyCount.value = "1";
    showStatus(t("keysPurchased"), "success");
    await refreshData();
  } catch (e: any) {
    handleError(e, { operation: "buyKeys", metadata: { count, roundId: game.roundId.value } });
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    showStatus(userMsg, "error");
    if (retryable) showError(userMsg, true);
  }
};

const handleClaimPrize = async () => {
  if (game.isClaiming.value) return;
  if (!game.address.value) { try { await game.connect(); } catch (e) { handleError(e, { operation: "connectBeforeClaim" }); showError(getUserMessage(e)); return; } }
  if (!game.address.value) { showError(t("connectWalletToPlay")); return; }
  lastOperation.value = 'claimPrize';
  try {
    game.isClaiming.value = true;
    await game.ensureContractAddress();
    await game.invokeContract({ scriptHash: game.contractAddress.value as string, operation: "checkAndEndRound", args: [] });
    showStatus(t("prizeClaimed"), "success");
    await refreshData();
  } catch (e: any) {
    handleError(e, { operation: "claimPrize" });
    const userMsg = getUserMessage(e);
    const retryable = canRetry(e);
    showStatus(userMsg, "error");
    if (retryable) showError(userMsg, true);
  } finally { game.isClaiming.value = false; }
};

const refreshData = async () => {
  try {
    game.loading.value = true;
    const remainingSeconds = await game.loadRoundData();
    const endTime = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
    timer.setEndTime(endTime);
    timer.isRoundActive.value = game.isRoundActive.value;
    await game.loadUserKeys();
    await game.loadHistory();
  } catch (e: any) {
    handleError(e, { operation: "refreshData" });
    showStatus(getUserMessage(e), "error");
  } finally { game.loading.value = false; }
};

onMounted(async () => {
  await refreshData();
  interval = setInterval(() => timer.updateNow(), 1000);
});

watch(game.address, async () => await game.loadUserKeys());

onUnmounted(() => {
  if (interval) clearInterval(interval);
  if (errorClearTimer) clearTimeout(errorClearTimer);
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./doomsday-clock-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap");
:global(page) { background: var(--bg-primary); }
.wallet-prompt { margin-bottom: 16px; }
.error-toast {
  position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
  background: var(--doom-danger); color: var(--doom-button-text);
  padding: 12px 24px; border-radius: 4px; font-weight: 700; font-size: 14px;
  z-index: 3000; box-shadow: var(--doom-shadow), var(--doom-accent-glow);
  animation: toast-in 0.3s ease-out; max-width: 90%; text-align: center;
}
.error-toast.error-retryable { padding-bottom: 48px; }
.retry-actions { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); }
@keyframes toast-in {
  from { transform: translate(-50%, -20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
.tab-content {
  padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 16px;
  background-color: var(--doom-bg);
  background-image: linear-gradient(var(--doom-grid), var(--doom-grid)), radial-gradient(circle at 1px 1px, var(--doom-grid-dot) 1px, transparent 0);
  background-size: auto, 4px 4px;
  min-height: 100vh; position: relative;
  font-family: "Share Tech Mono", monospace;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
}
.theme-doomsday :deep(.neo-card) {
  background: linear-gradient(135deg, var(--doom-panel) 0%, var(--doom-panel-deep) 100%) !important;
  border: 1px solid var(--doom-border) !important; border-radius: 4px !important;
  box-shadow: var(--doom-shadow), var(--doom-shadow-glow) !important;
  color: var(--doom-text) !important; position: relative;
  &::after { content: ""; position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; background: var(--doom-border); box-shadow: 0 0 5px var(--doom-border); }
  &.variant-danger {
    border-color: var(--doom-danger) !important;
    background: linear-gradient(135deg, var(--doom-danger-bg-start) 0%, var(--doom-danger-bg-end) 100%) !important;
    &::after { background: var(--doom-danger); box-shadow: 0 0 5px var(--doom-danger); }
  }
  &.variant-warning { border-color: var(--doom-accent) !important; background: linear-gradient(135deg, var(--doom-panel) 0%, var(--doom-panel-deep) 100%) !important; }
}
.theme-doomsday :deep(.neo-button) {
  border-radius: 2px !important; text-transform: uppercase; font-weight: 700 !important;
  font-family: "Share Tech Mono", monospace !important; letter-spacing: 0.1em;
  position: relative; overflow: hidden;
  &.variant-primary {
    background: var(--doom-accent) !important; color: var(--doom-button-text) !important;
    border: none !important; box-shadow: var(--doom-accent-glow) !important;
    &:active { transform: translateY(2px); box-shadow: var(--doom-accent-glow-pressed) !important; }
    &::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(0deg, var(--doom-scanline), var(--doom-scanline) 2px, transparent 2px, transparent 4px);
      pointer-events: none;
    }
  }
  &.variant-secondary {
    background: transparent !important; border: 1px solid var(--doom-accent) !important;
    color: var(--doom-accent) !important;
    &:hover { background: var(--doom-hover) !important; }
  }
}
.scrollable { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.desktop-sidebar { display: flex; flex-direction: column; gap: var(--spacing-3, 12px); }
.sidebar-title { font-size: var(--font-size-sm, 13px); font-weight: 600; color: var(--text-secondary, rgba(248, 250, 252, 0.7)); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
