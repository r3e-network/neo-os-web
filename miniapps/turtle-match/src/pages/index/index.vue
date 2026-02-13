<template>
  <view class="theme-turtle-match">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      class="pond-theme"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <view class="game-container">
            <PlayerStats :stats="stats" :t="t" />

            <view v-if="error" class="error-banner">
              <text class="error-text">{{ error }}</text>
            </view>

            <ConnectPrompt v-if="!isConnected" :loading="loading" :t="t" @connect="connect" />

            <PurchaseSection
              v-else-if="!hasActiveSession"
              v-model:boxCount="boxCount"
              :loading="loading"
              :t="t"
              @start="handleStartGame"
            />

            <view v-else class="game-area">
              <GameBoard
                :remainingBoxes="remainingBoxes"
                :currentMatches="currentMatches"
                :currentReward="currentReward"
                :gridTurtles="gridTurtles"
                :matchedPair="matchedPairRef"
                :gamePhase="gamePhase"
                :loading="loading"
                :t="t"
                @settle="handleSettle"
                @newGame="handleNewGame"
              />
            </view>
          </view>

          <BlindboxOpening :visible="showBlindbox" :turtleColor="currentTurtleColor" @complete="showBlindbox = false" />
          <MatchCelebration
            :visible="showCelebration"
            :turtleColor="matchColor"
            :reward="matchReward"
            @complete="showCelebration = false"
          />
          <GameResult
            :visible="showResult"
            :matches="currentMatches"
            :reward="currentReward"
            :boxCount="Number(session?.boxCount || 0)"
            @close="showResult = false"
          />
          <GameSplash :visible="showSplash" @complete="showSplash = false" />
        </ErrorBoundary>
      </template>

      <template #tab-guide>
        <GuideTab :t="t" />
      </template>

      <template #tab-community>
        <CommunityTab :t="t" />
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('operationPanelTitle')">
          <NeoStats :stats="opStats" />
          <view v-if="!isConnected" class="op-connect">
            <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="connect">
              {{ t("connectWallet") }}
            </NeoButton>
          </view>
          <view v-else-if="!hasActiveSession" class="op-start">
            <view class="op-box-select">
              <text class="op-label">{{ t("buyBlindbox") }}</text>
              <NeoInput v-model="boxCount" type="number" size="sm" :placeholder="'3-20'" />
            </view>
            <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="handleStartGame">
              {{ t("startGame") }}
            </NeoButton>
          </view>
          <view v-else class="op-active">
            <NeoButton
              v-if="gamePhase === 'settling'"
              size="sm"
              variant="primary"
              class="op-btn"
              :disabled="loading"
              @click="handleSettle"
            >
              {{ t("settleRewards") }}
            </NeoButton>
            <NeoButton
              v-else-if="gamePhase === 'complete'"
              size="sm"
              variant="secondary"
              class="op-btn"
              @click="handleNewGame"
            >
              {{ t("newGame") }}
            </NeoButton>
            <view v-else class="op-hint">
              <text class="op-hint-text">{{ t("autoOpening") }}</text>
            </view>
          </view>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  MiniAppTemplate,
  NeoCard,
  NeoButton,
  NeoInput,
  NeoStats,
  SidebarPanel,
  ErrorBoundary,
} from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useTurtleGame, TurtleColor } from "@/composables/useTurtleGame";
import { useTurtleMatching } from "@/composables/useTurtleMatching";
import PlayerStats from "./components/PlayerStats.vue";
import GameBoard from "./components/GameBoard.vue";
import ConnectPrompt from "./components/ConnectPrompt.vue";
import PurchaseSection from "./components/PurchaseSection.vue";
import GuideTab from "./components/GuideTab.vue";
import CommunityTab from "./components/CommunityTab.vue";
import BlindboxOpening from "./components/BlindboxOpening.vue";
import MatchCelebration from "./components/MatchCelebration.vue";
import GameResult from "./components/GameResult.vue";
import GameSplash from "./components/GameSplash.vue";

const { t } = useI18n();
const { status } = useStatusMessage();
const APP_ID = "miniapp-turtle-match";

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "play", labelKey: "tabPlay", icon: "game", default: true },
    { key: "guide", labelKey: "tabGuide", icon: "activity" },
    { key: "community", labelKey: "tabCommunity", icon: "heart" },
    { key: "docs", labelKey: "docs", icon: "book" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["docStep1", "docStep2", "docStep3", "docStep4"],
      featureKeys: [
        { nameKey: "docFeature1Name", descKey: "docFeature1Desc" },
        { nameKey: "docFeature2Name", descKey: "docFeature2Desc" },
        { nameKey: "docFeature3Name", descKey: "docFeature3Desc" },
      ],
    },
  },
};

const appState = computed(() => ({}));

const sidebarItems = computed(() => [
  { label: t("totalSessions"), value: stats.value?.totalSessions ?? 0 },
  { label: t("matches"), value: currentMatches.value },
  { label: t("remainingBoxes"), value: remainingBoxes.value },
  { label: t("phase"), value: gamePhase.value },
]);

const opStats = computed(() => [
  { label: t("totalSessions"), value: stats.value?.totalSessions ?? 0 },
  { label: t("matches"), value: currentMatches.value },
  { label: t("remainingBoxes"), value: remainingBoxes.value },
  { label: t("phase"), value: gamePhase.value },
]);

const {
  loading,
  error,
  session,
  stats,
  isConnected,
  hasActiveSession,
  gamePhase,
  connect,
  loadStats,
  startGame,
  settleGame,
} = useTurtleGame(APP_ID);
const {
  localGame,
  matchedPairRef,
  remainingBoxes,
  currentReward,
  currentMatches,
  gridTurtles,
  initGame,
  processGameStep,
  resetLocalGame,
} = useTurtleMatching();

const activeTab = ref("play");
const boxCount = ref(5);
const showSplash = ref(true);
const showBlindbox = ref(false);
const showCelebration = ref(false);
const showResult = ref(false);
const currentTurtleColor = ref<TurtleColor>(TurtleColor.Green);
const matchColor = ref<TurtleColor>(TurtleColor.Green);
const matchReward = ref<bigint>(BigInt(0));
const isAutoPlaying = ref(false);

let autoPlayKickoffTimer: ReturnType<typeof setTimeout> | null = null;
let activeDelayTimer: ReturnType<typeof setTimeout> | null = null;
let componentUnmounted = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    activeDelayTimer = setTimeout(() => {
      activeDelayTimer = null;
      resolve();
    }, ms);
  });
}

async function handleStartGame() {
  gamePhase.value = "playing";
  const sessionId = await startGame(boxCount.value);
  if (sessionId && session.value) {
    initGame(session.value);
    autoPlayKickoffTimer = setTimeout(() => {
      autoPlayKickoffTimer = null;
      autoPlay();
    }, 500);
  } else {
    gamePhase.value = "idle";
  }
}

async function autoPlay() {
  if (!localGame.value || isAutoPlaying.value) return;
  isAutoPlaying.value = true;

  while (!localGame.value.isComplete && !componentUnmounted) {
    showBlindbox.value = true;
    const result = await processGameStep();
    if (componentUnmounted) break;

    if (result.turtle) {
      currentTurtleColor.value = result.turtle.color;
    }

    await delay(2000);
    if (componentUnmounted) break;
    showBlindbox.value = false;

    if (result.matches > 0) {
      matchColor.value = currentTurtleColor.value;
      matchReward.value = result.reward;
      showCelebration.value = true;
      await delay(2500);
      if (componentUnmounted) break;
      showCelebration.value = false;
    }

    await delay(300);
    if (componentUnmounted) break;
  }

  if (!componentUnmounted) {
    isAutoPlaying.value = false;
    gamePhase.value = "settling";
    showResult.value = true;
  }
}

async function handleSettle() {
  const success = await settleGame();
  if (success) {
    gamePhase.value = "complete";
  }
}

function handleNewGame() {
  resetLocalGame();
  gamePhase.value = "idle";
}

onMounted(() => {
  loadStats();
});

onUnmounted(() => {
  componentUnmounted = true;
  if (autoPlayKickoffTimer) clearTimeout(autoPlayKickoffTimer);
  if (activeDelayTimer) clearTimeout(activeDelayTimer);
});

const handleBoundaryError = (error: Error) => {
  console.error("[turtle-match] boundary error:", error);
};
const resetAndReload = async () => {
  loadStats();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "../../static/game.css";

:global(page) {
  background: var(--turtle-bg);
}

.pond-theme {
  --nav-bg: transparent;
  --nav-text: var(--turtle-text);
}

.op-btn {
  width: 100%;
}

.op-box-select {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.op-box-select .op-label {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  white-space: nowrap;
}

.op-hint {
  padding: 8px;
  background: var(--bg-card-subtle, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  text-align: center;
}

.op-hint-text {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.op-connect,
.op-start,
.op-active {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-banner {
  background: var(--turtle-danger-soft);
  border: 1px solid var(--turtle-danger-border);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.error-text {
  color: var(--turtle-danger-text);
  font-size: 12px;
  font-weight: 600;
}
</style>
