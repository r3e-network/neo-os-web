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
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <view class="app-container">
          <NeoCard
            v-if="status"
            :variant="status.type === 'error' ? 'danger' : status.type === 'loading' ? 'warning' : 'success'"
            class="glass-status mb-4 text-center"
          >
            <text class="status-msg">{{ status.msg }}</text>
          </NeoCard>

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
          <!-- Gas Tank Visualization -->
          <GasTank :fuel-level-percent="fuelLevelPercent" :gas-balance="gasBalance" :is-eligible="isEligible" :t="t" />
        </view>
      </template>

      <template #tab-donate>
        <view class="app-container">
          <NeoCard variant="accent" class="glass-container">
            <view class="donate-form">
              <text class="form-subtitle">{{ t("donateSubtitle") }}</text>
              <text class="form-description">{{ t("donateDescription") }}</text>
              <view class="input-section">
                <text class="input-label">{{ t("donateAmount") }}</text>
                <view class="preset-amounts">
                  <view
                    v-for="amt in [0.1, 0.5, 1, 5]"
                    :key="amt"
                    :class="['preset-btn glass-btn', { active: donateAmount === amt.toString() }]"
                    @click="donateAmount = amt.toString()"
                  >
                    <text class="preset-value">{{ amt }}</text>
                    <text class="preset-unit">GAS</text>
                  </view>
                </view>
                <NeoInput v-model="donateAmount" type="number" placeholder="0.1" suffix="GAS" />
              </view>
              <NeoButton variant="primary" size="lg" block :loading="isDonating" @click="handleDonate">
                {{ isDonating ? t("donating") : t("donateBtn") }}
              </NeoButton>
            </view>
          </NeoCard>
        </view>
      </template>

      <template #tab-send>
        <view class="app-container">
          <NeoCard variant="accent" class="glass-container">
            <view class="send-form">
              <text class="form-subtitle">{{ t("sendSubtitle") }}</text>
              <view class="input-section">
                <text class="input-label">{{ t("recipientAddress") }}</text>
                <NeoInput v-model="recipientAddress" :placeholder="t('recipientPlaceholder')" />
              </view>
              <view class="input-section">
                <text class="input-label">{{ t("sendAmount") }}</text>
                <view class="preset-amounts">
                  <view
                    v-for="amt in [0.05, 0.1, 0.2, 0.5]"
                    :key="amt"
                    :class="['preset-btn glass-btn', { active: sendAmount === amt.toString() }]"
                    @click="sendAmount = amt.toString()"
                  >
                    <text class="preset-value">{{ amt }}</text>
                    <text class="preset-unit">GAS</text>
                  </view>
                </view>
                <NeoInput v-model="sendAmount" type="number" placeholder="0.1" suffix="GAS" />
              </view>
              <NeoButton variant="primary" size="lg" block :loading="isSending" @click="handleSend">
                {{ isSending ? t("sending") : t("sendBtn") }}
              </NeoButton>
            </view>
          </NeoCard>
        </view>
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
import { toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { MiniAppTemplate, NeoCard, NeoButton, NeoInput } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import GasTank from "./components/GasTank.vue";
import UserBalanceInfo from "./components/UserBalanceInfo.vue";
import RequestGasCard from "./components/RequestGasCard.vue";
import DailyQuotaCard from "./components/DailyQuotaCard.vue";
import UsageStatisticsCard from "./components/UsageStatisticsCard.vue";
import EligibilityStatusCard from "./components/EligibilityStatusCard.vue";

const { t } = useI18n();

const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;
const { isRequestingSponsorship: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsor();

const ELIGIBILITY_THRESHOLD = 0.1;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "form-panel",
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
const status = ref<{ msg: string; type: string } | null>(null);

const quickAmounts = [0.01, 0.02, 0.03, 0.04];

// Donate and Send state
const donateAmount = ref("0.1");
const sendAmount = ref("0.1");
const recipientAddress = ref("");
const isDonating = ref(false);
const isSending = ref(false);
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const SPONSOR_POOL_ADDRESS = "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK"; // Gas sponsor pool

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

const showStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
};

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
  } catch (e: any) {
    showStatus(e.message || t("loadFailed"), "error");
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
  } catch (e: any) {
    showStatus(e.message || t("requestFailed"), "error");
  }
};

const handleDonate = async () => {
  if (isDonating.value) return;
  if (!requireNeoChain(chainType, t)) return;
  const amount = parseFloat(donateAmount.value);
  if (Number.isNaN(amount) || amount <= 0) {
    showStatus(t("invalidAmount"), "error");
    return;
  }
  isDonating.value = true;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));
    await invokeContract({
      contractAddress: GAS_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: SPONSOR_POOL_ADDRESS },
        { type: "Integer", value: toFixed8(donateAmount.value) },
        { type: "Any", value: null },
      ],
    });
    showStatus(t("donateSuccess"), "success");
    donateAmount.value = "0.1";
    await loadUserData();
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
  } finally {
    isDonating.value = false;
  }
};

const handleSend = async () => {
  if (isSending.value) return;
  if (!requireNeoChain(chainType, t)) return;
  if (!recipientAddress.value || recipientAddress.value.length < 30) {
    showStatus(t("invalidAddress"), "error");
    return;
  }
  const amount = parseFloat(sendAmount.value);
  if (Number.isNaN(amount) || amount <= 0) {
    showStatus(t("invalidAmount"), "error");
    return;
  }
  isSending.value = true;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));
    await invokeContract({
      contractAddress: GAS_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: recipientAddress.value },
        { type: "Integer", value: toFixed8(sendAmount.value) },
        { type: "Any", value: null },
      ],
    });
    showStatus(t("sendSuccess"), "success");
    sendAmount.value = "0.1";
    recipientAddress.value = "";
    await loadUserData();
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
  } finally {
    isSending.value = false;
  }
};

onMounted(() => {
  loadUserData();
  // We can't auto-refresh due to rate limits potentially, but could add a timer if needed
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
  border-radius: 99px !important; /* Pill shape */
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

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-msg {
  font-weight: 700;
  text-transform: uppercase;
  font-family: $font-mono;
  font-size: 12px;
  color: var(--gas-accent-secondary);
  text-shadow: var(--gas-status-shadow);
}

.status-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--gas-card-danger-text);
  letter-spacing: 0.08em;
}

.status-detail {
  font-size: 12px;
  text-align: center;
  color: var(--gas-text-secondary);
  opacity: 0.85;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.donate-form,
.send-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-subtitle {
  font-weight: 800;
  font-size: 14px;
  color: var(--gas-accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  text-shadow: 0 0 8px var(--gas-accent-glow);
}

.form-description {
  font-size: 12px;
  color: var(--gas-form-description);
  line-height: 1.5;
  margin-bottom: 8px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gas-accent-secondary);
  letter-spacing: 0.05em;
  text-shadow: var(--gas-status-shadow);
}

.preset-amounts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.preset-btn {
  padding: 16px 8px;
  background: var(--gas-preset-bg);
  border: 1px solid var(--gas-preset-border);
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(5px);

  &:hover {
    background: var(--gas-preset-hover-bg);
    border-color: var(--gas-preset-hover-border);
    transform: translateY(-2px);
  }

  &.active {
    background: var(--gas-preset-active-bg);
    border-color: var(--gas-accent);
    box-shadow: var(--gas-preset-active-shadow);
    .preset-value {
      color: var(--gas-preset-active-text);
    }
  }
}

.preset-value {
  font-weight: 800;
  font-size: 18px;
  color: var(--gas-text);
  font-family: $font-mono;
}

.preset-unit {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.7;
  color: var(--gas-accent-secondary);
}

.glass-status {
  text-align: center;
  backdrop-filter: blur(10px);
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
