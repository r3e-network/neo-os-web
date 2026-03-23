<template>
  <MiniAppPage
    name="neo-treasury"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadData"
  >
    <!-- Overview Tab (default) — LEFT panel -->
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-bitcoin" compact>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <AppIcon name="money" :size="18" class="hero-stat-icon" aria-hidden="true" />
                <span class="hero-stat-value">{{ data?.totalUsd ? `$${data.totalUsd.toLocaleString()}` : t("notAvailable") }}</span>
                <span class="hero-stat-label">{{ t("sidebarTotalUsd") }}</span>
              </div>
              <div class="hero-stat">
                <AppIcon name="green_circle" :size="18" class="hero-stat-icon" aria-hidden="true" />
                <span class="hero-stat-value">{{ data?.totalNeo?.toLocaleString() ?? t("notAvailable") }}</span>
                <span class="hero-stat-label">{{ t("tokenNeo") }}</span>
              </div>
              <div class="hero-stat">
                <AppIcon name="fuel" :size="18" class="hero-stat-icon" aria-hidden="true" />
                <span class="hero-stat-value">{{ data?.totalGas?.toLocaleString() ?? t("notAvailable") }}</span>
                <span class="hero-stat-label">{{ t("tokenGas") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <!-- Main Content -->
      <div v-if="data">
        <!-- Background Refresh Indicator -->
        <div v-if="loading" class="soft-loading" role="status" aria-live="polite">
          <AppIcon name="loader" :size="16" class="animate-spin" aria-hidden="true" />
          <span class="soft-loading-text">{{ t("refreshing") }}</span>
        </div>

        <TotalSummaryCard
          :total-usd="data.totalUsd"
          :total-neo="data.totalNeo"
          :total-gas="data.totalGas"
          :last-updated="data.lastUpdated"
          :t="t"
        />

        <PriceGrid :prices="data.prices" />

        <FoundersList :categories="data.categories" :t="t" @select="goToFounder" />
      </div>

      <!-- Initial Loading State (Only if no data) -->
      <div v-else-if="loading" class="loading-container" role="status" aria-live="polite">
        <div class="skeleton-card mb-4" aria-hidden="true"></div>
        <div class="loading-overlay">
          <AppIcon name="loader" :size="48" class="mb-4 animate-spin" aria-hidden="true" />
          <span class="loading-label">{{ t("loading") }}</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container" role="alert">
        <AppIcon name="alert-circle" :size="48" class="text-danger mb-4" aria-hidden="true" />
        <span class="error-label">{{ error }}</span>
        <NeoButton type="button" variant="primary" class="mt-4" @click="loadData">
          {{ t("retry") }}
        </NeoButton>
      </div>
    </template>

    <!-- Da Hongfei Tab -->
    <template #tab-da>
      <div v-if="data">
        <FounderDetail v-if="daCategory" :category="daCategory" :prices="data.prices" :t="t" />
      </div>
    </template>

    <!-- Erik Zhang Tab -->
    <template #tab-erik>
      <div v-if="data">
        <FounderDetail v-if="erikCategory" :category="erikCategory" :prices="data.prices" :t="t" />
      </div>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('treasuryInfo')">
        <NeoButton type="button" size="sm" variant="primary" class="op-btn" :disabled="loading" @click="loadData">
          {{ loading ? t("refreshing") : t("refreshData") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppPage, NeoButton, AppIcon, HeroSection } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { fetchTreasuryData } from "@/utils/treasury";

import TotalSummaryCard from "./components/TotalSummaryCard.vue";
import PriceGrid from "./components/PriceGrid.vue";
import FoundersList from "./components/FoundersList.vue";

const activeTab = ref("total");
const loading = ref(true);
const error = ref("");
const data = ref<TreasuryData | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "neo-treasury",
  messages,
  template: {
    tabs: [
      { key: "total", labelKey: "tabTotal", icon: "📊", default: true },
      { key: "da", labelKey: "tabDa", icon: "👤" },
      { key: "erik", labelKey: "tabErik", icon: "👤" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    {
      labelKey: "sidebarTotalUsd",
      value: () => (data.value?.totalUsd ? `${t("currencySymbol")}${data.value.totalUsd.toLocaleString()}` : t("notAvailable")),
    },
    { labelKey: "sidebarTotalNeo", value: () => data.value?.totalNeo?.toLocaleString() ?? t("notAvailable") },
    { labelKey: "sidebarTotalGas", value: () => data.value?.totalGas?.toLocaleString() ?? t("notAvailable") },
    { labelKey: "sidebarFounders", value: () => data.value?.categories?.length ?? 0 },
  ],
});

const daCategory = computed(() => data.value?.categories?.find((c: { name: string }) => c.name === "Da Hongfei"));
const erikCategory = computed(() => data.value?.categories?.find((c: { name: string }) => c.name === "Erik Zhang"));

const appState = computed(() => ({
  loading: loading.value,
  error: error.value,
  totalUsd: data.value?.totalUsd,
}));
function goToFounder(name: string) {
  if (name === "Da Hongfei") activeTab.value = "da";
  else if (name === "Erik Zhang") activeTab.value = "erik";
}

const CACHE_KEY = "neo_treasury_cache";

async function loadData() {
  loading.value = true;
  error.value = "";

  // 1. Try to load from cache first
  try {
    const cached = uni.getStorageSync(CACHE_KEY);
    if (cached) {
      data.value = JSON.parse(cached);
      // If we have cache, we can stop "hard" loading but keep "soft" loading in background
    }
  } catch (_e: unknown) {
    console.warn("[neo-treasury] cache read failed:", _e instanceof Error ? _e.message : String(_e));
  }

  try {
    const freshData = await fetchTreasuryData();
    data.value = freshData;
    // 2. Save to cache
    uni.setStorageSync(CACHE_KEY, JSON.stringify(freshData));
  } catch (e: unknown) {
    if (!data.value) {
      error.value = formatErrorMessage(e, t("loadFailed"));
    } else {
      // Fresh fetch failed but cached data exists — keep stale data; user can manually retry
      console.warn("[neo-treasury] using cached data (fresh fetch failed):", e instanceof Error ? e.message : String(e));
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./neo-treasury-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  margin-bottom: 20px;
}

.hero-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-stat {
  text-align: center;
  padding: 8px 14px;
  background: rgba(255, 222, 89, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(255, 222, 89, 0.12);
}

.hero-stat-icon {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
}

.hero-stat-value {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: var(--treasury-gold, var(--text-primary));
  font-family: var(--font-family-display, "Cinzel", serif);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

.op-btn {
  width: 100%;
}

.loading-container {
  display: flex;
  flex-direction: column;
  padding: 16px;
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--treasury-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.soft-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--treasury-soft-bg);
  color: var(--treasury-gold);
  border: 1px solid var(--treasury-soft-border);
  border-radius: 99px;
  box-shadow: var(--treasury-soft-shadow);
}

.soft-loading-text {
  font-family: var(--font-family-display, "Cinzel", serif);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.skeleton-card {
  height: 120px;
  background: var(--treasury-skeleton-bg);
  border: 1px solid var(--treasury-skeleton-border);
  border-radius: 20px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
}

.error-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.loading-label,
.error-label {
  font-family: var(--font-family-display, "Cinzel", serif);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--treasury-gold);
  letter-spacing: 0.05em;
}

.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.text-danger {
  color: var(--treasury-danger);
}

/* ── Neo Treasury Hero Enhancements: Financial Dashboard ── */
@keyframes gold-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
@keyframes counter-tick {
  0%,
  100% {
    transform: translateY(0);
  }
  10% {
    transform: translateY(-2px);
  }
  20% {
    transform: translateY(0);
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 40%, rgba(255, 222, 89, 0.08) 0%, transparent 55%);
}
.hero-stat-value {
  background: linear-gradient(90deg, var(--treasury-gold), var(--treasury-light-gold, #fff8dc), var(--treasury-gold));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gold-shimmer 4s linear infinite;
}
.hero-stats {
  box-shadow: 0 4px 20px rgba(255, 222, 89, 0.1);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(255, 222, 89, 0.25);
    transform: translateY(-2px);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(255, 222, 89, 0.08);
  background: linear-gradient(180deg, rgba(255, 222, 89, 0.04), transparent);
}
.hero-stat-icon {
  animation: counter-tick 3s ease-in-out infinite;
}
.soft-loading {
  box-shadow: 0 0 16px rgba(255, 222, 89, 0.12);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card,
  .animate-spin,
  .hero-stat-value,
  .hero-stat-icon {
    animation: none;
  }
}
</style>
