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
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <!-- Overview Tab (default) -->
      <template #content>
        <view class="app-container">
          <!-- Main Content -->
          <view v-if="data" class="fade-in">
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
              :t="t as any"
            />

            <PriceGrid :prices="data.prices" />

            <FoundersList :categories="data.categories" :t="t as any" @select="goToFounder" />
          </view>

          <!-- Initial Loading State (Only if no data) -->
          <view v-else-if="loading" class="loading-container">
            <view class="skeleton-card mb-4"></view>
            <view class="skeleton-grid mb-4"></view>
            <view class="skeleton-list"></view>
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
        </view>
      </template>

      <!-- Da Hongfei Tab -->
      <template #tab-da>
        <view class="app-container">
          <view v-if="data" class="fade-in">
            <FounderDetail :category="daCategory!" :prices="data.prices" :t="t as any" />
          </view>
        </view>
      </template>

      <!-- Erik Zhang Tab -->
      <template #tab-erik>
        <view class="app-container">
          <view v-if="data" class="fade-in">
            <FounderDetail :category="erikCategory!" :prices="data.prices" :t="t as any" />
          </view>
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppTemplate, NeoCard, NeoButton, AppIcon } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { fetchTreasuryData, type TreasuryData, type CategoryBalance } from "@/utils/treasury";

import TotalSummaryCard from "./components/TotalSummaryCard.vue";
import PriceGrid from "./components/PriceGrid.vue";
import FoundersList from "./components/FoundersList.vue";
import FounderDetail from "./components/FounderDetail.vue";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "dashboard",
  tabs: [
    { key: "total", labelKey: "tabTotal", icon: "📊", default: true },
    { key: "da", labelKey: "tabDa", icon: "👤" },
    { key: "erik", labelKey: "tabErik", icon: "👤" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("total");
const loading = ref(true);
const error = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const data = ref<TreasuryData | null>(null);

const appState = computed(() => ({
  loading: loading.value,
  error: error.value,
  totalUsd: data.value?.totalUsd,
}));

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
  } catch {}

  try {
    const freshData = await fetchTreasuryData();
    data.value = freshData;
    // 2. Save to cache
    uni.setStorageSync(CACHE_KEY, JSON.stringify(freshData));
  } catch (e) {
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-treasury-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.app-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  gap: 16px;
  background-color: var(--treasury-bg);
  /* Gold Flakes */
  background-image:
    radial-gradient(ellipse at 50% 50%, var(--treasury-flare) 0%, transparent 60%),
    radial-gradient(circle, var(--treasury-flake) 1px, transparent 1px);
  background-size:
    auto,
    8px 8px;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Treasury Component Overrides */
:deep(.neo-card) {
  background: var(--treasury-card-bg) !important;
  border: 1px solid var(--treasury-card-border) !important;
  border-radius: 12px !important;
  box-shadow: var(--treasury-card-shadow) !important;
  color: var(--treasury-text) !important;

  /* Reflective Edge */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--treasury-card-edge);
    opacity: 0.5;
  }
}

:deep(.neo-button) {
  border-radius: 6px !important;
  font-family: "Cinzel", serif !important;
  text-transform: uppercase;
  font-weight: 700 !important;

  &.variant-primary {
    background: var(--treasury-button-bg) !important;
    color: var(--treasury-button-text) !important;
    border: 1px solid var(--treasury-button-border) !important;
    box-shadow: var(--treasury-button-shadow) !important;
    text-shadow: var(--treasury-button-text-shadow);

    &:active {
      background: var(--treasury-button-active-bg) !important;
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--treasury-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-family: "Cinzel", serif;
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
  font-family: "Cinzel", serif;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--treasury-gold);
  letter-spacing: 0.05em;
}

.status-text {
  font-family: "Cinzel", serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--treasury-text);
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

.fade-in {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.text-danger {
  color: var(--treasury-danger);
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Mobile-specific styles */
@media (max-width: 767px) {
  .app-container {
    padding: 12px;
    gap: 12px;
  }
  .tab-content {
    padding: 12px;
  }
  .loading-container {
    padding: 12px;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .app-container {
    padding: 32px;
    max-width: 1000px;
    margin: 0 auto;
  }
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
