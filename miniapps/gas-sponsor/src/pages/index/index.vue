<template>
  <view class="theme-gas-sponsor">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab — LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Gas Tank Visualization -->
          <GasTank :fuel-level-percent="fuelLevelPercent" :gas-balance="gasBalance" :is-eligible="isEligible" :t="t" />
        </ErrorBoundary>
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
          :t="t"
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
          :t="t"
        />

        <DailyQuotaCard
          :quota-percent="quotaPercent"
          :daily-limit="dailyLimit"
          :used-quota="usedQuota"
          :remaining-quota="remainingQuota"
          :reset-time="resetTime"
          :t="t"
        />

        <UsageStatisticsCard
          :used-quota="usedQuota"
          :remaining-quota="remainingQuota"
          :daily-limit="dailyLimit"
          :reset-time="resetTime"
          :t="t"
        />

        <EligibilityStatusCard
          :gas-balance="gasBalance"
          :remaining-quota="remainingQuota"
          :user-address="userAddress"
          :t="t"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet, useGasSponsor } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import { useGasTransfers } from "@/composables/useGasTransfers";
import GasTank from "./components/GasTank.vue";
import UserBalanceInfo from "./components/UserBalanceInfo.vue";
import RequestGasCard from "./components/RequestGasCard.vue";
import DailyQuotaCard from "./components/DailyQuotaCard.vue";
import UsageStatisticsCard from "./components/UsageStatisticsCard.vue";
import EligibilityStatusCard from "./components/EligibilityStatusCard.vue";
import DonateForm from "./components/DonateForm.vue";
import SendForm from "./components/SendForm.vue";

const { t } = createUseI18n(messages)();

const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;
const { isRequestingSponsorship: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsor();

const ELIGIBILITY_THRESHOLD = 0.1;

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "sponsor", labelKey: "tabSponsor", icon: "🎁", default: true },
    { key: "donate", labelKey: "tabDonate", icon: "❤️" },
    { key: "send", labelKey: "tabSend", icon: "📤" },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
  ],
});
const activeTab = ref("sponsor");
const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  gasBalance: gasBalance.value,
  isEligible: isEligible.value,
  isLoading: loading.value,
}));

const userAddress = ref("");
const gasBalance = ref("0");
const usedQuota = ref("0");
const dailyLimit = ref("0.1");
const resetsAt = ref("");
const loading = ref(true);
const requestAmount = ref("0.01");
const { status, setStatus: showStatus, clearStatus } = useStatusMessage();

const quickAmounts = [0.01, 0.02, 0.03, 0.04];

const isEligible = computed(() => parseFloat(gasBalance.value) < ELIGIBILITY_THRESHOLD);
const remainingQuota = computed(() => Math.max(0, parseFloat(dailyLimit.value) - parseFloat(usedQuota.value)));
const quotaPercent = computed(() => {
  const limit = parseFloat(dailyLimit.value);
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return (parseFloat(usedQuota.value) / limit) * 100;
});
const maxRequestAmount = computed(() => Math.min(remainingQuota.value, 0.05).toString());
const fuelLevelPercent = computed(() => {
  const balance = parseFloat(gasBalance.value);
  return Math.min((balance / ELIGIBILITY_THRESHOLD) * 100, 100);
});

const sidebarItems = computed(() => [
  { label: t("sidebarTankLevel"), value: `${Math.round(fuelLevelPercent.value)}%` },
  { label: t("gasBalance"), value: gasBalance.value },
  { label: t("sidebarRemainingQuota"), value: remainingQuota.value.toFixed(4) },
  { label: t("sidebarEligible"), value: isEligible.value ? t("eligible") : t("notEligible") },
]);

const resetTime = computed(() => {
  if (!resetsAt.value) return "--";
  const resetDate = new Date(resetsAt.value);
  const now = new Date();
  const diff = resetDate.getTime() - now.getTime();
  if (diff <= 0) return t("now");
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
});

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

const { handleBoundaryError } = useHandleBoundaryError("gas-sponsor");
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
