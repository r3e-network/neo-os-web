<template>
  <MiniAppPage
    name="neoburger"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="!!status && status.type === 'success'"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <view class="neoburger-shell">
        <HeroSection
          :total-staked-display="totalStakedDisplay"
          :total-staked-usd-text="totalStakedUsdText"
          :apr-display="aprDisplay"
        />

        <StatsPanel @switch-to-jazz="switchToJazz" @open-link="openExternal" />
      </view>
    </template>

    <template #operation>
      <StationPanel
        ref="stationPanelRef"
        v-model:mode="homeMode"
        :wallet-connected="walletConnected"
        :can-submit="swap.swapCanSubmit"
        :loading="loading"
        :primary-action-label="primaryActionLabel"
        :jazz-action-label="jazzActionLabel"
        :daily-rewards="rewards.dailyRewards"
        :weekly-rewards="rewards.weeklyRewards"
        :monthly-rewards="rewards.monthlyRewards"
        :total-rewards="rewards.totalRewards"
        :total-rewards-usd-text="rewards.totalRewardsUsdText"
        @learn-more="activeTab = 'docs'"
        @set-amount="swap.setSwapAmount"
        @primary-action="handlePrimaryAction"
        @jazz-action="handleJazzAction"
      >
        <template #swap-interface>
          <SwapInterface
            :swap-mode="swap.swapMode"
            :neo-balance="neoBalance"
            :b-neo-balance="bNeoBalance"
            :swap-amount="swap.swapAmount"
            :swap-output="swap.swapOutput"
            :swap-usd-text="swap.swapUsdText"
            @update:swap-amount="swap.updateSwapAmount"
            @toggle-mode="swap.toggleSwapMode"
          />
        </template>
      </StationPanel>
    </template>

    <template #tab-airdrop>
      <AirdropPanel :wallet-connected="walletConnected" @connect-wallet="loadBalances" />
    </template>

    <template #tab-treasury>
      <TreasuryPanel @copy="copyToClipboard" />
    </template>

    <template #tab-dashboard>
      <DashboardPanel :total-staked-display="totalStakedDisplay" />
    </template>

    <template #tab-docs>
      <DocsPanel @open-docs="openExternal" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import type { UniAppGlobals } from "@shared/types/globals";
import { createMiniApp } from "@shared/utils/createMiniApp";

import { useNeoburgerCore } from "@/composables/useNeoburgerCore";
import { useNeoburgerSwap } from "@/composables/useNeoburgerSwap";
import { useNeoburgerStats } from "@/composables/useNeoburgerStats";

import HeroSection from "@/components/HeroSection.vue";
import StationPanel from "@/components/StationPanel.vue";
import StatsPanel from "@/components/StatsPanel.vue";

const { neoBalance, bNeoBalance, walletConnected, BNEO_CONTRACT, loadBalances, handleClaimRewards } =
  useNeoburgerCore();

const activeTab = ref("home");
const homeMode = ref<"burger" | "jazz">("burger");
const stationPanelRef = ref<InstanceType<typeof StationPanel> | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "neoburger",
    messages,
    template: {
      tabs: [
        { key: "home", labelKey: "tabHome", icon: "🏠", default: true },
        { key: "airdrop", labelKey: "tabAirdrop", icon: "🚀" },
        { key: "treasury", labelKey: "tabTreasury", icon: "🏦" },
        { key: "dashboard", labelKey: "tabDashboard", icon: "📊" },
      ],
      fireworks: true,
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "sidebarNeoBalance", value: () => neoBalance.value ?? "—" },
      { labelKey: "sidebarBneoBalance", value: () => bNeoBalance.value ?? "—" },
      { labelKey: "sidebarTotalStaked", value: () => totalStakedDisplay.value },
      { labelKey: "sidebarApr", value: () => aprDisplay.value },
    ],
  });

const showStatus = setStatus;
const loading = ref(false);

const { apy, priceData, aprDisplay, totalStakedDisplay, totalStakedUsdText, loadApy, loadPrices } = useNeoburgerStats();
const swap = useNeoburgerSwap(neoBalance, bNeoBalance, BNEO_CONTRACT, priceData, showStatus, loadBalances);

const appState = computed(() => ({
  walletConnected: walletConnected.value,
  neoBalance: neoBalance.value,
  bNeoBalance: bNeoBalance.value,
}));
function switchToJazz() {
  homeMode.value = "jazz";
  stationPanelRef.value?.setMode("jazz");
}

async function handlePrimaryAction() {
  if (walletConnected.value) {
    loading.value = true;
    await swap.executeSwap();
    loading.value = false;
  } else {
    await loadBalances();
  }
}

async function handleJazzAction() {
  if (walletConnected.value) {
    loading.value = true;
    const success = await handleClaimRewards();
    if (success) {
      showStatus(t("claimSuccess"), "success");
      await loadBalances();
    } else {
      showStatus(t("claimFailed"), "error");
    }
    loading.value = false;
  } else {
    await loadBalances();
  }
}

async function copyToClipboard(value: string) {
  try {
    const g = globalThis as unknown as UniAppGlobals;
    const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
    if (uniApi?.setClipboardData) {
      await uniApi.setClipboardData({ data: value });
    } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      throw new Error("clipboard");
    }
    showStatus(t("copySuccess"), "success");
  } catch {
    showStatus(t("copyFailed"), "error");
  }
}

function openExternal(url: string) {
  if (!url) return;
  const g = globalThis as unknown as UniAppGlobals;
  const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
  if (uniApi?.openURL) {
    uniApi.openURL({ url });
    return;
  }
  const plusApi = g?.plus as Record<string, Record<string, (...args: unknown[]) => unknown>> | undefined;
  if (plusApi?.runtime?.openURL) {
    plusApi.runtime.openURL(url);
    return;
  }
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") window.location.href = url;
}

onMounted(() => {
  loadBalances();
  loadApy();
  loadPrices();
});

const resetAndReload = async () => {
  await loadBalances();
  await loadApy();
  await loadPrices();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./neoburger-theme.scss";
@import "./neoburger-deep-overrides.scss";

:global(page) {
  background: var(--burger-bg);
}

.status-card {
  margin: 16px 18px 0;
}

.status-text {
  font-weight: 800;
  text-transform: uppercase;
  font-size: 13px;
  text-align: center;
  letter-spacing: 0.05em;
  font-family: var(--font-family-display, "Manrope", "Outfit", sans-serif);
}

.neoburger-shell {
  padding: 20px 18px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: var(--font-family-display, "Manrope", "Outfit", sans-serif);
  color: var(--burger-text);
}
</style>
