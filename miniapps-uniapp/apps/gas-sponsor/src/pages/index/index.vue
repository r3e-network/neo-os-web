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
import { useWallet, useGasSponsor } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppPage } from "@shared/components";
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
  loadUserData
);

const resetAndReload = async () => {
  await loadUserData();
};

onMounted(() => {
  loadUserData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;

@import "./gas-sponsor-theme.scss";

@include page-background(
  var(--gas-bg, var(--bg-primary)),
  (
    font-family: var(--gas-font, #{$font-family}),
  )
);
</style>
