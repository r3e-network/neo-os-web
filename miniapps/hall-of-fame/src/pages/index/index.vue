<template>
  <view class="theme-hall-of-fame">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="!!status && status.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <template #operation>
        <!-- Period Filter -->
        <PeriodFilter :periods="periods" :active-period="activePeriod" @select="setPeriod" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { formatNumber } from "@shared/utils/format";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";

import CategoryTabs from "./components/CategoryTabs.vue";
import PeriodFilter from "./components/PeriodFilter.vue";
import EntrantCard from "./components/EntrantCard.vue";
import EmptyState from "./components/EmptyState.vue";

const { t } = createUseI18n(messages)();

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

const activeTab = ref("main");

const templateConfig = createTemplateConfig({
  tabs: [{ key: "main", labelKey: "tabLeaderboard", icon: "📋", default: true }],
  fireworks: true,
});

const appState = computed(() => ({
  leaderboardCount: leaderboard.value.length,
  activeCategory: activeCategory.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "catPeople", value: () => entrants.value.filter((e) => e.category === "people").length },
  { labelKey: "catCommunity", value: () => entrants.value.filter((e) => e.category === "community").length },
  { labelKey: "catDeveloper", value: () => entrants.value.filter((e) => e.category === "developer").length },
  { labelKey: "topScore", value: () => (topScore.value ? formatNumber(topScore.value, 0) : "—") },
]);

const categories = computed(() => [
  { id: "people", label: t("catPeople") },
  { id: "community", label: t("catCommunity") },
  { id: "developer", label: t("catDeveloper") },
]);

const periods = computed(() => [
  { id: "day", label: t("period24h") },
  { id: "week", label: t("period7d") },
  { id: "month", label: t("period30d") },
  { id: "all", label: t("periodAll") },
]);

const activeCategory = ref<Category>("people");
const activePeriod = ref<Period>("month");
const entrants = ref<Entrant[]>([]);
const votingId = ref<string | null>(null);
const { status, setStatus: showStatus, clearStatus } = useStatusMessage();
const isLoading = ref(false);
const fetchError = ref(false);

const { handleBoundaryError } = useHandleBoundaryError("hall-of-fame");
const resetAndReload = async () => {
  await fetchLeaderboard();
};

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
    showStatus(t("voteSuccess"), "success");
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("voteFailed")), "error");
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
