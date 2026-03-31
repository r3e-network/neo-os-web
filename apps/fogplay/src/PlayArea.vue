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

.coinflip-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
</style>
