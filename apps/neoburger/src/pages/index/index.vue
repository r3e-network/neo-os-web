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
      <div class="neoburger-shell">
        <div class="hero-container">
          <HeroSection
            :total-staked-display="totalStakedDisplay"
            :total-staked-usd-text="totalStakedUsdText"
            :apr-display="aprDisplay"
          />
          <div class="hero-conversion">
            <div class="hero-convert-token">
              <span class="convert-icon">Ⓝ</span>
              <span class="convert-label">{{ t("tokenNeo") }}</span>
            </div>
            <span class="convert-arrow">→</span>
            <div class="hero-convert-token">
              <span class="convert-icon convert-icon--bneo">ⓑ</span>
              <span class="convert-label">{{ t("tokenBneo") }}</span>
            </div>
          </div>
          <div class="hero-stats-row">
            <div class="hero-stat">
              <span class="hero-stat-label">{{ t("sidebarNeoBalance") }}</span>
              <span class="hero-stat-value">{{ neoBalance ?? t("notAvailable") }}</span>
            </div>
            <div class="hero-stat-divider" />
            <div class="hero-stat">
              <span class="hero-stat-label">{{ t("sidebarBneoBalance") }}</span>
              <span class="hero-stat-value">{{ bNeoBalance ?? t("notAvailable") }}</span>
            </div>
          </div>
        </div>

        <StatsPanel @switch-to-jazz="switchToJazz" @open-link="openExternal" />
      </div>
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
      { labelKey: "sidebarNeoBalance", value: () => neoBalance.value ?? t("notAvailable") },
      { labelKey: "sidebarBneoBalance", value: () => bNeoBalance.value ?? t("notAvailable") },
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
  try {
    if (walletConnected.value) {
      loading.value = true;
      const success = await swap.executeSwap();
      loading.value = false;
      if (!success) {
        showStatus(t("actionFailed"), "error");
      }
    } else {
      await loadBalances();
    }
  } catch (_e: unknown) {
    loading.value = false;
    showStatus(t("actionFailed"), "error");
  }
}

async function handleJazzAction() {
  try {
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
  } catch (_e: unknown) {
    loading.value = false;
    showStatus(t("claimFailed"), "error");
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
  } catch (_e: unknown) {
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
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@use "./neoburger-theme.scss" as *;
@use "./neoburger-deep-overrides.scss" as *;

:global(body) {
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

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
}

.hero-conversion {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
}

.hero-convert-token {
  display: flex;
  align-items: center;
  gap: 8px;
}

.convert-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--burger-accent), var(--burger-accent-deep));
  color: #fff;

  &--bneo {
    background: linear-gradient(135deg, var(--burger-gold, #fbbf24), var(--burger-gold-dark, #f59e0b));
  }
}

.convert-label {
  font-size: 14px;
  font-weight: 600;
}

.convert-arrow {
  font-size: 20px;
  opacity: 0.5;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  padding: 16px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-color, rgba(255, 255, 255, 0.1));
}

/* ── NeoBurger Hero Enhancements ── */
@keyframes burger-stack-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  20% {
    transform: translateY(-6px);
  }
  40% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(0);
  }
}

@keyframes burger-cheese-melt {
  0%,
  100% {
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.15);
  }
  50% {
    box-shadow:
      0 0 32px rgba(245, 158, 11, 0.3),
      0 4px 16px rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.25);
  }
}

@keyframes burger-warm-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(180, 83, 9, 0.06), rgba(251, 191, 36, 0.08));
  background-size: 200% 200%;
  animation: burger-warm-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(245, 158, 11, 0.08),
    inset 0 1px 0 rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.1);
  border-radius: 20px;
  padding: 32px 20px;
}

.hero-conversion {
  animation: burger-stack-bounce 3s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.1);
}

.hero-stats-row {
  animation: burger-cheese-melt 4s ease-in-out infinite;
}

.convert-icon {
  box-shadow: 0 0 12px rgba(0, 230, 118, 0.3);

  &--bneo {
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
  }
}
</style>
