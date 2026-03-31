<template>
  <div class="burn-play-area">
    <BurnHeroSection :t="t" :totalBurned="totalBurned" />
    <UserStatsRow :t="t" :userBurned="userBurned" :formattedRank="formattedRank" />
    <BurnActionCard
      :t="t"
      :burnAmount="burnAmount"
      :estimatedReward="estimatedReward"
      :isBurning="isBurning"
      @update:burnAmount="burnAmount = $event"
      @burn="handleBurn"
    />
    <LeaderboardCard :t="t" :entries="leaderboardPreview" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Composition root for Burn League
 *
 * Composes BurnHeroSection, UserStatsRow, BurnActionCard, and LeaderboardCard.
 * All business logic lives in useBurnLeague.ts composable; this component
 * reads props.state and dispatches actions via the injected action registry.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import type { LeaderEntry } from "./composables/useBurnLeague";
import BurnHeroSection from "./components/BurnHeroSection.vue";
import UserStatsRow from "./components/UserStatsRow.vue";
import BurnActionCard from "./components/BurnActionCard.vue";
import LeaderboardCard from "./components/LeaderboardCard.vue";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const totalBurned = computed(() => Number(props.state.totalBurned?.value ?? 0));
const userBurned = computed(() => Number(props.state.userBurned?.value ?? 0));
const formattedRank = computed(() => String(props.state.formattedRank?.value ?? "--"));
const isBurning = computed(() => Boolean(props.state.isBurning?.value ?? false));
const burnAmount = computed({
  get: () => String(props.state.burnAmount?.value ?? "1"),
  set: (v: string) => {
    if (props.state.burnAmount) props.state.burnAmount.value = v;
  },
});
const estimatedReward = computed(() => Number(props.state.estimatedReward?.value ?? 0));
const leaderboardPreview = computed(
  () => (props.state.leaderboardPreview?.value ?? []) as LeaderEntry[],
);

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleBurn = async () => {
  const handler = actions.get("burnTokens");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
.burn-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
