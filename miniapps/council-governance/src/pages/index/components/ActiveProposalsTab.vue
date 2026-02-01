<template>
  <view class="tab-content">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="status-card">
      <text class="status-text">{{ status.msg }}</text>
    </NeoCard>

    <view v-if="loading && proposals.length === 0" class="skeleton-list mt-4">
      <NeoCard v-for="i in 3" :key="i" class="mb-6 skeleton-neo-card">
        <view class="skeleton-line w-20 mb-4"></view>
        <view class="skeleton-line w-full mb-2 h-6"></view>
        <view class="skeleton-line w-full mb-4 h-6"></view>
        <view class="skeleton-line w-full h-8 bg-glass"></view>
      </NeoCard>
    </view>

    <!-- Soft Loading Indicator -->
    <view v-if="loading && proposals.length > 0" class="soft-loading-neo">
      <view class="spinner-small"></view>
      <text class="soft-loading-text uppercase">{{ t("loadingProposals") }}</text>
    </view>

    <!-- Voting Power Card -->
    <NeoCard class="mb-6" variant="erobo">
      <view class="power-header">
        <view>
          <text class="power-label">{{ t("yourVotingPower") }}</text>
          <text class="power-value">{{ votingPower }}</text>
        </view>
        <view class="text-right">
          <text class="power-label" style="text-align: right">{{ t("councilMember") }}</text>
          <text class="candidate-status">{{ isCandidate ? t("yes") : t("no") }}</text>
        </view>
      </view>
    </NeoCard>

    <view v-if="candidateLoaded && !isCandidate" class="warning-banner-neo">
      {{ t("notCandidate") }}
    </view>

    <view class="action-bar-neo mb-6">
      <NeoButton variant="primary" size="md" block @click="$emit('create')"> + {{ t("createProposal") }} </NeoButton>
    </view>

    <view v-if="proposals.length === 0 && !loading" class="empty-state">
      {{ t("noActiveProposals") }}
    </view>

    <NeoCard
      v-for="p in proposals"
      :key="p.id"
      class="mb-6 erobo-proposal-card glass-panel"
      variant="erobo-neo"
      @click="$emit('select', p)"
    >
      <view class="proposal-header-neo">
        <view class="proposal-meta-neo">
          <text class="proposal-id-neo">#{{ p.id }}</text>
          <text :class="['proposal-type-neo', p.type === 1 ? 'text-accent' : 'text-primary']">
            {{ p.type === 0 ? t("textType") : t("policyType") }}
          </text>
        </view>
        <text class="proposal-countdown-neo">
          {{ formatCountdown(p.expiryTime) }}
        </text>
      </view>

      <text class="proposal-title-neo">{{ p.title }}</text>

      <!-- Quorum Progress -->
      <view class="quorum-section-neo mb-6">
        <view class="quorum-header-neo">
          <text class="opacity-60">{{ t("quorum") }}</text>
          <text>{{ getQuorumPercent(p).toFixed(1) }}%</text>
        </view>
        <view class="neo-progress">
          <view class="neo-progress-fill" :style="{ width: getQuorumPercent(p) + '%' }"></view>
        </view>
      </view>

      <!-- Vote Distribution -->
      <view class="vote-distribution-neo">
        <view class="neo-progress mb-3 !h-6 flex">
          <view class="bg-success !h-full" :style="{ width: getYesPercent(p) + '%' }"></view>
          <view class="bg-danger !h-full" :style="{ width: getNoPercent(p) + '%' }"></view>
        </view>
        <view class="vote-stats-neo">
          <view class="stat-group">
            <view class="dot success"></view>
            <text class="stat-text">{{ t("for") }}: {{ p.yesVotes }}</text>
          </view>
          <view class="stat-group">
            <text class="stat-text">{{ t("against") }}: {{ p.noVotes }}</text>
            <view class="dot danger"></view>
          </view>
        </view>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { formatCountdown } from "@shared/utils/format";

const props = defineProps<{
  proposals: any[];
  status: { msg: string; type: string } | null;
  loading: boolean;
  votingPower: number;
  isCandidate: boolean;
  candidateLoaded: boolean;
  t: (key: string) => string;
}>();

const quorumThreshold = 10;

const getYesPercent = (p: any) => {
  const total = p.yesVotes + p.noVotes;
  return total > 0 ? (p.yesVotes / total) * 100 : 0;
};

const getNoPercent = (p: any) => {
  const total = p.yesVotes + p.noVotes;
  return total > 0 ? (p.noVotes / total) * 100 : 0;
};

const getQuorumPercent = (p: any) => {
  const totalVotes = p.yesVotes + p.noVotes;
  return Math.min((totalVotes / quorumThreshold) * 100, 100);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.tab-content {
  padding: 20px;
}

.status-card {
  margin-bottom: 16px;
  text-align: center;
}
.status-text {
  font-weight: 700;
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 48px;
  opacity: 0.4;
  font-style: italic;
}

.neo-progress {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  overflow: hidden;
}
.neo-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: #00e599;
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
}

.text-accent {
  color: #00e599;
}
.text-primary {
  color: var(--text-primary);
}

.soft-loading-neo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 229, 153, 0.05);
  color: #00e599;
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 99px;
  backdrop-filter: blur(10px);
  width: fit-content;
  margin: 0 auto 16px;
}

.soft-loading-text {
  font-family: $font-mono;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid #00e599;
  border-top-color: transparent;
  border-radius: 50%;
  animation: rotate 0.8s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.skeleton-neo-card {
  opacity: 0.7;
}

.skeleton-line {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  height: 12px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

.warning-banner-neo {
  background: rgba(253, 224, 71, 0.1);
  color: #fde047;
  border: 1px solid rgba(253, 224, 71, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 24px;
  text-align: center;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

// Utility overrides for scoped styles
.w-20 {
  width: 80px;
}
.w-full {
  width: 100%;
}
.h-6 {
  height: 24px;
}
.h-8 {
  height: 32px;
}
.bg-glass {
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
}
.opacity-60 {
  opacity: 0.6;
}

.power-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.power-label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.1em;
}
.power-value {
  font-size: 32px;
  font-weight: 800;
  font-family: $font-family;
  color: #00e599;
  text-shadow: 0 0 20px rgba(0, 229, 153, 0.6);
  line-height: 1;
}
.candidate-status {
  font-weight: 900;
  color: var(--text-primary);
  font-size: 18px;
  text-transform: uppercase;
}

.proposal-header-neo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.proposal-meta-neo {
  display: flex;
  flex-direction: column;
}

.proposal-id-neo {
  font-size: 12px;
  font-family: $font-mono;
  opacity: 0.6;
  display: block;
  margin-bottom: 4px;
}
.proposal-type-neo {
  font-weight: 900;
  text-transform: uppercase;
  font-size: 14px;
}

.proposal-countdown-neo {
  font-family: $font-mono;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.proposal-title-neo {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 16px;
  display: block;
}

.quorum-header-neo {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}

.bg-success {
  background: #00e599;
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
}

.bg-danger {
  background: #ef4444;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
}

.vote-stats-neo {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  font-family: $font-mono;
}
.stat-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-text {
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}
.dot {
  width: 12px;
  height: 12px;
  border: 1px solid var(--border-color, black);
  &.success {
    background: #00e599;
  }
  &.danger {
    background: #ef4444;
  }
}

.mb-6 {
  margin-bottom: 24px;
}
</style>
