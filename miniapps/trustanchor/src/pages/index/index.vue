<template>
  <MiniAppPage
    name="trustanchor"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadAll"
  >
    <!-- Overview Tab (default) -->
    <template #content>
      <StatsDisplay :items="trustStats" layout="grid" class="mb-6" />

      <NeoCard variant="erobo" class="mb-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("voteForReputation") }}</text>
        </view>
        <text class="section-desc mb-4">{{ t("voteForReputationDesc") }}</text>

        <view class="section-header section-header--spaced mb-4">
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
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { MiniAppPage, StatsDisplay, NeoButton, NeoCard } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useTrustAnchor } from "./composables/useTrustAnchor";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "trustanchor",
  messages,
  template: {
    tabs: [
      { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
      { key: "agents", labelKey: "tabAgents", icon: "users" },
      { key: "history", labelKey: "tabHistory", icon: "clock" },
    ],
    docSubtitleKey: "docsSubtitle",
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "stake", value: () => `${formatNum(myStake.value)} NEO` },
    { labelKey: "claim", value: () => `${formatNum(pendingRewards.value)} GAS` },
    { labelKey: "totalStaked", value: () => `${formatNum(stats.value?.totalStaked ?? 0)} NEO` },
    { labelKey: "delegatorsLabel", value: () => stats.value?.totalDelegators ?? 0 },
  ],
});
const { address, connect } = useWallet() as WalletSDK;

const { agents, stats, myStake, pendingRewards, totalRewards, setError, loadAll, stake, unstake, claimRewards } =
  useTrustAnchor(t);
const isClaiming = ref(false);

const appState = computed(() => ({
  myStake: myStake.value,
  pendingRewards: pendingRewards.value,
  totalRewards: totalRewards.value,
}));

const formatNum = (n: number | string) => formatNumber(n, 2);

const trustStats = computed<StatsDisplayItem[]>(() => [
  { label: t("myStake"), value: `${formatNum(myStake.value)} NEO` },
  { label: t("pendingRewards"), value: `${formatNum(pendingRewards.value)} GAS`, variant: "success" },
  { label: t("totalRewards"), value: `${formatNum(totalRewards.value)} GAS`, variant: "accent" },
  { label: t("zeroFee"), value: t("zeroFeeDesc"), variant: "erobo" },
]);
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

  &--spaced {
    margin-top: 16px;
  }
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
