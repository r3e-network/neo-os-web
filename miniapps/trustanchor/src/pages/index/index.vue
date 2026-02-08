<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-trustanchor" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
    <ChainWarning :title="t('warningTitle')" :message="t('warningMessage')" :button-text="t('switchButton')" />

    <view v-if="activeTab === 'overview'" class="tab-content scrollable">
      <StatsGrid
        :my-stake="myStake"
        :pending-rewards="pendingRewards"
        :total-rewards="totalRewards"
      />

      <NeoCard variant="erobo" class="mb-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("voteForReputation") }}</text>
        </view>
        <text class="section-desc mb-4">{{ t("voteForReputationDesc") }}</text>

        <view class="section-header mb-4 mt-4">
          <text class="section-title">{{ t("notForProfit") }}</text>
        </view>
        <text class="section-desc">{{ t("notForProfitDesc") }}</text>
      </NeoCard>

      <NeoCard variant="erobo" class="mb-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("stake") }}</text>
        </view>

        <view v-if="address" class="stake-form">
          <view class="input-group mb-4">
            <text class="input-label">{{ t("stake NEO") }}</text>
            <view class="input-row">
              <input
                type="number"
                v-model="stakeAmount"
                class="amount-input"
                :placeholder="t('amount')"
              />
              <NeoButton variant="primary" :loading="isStaking" @click="handleStake">
                {{ t("stake") }}
              </NeoButton>
            </view>
          </view>

          <view class="input-group">
            <text class="input-label">{{ t("unstake") }}</text>
            <view class="input-row">
              <input
                type="number"
                v-model="unstakeAmount"
                class="amount-input"
                :placeholder="t('amount')"
              />
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

      <NeoCard variant="erobo" class="px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("claim") }}</text>
        </view>
        <view class="claim-section">
          <text class="claim-amount">{{ formatNum(pendingRewards) }} GAS</text>
          <NeoButton
            variant="primary"
            :loading="isClaiming"
            :disabled="pendingRewards <= 0"
            @click="handleClaim">
            {{ t("claim") }}
          </NeoButton>
        </view>
      </NeoCard>
    </view>

    <view v-if="activeTab === 'agents'" class="tab-content scrollable">
      <view class="agents-header px-1 mb-4">
        <text class="agents-title">{{ t("agentRanking") }}</text>
      </view>

      <view class="agents-list">
        <NeoCard v-for="(agent, index) in agents" :key="agent.address" variant="erobo" class="agent-card mb-3">
          <view class="agent-row">
            <view class="agent-rank">{{ index + 1 }}</view>
            <view class="agent-info">
              <text class="agent-name">{{ agent.name }}</text>
              <text class="agent-address">{{ formatAddress(agent.address) }}</text>
            </view>
            <view class="agent-stats">
              <view class="agent-stat">
                <text class="stat-number">{{ formatNum(agent.votes) }}</text>
                <text class="stat-unit">NEO</text>
              </view>
              <view class="agent-stat">
                <text class="stat-number">{{ (agent.performance * 100).toFixed(1) }}%</text>
                <text class="stat-unit">{{ t("performance") }}</text>
              </view>
            </view>
          </view>
        </NeoCard>

        <view v-if="agents.length === 0" class="empty-state">
          <AppIcon name="users" :size="48" class="mb-4 opacity-50" />
          <text class="empty-text">{{ t("loading") }}</text>
        </view>
      </view>
    </view>

    <view v-if="activeTab === 'history'" class="tab-content scrollable">
      <NeoCard variant="erobo" class="px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("philosophy") }}</text>
        </view>
        <text class="philosophy-text">{{ t("philosophyText") }}</text>
      </NeoCard>

      <NeoCard variant="erobo" class="mt-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("statsTitle") }}</text>
        </view>

        <view class="stats-detail">
          <view class="stat-row">
            <text class="stat-label">{{ t("totalStaked") }}</text>
            <text class="stat-value">{{ formatNum(stats?.totalStaked ?? 0) }} NEO</text>
          </view>
          <view class="stat-row">
            <text class="stat-label">{{ t("delegatorsLabel") }}</text>
            <text class="stat-value">{{ stats?.totalDelegators ?? 0 }}</text>
          </view>
          <view class="stat-row">
            <text class="stat-label">{{ t("votePowerLabel") }}</text>
            <text class="stat-value">{{ formatNum(stats?.totalVotePower ?? 0) }}</text>
          </view>
          <view class="stat-row">
            <text class="stat-label">{{ t("aprLabel") }}</text>
            <text class="stat-value text-green">{{ ((stats?.estimatedApr ?? 0) * 100).toFixed(1) }}%</text>
          </view>
        </view>
      </NeoCard>

      <NeoCard variant="erobo" class="mt-4 px-1">
        <view class="section-header mb-4">
          <text class="section-title">{{ t("howItWorks") }}</text>
        </view>
        <view class="steps-list">
          <view class="step-item">
            <text class="step-num">1</text>
            <text class="step-text">{{ t("step1") }}</text>
          </view>
          <view class="step-item">
            <text class="step-num">2</text>
            <text class="step-text">{{ t("step2") }}</text>
          </view>
          <view class="step-item">
            <text class="step-num">3</text>
            <text class="step-text">{{ t("step3") }}</text>
          </view>
          <view class="step-item">
            <text class="step-num">4</text>
            <text class="step-text">{{ t("step4") }}</text>
          </view>
        </view>
      </NeoCard>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber, formatAddress as formatAddressText } from "@shared/utils/format";
import { ResponsiveLayout, NeoButton, NeoCard, ChainWarning } from "@shared/components";
import StatsGrid from "./components/StatsGrid.vue";
import { useI18n } from "@/composables/useI18n";
import { useTrustAnchor, type Agent } from "./composables/useTrustAnchor";

const { t } = useI18n();
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

const activeTab = ref("overview");
const stakeAmount = ref("");
const unstakeAmount = ref("");
const isStaking = ref(false);
const isUnstaking = ref(false);
const isClaiming = ref(false);

const navTabs = computed(() => [
  { id: "overview", icon: "layout", label: t("tabOverview") },
  { id: "agents", icon: "users", label: t("tabAgents") },
  { id: "history", icon: "clock", label: t("tabHistory") },
]);

const formatNum = (n: number | string) => formatNumber(n, 2);
const formatAddress = (addr: string) => formatAddressText(addr, 6);

const handleStake = async () => {
  const amount = parseFloat(stakeAmount.value);
  if (isNaN(amount) || amount <= 0) {
    setError("Invalid stake amount");
    return;
  }

  isStaking.value = true;
  try {
    const result = await stake(amount);
    if (result.success) {
      stakeAmount.value = "";
    }
  } finally {
    isStaking.value = false;
  }
};

const handleUnstake = async () => {
  const amount = parseFloat(unstakeAmount.value);
  if (isNaN(amount) || amount <= 0) {
    setError("Invalid unstake amount");
    return;
  }
  if (amount > myStake.value) {
    setError("Insufficient staked balance");
    return;
  }

  isUnstaking.value = true;
  try {
    const result = await unstake(amount);
    if (result.success) {
      unstakeAmount.value = "";
    }
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

// Responsive layout
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);

const handleResize = () => { windowWidth.value = window.innerWidth; };
window.addEventListener('resize', handleResize);
onUnmounted(() => window.removeEventListener('resize', handleResize));
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "./trustanchor-theme.scss" as *;

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.amount-input {
  flex: 1;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
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

.agents-header {
  margin-top: 16px;
}

.agents-title {
  font-size: 18px;
  font-weight: bold;
}

.agents-list {
  padding: 0 4px;
}

.agent-card {
  padding: 12px;
}

.agent-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--erobo-purple);
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.agent-info {
  flex: 1;
}

.agent-name {
  display: block;
  font-weight: bold;
  font-size: 14px;
}

.agent-address {
  display: block;
  font-size: 10px;
  opacity: 0.6;
}

.agent-stats {
  display: flex;
  gap: 16px;
}

.agent-stat {
  text-align: right;
}

.agent-stat .stat-number {
  display: block;
  font-weight: bold;
  font-size: 14px;
}

.agent-stat .stat-unit {
  display: block;
  font-size: 10px;
  opacity: 0.6;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-text {
  opacity: 0.6;
}

.stats-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-row:last-child {
  border-bottom: none;
}

.philosophy-text {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.9;
}

.section-desc {
  font-size: 14px;
  opacity: 0.8;
  display: block;
}

.mt-4 {
  margin-top: 16px;
}

.text-green {
  color: #22c55e;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--erobo-purple);
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.step-text {
  font-size: 14px;
  opacity: 0.9;
}

// Responsive styles
@media (max-width: 767px) {
  .tab-content { padding: 12px; }
  .input-row {
    flex-direction: column;
    gap: 8px;
  }
  .amount-input {
    width: 100%;
  }
  .agent-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .agent-stats {
    width: 100%;
    justify-content: space-between;
  }
  .claim-section {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
}
@media (min-width: 1024px) {
  .tab-content { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .agents-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
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
