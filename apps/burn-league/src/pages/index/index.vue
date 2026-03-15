<template>
  <MiniAppPage
    name="burn-league"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="refreshData"
  >
    <template #content>
      <!-- Total Burned Hero Section with Fire Animation -->
      <HeroSection :total-burned="totalBurned" />
    </template>

    <template #operation>
      <!-- Burn Action Card -->
      <BurnActionCard
        v-model:burnAmount="burnAmount"
        :estimated-reward="estimatedReward"
        :is-loading="isLoading"
        @burn="burnTokens"
      />
    </template>

    <template #tab-stats>
      <!-- Total Burned Hero Section with Fire Animation -->
      <HeroSection :total-burned="totalBurned" />

      <!-- Stats Grid -->
      <StatsDisplay :items="statsGridItems" layout="grid" :columns="2" />

      <StatsTab :row-items="statsRowItems" />

      <!-- Leaderboard in Stats Tab -->
      <LeaderboardList :leaderboard="leaderboard" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useBurnLeague } from "@/composables/useBurnLeague";

import HeroSection from "./components/HeroSection.vue";

const burnAmount = ref("1");
const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "burn-league",
  messages,
  template: {
    tabs: [{ key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true }],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "stats", value: () => `${league.totalBurned.value} GAS` },
    { labelKey: "game", value: () => `${league.userBurned.value} GAS` },
    { labelKey: "sidebarRank", value: () => league.rank.value || "-" },
    { labelKey: "sidebarBurns", value: () => league.burnCount.value },
    { labelKey: "sidebarRewardPool", value: () => `${league.rewardPool.value} GAS` },
  ],
});

const league = useBurnLeague(t);
const { address, totalBurned, rewardPool, userBurned, rank, burnCount, leaderboard, isLoading, refreshData } = league;

const appState = computed(() => ({
  totalBurned: totalBurned.value,
  userBurned: userBurned.value,
  rank: rank.value,
  burnCount: burnCount.value,
}));
const burnTokens = async () => {
  await league.burnTokens(burnAmount.value, setStatus, () => {
    burnAmount.value = "1";
  });
};

watch(
  address,
  () => {
    refreshData(setStatus);
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./burn-league-theme.scss" as *;

:global(body) {
  background: var(--burn-bg);
  font-family: var(--burn-font);
}

/* ── Burn League Hero Enhancements ── */

@keyframes flame-flicker {
  0%,
  100% {
    text-shadow:
      0 0 10px rgba(255, 100, 0, 0.6),
      0 0 20px rgba(255, 60, 0, 0.4),
      0 0 40px rgba(255, 40, 0, 0.2);
    transform: scale(1) rotate(0deg);
    opacity: 0.85;
  }
  25% {
    text-shadow:
      0 0 15px rgba(255, 120, 0, 0.8),
      0 0 30px rgba(255, 80, 0, 0.5),
      0 0 50px rgba(255, 40, 0, 0.3);
    transform: scale(1.04) rotate(-0.5deg);
    opacity: 1;
  }
  50% {
    text-shadow:
      0 0 8px rgba(255, 80, 0, 0.5),
      0 0 18px rgba(255, 50, 0, 0.3);
    transform: scale(0.98) rotate(0.5deg);
    opacity: 0.8;
  }
  75% {
    text-shadow:
      0 0 12px rgba(255, 110, 0, 0.7),
      0 0 25px rgba(255, 70, 0, 0.45);
    transform: scale(1.02) rotate(-0.3deg);
    opacity: 0.95;
  }
}

@keyframes ember-glow {
  0%,
  100% {
    box-shadow:
      0 0 15px rgba(255, 80, 0, 0.15),
      0 0 30px rgba(255, 40, 0, 0.08);
  }
  50% {
    box-shadow:
      0 0 25px rgba(255, 100, 0, 0.3),
      0 0 50px rgba(255, 60, 0, 0.15);
  }
}

:deep(.hero-section) {
  background: linear-gradient(
    145deg,
    rgba(255, 80, 0, 0.08) 0%,
    rgba(200, 30, 0, 0.06) 50%,
    rgba(255, 120, 0, 0.04) 100%
  );
  animation: ember-glow 3s ease-in-out infinite;
  transition: box-shadow 0.4s ease;
}

:deep(.hero-icon) {
  animation: flame-flicker 2s ease-in-out infinite;
}

:deep(.hero-stat) {
  background: linear-gradient(135deg, rgba(255, 100, 0, 0.1) 0%, rgba(255, 60, 0, 0.06) 100%);
  border: 1px solid rgba(255, 100, 0, 0.15);
  box-shadow: 0 0 10px rgba(255, 80, 0, 0.08);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;
}

:deep(.hero-stat:hover) {
  box-shadow: 0 0 18px rgba(255, 100, 0, 0.2);
  transform: translateY(-1px);
}

:deep(.hero-stat-value) {
  text-shadow: 0 0 6px rgba(255, 100, 0, 0.3);
}
</style>
