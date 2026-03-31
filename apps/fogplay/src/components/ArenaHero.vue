<template>
  <div class="arena-hero">
    <!-- Arena Background -->
    <div class="hero-arena-bg">
      <div class="arena-ring" />
      <div class="arena-ring arena-ring-2" />
      <div :class="['arena-ambient', { flipping: isFlipping }]" />
    </div>

    <!-- 3D Coin Display -->
    <div class="coin-stage">
      <CoinArena :display-outcome="displayOutcome" :is-flipping="isFlipping" :result="result" :t="t" />
    </div>

    <!-- Result Flash -->
    <div v-if="result && !isFlipping" :class="['result-flash', result.won ? 'win' : 'lose']">
      <span class="result-flash-icon" aria-hidden="true">{{ result.won ? '\u2705' : '\u274C' }}</span>
      <span class="result-flash-text">{{ result.won ? 'WIN' : 'LOSE' }}</span>
    </div>

    <!-- Side Labels -->
    <div class="side-labels">
      <div :class="['side-badge', { active: displayOutcome === 'heads' || (!displayOutcome && !isFlipping) }]">
        <AppIcon name="legend" :size="20" class="side-icon" aria-hidden="true" />
        <span class="side-text">{{ t("heads") }}</span>
      </div>
      <div class="side-vs">{{ t("vs") }}</div>
      <div :class="['side-badge', { active: displayOutcome === 'tails' }]">
        <AppIcon name="moon" :size="20" class="side-icon" aria-hidden="true" />
        <span class="side-text">{{ t("tails") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppIcon } from "@shared/components";
import CoinArena from "../pages/index/components/CoinArena.vue";
import type { GameResult } from "../composables/useCoinFlip";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  isFlipping: boolean;
  displayOutcome: "heads" | "tails" | null;
  result: GameResult | null;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/fogplay-theme.scss" as *;

.arena-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  position: relative;
  width: 100%;
}

/* -- Arena Background -- */
.hero-arena-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.arena-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 280px;
  height: 280px;
  border: 1px dashed var(--coin-arena-ring);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: arena-spin 40s linear infinite;
}

.arena-ring-2 {
  width: 220px;
  height: 220px;
  border-color: var(--coin-arena-ring-2);
  animation-direction: reverse;
  animation-duration: 30s;
}

.arena-ambient {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, var(--coin-arena-ambient) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  transition: all 0.5s ease;

  &.flipping {
    width: 250px;
    height: 250px;
    background: radial-gradient(circle, var(--coin-arena-ambient-flip) 0%, transparent 70%);
  }
}

/* -- Coin Stage -- */
.coin-stage {
  position: relative;
  z-index: 2;
}

/* -- Side Labels -- */
.side-labels {
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 2;
}

.side-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 12px;
  background: var(--coin-record-bg);
  border: 1px solid var(--coin-record-border);
  transition: all 0.3s ease;
  opacity: 0.5;

  &.active {
    opacity: 1;
    background: var(--coin-side-active-bg);
    border-color: var(--coin-side-active-border);
    box-shadow: 0 0 12px var(--coin-side-glow);
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px var(--coin-border-faint);
  }
}

.side-icon {
  font-size: 20px;
}

.side-text {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--coin-text-muted);
}

.side-vs {
  font-size: 12px;
  font-weight: 900;
  color: var(--coin-text-muted-light);
  letter-spacing: 0.15em;
}

/* -- Result Flash -- */
.result-flash {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  border-radius: 14px;
  z-index: 10;
  animation: flash-entrance 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  &.win {
    background: rgba(52, 211, 153, 0.15);
    border: 2px solid rgba(52, 211, 153, 0.4);
    box-shadow: 0 0 30px rgba(52, 211, 153, 0.25);
  }

  &.lose {
    background: rgba(239, 68, 68, 0.15);
    border: 2px solid rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 30px rgba(239, 68, 68, 0.25);
  }
}

.result-flash-icon {
  font-size: 24px;
}

.result-flash-text {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.15em;
  text-transform: uppercase;

  .win & {
    color: #34d399;
    text-shadow: 0 0 15px rgba(52, 211, 153, 0.5);
  }
  .lose & {
    color: #f87171;
    text-shadow: 0 0 15px rgba(248, 113, 113, 0.5);
  }
}

@keyframes flash-entrance {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* -- Animations -- */
@keyframes arena-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

/* -- Responsive -- */
@media (max-width: 480px) {
  .side-labels {
    gap: 10px;
  }
  .side-badge {
    padding: 6px 12px;
  }
}

/* -- Reduced motion -- */
@media (prefers-reduced-motion: reduce) {
  .arena-ring,
  .arena-ring-2,
  .side-badge {
    animation: none;
    transition: none;
  }
}
</style>
