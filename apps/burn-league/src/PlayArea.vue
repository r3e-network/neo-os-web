<template>
  <div class="burn-play-area">
    <div class="arena-fire-border"></div>
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
@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap");

.burn-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 28px 12px 20px;
  min-height: 300px;
  position: relative;
  overflow: hidden;

  /* Ember glow from bottom */
  background:
    radial-gradient(ellipse at 50% 100%, rgba(234, 88, 12, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 0%, rgba(220, 38, 38, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 20% 80%, rgba(234, 88, 12, 0.06) 0%, transparent 30%),
    radial-gradient(circle at 80% 80%, rgba(234, 88, 12, 0.06) 0%, transparent 30%);
}

.arena-fire-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #dc2626 15%,
    #ea580c 30%,
    #fbbf24 50%,
    #ea580c 70%,
    #dc2626 85%,
    transparent 100%
  );
  animation: fire-border-pulse 3s ease-in-out infinite;
}

@keyframes fire-border-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* Arena-style headings */
:deep(h1),
:deep(h2),
:deep(h3),
:deep(.hero-title),
:deep(.section-title) {
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:deep(.burn-hero-section) {
  position: relative;
  z-index: 1;
}

:deep(.user-stats-row) {
  position: relative;
  z-index: 1;
}

/* Burn counter fire effect */
:deep(.total-burned),
:deep(.burn-count) {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2.5rem;
  letter-spacing: 0.05em;
  background: linear-gradient(180deg, #fbbf24 0%, #ea580c 50%, #dc2626 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 12px rgba(234, 88, 12, 0.5));
}

/* Leaderboard rank badges */
:deep(.leaderboard-card) {
  position: relative;
  z-index: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(234, 88, 12, 0.15);
  border-radius: 8px;
}

:deep(.rank-1) {
  color: #fbbf24;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  &::before {
    content: "\01F451";
    margin-right: 4px;
  }
}

:deep(.rank-2) {
  color: #cbd5e1;
  text-shadow: 0 0 8px rgba(203, 213, 225, 0.4);
}

:deep(.rank-3) {
  color: #d97706;
  text-shadow: 0 0 8px rgba(217, 119, 6, 0.4);
}

/* Burn action card arena styling */
:deep(.burn-action-card) {
  position: relative;
  z-index: 1;
  border-color: rgba(234, 88, 12, 0.2);
  box-shadow: 0 0 30px rgba(234, 88, 12, 0.08);
}

:deep(.neo-btn--primary) {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #ea580c 0%, #dc2626 100%);
  border: 1px solid rgba(251, 191, 36, 0.2);
  box-shadow: 0 4px 20px rgba(220, 38, 38, 0.3);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 30px rgba(220, 38, 38, 0.5), 0 0 40px rgba(234, 88, 12, 0.15);
    transform: translateY(-1px);
  }
}

/* Season progress bar ember gradient */
:deep(.season-progress) {
  background: linear-gradient(90deg, #dc2626, #ea580c, #fbbf24);
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .arena-fire-border {
    animation: none;
    opacity: 1;
  }
}
</style>
