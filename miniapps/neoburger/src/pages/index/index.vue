<template>
  <view class="theme-neoburger">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMessage ? { msg: statusMessage, type: statusType } : null"
      :fireworks-active="!!statusMessage && statusType === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <NeoCard v-if="statusMessage" :variant="statusType === 'error' ? 'danger' : 'success'" class="status-card">
          <text class="status-text">{{ statusMessage }}</text>
        </NeoCard>

        <view class="neoburger-shell">
          <HeroSection
            :total-staked-display="totalStakedDisplay"
            :total-staked-usd-text="totalStakedUsdText"
            :apr-display="aprDisplay"
          />

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

          <StatsPanel @switch-to-jazz="switchToJazz" @open-link="openExternal" />
        </view>
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
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { getPrices, type PriceData } from "@shared/utils/price";
import { formatCompactNumber } from "@shared/utils/format";

import { useNeoburgerCore } from "@/composables/useNeoburgerCore";
import { useNeoburgerRewards } from "@/composables/useNeoburgerRewards";
import { useNeoburgerSwap } from "@/composables/useNeoburgerSwap";

import HeroSection from "@/components/HeroSection.vue";
import StationPanel from "@/components/StationPanel.vue";
import SwapInterface from "@/components/SwapInterface.vue";
import StatsPanel from "@/components/StatsPanel.vue";
import AirdropPanel from "@/components/AirdropPanel.vue";
import TreasuryPanel from "@/components/TreasuryPanel.vue";
import DashboardPanel from "@/components/DashboardPanel.vue";
import DocsPanel from "@/components/DocsPanel.vue";

const { t } = useI18n();

const { neoBalance, bNeoBalance, walletConnected, BNEO_CONTRACT, loadBalances, handleClaimRewards } =
  useNeoburgerCore();

const activeTab = ref("home");
const homeMode = ref<"burger" | "jazz">("burger");
const stationPanelRef = ref<InstanceType<typeof StationPanel> | null>(null);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "dashboard",
  tabs: [
    { key: "home", labelKey: "tabHome", icon: "🏠", default: true },
    { key: "airdrop", labelKey: "tabAirdrop", icon: "🚀" },
    { key: "treasury", labelKey: "tabTreasury", icon: "🏦" },
    { key: "dashboard", labelKey: "tabDashboard", icon: "📊" },
    { key: "docs", labelKey: "tabDocs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
  },
};
const appState = computed(() => ({
  walletConnected: walletConnected.value,
  neoBalance: neoBalance.value,
  bNeoBalance: bNeoBalance.value,
}));

const loading = ref(false);
const statusMessage = ref("");
const statusType = ref<"success" | "error">("success");
const apy = ref(0);
const animatedApy = ref("0.0");
const loadingApy = ref(true);
const priceData = ref<PriceData | null>(null);
const totalStaked = ref<number | null>(null);
const totalStakedFormatted = ref<string | null>(null);

let apyAnimationTimer: ReturnType<typeof setInterval> | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;

function showStatus(message: string, type: "success" | "error") {
  statusMessage.value = message;
  statusType.value = type;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusMessage.value = "";
    statusTimer = null;
  }, 5000);
}

const rewards = useNeoburgerRewards(bNeoBalance, apy, priceData);

const swap = useNeoburgerSwap(neoBalance, bNeoBalance, BNEO_CONTRACT, priceData, showStatus, loadBalances);

const primaryActionLabel = computed(() => (walletConnected.value ? swap.swapButtonLabel : t("connectWallet")));
const jazzActionLabel = computed(() => (walletConnected.value ? t("claimRewards") : t("connectWallet")));
const aprDisplay = computed(() => (loadingApy.value ? t("apyPlaceholder") : `${animatedApy.value}%`));

const totalStakedDisplay = computed(() => {
  if (totalStakedFormatted.value) return totalStakedFormatted.value;
  if (totalStaked.value === null) return t("placeholderDash");
  return formatCompactNumber(totalStaked.value);
});

const totalStakedUsdText = computed(() => {
  const price = priceData.value?.neo.usd ?? 0;
  if (!price || totalStaked.value === null) return t("usdPlaceholder");
  return t("approxUsd", { value: formatCompactNumber(totalStaked.value * price) });
});

function animateApy() {
  const target = apy.value;
  const duration = 2000;
  const steps = 60;
  const increment = target / steps;
  let current = 0;
  let step = 0;

  if (apyAnimationTimer) clearInterval(apyAnimationTimer);

  apyAnimationTimer = setInterval(() => {
    current += increment;
    step++;
    animatedApy.value = current.toFixed(1);
    if (step >= steps) {
      animatedApy.value = target.toFixed(1);
      if (apyAnimationTimer) {
        clearInterval(apyAnimationTimer);
        apyAnimationTimer = null;
      }
    }
  }, duration / steps);
}

function switchToJazz() {
  homeMode.value = "jazz";
  stationPanelRef.value?.setMode("jazz");
}

const APY_CACHE_KEY = "neoburger_apy_cache";
const STATS_ENDPOINTS = ["/api/neoburger-stats", "/api/neoburger/stats"];
const LOCAL_STATS_MOCK = {
  apy: 12.8,
  total_staked: 1425367,
  total_staked_formatted: "1.43M",
};
const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

const fetchStats = async () => {
  if (isLocalPreview) {
    return LOCAL_STATS_MOCK;
  }

  for (const endpoint of STATS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      return await response.json();
    } catch {}
  }
  return null;
};

const readCachedApy = () => {
  try {
    const uniApi = (globalThis as any)?.uni;
    const raw =
      uniApi?.getStorageSync?.(APY_CACHE_KEY) ??
      (typeof localStorage !== "undefined" ? localStorage.getItem(APY_CACHE_KEY) : null);
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

const writeCachedApy = (value: number) => {
  try {
    const uniApi = (globalThis as any)?.uni;
    if (uniApi?.setStorageSync) {
      uniApi.setStorageSync(APY_CACHE_KEY, String(value));
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(APY_CACHE_KEY, String(value));
    }
  } catch {}
};

async function loadApy() {
  try {
    loadingApy.value = true;
    const cached = readCachedApy();
    if (cached !== null) apy.value = cached;
    const data = await fetchStats();
    if (data) {
      const nextApy = parseFloat(data.apy ?? data.apr);
      if (Number.isFinite(nextApy) && nextApy >= 0) {
        apy.value = nextApy;
        writeCachedApy(nextApy);
      }
      const nextTotalStaked = Number(data.total_staked ?? data.totalStakedNeo);
      if (Number.isFinite(nextTotalStaked) && nextTotalStaked >= 0) totalStaked.value = nextTotalStaked;
      const formatted = data.total_staked_formatted ?? data.totalStakedFormatted;
      if (typeof formatted === "string") totalStakedFormatted.value = formatted;
    }
  } catch {
  } finally {
    loadingApy.value = false;
    animateApy();
  }
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
    const uniApi = (globalThis as any)?.uni;
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
  const uniApi = (globalThis as any)?.uni;
  if (uniApi?.openURL) {
    uniApi.openURL({ url });
    return;
  }
  const plusApi = (globalThis as any)?.plus;
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

async function loadPrices() {
  try {
    priceData.value = await getPrices();
  } catch {}
}

onMounted(() => {
  loadBalances();
  loadApy();
  loadPrices();
});

onUnmounted(() => {
  if (apyAnimationTimer) {
    clearInterval(apyAnimationTimer);
    apyAnimationTimer = null;
  }
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap");
@import "./neoburger-theme.scss";

:global(page) {
  background: var(--burger-bg);
}

:deep(.app-layout) {
  background: var(--burger-bg);
  background-image:
    radial-gradient(circle at 10% 10%, var(--burger-bg-glow-1), transparent 45%),
    radial-gradient(circle at 90% 30%, var(--burger-bg-glow-2), transparent 40%),
    radial-gradient(circle at 50% 80%, var(--burger-bg-glow-3), transparent 60%);
  color: var(--burger-text);
  font-family: "Manrope", "Outfit", sans-serif;
}

:deep(.app-content) {
  background: transparent;
}

:deep(.navbar) {
  background: var(--burger-nav-bg);
  border-top: 1px solid var(--burger-nav-border);
}

:deep(.nav-item) {
  color: var(--burger-nav-item);
}

:deep(.nav-item.active) {
  color: var(--burger-accent-strong);
}

:deep(.nav-item::after) {
  background: var(--burger-accent-strong);
}

:deep(.neo-btn--primary) {
  background: var(--burger-primary-gradient);
  color: var(--burger-accent-text);
  box-shadow: var(--burger-accent-shadow);
}

:deep(.neo-btn--secondary) {
  background: var(--burger-surface);
  color: var(--burger-text-strong);
  border: 1px solid var(--burger-border-strong);
  box-shadow: none;
}

:deep(.neo-btn--success) {
  background: var(--burger-success-gradient);
  color: var(--burger-success-text);
  box-shadow: var(--burger-success-shadow);
}

:deep(.neo-input__wrapper) {
  background: var(--burger-surface);
  border: 1px solid var(--burger-border-strong);
  box-shadow: var(--burger-input-inset);
}

:deep(.neo-card) {
  background: var(--burger-surface);
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow);
  color: var(--burger-text);
  backdrop-filter: none;
}

:deep(.neo-card--danger) {
  background: var(--burger-danger-bg);
  border-color: var(--burger-danger-border);
  color: var(--burger-danger-text);
}

:deep(.neo-card--success) {
  background: var(--burger-success-card-bg);
  border-color: var(--burger-success-card-border);
  color: var(--burger-success-card-text);
}

:deep(.neo-btn),
:deep(.neo-input__field) {
  font-family: "Manrope", "Outfit", sans-serif;
}

:deep(.neo-input__field) {
  color: var(--burger-text);
}

:deep(.neo-input__field::placeholder) {
  color: var(--burger-text-placeholder);
}

:deep(.neo-doc) {
  color: var(--burger-text);
}

:deep(.neo-doc .doc-header),
:deep(.neo-doc .doc-footer) {
  border-color: var(--burger-border);
}

:deep(.neo-doc .doc-badge) {
  background: var(--burger-doc-badge-bg);
  color: var(--burger-doc-badge-text);
  border-color: var(--burger-doc-badge-border);
  box-shadow: var(--burger-doc-badge-shadow);
}

:deep(.neo-doc .doc-subtitle),
:deep(.neo-doc .section-text),
:deep(.neo-doc .step-text),
:deep(.neo-doc .feature-desc),
:deep(.neo-doc .footer-text) {
  color: var(--burger-text-soft);
}

:deep(.neo-doc .section-label) {
  color: var(--burger-accent-deep);
  text-shadow: none;
}

:deep(.neo-doc .step-number) {
  background: var(--burger-surface);
  color: var(--burger-accent-deep);
  border-color: var(--burger-doc-step-border);
  box-shadow: none;
}

:deep(.neo-doc .feature-card) {
  background: var(--burger-surface-alt);
  border-color: var(--burger-border);
  box-shadow: var(--burger-shadow-soft);
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
  font-family: "Manrope", "Outfit", sans-serif;
}

.neoburger-shell {
  padding: 20px 18px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: "Manrope", "Outfit", sans-serif;
  color: var(--burger-text);
}

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
