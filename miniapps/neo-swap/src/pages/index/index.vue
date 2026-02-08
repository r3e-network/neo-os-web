<template>
  <view class="theme-neo-swap">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="sidebar-info">
          <text class="sidebar-title">{{ t("popularPairs") }}</text>
          <view class="pair-list">
            <view
              v-for="pair in popularPairs"
              :key="pair.id"
              class="pair-item"
              :class="{ active: selectedPair === pair.id }"
              @click="selectedPair = pair.id"
            >
              <view class="pair-icons">
                <image :src="pair.fromIcon" class="pair-icon" :alt="pair.fromSymbol || t('tokenIcon')" />
                <image :src="pair.toIcon" class="pair-icon overlap" :alt="pair.toSymbol || t('tokenIcon')" />
              </view>
              <view class="pair-info">
                <text class="pair-name">{{ pair.name }}</text>
                <text class="pair-rate">{{ pair.rate }}</text>
              </view>
            </view>
          </view>
        </view>
      </template>

      <!-- Swap Tab (default) -->
      <template #content>
        <SwapTab :t="t" />
      </template>

      <!-- Pool Tab -->
      <template #tab-pool>
        <PoolTab :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import SwapTab from "./components/SwapTab.vue";
import PoolTab from "./components/PoolTab.vue";

const { t } = useI18n();
const { chainType } = useWallet() as WalletSDK;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "swap-interface",
  tabs: [
    { key: "swap", labelKey: "tabSwap", icon: "💱", default: true },
    { key: "pool", labelKey: "tabPool", icon: "💧" },
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

const activeTab = ref("swap");
const selectedPair = ref("neo-gas");

// Responsive layout
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};
onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));

const popularPairs = [
  {
    id: "neo-gas",
    name: "NEO/GAS",
    rate: "1:45.2",
    fromIcon: "/static/neo-token.png",
    toIcon: "/static/gas-token.png",
  },
  {
    id: "gas-bneo",
    name: "GAS/bNEO",
    rate: "1:0.95",
    fromIcon: "/static/gas-token.png",
    toIcon: "/static/neo-token.png",
  },
  {
    id: "neo-flm",
    name: "NEO/FLM",
    rate: "1:125.8",
    fromIcon: "/static/neo-token.png",
    toIcon: "/static/gas-token.png",
  },
];

const appState = computed(() => ({
  selectedPair: selectedPair.value,
}));
</script>

<style lang="scss" scoped>
.theme-neo-swap {
  --swap-primary: #00a651;
  --swap-secondary: #008f45;
  --swap-bg: #0a0a0f;
  --swap-card-bg: rgba(255, 255, 255, 0.05);
  --swap-text: #ffffff;
  --swap-text-secondary: rgba(255, 255, 255, 0.7);
  --swap-border: rgba(255, 255, 255, 0.1);
}

.tab-content {
  padding: 16px;

  @media (min-width: 768px) {
    padding: 0;
  }
}

// Desktop Sidebar
.sidebar-info {
  .sidebar-title {
    font-size: 12px;
    color: var(--swap-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 16px;
    display: block;
  }
}

.pair-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pair-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.active {
    background: rgba(0, 166, 81, 0.1);
    border-color: var(--swap-primary);
  }
}

.pair-icons {
  position: relative;

  .pair-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;

    &.overlap {
      position: absolute;
      left: 16px;
      border: 2px solid var(--swap-bg);
    }
  }
}

.pair-info {
  flex: 1;
  margin-left: 16px;
}

.pair-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--swap-text);
  display: block;
}

.pair-rate {
  font-size: 12px;
  color: var(--swap-text-secondary);
}

// Responsive styles
@media (max-width: 767px) {
  .tab-content {
    padding: 12px;
  }
  .pair-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 12px;
    padding-bottom: 8px;
  }
  .pair-item {
    min-width: 140px;
    flex-shrink: 0;
  }
}
@media (min-width: 1024px) {
  .tab-content {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
}
</style>
