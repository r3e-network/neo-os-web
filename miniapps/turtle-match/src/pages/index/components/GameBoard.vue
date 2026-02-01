<template>
  <view class="game-board">
    <view class="game-stats-row">
      <view class="stat-bubble">
        <text class="bubble-label">{{ t("remainingBoxes") }}</text>
        <text class="bubble-value">{{ remainingBoxes }}</text>
      </view>
      <view class="stat-bubble">
        <text class="bubble-label">{{ t("matches") }}</text>
        <text class="bubble-value">{{ currentMatches }}</text>
      </view>
      <view class="stat-bubble highlight">
        <text class="bubble-label">{{ t("won") }}</text>
        <text class="bubble-value gold">{{ formatGas(currentReward || 0n, 3) }} GAS</text>
      </view>
    </view>

    <view class="grid-container">
      <TurtleGrid :gridTurtles="gridTurtles" :matchedPair="matchedPair" />
    </view>

    <view class="game-actions">
      <view v-if="gamePhase === 'playing'" class="auto-play-status">
        <view class="auto-play-waves">
          <view class="p-wave" />
          <view class="p-wave" />
        </view>
        <text class="auto-play-text">{{ t("autoOpening") }}</text>
      </view>

      <NeoButton
        v-else-if="gamePhase === 'settling'"
        variant="primary"
        size="lg"
        block
        @click="$emit('settle')"
        :loading="loading"
        >{{ t("settleRewards") }}</NeoButton
      >

      <NeoButton v-else-if="gamePhase === 'complete'" variant="secondary" block @click="$emit('newGame')">
        {{ t("newGame") }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import TurtleGrid from "./TurtleGrid.vue";
import type { Turtle } from "../composables/useTurtleGame";

interface Props {
  remainingBoxes: number;
  currentMatches: number;
  currentReward: bigint;
  gridTurtles: Turtle[];
  matchedPair: number[];
  gamePhase: "idle" | "playing" | "settling" | "complete";
  loading: boolean;
  t: Function;
}

defineProps<Props>();

defineEmits<{
  settle: [];
  newGame: [];
}>();
</script>

<style lang="scss" scoped>
.game-board {
  width: 100%;
}

.game-stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.stat-bubble {
  flex: 1;
  background: var(--turtle-glass);
  backdrop-filter: blur(5px);
  border: 1px solid var(--turtle-panel-border);
  padding: 12px;
  border-radius: 16px;
  text-align: center;

  &.highlight {
    background: var(--turtle-accent-soft);
    border-color: var(--turtle-accent-border);
  }
}

.bubble-label {
  font-size: 9px;
  text-transform: uppercase;
  color: var(--turtle-text-muted);
  margin-bottom: 4px;
  display: block;
}

.bubble-value {
  font-size: 16px;
  font-weight: 800;
  color: var(--turtle-text);
  &.gold {
    color: var(--turtle-accent);
  }
}

.grid-container {
  margin-bottom: 30px;
}

.game-actions {
  display: flex;
  justify-content: center;
}

.auto-play-status {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 40px;
  background: var(--turtle-primary-soft);
  border: 1px solid var(--turtle-primary-border);
  border-radius: 40px;
  overflow: hidden;
}

.auto-play-text {
  font-size: 14px;
  font-weight: 800;
  color: var(--turtle-primary);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.auto-play-waves {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.p-wave {
  position: absolute;
  inset: 0;
  border: 1px solid var(--turtle-primary-border);
  border-radius: 40px;
  animation: pulse-wave 2s infinite;
  &:last-child {
    animation-delay: 1s;
  }
}

@keyframes pulse-wave {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.5, 2);
    opacity: 0;
  }
}
</style>
