<template>
  <view class="theme-neo-treasury">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Overview Tab (default) — LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Main Content -->
          <view v-if="data">
            <!-- Background Refresh Indicator -->
            <view v-if="loading" class="soft-loading">
              <AppIcon name="loader" :size="16" class="animate-spin" />
              <text class="soft-loading-text">{{ t("refreshing") }}</text>
            </view>

            <TotalSummaryCard
              :total-usd="data.totalUsd"
              :total-neo="data.totalNeo"
              :total-gas="data.totalGas"
              :last-updated="data.lastUpdated"
              :t="t"
            />

            <PriceGrid :prices="data.prices" />

            <FoundersList :categories="data.categories" :t="t" @select="goToFounder" />
          </view>

          <!-- Initial Loading State (Only if no data) -->
          <view v-else-if="loading" class="loading-container">
            <view class="skeleton-card mb-4"></view>
            <view class="loading-overlay">
              <AppIcon name="loader" :size="48" class="mb-4 animate-spin" />
              <text class="loading-label">{{ t("loading") }}</text>
            </view>
          </view>

          <!-- Error State -->
          <view v-else-if="error" class="error-container">
            <AppIcon name="alert-circle" :size="48" class="text-danger mb-4" />
            <text class="error-label">{{ error }}</text>
            <NeoButton variant="primary" class="mt-4" @click="loadData">
              {{ t("retry") }}
            </NeoButton>
          </view>
        </ErrorBoundary>
      </template>

      <!-- Da Hongfei Tab -->
      <template #tab-da>
        <view v-if="data">
          <FounderDetail :category="daCategory!" :prices="data.prices" :t="t" />
        </view>
      </template>

      <!-- Erik Zhang Tab -->
      <template #tab-erik>
        <view v-if="data">
          <FounderDetail :category="erikCategory!" :prices="data.prices" :t="t" />
        </view>
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('treasuryInfo')">
          <NeoStats :stats="opStats" />
          <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="loadData">
            {{ loading ? t("refreshing") : t("refreshData") }}
          </NeoButton>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  MiniAppTemplate,
  NeoCard,
  NeoButton,
  NeoStats,
  AppIcon,
  SidebarPanel,
  ErrorBoundary,
} from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { fetchTreasuryData, type TreasuryData, type CategoryBalance } from "@/utils/treasury";

import TotalSummaryCard from "./components/TotalSummaryCard.vue";
import PriceGrid from "./components/PriceGrid.vue";
import FoundersList from "./components/FoundersList.vue";
import FounderDetail from "./components/FounderDetail.vue";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "total", labelKey: "tabTotal", icon: "📊", default: true },
    { key: "da", labelKey: "tabDa", icon: "👤" },
    { key: "erik", labelKey: "tabErik", icon: "👤" },
  ],
  docFeatureCount: 3,
});

const activeTab = ref("total");
const loading = ref(true);
const error = ref("");
const { status } = useStatusMessage();
const data = ref<TreasuryData | null>(null);

const appState = computed(() => ({
  loading: loading.value,
  error: error.value,
  totalUsd: data.value?.totalUsd,
}));

const sidebarItems = createSidebarItems(t, [
  {
    labelKey: "sidebarTotalUsd",
    value: () => (data.value?.totalUsd ? `$${data.value.totalUsd.toLocaleString()}` : "—"),
  },
  { labelKey: "sidebarTotalNeo", value: () => data.value?.totalNeo?.toLocaleString() ?? "—" },
  { labelKey: "sidebarTotalGas", value: () => data.value?.totalGas?.toLocaleString() ?? "—" },
  { labelKey: "sidebarFounders", value: () => data.value?.categories?.length ?? 0 },
]);

const opStats = computed(() => [
  { label: t("sidebarTotalUsd"), value: data.value?.totalUsd ? `$${data.value.totalUsd.toLocaleString()}` : "—" },
  { label: t("sidebarTotalNeo"), value: data.value?.totalNeo?.toLocaleString() ?? "—" },
  { label: t("sidebarTotalGas"), value: data.value?.totalGas?.toLocaleString() ?? "—" },
  { label: t("sidebarFounders"), value: data.value?.categories?.length ?? 0 },
]);

const daCategory = computed<CategoryBalance | null>(() => {
  return data.value?.categories.find((c: CategoryBalance) => c.name === "Da Hongfei") || null;
});

const erikCategory = computed<CategoryBalance | null>(() => {
  return data.value?.categories.find((c: CategoryBalance) => c.name === "Erik Zhang") || null;
});

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
  } catch {
    /* Cache read failure is non-critical — proceed to fetch fresh data */
  }

  try {
    const freshData = await fetchTreasuryData();
    data.value = freshData;
    // 2. Save to cache
    uni.setStorageSync(CACHE_KEY, JSON.stringify(freshData));
  } catch (e: unknown) {
    if (!data.value) {
      error.value = t("loadFailed");
    } else {
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

const { handleBoundaryError } = useHandleBoundaryError("neo-treasury");
const resetAndReload = async () => {
  await loadData();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-treasury-theme.scss";

:global(page) {
  background: var(--bg-primary);
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
</style>
