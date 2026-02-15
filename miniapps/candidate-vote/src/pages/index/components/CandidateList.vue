<template>
  <NeoCard variant="erobo-neo" class="candidate-list-card">
    <ItemList
      :items="sortedCandidates as unknown as Record<string, unknown>[]"
      item-key="publicKey"
      :loading="isLoading"
      :loading-text="t('loadingCandidates')"
      :empty-text="t('noCandidates')"
      :aria-label="t('ariaCandidates')"
    >
      <template #empty>
        <view class="empty-state">
          <text class="empty-icon">🗳️</text>
          <text class="empty-text">{{ t("noCandidates") }}</text>
        </view>
      </template>
      <template #item="{ item, index }">
        <view
          class="candidate-item"
          :class="{
            selected: selectedCandidate?.publicKey === (item as unknown as GovernanceCandidate).publicKey,
            'user-voted': isUserVotedCandidate(item as unknown as GovernanceCandidate),
          }"
          @click="selectCandidate(item as unknown as GovernanceCandidate)"
        >
          <view class="rank-badge" :class="getRankClass(index)">
            <text class="rank-number">#{{ index + 1 }}</text>
          </view>

          <view class="candidate-info">
            <view class="name-row">
              <text class="candidate-name">{{
                (item as unknown as GovernanceCandidate).name ||
                truncateAddress((item as unknown as GovernanceCandidate).address)
              }}</text>
              <view v-if="isUserVotedCandidate(item as unknown as GovernanceCandidate)" class="your-vote-badge">
                <text class="your-vote-text">{{ t("yourVote") }}</text>
              </view>
            </view>
            <text class="candidate-address">{{
              truncateAddress((item as unknown as GovernanceCandidate).publicKey)
            }}</text>
          </view>

          <view class="candidate-votes">
            <text class="votes-value">{{ formatVotes((item as unknown as GovernanceCandidate).votes) }}</text>
            <text class="votes-label">{{ t("votes") }}</text>
          </view>

          <view class="action-buttons">
            <view
              v-if="selectedCandidate?.publicKey === (item as unknown as GovernanceCandidate).publicKey"
              class="selected-indicator"
            >
              <text class="check-icon">✓</text>
            </view>
            <view class="info-btn" @click.stop="viewDetails(item as unknown as GovernanceCandidate, index)">
              <text class="info-icon">ℹ</text>
            </view>
          </view>
        </view>
      </template>
    </ItemList>

    <view v-if="totalVotes" class="total-votes-footer">
      <text class="total-label">{{ t("totalNetworkVotes") }}:</text>
      <text class="total-value">{{ formatVotes(totalVotes) }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, ItemList } from "@shared/components";
import type { GovernanceCandidate } from "../utils";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

const props = defineProps<{
  candidates: GovernanceCandidate[];
  selectedCandidate: GovernanceCandidate | null;
  userVotedPublicKey: string | null;
  totalVotes: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "select", candidate: GovernanceCandidate): void;
  (e: "view-details", candidate: GovernanceCandidate, rank: number): void;
}>();

const sortedCandidates = computed(() => {
  return [...props.candidates].sort((a, b) => {
    const votesA = safeBigInt(a.votes);
    const votesB = safeBigInt(b.votes);
    if (votesA === votesB) return 0;
    return votesB > votesA ? 1 : -1;
  });
});

const selectCandidate = (candidate: GovernanceCandidate) => {
  emit("select", candidate);
};

const viewDetails = (candidate: GovernanceCandidate, index: number) => {
  emit("view-details", candidate, index + 1);
};

const truncateAddress = (addr: string) => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const safeBigInt = (value: string | undefined) => {
  try {
    return BigInt(value || "0");
  } catch {
    return BigInt(0);
  }
};

const normalizePublicKey = (value: string | null | undefined) => String(value || "").replace(/^0x/i, "");

const isUserVotedCandidate = (candidate: GovernanceCandidate) => {
  if (!props.userVotedPublicKey) return false;
  return normalizePublicKey(candidate.publicKey) === normalizePublicKey(props.userVotedPublicKey);
};

const formatVotes = (votes: string) => {
  const num = safeBigInt(votes);
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
  return votes;
};

const getRankClass = (index: number) => {
  if (index === 0) return "rank-gold";
  if (index === 1) return "rank-silver";
  if (index === 2) return "rank-bronze";
  return "";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.candidate-list-card {
  margin-bottom: 24px;
}

.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.loading-text,
.empty-text {
  @include stat-label;
  opacity: 0.6;
  font-size: 14px;
  letter-spacing: 0.05em;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: var(--candidate-scrollbar-track);
  }
  &::-webkit-scrollbar-thumb {
    background: var(--candidate-scrollbar-thumb);
    border-radius: 2px;
  }
}

.candidate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--candidate-item-bg);
  border: 1px solid var(--candidate-item-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(5px);

  &:hover {
    background: var(--candidate-item-hover-bg);
    border-color: var(--candidate-item-hover-border);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.selected {
    background: rgba(0, 229, 153, 0.1);
    border-color: var(--candidate-neo-green);
    box-shadow: 0 0 15px rgba(0, 229, 153, 0.1);
  }

  &.user-voted {
    border-color: rgba(0, 229, 153, 0.4);
    background: rgba(0, 229, 153, 0.05);
  }
}

.rank-badge {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--candidate-rank-bg);
  border: 1px solid var(--candidate-rank-border);
  border-radius: 50%;
  font-weight: 800;
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));

  &.rank-gold {
    background: var(--candidate-medal-gold);
    color: black;
    box-shadow: 0 2px 5px rgba(253, 185, 49, 0.3);
  }
  &.rank-silver {
    background: var(--candidate-medal-silver);
    color: black;
    box-shadow: 0 2px 5px rgba(189, 189, 189, 0.3);
  }
  &.rank-bronze {
    background: var(--candidate-medal-bronze);
    color: var(--text-primary);
    box-shadow: 0 2px 5px rgba(160, 82, 45, 0.3);
  }
}

.candidate-info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.your-vote-badge {
  background: var(--candidate-step-gradient);
  padding: 2px 8px;
  border-radius: 99px;
  flex-shrink: 0;
}

.your-vote-text {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: black;
}

.candidate-name {
  @include text-truncate;
  display: block;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.candidate-address {
  display: block;
  font-size: 10px;
  font-family: monospace;
  color: var(--text-secondary);
}

.candidate-votes {
  text-align: right;
}

.votes-value {
  display: block;
  font-weight: 700;
  font-family: $font-family;
  font-feature-settings: "tnum";
  font-size: 14px;
  color: var(--text-primary);
}

.votes-label {
  display: block;
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-secondary);
}

.selected-indicator {
  width: 20px;
  height: 20px;
  background: var(--candidate-selected-bg);
  color: var(--candidate-selected-text);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  box-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.info-btn {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.info-icon {
  font-size: 14px;
  color: var(--text-primary);
}

.check-icon {
  line-height: 1;
}

.total-votes-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-label {
  @include stat-label;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.05em;
}

.total-value {
  font-weight: 700;
  font-family: $font-family;
  font-feature-settings: "tnum";
  color: var(--text-primary);
  font-size: 14px;
}
</style>
