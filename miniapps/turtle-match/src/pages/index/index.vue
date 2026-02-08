<template>
  <view class="theme-turtle-match">
    <view class="pond-background" />
    <view class="pond-caustics" />
    <view class="neural-rain" />
    <ResponsiveLayout
      :desktop-breakpoint="1024"
      class="pond-theme"
      :title="t('title')"
      :tabs="navTabs"
      :active-tab="activeTab"
      :show-back="true"
      @tab-change="activeTab = $event">
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("operationFlow") }}</text>
          <view v-for="(step, index) in sidebarSteps" :key="step.title" class="sidebar-step">
            <view class="sidebar-step__index">{{ index + 1 }}</view>
            <view class="sidebar-step__body">
              <text class="sidebar-step__title">{{ step.title }}</text>
              <text class="sidebar-step__detail">{{ step.detail }}</text>
            </view>
          </view>
          <view class="sidebar-review">
            <text class="sidebar-review__label">{{ t("communityReviews") }}</text>
            <text class="sidebar-review__score">4.8/5</text>
            <text class="sidebar-review__meta">127 verified sessions</text>
          </view>
        </view>
      </template>

      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <view v-if="activeTab === 'play'" class="tab-content">
        <view class="game-container">
          <view class="game-header">
            <PlayerStats :stats="stats" :t="t" />
          </view>

          <view v-if="error" class="error-banner">
            <text class="error-text">{{ error }}</text>
          </view>

          <view v-if="!isConnected" class="connect-prompt">
            <GradientCard variant="erobo">
              <view class="connect-prompt__content">
                <view class="hero-turtle">
                  <TurtleSprite :color="TurtleColor.Green" matched />
                </view>
                <text class="connect-prompt__title">{{ t("title") }}</text>
                <text class="connect-prompt__desc">{{ t("description") }}</text>
                <NeoButton variant="primary" size="lg" @click="connect" :loading="loading">{{
                  t("connectWallet")
                }}</NeoButton>
              </view>
            </GradientCard>
          </view>

          <view v-else-if="!hasActiveSession" class="purchase-section">
            <view class="purchase-grid">
              <GradientCard variant="erobo-neo" class="purchase-card">
                <view class="purchase-section__content">
                  <text class="purchase-section__title">{{ t("buyBlindbox") }}</text>
                  <text class="purchase-section__price">0.1 GAS / {{ t("box") }}</text>

                  <view class="purchase-section__counter">
                    <view class="counter-btn" @click="decreaseCount">
                      <text class="btn-icon">-</text>
                    </view>
                    <text class="counter-value">{{ boxCount }}</text>
                    <view class="counter-btn" @click="increaseCount">
                      <text class="btn-icon">+</text>
                    </view>
                  </view>

                  <view class="purchase-section__total">
                    <text class="total-label">{{ t("totalPrice") }}</text>
                    <text class="total-value">{{ totalCost }} GAS</text>
                  </view>

                  <NeoButton variant="primary" size="lg" block @click="handleStartGame" :loading="loading">{{
                    t("startGame")
                  }}</NeoButton>
                </view>
              </GradientCard>
            </view>
          </view>

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
      </view>

      <view v-if="activeTab === 'guide'" class="tab-content">
        <view class="insight-grid">
          <GradientCard variant="erobo" class="insight-card">
            <text class="insight-title">{{ t("coreLogicTitle") }}</text>
            <view class="insight-list">
              <view v-for="item in coreLogicPoints" :key="item" class="insight-item">
                <text class="insight-bullet">•</text>
                <text class="insight-text">{{ item }}</text>
              </view>
            </view>
          </GradientCard>

          <GradientCard variant="erobo-neo" class="insight-card">
            <text class="insight-title">{{ t("operationPanelTitle") }}</text>
            <view class="insight-list">
              <view v-for="step in operationChecklist" :key="step" class="insight-item">
                <text class="insight-bullet">•</text>
                <text class="insight-text">{{ step }}</text>
              </view>
            </view>
          </GradientCard>
        </view>
      </view>

      <view v-if="activeTab === 'community'" class="tab-content">
        <view class="community-shell">
          <GradientCard variant="erobo" class="community-header">
            <text class="community-title">{{ t("communityReviews") }}</text>
            <text class="community-subtitle">{{ t("communityHint") }}</text>
          </GradientCard>

          <view class="reviews-list">
            <view v-for="review in reviewCards" :key="review.user" class="review-card">
              <view class="review-meta">
                <text class="review-user">{{ review.user }}</text>
                <text class="review-score">{{ review.score }}</text>
              </view>
              <text class="review-comment">{{ review.comment }}</text>
              <text class="review-tag">{{ review.tag }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'docs'" class="tab-content">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>

      <BlindboxOpening
        v-if="activeTab === 'play'"
        :visible="showBlindbox"
        :turtleColor="currentTurtleColor"
        @complete="showBlindbox = false"
      />
      <MatchCelebration
        v-if="activeTab === 'play'"
        :visible="showCelebration"
        :turtleColor="matchColor"
        :reward="matchReward"
        @complete="showCelebration = false"
      />
      <GameResult
        v-if="activeTab === 'play'"
        :visible="showResult"
        :matches="currentMatches"
        :reward="currentReward"
        :boxCount="Number(session?.boxCount || 0)"
        @close="showResult = false"
      />
      <GameSplash v-if="activeTab === 'play'" :visible="showSplash" @complete="showSplash = false" />
    </ResponsiveLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ResponsiveLayout, GradientCard, NeoButton, ChainWarning, NeoDoc } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useI18n } from "@/composables/useI18n";
import { useTurtleGame, TurtleColor } from "@/composables/useTurtleGame";
import { useTurtleMatching } from "@/composables/useTurtleMatching";
import PlayerStats from "./components/PlayerStats.vue";
import GameBoard from "./components/GameBoard.vue";
import TurtleSprite from "./components/TurtleSprite.vue";
import BlindboxOpening from "./components/BlindboxOpening.vue";
import MatchCelebration from "./components/MatchCelebration.vue";
import GameResult from "./components/GameResult.vue";
import GameSplash from "./components/GameSplash.vue";

const { t } = useI18n();
const APP_ID = "miniapp-turtle-match";

const navTabs = computed<NavTab[]>(() => [
  { id: "play", icon: "game", label: t("tabPlay") },
  { id: "guide", icon: "activity", label: t("tabGuide") },
  { id: "community", icon: "heart", label: t("tabCommunity") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const sidebarSteps = computed(() => [
  { title: t("connectWallet"), detail: t("docStep1") },
  { title: t("buyBlindbox"), detail: t("docStep2") },
  { title: t("settleRewards"), detail: t("docStep4") },
]);

const coreLogicPoints = computed(() => [t("docFeature1Desc"), t("docFeature2Desc"), t("docFeature3Desc")]);
const operationChecklist = computed(() => [t("docStep1"), t("docStep2"), t("docStep3"), t("docStep4")]);

const reviewCards = computed(() => [
  { user: "@neo-player", score: "★★★★★", comment: "Game flow is crystal clear. Connect, open, settle — done.", tag: "Fast settlement" },
  { user: "@gas-hunter", score: "★★★★☆", comment: "Operation panel is easy to follow, no confusion on transaction steps.", tag: "Great UX" },
  { user: "@turtle-collector", score: "★★★★★", comment: "Excellent mobile layout and clean desktop split-view for wallet actions.", tag: "Polished UI" },
]);

const docSteps = computed(() => [t("docStep1"), t("docStep2"), t("docStep3"), t("docStep4")]);
const docFeatures = computed(() => [
  { name: t("docFeature1Name"), desc: t("docFeature1Desc") },
  { name: t("docFeature2Name"), desc: t("docFeature2Desc") },
  { name: t("docFeature3Name"), desc: t("docFeature3Desc") },
]);

const { loading, error, session, stats, isConnected, hasActiveSession, gamePhase, connect, loadStats, startGame, settleGame } = useTurtleGame(APP_ID);
const { localGame, matchedPairRef, remainingBoxes, currentReward, currentMatches, gridTurtles, initGame, processGameStep, resetLocalGame } = useTurtleMatching();

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

const totalCost = computed(() => {
  const price = 0.1;
  return (price * boxCount.value).toFixed(1);
});

function increaseCount() {
  if (boxCount.value < 20) boxCount.value++;
}

function decreaseCount() {
  if (boxCount.value > 3) boxCount.value--;
}

async function handleStartGame() {
  gamePhase.value = "playing";
  const sessionId = await startGame(boxCount.value);
  if (sessionId && session.value) {
    initGame(session.value);
    setTimeout(() => autoPlay(), 500);
  } else {
    gamePhase.value = "idle";
  }
}

async function autoPlay() {
  if (!localGame.value || isAutoPlaying.value) return;
  isAutoPlaying.value = true;

  while (!localGame.value.isComplete) {
    showBlindbox.value = true;
    const result = await processGameStep();

    if (result.turtle) {
      currentTurtleColor.value = result.turtle.color;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    showBlindbox.value = false;

    if (result.matches > 0) {
      matchColor.value = currentTurtleColor.value;
      matchReward.value = result.reward;
      showCelebration.value = true;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      showCelebration.value = false;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  isAutoPlaying.value = false;
  gamePhase.value = "settling";
  showResult.value = true;
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
</script>

<style lang="scss" scoped>
@import "@shared/styles/variables.scss";
@import "@shared/styles/tokens.scss";
@import "../../static/game.css";

.pond-theme {
  --nav-bg: transparent;
  --nav-text: var(--turtle-text);
}

.tab-content {
  min-height: 0;
}

.game-container {
  padding-top: 20px;
  position: relative;
  overflow: hidden;
}

.game-header {
  margin: 0 20px 30px;
}

.connect-prompt__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.hero-turtle {
  width: 180px;
  height: 180px;
  margin-bottom: 30px;
  filter: drop-shadow(0 20px 40px var(--turtle-primary-glow-strong));
  animation: hero-float 4s ease-in-out infinite;
}

@keyframes hero-float {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

.connect-prompt__title {
  font-size: 28px;
  font-weight: 900;
  color: var(--turtle-text);
  text-shadow: 0 2px 10px var(--turtle-title-shadow);
}

.connect-prompt__desc {
  font-size: 14px;
  color: var(--turtle-text-subtle);
  text-align: center;
  line-height: 1.6;
}

.purchase-grid {
  padding: 0 20px;
}

.purchase-card {
  border: 1px solid var(--turtle-primary-border);
}

.purchase-section__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
}

.purchase-section__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--turtle-text);
  letter-spacing: 1px;
}

.purchase-section__price {
  font-size: 12px;
  font-weight: 700;
  color: var(--turtle-primary);
  background: var(--turtle-primary-soft);
  padding: 4px 12px;
  border-radius: 20px;
}

.purchase-section__counter {
  display: flex;
  align-items: center;
  gap: 30px;
  background: var(--turtle-panel-bg);
  padding: 8px 16px;
  border-radius: 40px;
  border: 1px solid var(--turtle-panel-border);
}

.counter-btn {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background: linear-gradient(135deg, var(--turtle-primary) 0%, var(--turtle-primary-strong) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--turtle-primary-glow-strong);

  &:active {
    transform: scale(0.95);
  }
}

.btn-icon {
  color: var(--turtle-text);
  font-size: 24px;
  font-weight: 800;
}

.counter-value {
  font-size: 40px;
  font-weight: 900;
  color: var(--turtle-text);
  min-width: 80px;
  text-align: center;
}

.purchase-section__total {
  text-align: center;
}

.total-label {
  font-size: 12px;
  color: var(--turtle-text-muted);
  display: block;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.total-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--turtle-accent);
}

.game-area {
  padding: 0 20px;
}

.error-banner {
  background: var(--turtle-danger-soft);
  border: 1px solid var(--turtle-danger-border);
  padding: 12px;
  margin: 0 20px 20px;
  border-radius: 12px;
  text-align: center;
}

.error-text {
  color: var(--turtle-danger-text);
  font-size: 12px;
  font-weight: 600;
}

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

.sidebar-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-step__index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--turtle-primary-soft);
  color: var(--turtle-primary);
  font-size: 12px;
  font-weight: 800;
}

.sidebar-step__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-step__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--turtle-text);
}

.sidebar-step__detail {
  font-size: 11px;
  line-height: 1.5;
  color: var(--turtle-text-subtle);
}

.sidebar-review {
  padding: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(132, 204, 22, 0.12), rgba(59, 130, 246, 0.1));
  border: 1px solid rgba(132, 204, 22, 0.28);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-review__label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--turtle-text-subtle);
}

.sidebar-review__score {
  font-size: 18px;
  font-weight: 900;
  color: var(--turtle-text);
}

.sidebar-review__meta {
  font-size: 11px;
  color: var(--turtle-text-muted);
}

.insight-grid {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.insight-card {
  border: 1px solid var(--turtle-panel-border);
}

.insight-title {
  display: block;
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 800;
  color: var(--turtle-text);
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.insight-bullet {
  color: var(--turtle-primary);
  font-size: 14px;
  line-height: 1.4;
}

.insight-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.6;
  color: var(--turtle-text-subtle);
}

.community-shell {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.community-header {
  border: 1px solid var(--turtle-primary-border);
}

.community-title {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--turtle-text);
}

.community-subtitle {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--turtle-text-subtle);
}

.reviews-list {
  display: grid;
  gap: 12px;
}

.review-card {
  padding: 14px;
  border-radius: 12px;
  background: var(--turtle-panel-bg);
  border: 1px solid var(--turtle-panel-border);
}

.review-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-user {
  font-size: 13px;
  font-weight: 700;
  color: var(--turtle-text);
}

.review-score {
  font-size: 12px;
  color: var(--turtle-primary);
}

.review-comment {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--turtle-text-subtle);
}

.review-tag {
  display: inline-block;
  margin-top: 10px;
  font-size: 11px;
  color: var(--turtle-primary);
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--turtle-primary-soft);
}

@media (max-width: 767px) {
  .game-container {
    padding-top: 12px;
  }

  .game-header {
    margin: 0 12px 20px;
  }

  .purchase-grid {
    padding: 0 12px;
  }

  .purchase-section__counter {
    gap: 20px;
  }

  .counter-value {
    font-size: 32px;
    min-width: 60px;
  }

  .counter-btn {
    width: 40px;
    height: 40px;
  }

  .game-area {
    padding: 0 12px;
  }

  .hero-turtle {
    width: 120px;
    height: 120px;
  }

  .insight-grid,
  .community-shell {
    padding: 12px;
  }
}

@media (min-width: 1024px) {
  .game-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .purchase-section__content {
    max-width: 500px;
    margin: 0 auto;
  }

  .insight-grid,
  .community-shell {
    padding: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
}
</style>
