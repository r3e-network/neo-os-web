<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    class="theme-trustanchor"
    @tab-change="activeTab = $event"
  >
    <!-- Desktop Sidebar -->
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <!-- Overview Tab (default) -->
    <template #content>
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
        <StatsGrid :my-stake="myStake" :pending-rewards="pendingRewards" :total-rewards="totalRewards" />

        <NeoCard variant="erobo" class="mb-4 px-1">
          <view class="section-header mb-4">
            <text class="section-title">{{ t("voteForReputation") }}</text>
          </view>
          <text class="section-desc mb-4">{{ t("voteForReputationDesc") }}</text>

          <view class="section-header mb-4" style="margin-top: 16px">
            <text class="section-title">{{ t("notForProfit") }}</text>
          </view>
          <text class="section-desc">{{ t("notForProfitDesc") }}</text>
        </NeoCard>

        <NeoCard variant="erobo" class="px-1">
          <view class="section-header mb-4">
            <text class="section-title">{{ t("claim") }}</text>
          </view>
          <view class="claim-section">
            <text class="claim-amount">{{ formatNum(pendingRewards) }} GAS</text>
            <NeoButton variant="primary" :loading="isClaiming" :disabled="pendingRewards <= 0" @click="handleClaim">
              {{ t("claim") }}
            </NeoButton>
          </view>
        </NeoCard>
      </ErrorBoundary>
    </template>

    <template #operation>
      <NeoCard variant="erobo" class="mb-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("stake") }}</text>
        </view>

        <view v-if="address" class="stake-form">
          <view class="input-group mb-4">
            <view class="input-row">
              <NeoInput type="number" v-model="stakeAmount" :label="t('stake NEO')" :placeholder="t('amount')" />
              <NeoButton variant="primary" :loading="isStaking" @click="handleStake">
                {{ t("stake") }}
              </NeoButton>
            </view>
          </view>

          <view class="input-group">
            <view class="input-row">
              <NeoInput type="number" v-model="unstakeAmount" :label="t('unstake')" :placeholder="t('amount')" />
              <NeoButton variant="secondary" :loading="isUnstaking" @click="handleUnstake">
                {{ t("unstake") }}
              </NeoButton>
            </view>
          </view>
        </view>

        <view v-else class="connect-prompt">
          <NeoButton variant="primary" @click="connect">
            {{ t("connectWallet") }}
          </NeoButton>
        </view>
      </NeoCard>
    </template>

    <!-- Agents Tab -->
    <template #tab-agents>
      <AgentsTab :agents="agents" />
    </template>

    <!-- History Tab -->
    <template #tab-history>
      <HistoryTab :stats="stats" />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { MiniAppTemplate, NeoButton, NeoCard, NeoInput, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import StatsGrid from "./components/StatsGrid.vue";
import AgentsTab from "./components/AgentsTab.vue";
import HistoryTab from "./components/HistoryTab.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useTrustAnchor } from "./composables/useTrustAnchor";

const { t } = createUseI18n(messages)();
const { status } = useStatusMessage();
const { address, connect } = useWallet() as WalletSDK;

const {
  isLoading,
  error,
  agents,
  stats,
  myStake,
  pendingRewards,
  totalRewards,
  setError,
  clearError,
  loadAll,
  stake,
  unstake,
  claimRewards,
} = useTrustAnchor(t);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
    { key: "agents", labelKey: "tabAgents", icon: "users" },
    { key: "history", labelKey: "tabHistory", icon: "clock" },
    { key: "docs", labelKey: "docs", icon: "book" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docsSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("overview");
const stakeAmount = ref("");
const unstakeAmount = ref("");
const isStaking = ref(false);
const isUnstaking = ref(false);
const isClaiming = ref(false);

const appState = computed(() => ({
  myStake: myStake.value,
  pendingRewards: pendingRewards.value,
  totalRewards: totalRewards.value,
}));

const formatNum = (n: number | string) => formatNumber(n, 2);

const sidebarItems = computed(() => [
  { label: t("stake"), value: `${formatNum(myStake.value)} NEO` },
  { label: t("claim"), value: `${formatNum(pendingRewards.value)} GAS` },
  { label: t("totalStaked"), value: `${formatNum(stats.value?.totalStaked ?? 0)} NEO` },
  { label: t("delegatorsLabel"), value: stats.value?.totalDelegators ?? 0 },
]);

const handleStake = async () => {
  const amount = parseFloat(stakeAmount.value);
  if (isNaN(amount) || amount <= 0) {
    setError(t("errorInvalidStakeAmount"));
    return;
  }
  isStaking.value = true;
  try {
    const result = await stake(amount);
    if (result.success) stakeAmount.value = "";
  } finally {
    isStaking.value = false;
  }
};

const handleUnstake = async () => {
  const amount = parseFloat(unstakeAmount.value);
  if (isNaN(amount) || amount <= 0) {
    setError(t("errorInvalidUnstakeAmount"));
    return;
  }
  if (amount > myStake.value) {
    setError(t("errorInsufficientStaked"));
    return;
  }
  isUnstaking.value = true;
  try {
    const result = await unstake(amount);
    if (result.success) unstakeAmount.value = "";
  } finally {
    isUnstaking.value = false;
  }
};

const handleClaim = async () => {
  if (pendingRewards.value <= 0) return;
  isClaiming.value = true;
  try {
    await claimRewards();
  } finally {
    isClaiming.value = false;
  }
};

onMounted(() => {
  loadAll();
});

const { handleBoundaryError } = useHandleBoundaryError("trustanchor");
const resetAndReload = () => {
  loadAll();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./trustanchor-theme.scss" as *;

:global(page) {
  background: var(--bg-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
}

.section-desc {
  font-size: 14px;
  opacity: 0.8;
  display: block;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 12px;
  opacity: 0.7;
}

.input-row {
  display: flex;
  gap: 12px;
}

.claim-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.claim-amount {
  font-size: 24px;
  font-weight: bold;
}

.connect-prompt {
  display: flex;
  justify-content: center;
  padding: 20px;
}

@media (max-width: 767px) {
  .input-row {
    flex-direction: column;
    gap: 8px;
  }
  .claim-section {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
}
</style>
