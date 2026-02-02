<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-garden-of-neo" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <view v-if="activeTab === 'garden'" class="flex flex-col h-full">
      <!-- Chain Warning - Framework Component -->
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />
      <GardenTab
        :t="t"
        :contract-address="contractAddress"
        :ensure-contract-address="ensureContractAddress"
        @update:stats="updateStats"
      />
    </view>

    <StatsTab
      v-if="activeTab === 'stats'"
      :t="t"
      :total-plants="stats.totalPlants"
      :ready-to-harvest="stats.readyToHarvest"
      :total-harvested="stats.totalHarvested"
    />

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
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning } from "@shared/components";
import GardenTab from "./components/GardenTab.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = useI18n();

const navTabs = computed(() => [
  { id: "garden", icon: "leaf", label: t("garden") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("garden");

// Stats State
const stats = ref({
  totalPlants: 0,
  readyToHarvest: 0,
  totalHarvested: 0,
});

const updateStats = (newStats: any) => {
  stats.value = newStats;
};

// Wallet & Contract
const { chainType, getContractAddress } = useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) throw new Error(t("missingContract"));
  return contractAddress.value;
};

// Docs
const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap");
@import "./garden-of-neo-theme.scss";

:global(page) {
  background: var(--garden-bg);
  font-family: var(--garden-font);
}

.tab-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(180deg, var(--garden-bg) 0%, var(--garden-bg-secondary) 100%);
  min-height: 100vh;
  position: relative;
  font-family: var(--garden-font);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  /* Leaf Pattern */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 4px 4px, var(--garden-pattern) 2px, transparent 0);
    background-size: 32px 32px;
    opacity: 0.3;
    pointer-events: none;
    z-index: 0;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Organic/Ethereal Overrides */
:deep(.neo-card) {
  background: var(--garden-card-bg) !important;
  border: 1px solid var(--garden-card-border) !important;
  border-radius: 20px !important;
  box-shadow: var(--garden-card-shadow) !important;
  color: var(--garden-text) !important;
  backdrop-filter: blur(12px);
  position: relative;
  overflow: hidden;

  /* Glass sheen */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--garden-sheen) 0%, transparent 100%);
    pointer-events: none;
  }

  &.variant-danger {
    border-color: var(--garden-danger-border) !important;
    background: var(--garden-danger-bg) !important;
    color: var(--garden-danger-text) !important;
  }
}

:deep(.neo-button) {
  border-radius: 12px !important;
  font-weight: 800 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s ease;

  &.variant-primary {
    background: linear-gradient(135deg, var(--garden-leaf) 0%, var(--garden-accent) 100%) !important;
    color: var(--garden-button-text) !important;
    border: none !important;
    box-shadow: var(--garden-button-shadow) !important;

    &:active {
      transform: scale(0.96);
      box-shadow: var(--garden-button-shadow-press) !important;
    }
  }
  &.variant-secondary {
    background: var(--garden-button-secondary-bg) !important;
    border: 2px solid var(--garden-button-secondary-border) !important;
    color: var(--garden-button-secondary-text) !important;

    &:hover {
      background: var(--garden-button-hover-bg) !important;
    }
  }
}

:deep(.app-layout) {
  background: var(--bg-primary);
  background-image: none;
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
