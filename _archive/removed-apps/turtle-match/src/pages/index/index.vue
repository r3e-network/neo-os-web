<template>
  <MiniAppPage
    name="turtle-match"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    class="pond-theme"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadStats"
  >
    <template #content>
      <div class="game-container">
        <GradientCard variant="erobo">
          <StatsDisplay :items="playerStatsItems" layout="grid" :columns="2" />
        </GradientCard>

        <div v-if="error" class="error-banner" role="alert" aria-live="assertive">
          <span class="error-text">{{ error }}</span>
        </div>

        <GradientCard v-if="!isConnected" variant="erobo">
          <div class="connect-prompt">
            <span class="connect-title">{{ t("title") }}</span>
            <span class="connect-desc">{{ t("description") }}</span>
            <NeoButton variant="primary" size="lg" :loading="loading" @click="connect">{{
              t("connectWallet")
            }}</NeoButton>
          </div>
        </GradientCard>

        <PurchaseSection
          v-else-if="!hasActiveSession"
          v-model:boxCount="boxCount"
          :loading="loading"
          @start="handleStartGame"
        />

        <div v-else class="game-area">
          <GameBoard
            :remainingBoxes="remainingBoxes"
            :currentMatches="currentMatches"
            :currentReward="currentReward"
            :gridTurtles="gridTurtles"
            :matchedPair="matchedPairRef"
            :gamePhase="gamePhase"
            :loading="loading"
            @settle="handleSettle"
            @newGame="handleNewGame"
          />
        </div>
      </div>

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
    </template>

    <template #tab-guide>
      <GuideTab />
    </template>

    <template #tab-community>
      <CommunityTab />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('operationPanelTitle')">
        <div v-if="!isConnected" class="op-connect">
          <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="connect">
            {{ t("connectWallet") }}
          </NeoButton>
        </div>
        <div v-else-if="!hasActiveSession" class="op-start">
          <div class="op-box-select">
            <span class="op-label">{{ t("buyBlindbox") }}</span>
            <NeoInput v-model="boxCount" type="number" size="sm" :placeholder="'3-20'" />
          </div>
          <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="handleStartGame">
            {{ t("startGame") }}
          </NeoButton>
        </div>
        <div v-else class="op-active">
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
          <div v-else class="op-hint">
            <span class="op-hint-text">{{ t("autoOpening") }}</span>
          </div>
        </div>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { MiniAppPage, GradientCard, StatsDisplay, NeoButton } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import GameBoard from "./components/GameBoard.vue";
import PurchaseSection from "./components/PurchaseSection.vue";
import BlindboxOpening from "./components/BlindboxOpening.vue";
import MatchCelebration from "./components/MatchCelebration.vue";
import GameResult from "./components/GameResult.vue";
import GameSplash from "./components/GameSplash.vue";
import { useTurtleMatchPage } from "./composables/useTurtleMatchPage";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "turtle-match",
  messages,
  template: {
    tabs: [
      { key: "play", labelKey: "tabPlay", icon: "game", default: true },
      { key: "guide", labelKey: "tabGuide", icon: "activity" },
      { key: "community", labelKey: "tabCommunity", icon: "heart" },
    ],
    docFeatureCount: 3,
    docStepPrefix: "docStep",
    docFeaturePrefix: "docFeature",
  },
  sidebarItems: [
    { labelKey: "totalSessions", value: () => stats.value?.totalSessions ?? 0 },
    { labelKey: "matches", value: () => currentMatches.value },
    { labelKey: "remainingBoxes", value: () => remainingBoxes.value },
    { labelKey: "phase", value: () => gamePhase.value },
  ],
});

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
  matchedPairRef,
  remainingBoxes,
  currentReward,
  currentMatches,
  gridTurtles,
  boxCount,
  showSplash,
  showBlindbox,
  showCelebration,
  showResult,
  currentTurtleColor,
  matchColor,
  matchReward,
  appState,
  playerStatsItems,
  opStats,
  handleStartGame,
  handleSettle,
  handleNewGame,
} = useTurtleMatchPage(t);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "../../static/game.css";

:global(body) {
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

.connect-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.connect-title {
  font-size: 28px;
  font-weight: 900;
}

.connect-desc {
  font-size: 14px;
  text-align: center;
  line-height: 1.6;
  opacity: 0.7;
}
</style>
