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
        <view class="app-container">
          <!-- Status Message -->
          <NeoCard
            v-if="status"
            :variant="status.type === 'error' ? 'danger' : 'success'"
            class="mb-4 text-center"
          >
            <text class="font-bold tracking-wider uppercase">{{ status.msg }}</text>
          </NeoCard>

          <!-- Category Tabs -->
          <CategoryTabs
            :categories="categories"
            :active-category="activeCategory"
            @select="setCategory"
          />

          <!-- Period Filter -->
          <PeriodFilter
            :periods="periods"
            :active-period="activePeriod"
            @select="setPeriod"
          />

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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { formatNumber } from "@shared/utils/format";
import { useStatusMessage } from "@shared/composables/useStatusMessage";

import CategoryTabs from "./components/CategoryTabs.vue";
import PeriodFilter from "./components/PeriodFilter.vue";
import EntrantCard from "./components/EntrantCard.vue";
import EmptyState from "./components/EmptyState.vue";

const { t } = useI18n();

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

const activeTab = ref("leaderboard");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "market-list",
  tabs: [
    { key: "leaderboard", labelKey: "tabLeaderboard", icon: "📋", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const appState = computed(() => ({
  leaderboardCount: leaderboard.value.length,
  activeCategory: activeCategory.value,
}));

const sidebarItems = computed(() => [
  { label: t("catPeople"), value: entrants.value.filter((e) => e.category === "people").length },
  { label: t("catCommunity"), value: entrants.value.filter((e) => e.category === "community").length },
  { label: t("catDeveloper"), value: entrants.value.filter((e) => e.category === "developer").length },
  { label: t("topScore"), value: topScore.value ? formatNumber(topScore.value, 0) : "—" },
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
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap");

:global(page) {
  background: var(--bg-primary);
  font-family: var(--hof-font);
}

.app-container {
  padding: 32px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
  background-color: var(--bg-primary);
  background-image: radial-gradient(circle at 1px 1px, var(--hof-texture-dot) 1px, transparent 0);
  background-size: 6px 6px;
  min-height: 100vh;
}

/* Museum Component Overrides */
:deep(.neo-card) {
  background: var(--bg-card) !important;
  border: 4px solid var(--hof-accent) !important;
  border-radius: 2px !important;
  box-shadow: var(--hof-shadow) !important;
  color: var(--text-primary) !important;
  position: relative;

  /* Frame Inner Shadow */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    box-shadow: var(--hof-shadow-inner);
    pointer-events: none;
  }

  &.variant-erobo-neo {
    border-color: var(--hof-accent-strong) !important;
    box-shadow: var(--hof-shadow-strong) !important;
  }

  &.variant-danger {
    border-color: var(--hof-danger-border) !important;
    background: var(--hof-danger-bg) !important;
    color: var(--hof-danger-text) !important;
  }

  &.variant-success {
    border-color: var(--hof-success-border) !important;
    background: var(--hof-success-bg) !important;
    color: var(--hof-success-text) !important;
  }
}

:deep(.neo-button) {
  border-radius: 4px !important;
  font-family: var(--hof-font) !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700 !important;

  &.variant-primary {
    background: linear-gradient(135deg, var(--hof-accent), var(--hof-accent-strong)) !important;
    color: var(--hof-button-text) !important;
    border: 1px solid var(--hof-accent-border) !important;
    box-shadow: var(--hof-button-shadow) !important;

    &:active {
      transform: translateY(1px);
      box-shadow: none !important;
    }
  }

  &.variant-secondary {
    background: var(--hof-secondary-bg) !important;
    border: 1px solid var(--hof-frame) !important;
    color: var(--hof-frame) !important;
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
