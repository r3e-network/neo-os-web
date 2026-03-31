<template>
  <div class="coinflip-play-area">
    <!-- Arena: background rings, 3D coin, side labels -->
    <ArenaHero
      :t="t"
      :is-flipping="isFlipping"
      :display-outcome="displayOutcome"
      :result="result"
    />

    <!-- Win/Loss/Total stats bar -->
    <RecordStatsBar
      :t="t"
      :wins="wins"
      :losses="losses"
      :total-games="totalGames"
    />

    <!-- Choice selector, wager grid, flip button -->
    <WagerControls
      :t="t"
      :choice="choice"
      :bet-amount="betAmount"
      :can-bet="canBet"
      :is-flipping="isFlipping"
    />

    <!-- Result Overlay -->
    <ResultOverlay :visible="showWinOverlay" :win-amount="winAmount" @close="handleDismiss" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue -- Composition root for the FogPlay miniapp play area.
 *
 * Delegates rendering to focused sub-components:
 *   - ArenaHero: animated background, 3D coin, heads/tails labels
 *   - RecordStatsBar: win/loss/total counters
 *   - WagerControls: choice cards, wager presets, flip button (uses inject for actions)
 *   - ResultOverlay: win celebration overlay (pre-existing)
 *
 * Data flows in via props from defineMiniApp's render function.
 * Actions are dispatched via the injected MINIAPP_ACTIONS_KEY registry.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import ArenaHero from "./components/ArenaHero.vue";
import RecordStatsBar from "./components/RecordStatsBar.vue";
import WagerControls from "./components/WagerControls.vue";
import ResultOverlay from "./pages/index/components/ResultOverlay.vue";
import type { GameResult } from "./composables/useCoinFlip";

// -- Props --
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// -- State bindings --
const betAmount = computed(() => String(props.state.betAmount?.value ?? "1"));
const choice = computed(() => (props.state.choice?.value ?? "heads") as "heads" | "tails");
const isFlipping = computed(() => Boolean(props.state.isFlipping?.value ?? false));
const result = computed(() => (props.state.result?.value ?? null) as GameResult | null);
const displayOutcome = computed(() => (props.state.displayOutcome?.value ?? null) as "heads" | "tails" | null);
const showWinOverlay = computed(() => Boolean(props.state.showWinOverlay?.value ?? false));
const winAmount = computed(() => String(props.state.winAmount?.value ?? "0"));
const canBet = computed(() => Boolean(props.state.canBet?.value ?? false));
const wins = computed(() => Number(props.state.wins?.value ?? 0));
const losses = computed(() => Number(props.state.losses?.value ?? 0));
const totalGames = computed(() => Number(props.state.totalGames?.value ?? 0));

// -- Action dispatch (only for ResultOverlay dismiss, others handled by WagerControls) --
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleDismiss = async () => {
  const handler = actions.get("dismissOverlay");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap");

.coinflip-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 28px 12px 20px;
  min-height: 300px;
  text-align: center;
  position: relative;
  overflow: hidden;
  font-family: "Playfair Display", serif;

  /* Casino felt green radial */
  background:
    radial-gradient(ellipse at 50% 0%, rgba(27, 94, 32, 0.2) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, rgba(139, 0, 0, 0.12) 0%, transparent 50%);

  /* Gold border trim top */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 215, 0, 0.3) 20%,
      #ffd700 50%,
      rgba(255, 215, 0, 0.3) 80%,
      transparent 100%
    );
  }

  /* Subtle diamond pattern overlay */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 25px,
        rgba(255, 215, 0, 0.015) 25px,
        rgba(255, 215, 0, 0.015) 26px
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 25px,
        rgba(255, 215, 0, 0.015) 25px,
        rgba(255, 215, 0, 0.015) 26px
      );
    pointer-events: none;
  }
}

/* Casino-styled headings */
:deep(h1),
:deep(h2),
:deep(h3),
:deep(.arena-title) {
  font-family: "Playfair Display", serif;
  font-weight: 800;
  color: #ffd700;
  text-shadow: 0 2px 8px rgba(255, 215, 0, 0.25);
  letter-spacing: 0.03em;
}

/* Stats bar casino chip style */
:deep(.record-stats-bar) {
  position: relative;
  z-index: 1;
  background: rgba(27, 94, 32, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 8px;
}

:deep(.wager-controls) {
  position: relative;
  z-index: 1;
}

:deep(.arena-hero) {
  position: relative;
  z-index: 1;
}

/* Win amount gold styling */
:deep(.win-amount) {
  font-family: "Playfair Display", serif;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

/* Neo button casino style */
:deep(.neo-btn--primary) {
  background: linear-gradient(180deg, #ffd700 0%, #b8860b 100%);
  color: #1b1b00;
  font-family: "Playfair Display", serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 2px solid rgba(255, 215, 0, 0.4);
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 25px rgba(255, 215, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
}

/* Result overlay dramatic entrance */
:deep(.result-overlay) {
  font-family: "Playfair Display", serif;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.neo-btn--primary) {
    transition: none;
  }
}
</style>
