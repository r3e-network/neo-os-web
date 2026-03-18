<template>
  <MiniAppPage
    name="gas-sponsor"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <!-- Main Tab — LEFT panel -->
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-neo" compact>
          <template #stats>
            <HeroStatsStrip :items="heroStatsItems" />
          </template>
        </HeroSection>
      </div>

      <!-- Gas Tank Visualization -->
      <GasTank :fuel-level-percent="fuelLevelPercent" :gas-balance="gasBalance" :is-eligible="isEligible" />
    </template>

    <!-- Main Tab — RIGHT panel -->
    <template #operation>
      <!-- Request Sponsored Gas -->
      <RequestGasCard
        :is-eligible="isEligible"
        :remaining-quota="remainingQuota"
        v-model:requestAmount="requestAmount"
        :max-request-amount="maxRequestAmount"
        :is-requesting="isRequesting"
        :quick-amounts="quickAmounts"
        @request="requestSponsorship"
      />
    </template>

    <template #tab-donate>
      <DonateForm v-model="donateAmount" :loading="isDonating" @donate="handleDonate" />
    </template>

    <template #tab-send>
      <SendForm
        :recipient="recipientAddress"
        :amount="sendAmount"
        :loading="isSending"
        @update:recipient="recipientAddress = $event"
        @update:amount="sendAmount = $event"
        @send="handleSend"
      />
    </template>

    <template #tab-stats>
      <!-- User Balance Info -->
      <UserBalanceInfo
        :loading="loading"
        :user-address="userAddress"
        :gas-balance="gasBalance"
        :is-eligible="isEligible"
      />

      <DailyQuotaCard
        :quota-percent="quotaPercent"
        :daily-limit="dailyLimit"
        :used-quota="usedQuota"
        :remaining-quota="remainingQuota"
        :reset-time="resetTime"
      />

      <UsageStatisticsCard
        :used-quota="usedQuota"
        :remaining-quota="remainingQuota"
        :daily-limit="dailyLimit"
        :reset-time="resetTime"
      />

      <EligibilityStatusCard :gas-balance="gasBalance" :remaining-quota="remainingQuota" :user-address="userAddress" />
    </template>
  </MiniAppPage>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet, useGasSponsor } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppPage, HeroSection, HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useGasTransfers } from "@/composables/useGasTransfers";
import GasTank from "./components/GasTank.vue";

const { address, connect } = useWallet() as WalletSDK;
const { isRequestingSponsorship: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsor();

const ELIGIBILITY_THRESHOLD = 0.1;

const userAddress = ref("");
const gasBalance = ref("0");
const usedQuota = ref("0");
const dailyLimit = ref("0.1");
const resetsAt = ref("");
const loading = ref(true);
const requestAmount = ref("0.01");
const isEligible = computed(() => parseFloat(gasBalance.value) < ELIGIBILITY_THRESHOLD);
const remainingQuota = computed(() => Math.max(0, parseFloat(dailyLimit.value) - parseFloat(usedQuota.value)));
const fuelLevelPercent = computed(() => {
  const balance = parseFloat(gasBalance.value);
  return Math.min((balance / ELIGIBILITY_THRESHOLD) * 100, 100);
});

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "gas-sponsor",
    messages,
    template: {
      tabs: [
        { key: "sponsor", labelKey: "tabSponsor", icon: "🎁", default: true },
        { key: "donate", labelKey: "tabDonate", icon: "❤️" },
        { key: "send", labelKey: "tabSend", icon: "📤" },
        { key: "stats", labelKey: "tabStats", icon: "📊" },
      ],
    },
    sidebarItems: [
      { labelKey: "sidebarTankLevel", value: () => `${Math.round(fuelLevelPercent.value)}%` },
      { labelKey: "gasBalance", value: () => gasBalance.value },
      { labelKey: "sidebarRemainingQuota", value: () => remainingQuota.value.toFixed(4) },
      { labelKey: "sidebarEligible", value: () => (isEligible.value ? t("eligible") : t("notEligible")) },
    ],
  });

const showStatus = setStatus;

const appState = computed(() => ({
  address: address.value,
  gasBalance: gasBalance.value,
  isEligible: isEligible.value,
  isLoading: loading.value,
}));
const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { icon: "⛽", value: `${Math.round(fuelLevelPercent.value)}%`, label: t("sidebarTankLevel") },
  { icon: "💰", value: gasBalance.value, label: t("gasBalance") },
]);
const loadUserData = async () => {
  loading.value = true;
  try {
    await connect();
    userAddress.value = address.value || "";

    const statusData = await checkEligibility();
    gasBalance.value = statusData.gas_balance;
    usedQuota.value = statusData.used_today;
    dailyLimit.value = statusData.daily_limit;
    resetsAt.value = statusData.resets_at;
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("loadFailed")), "error");
  } finally {
    loading.value = false;
  }
};

const requestSponsorship = async () => {
  if (!isEligible.value || remainingQuota.value <= 0) return;

  const amount = parseFloat(requestAmount.value);
  if (Number.isNaN(amount) || amount <= 0 || amount > remainingQuota.value) {
    showStatus(t("invalidAmount"), "error");
    return;
  }

  try {
    showStatus(t("requestingSponsorship"), "loading");
    const result = await apiRequest(requestAmount.value);
    showStatus(t("requestSubmitted", { id: `${result.request_id.slice(0, 8)}...` }), "success");
    requestAmount.value = "0.01";
    await loadUserData();
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("requestFailed")), "error");
  }
};

const { donateAmount, sendAmount, recipientAddress, isDonating, isSending, handleDonate, handleSend } = useGasTransfers(
  showStatus,
  loadUserData,
);

const resetAndReload = async () => {
  await loadUserData();
};

onMounted(() => {
  loadUserData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;

@use "./gas-sponsor-theme.scss" as *;

@include page-background(
  var(--gas-bg, var(--bg-primary)),
  (
    font-family: var(--gas-font, #{$font-family}),
  )
);

.hero-container {
  margin-bottom: 20px;
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(0, 229, 153, 0.08);
  --hero-stat-border: rgba(0, 229, 153, 0.15);
}

/* ── Gas Sponsor Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes fuel-gauge-fill {
  0% {
    background-size: 0% 100%;
  }
  50% {
    background-size: 100% 100%;
  }
  100% {
    background-size: 0% 100%;
  }
}

@keyframes tank-glow {
  0%,
  100% {
    box-shadow:
      0 0 12px rgba(0, 229, 153, 0.1),
      0 0 24px rgba(0, 229, 153, 0.05);
  }
  50% {
    box-shadow:
      0 0 22px rgba(0, 229, 153, 0.25),
      0 0 44px rgba(0, 229, 153, 0.1);
  }
}

@keyframes gauge-needle {
  0%,
  100% {
    transform: rotate(-20deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

.hero-stat {
  animation: tank-glow 4s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 180, 120, 0.06) 100%);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 24px rgba(0, 229, 153, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.6s;
}

.hero-stat-icon {
  animation: gauge-needle 5s ease-in-out infinite;
  display: inline-block;
  transform-origin: center bottom;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
}
</style>
