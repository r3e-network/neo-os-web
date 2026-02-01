<template>
  <view class="theme-turtle-match">
    <view class="pond-background" />
    <view class="pond-caustics" />
    <view class="neural-rain" />
    <ResponsiveLayout :desktop-breakpoint="1024" class="pond-theme" :title="t('title')" :show-back="true"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />
      <view class="game-container">
        <!-- Header Stats -->
        <view class="game-header">
          <PlayerStats :stats="stats" :t="t" />
        </view>

        <view v-if="error" class="error-banner">
          <text class="error-text">{{ error }}</text>
        </view>

        <!-- Not Connected -->
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

        <!-- Purchase Section -->
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

        <!-- Active Game -->
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

      <!-- Animations -->
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
    </ResponsiveLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ResponsiveLayout, GradientCard, NeoButton, ChainWarning } from "@shared/components";
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

const { loading, error, session, stats, isConnected, hasActiveSession, gamePhase, connect, loadStats, startGame, settleGame } = useTurtleGame(APP_ID);
const { localGame, matchedPairRef, remainingBoxes, currentReward, currentMatches, gridTurtles, initGame, processGameStep, resetLocalGame } = useTurtleMatching();

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
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-20px) rotate(5deg); }
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

  &:active { transform: scale(0.95); }
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

@media (max-width: 767px) {
  .game-container { padding-top: 12px; }
  .game-header { margin: 0 12px 20px; }
  .purchase-grid { padding: 0 12px; }
  .purchase-section__counter { gap: 20px; }
  .counter-value { font-size: 32px; min-width: 60px; }
  .counter-btn { width: 40px; height: 40px; }
  .game-area { padding: 0 12px; }
  .hero-turtle { width: 120px; height: 120px; }
}

@media (min-width: 1024px) {
  .game-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .purchase-section__content { max-width: 500px; margin: 0 auto; }
}
</style>
