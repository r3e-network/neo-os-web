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
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./burn-league-theme.scss";

:global(page) {
  background: var(--burn-bg);
  font-family: var(--burn-font);
}
</style>
