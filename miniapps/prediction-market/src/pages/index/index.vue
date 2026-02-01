<template>
  <view class="theme-prediction-market">
    <ResponsiveLayout 
      :title="t('title')"
      :nav-items="navItems"
      :active-tab="activeTab"
      :show-sidebar="isDesktop"
      layout="sidebar"
      @navigate="handleTabChange"
    >
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <!-- Desktop Sidebar - Stats -->
      <template #desktop-sidebar>
        <MarketStats
          :totalMarkets="markets.length"
          :totalVolume="totalVolume"
          :activeTraders="activeTraders"
          :categories="categories"
          :selectedCategory="filters.category"
          :t="t"
          :getCategoryCount="getCategoryCount"
          :formatCurrency="formatCurrency"
          @selectCategory="setCategory"
        />
      </template>

      <!-- Markets Tab -->
      <view v-if="activeTab === 'markets'" class="tab-content">
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
      </view>

      <!-- Trading Tab -->
      <view v-if="activeTab === 'trading' && selectedMarket" class="tab-content">
        <MarketDetail
          :market="selectedMarket"
          :your-orders="yourOrders"
          :your-positions="yourPositions"
          :is-trading="isTrading"
          @trade="executeTrade"
          @cancel-order="cancelOrder"
          @back="handleBackToMarkets"
        />
      </view>

      <!-- Portfolio Tab -->
      <view v-if="activeTab === 'portfolio'" class="tab-content">
        <view class="portfolio-summary">
          <view class="summary-card">
            <text class="summary-label">{{ t("portfolioValue") }}</text>
            <text class="summary-value">{{ formatCurrency(portfolioValue) }} GAS</text>
          </view>
          <view class="summary-card" :class="{ positive: totalPnL > 0, negative: totalPnL < 0 }">
            <text class="summary-label">{{ t("totalPnL") }}</text>
            <text class="summary-value">{{ totalPnL > 0 ? '+' : '' }}{{ formatCurrency(totalPnL) }} GAS</text>
          </view>
        </view>
        <PortfolioView
          :positions="yourPositions"
          :orders="yourOrders"
          @claim="claimWinnings"
        />
      </view>

      <!-- Create Tab -->
      <view v-if="activeTab === 'create'" class="tab-content">
        <CreateMarketForm :is-creating="isCreating" @submit="createMarket" />
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>

      <!-- Error Toast -->
      <view v-if="error" class="error-toast">
        <text>{{ error }}</text>
      </view>
    </ResponsiveLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ResponsiveLayout, NeoDoc, ChainWarning } from "@shared/components";
import type { NavItem } from "@shared/components/ResponsiveLayout.vue";
import { useI18n } from "@/composables/useI18n";
import { usePredictionMarkets, type PredictionMarket } from "@/composables/usePredictionMarkets";
import { usePredictionTrading, type TradeParams } from "@/composables/usePredictionTrading";
import MarketList from "./components/MarketList.vue";
import MarketStats from "./components/MarketStats.vue";
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

const navItems = computed<NavItem[]>(() => [
  { key: "markets", label: t("markets"), icon: "📊" },
  { key: "portfolio", label: t("portfolio"), icon: "💼" },
  { key: "create", label: t("create"), icon: "➕" },
  { key: "docs", label: t("docs"), icon: "📖" },
]);

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

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
  { name: t("feature4Name"), desc: t("feature4Desc") },
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
  await doTrade(selectedMarket.value, params, t);
};

const cancelOrder = async (orderId: number) => {
  await doCancel(orderId, t);
};

const claimWinnings = async (marketId: number) => {
  await doClaim(marketId, t);
};

const createMarket = async (marketData: any) => {
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
.theme-prediction-market {
  --pm-primary: #6366f1;
  --pm-success: #10b981;
  --pm-danger: #ef4444;
  --pm-bg: #0f0f1a;
  --pm-card-bg: rgba(255, 255, 255, 0.05);
  --pm-text: #ffffff;
  --pm-text-secondary: rgba(255, 255, 255, 0.7);
  --pm-border: rgba(255, 255, 255, 0.1);
}

.tab-content {
  padding: 16px;
  
  @media (min-width: 768px) {
    padding: 0;
  }
}

.portfolio-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

.summary-card {
  background: var(--pm-card-bg);
  border: 1px solid var(--pm-border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  
  &.positive {
    border-color: rgba(16, 185, 129, 0.3);
    .summary-value {
      color: var(--pm-success);
    }
  }
  
  &.negative {
    border-color: rgba(239, 68, 68, 0.3);
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

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 24px;
  background: #ef4444;
  color: white;
  border-radius: 12px;
  font-weight: 600;
  z-index: 3000;
}
</style>
