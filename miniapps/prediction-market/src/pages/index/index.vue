<template>
  <MiniAppPage
    name="prediction-market"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="statusMessage"
    @tab-change="handleTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadMarkets"
  >
    <!-- Desktop Sidebar - Stats -->
    <!-- Markets Tab (default content) - LEFT panel -->
    <template #content>
      <MarketList
        :markets="filteredMarkets"
        :categories="categories"
        :selectedCategory="filters.category"
        :sortLabel="sortLabel"
        :loading="loadingMarkets"
        :isDesktop="isDesktop"
        @select="selectMarket"
        @selectCategory="setCategory"
        @toggleSort="toggleSort"
      />
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
        <StatsDisplay :items="marketStats" layout="rows" />
      </NeoCard>
    </template>

    <!-- Trading Tab -->
    <template #tab-trading>
      <MarketDetail
        v-if="selectedMarket"
        :market="selectedMarket"
        :your-orders="yourOrders"
        :your-positions="yourPositions"
        :is-trading="isTrading"
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
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { usePredictionMarkets } from "@/composables/usePredictionMarkets";
import { usePredictionTrading } from "@/composables/usePredictionTrading";
import MarketList from "./components/MarketList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "prediction-market",
  messages,
  template: {
    tabs: [
      { key: "markets", labelKey: "markets", icon: "📊", default: true },
      { key: "trading", labelKey: "trading", icon: "📈" },
      { key: "portfolio", labelKey: "portfolio", icon: "💼" },
      { key: "create", labelKey: "create", icon: "➕" },
    ],
    docFeatureCount: 4,
  },
  sidebarItems: [
    { labelKey: "markets", value: () => markets.value.length },
    { labelKey: "sidebarVolume", value: () => `${formatCurrency(totalVolume.value)} GAS` },
    { labelKey: "sidebarTraders", value: () => activeTraders.value },
    { labelKey: "portfolioValue", value: () => `${formatCurrency(portfolioValue.value)} GAS` },
    { labelKey: "totalPnL", value: () => `${totalPnL.value > 0 ? "+" : ""}${formatCurrency(totalPnL.value)} GAS` },
  ],
});
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

const marketStats = computed<StatsDisplayItem[]>(() => [
  { label: t("markets"), value: markets.value.length },
  { label: t("sidebarVolume"), value: `${formatCurrency(totalVolume.value)} GAS` },
  { label: t("sidebarTraders"), value: activeTraders.value },
]);

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
  await doTrade(selectedMarket.value, params);
};

const cancelOrder = async (orderId: number) => {
  await doCancel(orderId);
};

const claimWinnings = async (marketId: number) => {
  await doClaim(marketId);
};

const createMarket = async (marketData: Record<string, unknown>) => {
  isCreating.value = true;
  await doCreate(marketData);
  isCreating.value = false;
};

const formatCurrency = (value: number) => {
  return value.toFixed(2);
};

onMounted(() => {
  loadMarkets();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@import "./prediction-market-theme.scss";

:global(page) {
  background: var(--predict-bg);
}

.portfolio-summary {
  @include grid-layout(2, 12px);
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
