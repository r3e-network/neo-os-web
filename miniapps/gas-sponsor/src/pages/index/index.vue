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
        <view class="app-container">
          <NeoCard
            v-if="status"
            :variant="status.type === 'error' ? 'danger' : status.type === 'loading' ? 'warning' : 'success'"
            class="glass-status mb-4 text-center"
          >
            <text class="status-msg">{{ status.msg }}</text>
          </NeoCard>

          <!-- Gas Tank Visualization -->
          <GasTank :fuel-level-percent="fuelLevelPercent" :gas-balance="gasBalance" :is-eligible="isEligible" :t="t" />
        </view>
      </template>

      <!-- Main Tab — RIGHT panel -->
      <template #operation>
        <view class="app-container">
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
        </view>
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
        <view class="app-container scrollable">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet, useGasSponsor } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useGasTransfers } from "@/composables/useGasTransfers";
import GasTank from "./components/GasTank.vue";
import UserBalanceInfo from "./components/UserBalanceInfo.vue";
import RequestGasCard from "./components/RequestGasCard.vue";
import DailyQuotaCard from "./components/DailyQuotaCard.vue";
import UsageStatisticsCard from "./components/UsageStatisticsCard.vue";
import EligibilityStatusCard from "./components/EligibilityStatusCard.vue";
import DonateForm from "./components/DonateForm.vue";
import SendForm from "./components/SendForm.vue";

const { t } = useI18n();

const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;
const { isRequestingSponsorship: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsor();

const ELIGIBILITY_THRESHOLD = 0.1;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "sponsor", labelKey: "tabSponsor", icon: "🎁", default: true },
    { key: "donate", labelKey: "tabDonate", icon: "❤️" },
    { key: "send", labelKey: "tabSend", icon: "📤" },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
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
      ],
    },
  },
};
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
  { label: "Tank Level", value: `${Math.round(fuelLevelPercent.value)}%` },
  { label: "GAS Balance", value: gasBalance.value },
  { label: "Remaining Quota", value: remainingQuota.value.toFixed(4) },
  { label: "Eligible", value: isEligible.value ? "Yes" : "No" },
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

const { donateAmount, sendAmount, recipientAddress, isDonating, isSending, handleDonate, handleSend } =
  useGasTransfers(showStatus, loadUserData);

onMounted(() => {
  loadUserData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./gas-sponsor-theme.scss";

:global(page) {
  background: var(--gas-bg, var(--bg-primary));
  font-family: var(--gas-font, #{$font-family});
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--gas-bg);
  background-image:
    linear-gradient(var(--gas-grid) 1px, transparent 1px), linear-gradient(90deg, var(--gas-grid) 1px, transparent 1px);
  background-size: 40px 40px;
  min-height: 100vh;
  box-shadow: inset 0 0 100px var(--gas-inset-shadow);
}

/* Gas Station Component Overrides */
:deep(.neo-card) {
  background: var(--gas-card-bg) !important;
  border: 1px solid var(--gas-card-border) !important;
  border-bottom: 2px solid var(--gas-card-border-secondary) !important;
  border-radius: 4px !important;
  box-shadow: var(--gas-card-shadow) !important;
  color: var(--gas-text) !important;
  backdrop-filter: blur(10px);

  &.variant-danger {
    border-color: var(--gas-card-danger-border) !important;
    background: var(--gas-card-danger-bg) !important;
    color: var(--gas-card-danger-text) !important;
    box-shadow: var(--gas-card-danger-shadow) !important;
  }
}

:deep(.neo-button) {
  border-radius: 99px !important;
  font-family: var(--gas-font, #{$font-family}) !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 800 !important;

  &.variant-primary {
    background: var(--gas-button-primary-bg) !important;
    color: var(--gas-button-primary-text) !important;
    border: none !important;
    box-shadow: var(--gas-button-primary-shadow) !important;

    &:active {
      transform: scale(0.95);
      box-shadow: var(--gas-button-primary-shadow) !important;
    }
  }

  &.variant-secondary {
    background: var(--gas-button-secondary-bg) !important;
    border: 1px solid var(--gas-button-secondary-border) !important;
    color: var(--gas-button-secondary-text) !important;
    box-shadow: var(--gas-button-secondary-shadow) !important;
  }
}

:deep(.neo-input) {
  background: var(--gas-input-bg) !important;
  border: 1px solid var(--gas-input-border) !important;
  border-radius: 4px !important;
  color: var(--gas-input-text) !important;
  font-family: "Courier New", monospace !important;
}

.status-msg {
  font-weight: 700;
  text-transform: uppercase;
  font-family: $font-mono;
  font-size: 12px;
  color: var(--gas-accent-secondary);
  text-shadow: var(--gas-status-shadow);
}

.glass-status {
  text-align: center;
  backdrop-filter: blur(10px);
}
</style>
