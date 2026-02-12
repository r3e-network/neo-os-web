<template>
  <view v-if="candidate" class="candidate-info-display">
    <!-- Rank Badge -->
    <view class="rank-section">
      <view class="rank-badge-large" :class="getRankClass(rank)">
        <text class="rank-text">#{{ rank }}</text>
      </view>
      <view v-if="isUserVoted" class="voted-badge">
        <text class="voted-text">{{ t("yourVote") }}</text>
      </view>
    </view>

    <view v-if="candidate.logo" class="logo-wrap">
      <image
        class="candidate-logo"
        :src="candidate.logo"
        mode="widthFix"
        :alt="candidate.name || t('candidateLogo')"
      />
    </view>

    <!-- Candidate Name -->
    <view class="info-section">
      <text class="info-label">{{ t("name") }}</text>
      <text class="info-value name-value">
        {{ candidate.name || t("anonymous") }}
      </text>
    </view>

    <!-- Address -->
    <view class="info-section">
      <text class="info-label">{{ t("address") }}</text>
      <text class="info-value mono">{{ candidate.address || t("notAvailable") }}</text>
    </view>

    <!-- Public Key -->
    <view class="info-section">
      <text class="info-label">{{ t("publicKey") }}</text>
      <text class="info-value mono small">{{ candidate.publicKey || t("notAvailable") }}</text>
    </view>

    <view v-if="candidate.location" class="info-section">
      <text class="info-label">{{ t("location") }}</text>
      <text class="info-value">{{ candidate.location }}</text>
    </view>

    <view v-if="candidate.description" class="info-section">
      <text class="info-label">{{ t("description") }}</text>
      <text class="info-value description">{{ candidate.description }}</text>
    </view>

    <view v-if="hasLinks" class="info-section">
      <text class="info-label">{{ t("links") }}</text>
      <view class="link-grid">
        <text v-if="candidate.website" class="link-item" role="link" tabindex="0" :aria-label="t('website')" @click="$emit('open-external', candidate.website)">
          {{ t("website") }}
        </text>
        <text v-if="candidate.twitter" class="link-item" role="link" tabindex="0" :aria-label="t('twitter')" @click="$emit('open-external', candidate.twitter)">
          {{ t("twitter") }}
        </text>
        <text v-if="candidate.github" class="link-item" role="link" tabindex="0" :aria-label="t('github')" @click="$emit('open-external', candidate.github)">
          {{ t("github") }}
        </text>
        <text v-if="candidate.telegram" class="link-item" role="link" tabindex="0" :aria-label="t('telegram')" @click="$emit('open-external', candidate.telegram)">
          {{ t("telegram") }}
        </text>
        <text v-if="candidate.discord" class="link-item" role="link" tabindex="0" :aria-label="t('discord')" @click="$emit('open-external', candidate.discord)">
          {{ t("discord") }}
        </text>
        <text v-if="candidate.email" class="link-item" role="link" tabindex="0" :aria-label="t('email')" @click="$emit('open-external', `mailto:${candidate.email}`)">
          {{ t("email") }}
        </text>
      </view>
    </view>

    <!-- Votes -->
    <view class="info-section">
      <text class="info-label">{{ t("totalVotes") }}</text>
      <view class="votes-display">
        <text class="votes-value">{{ formatVotes(candidate.votes) }}</text>
        <text class="votes-percentage">({{ votePercentage }}%)</text>
      </view>
    </view>

    <!-- Status -->
    <view class="info-section">
      <text class="info-label">{{ t("status") }}</text>
      <view class="status-badge" :class="candidate.active ? 'active' : 'inactive'">
        <text class="status-text">
          {{ candidate.active ? t("activeValidator") : t("standby") }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GovernanceCandidate } from "../../utils";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const props = defineProps<{
  candidate: GovernanceCandidate;
  rank: number;
  totalVotes: string;
  isUserVoted: boolean;
}>();

defineEmits<{
  (e: "open-external", url: string): void;
}>();

const safeBigInt = (value: string | undefined) => {
  try {
    return BigInt(value || "0");
  } catch {
    return BigInt(0);
  }
};

const votePercentage = computed(() => {
  if (!props.candidate || !props.totalVotes) return "0.00";
  const total = safeBigInt(props.totalVotes || "1");
  const votes = safeBigInt(props.candidate.votes || "0");
  if (total === BigInt(0)) return "0.00";
  return ((Number(votes) / Number(total)) * 100).toFixed(2);
});

const formatVotes = (votes: string) => {
  const num = safeBigInt(votes || "0");
  if (num >= BigInt(1e12)) {
    return (Number(num / BigInt(1e10)) / 100).toFixed(2) + "T";
  }
  if (num >= BigInt(1e9)) {
    return (Number(num / BigInt(1e7)) / 100).toFixed(2) + "B";
  }
  if (num >= BigInt(1e6)) {
    return (Number(num / BigInt(1e4)) / 100).toFixed(2) + "M";
  }
  if (num >= BigInt(1e3)) {
    return (Number(num / BigInt(10)) / 100).toFixed(2) + "K";
  }
  return votes || "0";
};

const hasLinks = computed(() => {
  const candidate = props.candidate;
  if (!candidate) return false;
  return Boolean(
    candidate.website ||
    candidate.twitter ||
    candidate.github ||
    candidate.telegram ||
    candidate.discord ||
    candidate.email
  );
});

const getRankClass = (rank: number) => {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.logo-wrap {
  display: flex;
  justify-content: center;
  padding-bottom: 12px;
}

.candidate-logo {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  object-fit: contain;
}

.rank-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.rank-badge-large {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;

  &.rank-gold {
    background: var(--candidate-medal-gold);
    box-shadow: 0 4px 20px rgba(253, 185, 49, 0.4);
  }
  &.rank-silver {
    background: var(--candidate-medal-silver);
    box-shadow: 0 4px 20px rgba(189, 189, 189, 0.4);
  }
  &.rank-bronze {
    background: var(--candidate-medal-bronze);
    box-shadow: 0 4px 20px rgba(160, 82, 45, 0.4);
  }
}

.rank-text {
  font-weight: 800;
  font-size: 20px;
  color: black;

  .rank-gold &,
  .rank-silver & {
    color: black;
  }
  .rank-bronze & {
    color: var(--text-primary);
  }
}

.voted-badge {
  background: var(--candidate-step-gradient);
  padding: 6px 14px;
  border-radius: 99px;
  box-shadow: 0 4px 15px rgba(0, 229, 153, 0.3);
}

.voted-text {
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: black;
}

.info-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.info-value {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-all;

  &.name-value {
    font-weight: 700;
    font-size: 18px;
  }
  &.mono {
    font-family: monospace;
    font-size: 12px;
  }
  &.small {
    font-size: 10px;
  }
  &.description {
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.75);
  }
}

.votes-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.votes-value {
  font-weight: 700;
  font-size: 24px;
  color: var(--candidate-neo-green);
  font-family: $font-family;
}

.votes-percentage {
  font-size: 14px;
  color: var(--text-secondary);
}

.link-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link-item {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 99px;

  &.active {
    background: rgba(0, 229, 153, 0.15);
    border: 1px solid rgba(0, 229, 153, 0.3);
  }
  &.inactive {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
}

.status-text {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;

  .active & {
    color: var(--candidate-neo-green);
  }
  .inactive & {
    color: var(--text-secondary);
  }
}
</style>
