<template>
  <view class="theme-prediction-market">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMessage"
      @tab-change="handleTabChange"
    >
      <!-- Desktop Sidebar - Stats -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Markets Tab (default content) - LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <MarketList
            :markets="filteredMarkets"
            :categories="categories"
            :selectedCategory="filters.category"
            :sortLabel="sortLabel"
            :loading="loadingMarkets"
            :isDesktop="isDesktop"
            :t="t"
            @select="selectMarket"
            @selectCategory="setCategory"
            @toggleSort="toggleSort"
          />
        </ErrorBoundary>
      </template>

      <!-- RIGHT panel: Actions -->
      <template #operation>
        <NeoCard variant="erobo" :title="t('markets')">
          <view class="action-buttons">
            <NeoButton variant="primary" size="lg" block @click="activeTab = 'create'">
              {{ t("create") }}
            </NeoButton>
            <NeoButton variant="secondary" size="lg" block @click="activeTab = 'portfolio'">
              {{ t("portfolio") }}
            </NeoButton>
          </view>
        </NeoCard>
        <NeoStats :stats="marketStats" />
      </template>

      <!-- Trading Tab -->
      <template #tab-trading>
        <MarketDetail
          v-if="selectedMarket"
          :market="selectedMarket"
          :your-orders="yourOrders"
          :your-positions="yourPositions"
          :is-trading="isTrading"
          :t="t"
          @trade="executeTrade"
          @cancel-order="cancelOrder"
          @back="handleBackToMarkets"
        />
      </template>

      <!-- Portfolio Tab -->
      <template #tab-portfolio>
        <view class="portfolio-summary">
          <view class="summary-card">
            <text class="summary-label">{{ t("portfolioValue") }}</text>
            <text class="summary-value">{{ formatCurrency(portfolioValue) }} GAS</text>
          </view>
          <view class="summary-card" :class="{ positive: totalPnL > 0, negative: totalPnL < 0 }">
            <text class="summary-label">{{ t("totalPnL") }}</text>
            <text class="summary-value">{{ totalPnL > 0 ? "+" : "" }}{{ formatCurrency(totalPnL) }} GAS</text>
          </view>
        </view>
        <PortfolioView :positions="yourPositions" :orders="yourOrders" @claim="claimWinnings" />
      </template>

      <!-- Create Tab -->
      <template #tab-create>
        <CreateMarketForm :is-creating="isCreating" @submit="createMarket" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { usePredictionMarkets, type PredictionMarket } from "@/composables/usePredictionMarkets";
import { usePredictionTrading, type TradeParams } from "@/composables/usePredictionTrading";
import MarketList from "./components/MarketList.vue";
import MarketDetail from "./components/MarketDetail.vue";
import PortfolioView from "./components/PortfolioView.vue";
import CreateMarketForm from "./components/CreateMarketForm.vue";

const { t } = useI18n();
const APP_ID = "miniapp-prediction-market";

const activeTab = ref("markets");
const selectedMarket = ref<PredictionMarket | null>(null);
const isCreating = ref(false);

const {
  markets,
  filteredMarkets,
  categories,
  loadingMarkets,
  totalVolume,
  activeTraders,
  filters,
  error: marketsError,
  getCategoryCount,
  loadMarkets,
  setCategory,
  toggleSort,
} = usePredictionMarkets();

const {
  yourOrders,
  yourPositions,
  portfolioValue,
  totalPnL,
  isTrading,
  error: tradingError,
  executeTrade: doTrade,
  cancelOrder: doCancel,
  claimWinnings: doClaim,
  createMarket: doCreate,
} = usePredictionTrading(APP_ID);

const error = computed(() => marketsError.value || tradingError.value);
const statusMessage = computed(() => (error.value ? { msg: error.value, type: "error" as const } : null));

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "markets", labelKey: "markets", icon: "📊", default: true },
    { key: "trading", labelKey: "trading", icon: "📈" },
    { key: "portfolio", labelKey: "portfolio", icon: "💼" },
    { key: "create", labelKey: "create", icon: "➕" },
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
        { nameKey: "feature4Name", descKey: "feature4Desc" },
      ],
    },
  },
};

const isDesktop = computed(() => {
  try {
    return window.innerWidth >= 768;
  } catch {
    return false;
  }
});

const sortLabel = computed(() => {
  const labels: Record<string, string> = {
    volume: t("sortByVolume"),
    newest: t("sortByNewest"),
    ending: t("sortByEnding"),
  };
  return labels[filters.value.sortBy] || t("sortByVolume");
});

const appState = computed(() => ({
  totalMarkets: markets.value.length,
  totalVolume: totalVolume.value,
  activeTraders: activeTraders.value,
  portfolioValue: portfolioValue.value,
  totalPnL: totalPnL.value,
}));

const sidebarItems = computed(() => [
  { label: t("markets"), value: markets.value.length },
  { label: t("sidebarVolume"), value: `${formatCurrency(totalVolume.value)} GAS` },
  { label: t("sidebarTraders"), value: activeTraders.value },
  { label: t("portfolioValue"), value: `${formatCurrency(portfolioValue.value)} GAS` },
  { label: t("totalPnL"), value: `${totalPnL.value > 0 ? "+" : ""}${formatCurrency(totalPnL.value)} GAS` },
]);

const marketStats = computed(() => [
  { label: t("markets"), value: markets.value.length },
  { label: t("sidebarVolume"), value: `${formatCurrency(totalVolume.value)} GAS` },
  { label: t("sidebarTraders"), value: activeTraders.value },
]);

const handleBoundaryError = (error: Error) => {
  console.error("[prediction-market] boundary error:", error);
};
const resetAndReload = async () => {
  await loadMarkets(t);
};

const handleTabChange = (tab: string) => {
  activeTab.value = tab;
  if (tab !== "trading") {
    selectedMarket.value = null;
  }
};

const handleBackToMarkets = () => {
  activeTab.value = "markets";
  selectedMarket.value = null;
};

const selectMarket = (market: PredictionMarket) => {
  selectedMarket.value = market;
  activeTab.value = "trading";
};

const executeTrade = async (params: TradeParams) => {
  if (!selectedMarket.value) return;
  await doTrade(selectedMarket.value, params, t);
};

const cancelOrder = async (orderId: number) => {
  await doCancel(orderId, t);
};

const claimWinnings = async (marketId: number) => {
  await doClaim(marketId, t);
};

const createMarket = async (marketData: Record<string, unknown>) => {
  isCreating.value = true;
  await doCreate(marketData, t);
  isCreating.value = false;
};

const formatCurrency = (value: number) => {
  return value.toFixed(2);
};

onMounted(() => {
  loadMarkets(t);
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./prediction-market-theme.scss";

:global(page) {
  background: var(--predict-bg);
}

.portfolio-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  background: var(--pm-card-bg);
  border: 1px solid var(--pm-border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;

  &.positive {
    border-color: var(--pm-success-border, rgba(16, 185, 129, 0.3));
    .summary-value {
      color: var(--pm-success);
    }
  }

  &.negative {
    border-color: var(--pm-danger-border, rgba(239, 68, 68, 0.3));
    .summary-value {
      color: var(--pm-danger);
    }
  }
}

.summary-label {
  font-size: 12px;
  color: var(--pm-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--pm-text);
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
