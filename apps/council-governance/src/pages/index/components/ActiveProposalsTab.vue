<template>
  <div class="tab-content">
    <NeoCard
      v-if="status"
      :variant="status.type === 'error' ? 'danger' : 'erobo-neo'"
      class="status-card"
      :role="status.type === 'error' ? 'alert' : undefined"
    >
      <span class="status-text">{{ status.msg }}</span>
    </NeoCard>

    <div v-if="loading && proposals.length === 0" class="skeleton-list mt-4">
      <NeoCard v-for="i in 3" :key="i" class="skeleton-neo-card mb-6">
        <div class="skeleton-line mb-4 w-20"></div>
        <div class="skeleton-line mb-2 h-6 w-full"></div>
        <div class="skeleton-line mb-4 h-6 w-full"></div>
        <div class="skeleton-line bg-glass h-8 w-full"></div>
      </NeoCard>
    </div>

    <!-- Soft Loading Indicator -->
    <div v-if="loading && proposals.length > 0" class="soft-loading-neo">
      <div class="spinner-small"></div>
      <span class="soft-loading-text uppercase">{{ t("loadingProposals") }}</span>
    </div>

    <!-- Voting Power Card -->
    <NeoCard class="mb-6" variant="erobo">
      <div class="power-header">
        <div>
          <span class="power-label">{{ t("yourVotingPower") }}</span>
          <span class="power-value">{{ votingPower }}</span>
        </div>
        <div class="text-right">
          <span class="power-label power-label--right">{{ t("councilMember") }}</span>
          <span class="candidate-status">{{ isCandidate ? t("yes") : t("no") }}</span>
        </div>
      </div>
    </NeoCard>

    <div v-if="candidateLoaded && !isCandidate" class="warning-banner-neo">
      {{ t("notCandidate") }}
    </div>

    <div class="action-bar-neo mb-6">
      <NeoButton variant="primary" size="md" block @click="$emit('create')"> + {{ t("createProposal") }} </NeoButton>
    </div>

    <div v-if="proposals.length === 0 && !loading" class="empty-state">
      {{ t("noActiveProposals") }}
    </div>

    <NeoCard
      v-for="p in proposals"
      :key="p.id"
      class="erobo-proposal-card glass-panel mb-6"
      variant="erobo-neo"
      @click="$emit('select', p)"
    >
      <div class="proposal-header-neo">
        <div class="proposal-meta-neo">
          <span class="proposal-id-neo">#{{ p.id }}</span>
          <span :class="['proposal-type-neo', p.type === 1 ? 'text-accent' : 'text-primary']">
            {{ p.type === 0 ? t("textType") : t("policyType") }}
          </span>
        </div>
        <span class="proposal-countdown-neo">
          {{ formatCountdown(p.expiryTime) }}
        </span>
      </div>

      <span class="proposal-title-neo">{{ p.title }}</span>

      <!-- Quorum Progress -->
      <div class="quorum-section-neo mb-6">
        <div class="quorum-header-neo">
          <span class="opacity-60">{{ t("quorum") }}</span>
          <span>{{ getQuorumPercent(p).toFixed(1) }}%</span>
        </div>
        <div class="neo-progress">
          <div class="neo-progress-fill" :style="{ width: getQuorumPercent(p) + '%' }"></div>
        </div>
      </div>

      <!-- Vote Distribution -->
      <div class="vote-distribution-neo">
        <div class="neo-progress mb-3 flex !h-6">
          <div class="bg-success !h-full" :style="{ width: getYesPercent(p) + '%' }"></div>
          <div class="bg-danger !h-full" :style="{ width: getNoPercent(p) + '%' }"></div>
        </div>
        <div class="vote-stats-neo">
          <div class="stat-group">
            <div class="dot success"></div>
            <span class="stat-text">{{ t("for") }}: {{ p.yesVotes }}</span>
          </div>
          <div class="stat-group">
            <span class="stat-text">{{ t("against") }}: {{ p.noVotes }}</span>
            <div class="dot danger"></div>
          </div>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { formatCountdown } from "@shared/utils/format";

const props = defineProps<{
  proposals: {
    id: number;
    type: number;
    title: string;
    yesVotes: number;
    noVotes: number;
    expiryTime: number;
    status: number;
  }[];
  status: { msg: string; type: string } | null;
  loading: boolean;
  votingPower: number;
  isCandidate: boolean;
  candidateLoaded: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

const quorumThreshold = 10;

const getYesPercent = (p: { yesVotes: number; noVotes: number }) => {
  const total = p.yesVotes + p.noVotes;
  return total > 0 ? (p.yesVotes / total) * 100 : 0;
};

const getNoPercent = (p: { yesVotes: number; noVotes: number }) => {
  const total = p.yesVotes + p.noVotes;
  return total > 0 ? (p.noVotes / total) * 100 : 0;
};

const getQuorumPercent = (p: { yesVotes: number; noVotes: number }) => {
  const totalVotes = p.yesVotes + p.noVotes;
  return Math.min((totalVotes / quorumThreshold) * 100, 100);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

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
  background: var(--senate-success);
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
}

.text-accent {
  color: var(--senate-success);
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
  color: var(--senate-success);
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
  border: 2px solid var(--senate-success);
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
  color: var(--senate-warning);
  border: 1px solid rgba(253, 224, 71, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 24px;
  text-align: center;
  @include stat-label;
  font-size: 12px;
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
  @include stat-label;
  display: block;
  margin-bottom: 4px;

  &--right {
    text-align: right;
  }
}
.power-value {
  font-size: 32px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--senate-success);
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
  @include stat-label;
  font-size: 10px;
  margin-bottom: 8px;
}

.bg-success {
  background: var(--senate-success);
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
}

.bg-danger {
  background: var(--senate-danger);
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
    background: var(--senate-success);
  }
  &.danger {
    background: var(--senate-danger);
  }
}

.mb-6 {
  margin-bottom: 24px;
}
</style>
