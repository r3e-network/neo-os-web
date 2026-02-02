<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-hall-of-fame" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <view class="app-container">
      <!-- Status Message -->
      <NeoCard v-if="statusMessage" :variant="statusType === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold uppercase tracking-wider">{{ statusMessage }}</text>
      </NeoCard>

      <!-- Leaderboard Tab -->
      <view v-if="activeTab === 'leaderboard'" class="tab-content">
        <!-- Category Tabs -->
        <view class="category-tabs-glass">
          <view
            v-for="c in categories"
            :key="c.id"
            class="category-tab-glass"
            :class="{ active: activeCategory === c.id }"
            @click="setCategory(c.id)"
          >
            <text>{{ c.label }}</text>
          </view>
        </view>

        <!-- Period Filter -->
        <view class="period-filter-glass">
          <view
            v-for="p in periods"
            :key="p.id"
            class="period-btn-glass"
            :class="{ active: activePeriod === p.id }"
            @click="setPeriod(p.id)"
          >
            <text>{{ p.label }}</text>
          </view>
        </view>

        <!-- Leaderboard List -->
        <view class="leaderboard-list">
          <NeoCard
            v-for="(entrant, index) in leaderboard"
            :key="entrant.id"
            :variant="index === 0 ? 'erobo-neo' : 'erobo'"
            class="entrant-card-glass"
          >
            <view class="entrant-inner">
              <!-- Rank -->
              <view class="rank-glass" :class="'rank-' + (index + 1)">
                <text>#{{ index + 1 }}</text>
              </view>

              <!-- Avatar -->
              <view class="avatar-glass">
                <text class="avatar-text-glass">{{ entrant.name.charAt(0) }}</text>
              </view>

              <!-- Info -->
              <view class="entrant-info">
                <text class="entrant-name-glass">{{ entrant.name }}</text>
                <view class="score-row">
                  <text class="fire-glass">🔥</text>
                  <text class="score-glass">{{ formatNumber(entrant.score, 0) }} GAS</text>
                </view>
              </view>

              <!-- Vote Button -->
              <NeoButton
                variant="primary"
                size="sm"
                :disabled="!!votingId"
                :loading="votingId === entrant.id"
                @click="handleVote(entrant)"
              >
                {{ t("boost") }}
              </NeoButton>
            </view>

            <!-- Progress Bar -->
            <view class="progress-track-glass">
              <view
                class="progress-bar-glass"
                :class="{ gold: index === 0 }"
                :style="{ width: getProgressWidth(entrant.score) }"
              >
                <view class="progress-glow" v-if="index === 0"></view>
              </view>
            </view>
          </NeoCard>
        </view>

        <NeoCard v-if="!isLoading && leaderboard.length === 0" variant="erobo" class="empty-state-card">
          <view class="empty-state-content">
            <text class="empty-state-title">{{
              fetchError ? t("leaderboardUnavailable") : t("leaderboardEmpty")
            }}</text>
            <text v-if="fetchError" class="empty-state-subtitle">{{ t("tryAgain") }}</text>
          </view>
        </NeoCard>
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>
    </view>
    <Fireworks :active="!!statusMessage && statusType === 'success'" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { formatNumber } from "@shared/utils/format";
import { ResponsiveLayout, NeoButton, NeoCard, NeoDoc, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import type { NavTab } from "@shared/components/NavBar.vue";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

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
const navTabs = computed<NavTab[]>(() => [
  { id: "leaderboard", icon: "trophy", label: t("tabLeaderboard") },
  { id: "docs", icon: "book", label: t("docs") },
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

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const activeCategory = ref<Category>("people");
const activePeriod = ref<Period>("month");
const entrants = ref<Entrant[]>([]);
const votingId = ref<string | null>(null);
const statusMessage = ref("");
const statusType = ref<"success" | "error">("success");
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
  } catch (e) {
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

function getProgressWidth(score?: number) {
  if (!score) return "0%";
  return `${(score / topScore.value) * 100}%`;
}

function showStatus(message: string, type: "success" | "error") {
  statusMessage.value = message;
  statusType.value = type;
  setTimeout(() => (statusMessage.value = ""), 5000);
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
  } catch (e: any) {
    showStatus(e.message || t("voteFailed"), "error");
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

.category-tabs-glass {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  border-bottom: 1px solid var(--hof-divider);
  padding-bottom: 16px;
}

.category-tab-glass {
  padding: 8px 16px;
  background: transparent;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--hof-font);
  letter-spacing: 0.05em;

  &.active {
    color: var(--hof-accent);
    border-bottom: 2px solid var(--hof-accent);
  }
}

.period-filter-glass {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.period-btn-glass {
  padding: 4px 12px;
  border: 1px solid var(--hof-divider);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;

  &.active {
    background: var(--hof-accent);
    color: var(--hof-button-text);
    border-color: var(--hof-accent);
  }
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.entrant-card-glass {
  margin-bottom: 0;
  padding: 24px;
}

.entrant-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.rank-glass {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--hof-font);
  width: 40px;
  text-align: center;
  color: var(--text-muted);

  &.rank-1 {
    color: var(--hof-accent);
    font-size: 32px;
  }
  &.rank-2 {
    color: var(--text-muted);
    font-size: 28px;
  }
  &.rank-3 {
    color: var(--hof-bronze);
    font-size: 28px;
  }
}

.avatar-glass {
  width: 60px;
  height: 60px;
  background: var(--hof-avatar-bg);
  border: 2px solid var(--hof-avatar-border);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.avatar-text-glass {
  font-size: 24px;
  font-weight: 700;
  color: var(--hof-frame);
  font-family: var(--hof-font);
}

.entrant-info {
  flex: 1;
}

.entrant-name-glass {
  font-size: 20px;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-family: var(--hof-font);
}

.score-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.score-glass {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

.progress-track-glass {
  height: 4px;
  background: var(--hof-progress-bg);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  margin-top: 12px;
}

.progress-bar-glass {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--hof-progress);
  border-radius: 2px;

  &.gold {
    background: var(--hof-progress-top);
  }
}

.progress-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, var(--hof-glow), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.empty-state-card {
  text-align: center;
  border: 2px dashed var(--hof-empty-border) !important;
  background: transparent !important;
  box-shadow: none !important;
}
.empty-state-content {
  padding: 40px;
}
.empty-state-title {
  font-weight: 700;
  color: var(--text-muted);
  font-family: var(--hof-font);
  font-size: 18px;
}
.empty-state-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  display: block;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}


// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
