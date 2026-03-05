<template>
  <MiniAppPage
    name="hall-of-fame"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="!!status && status.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="fetchLeaderboard"
  >
    <template #content>
      <!-- Category Tabs -->
      <CategoryTabs :categories="categories" :active-category="activeCategory" @select="setCategory" />

      <!-- Leaderboard List -->
      <view class="leaderboard-list">
        <EntrantCard
          v-for="(entrant, index) in leaderboard"
          :key="entrant.id"
          :entrant="entrant"
          :rank="index + 1"
          :top-score="topScore"
          :voting-id="votingId"
          :boost-label="t('boost')"
          @vote="handleVote"
        />
      </view>

      <EmptyState
        v-if="!isLoading && leaderboard.length === 0"
        :title="fetchError ? t('leaderboardUnavailable') : t('leaderboardEmpty')"
        :subtitle="fetchError ? t('tryAgain') : undefined"
      />
    </template>

    <template #operation>
      <!-- Period Filter -->
      <PeriodFilter :periods="periods" :active-period="activePeriod" @select="setPeriod" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { messages } from "@/locale/messages";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { MiniAppPage } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { formatNumber } from "@shared/utils/format";
import { createMiniApp } from "@shared/utils/createMiniApp";

import CategoryTabs from "./components/CategoryTabs.vue";
import EntrantCard from "./components/EntrantCard.vue";
import EmptyState from "./components/EmptyState.vue";

const APP_ID = "miniapp-hall-of-fame";
const { address, connect, chainType } = useWallet() as WalletSDK;
const { processPayment } = usePaymentFlow(APP_ID);

type Category = "people" | "community" | "developer";
type Period = "day" | "week" | "month" | "all";

interface Entrant {
  id: string;
  name: string;
  category: Category;
  score: number;
}

const activeCategory = ref<Category>("people");
const activePeriod = ref<Period>("month");
const entrants = ref<Entrant[]>([]);
const votingId = ref<string | null>(null);
const isLoading = ref(false);
const fetchError = ref(false);

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
  name: "hall-of-fame",
  messages,
  template: {
    tabs: [{ key: "main", labelKey: "tabLeaderboard", icon: "📋", default: true }],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "catPeople", value: () => entrants.value.filter((e) => e.category === "people").length },
    { labelKey: "catCommunity", value: () => entrants.value.filter((e) => e.category === "community").length },
    { labelKey: "catDeveloper", value: () => entrants.value.filter((e) => e.category === "developer").length },
    { labelKey: "topScore", value: () => (topScore.value ? formatNumber(topScore.value, 0) : "—") },
  ],
});

const appState = computed(() => ({
  leaderboardCount: leaderboard.value.length,
  activeCategory: activeCategory.value,
}));

const categories = computed(() => [
  { id: "people", label: t("catPeople") },
  { id: "community", label: t("catCommunity") },
  { id: "developer", label: t("catDeveloper") },
]);
const buildLeaderboardUrl = () => {
  const params = new URLSearchParams();
  if (activePeriod.value !== "all") {
    params.set("period", activePeriod.value);
  }
  const query = params.toString();
  return query ? `/api/hall-of-fame/leaderboard?${query}` : "/api/hall-of-fame/leaderboard";
};

// Fetch leaderboard data from API
const fetchLeaderboard = async () => {
  isLoading.value = true;
  fetchError.value = false;
  try {
    const response = await fetch(buildLeaderboardUrl());
    if (!response.ok) {
      throw new Error(t("leaderboardUnavailable"));
    }
    const data = await response.json();
    const apiEntries = Array.isArray(data.entrants) ? data.entrants : [];
    entrants.value = apiEntries;
  } catch (e: unknown) {
    entrants.value = [];
    fetchError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const leaderboard = computed(() => {
  const base = entrants.value.filter((e) => e.category === activeCategory.value);
  return base.slice().sort((a, b) => b.score - a.score);
});

const topScore = computed(() => (leaderboard.value.length > 0 ? leaderboard.value[0].score || 1 : 1));

function setCategory(id: string) {
  activeCategory.value = id as Category;
}

function setPeriod(id: string) {
  activePeriod.value = id as Period;
  fetchLeaderboard();
}

async function handleVote(entrant: Entrant) {
  if (votingId.value) return;
  votingId.value = entrant.id;

  try {
    // First, process the GAS payment
    await processPayment("1", `vote:${entrant.id}:${entrant.name}`);

    // Then, persist the vote to the backend
    const response = await fetch("/api/hall-of-fame/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entrantId: entrant.id,
        voter: address.value || undefined,
        amount: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(t("voteRecordFailed"));
    }

    await response.json();
    await fetchLeaderboard();
    setStatus(t("voteSuccess"), "success");
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("voteFailed")), "error");
  } finally {
    votingId.value = null;
  }
}

onMounted(async () => {
  initTheme();
  listenForThemeChanges();

  await connect();
  await fetchLeaderboard();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./hall-of-fame-theme.scss";

:global(page) {
  background: var(--bg-primary);
  font-family: var(--hof-font);
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
