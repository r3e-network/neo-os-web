<template>
  <view class="proposal-gallery">
    <view v-if="loading" class="empty-state">
      <text class="empty-text">{{ t("loading") }}</text>
    </view>

    <view v-else-if="fetchError" class="empty-state">
      <text class="empty-text">{{ t("loadFailed") }}</text>
    </view>

    <view v-else-if="grants.length === 0" class="empty-state">
      <text class="empty-text">{{ t("noActiveGrants") }}</text>
    </view>

    <view v-else class="grants-list">
      <NeoCard
        v-for="grant in grants"
        :key="grant.id"
        variant="erobo-neo"
        class="grant-card-neo clickable"
        hoverable
        @click="$emit('select', grant)"
      >
        <view class="grant-card-header">
          <view class="grant-info">
            <text class="grant-title-glass">{{ grant.title }}</text>
            <text v-if="grant.proposer" class="grant-creator-glass">{{ t("by") }} {{ grant.proposer }}</text>
          </view>
          <view :class="['grant-badge-glass', grant.state]">
            <text class="badge-text">{{ getStatusLabel(grant.state) }}</text>
          </view>
        </view>

        <view class="proposal-meta">
          <text v-if="grant.onchainId !== null" class="meta-item">#{{ grant.onchainId }}</text>
          <text v-if="grant.createdAt" class="meta-item">{{ formatDate(grant.createdAt) }}</text>
        </view>

        <view class="proposal-stats">
          <view class="stat-chip accept">{{ t("votesFor") }} {{ formatCount(grant.votesAccept) }}</view>
          <view class="stat-chip reject">{{ t("votesAgainst") }} {{ formatCount(grant.votesReject) }}</view>
          <view class="stat-chip comments">{{ t("comments") }} {{ formatCount(grant.comments) }}</view>
        </view>

        <view class="proposal-actions">
          <view @click.stop>
            <NeoButton
              size="sm"
              variant="secondary"
              :disabled="!grant.discussionUrl"
              @click="$emit('copyLink', grant.discussionUrl)"
            >
              {{ grant.discussionUrl ? t("copyDiscussion") : t("noDiscussion") }}
            </NeoButton>
          </view>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";

interface Grant {
  id: string;
  title: string;
  proposer: string;
  state: string;
  votesAccept: number;
  votesReject: number;
  discussionUrl: string;
  createdAt: string;
  comments: number;
  onchainId: number | null;
}

defineProps<{
  grants: Grant[];
  loading: boolean;
  fetchError: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCount: (amount: number) => string;
  formatDate: (dateStr: string) => string;
  getStatusLabel: (state: string) => string;
}>();

defineEmits<{
  select: [grant: Grant];
  copyLink: [url: string];
}>();
</script>

<style lang="scss" scoped>
.proposal-gallery {
  display: flex;
  flex-direction: column;
}

.empty-state {
  padding: 32px;
  text-align: center;
  background: var(--eco-empty-bg);
  border-radius: 12px;
  border: 1px dashed var(--eco-empty-border);
}

.empty-text {
  color: var(--eco-text-muted);
  font-size: 14px;
}

.grants-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grant-card-neo {
  margin-bottom: 0;
}

.grant-card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: flex-start;
}

.grant-title-glass {
  font-weight: 700;
  font-size: 16px;
  color: var(--eco-text);
  display: block;
  margin-bottom: 4px;
}

.grant-creator-glass {
  font-size: 10px;
  font-weight: 500;
  color: var(--eco-text-muted);
}

.grant-badge-glass {
  padding: 4px 10px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 20px;

  &.active {
    background: var(--eco-badge-active-bg);
    color: var(--eco-badge-active-text);
  }
  &.review,
  &.voting,
  &.discussion {
    background: var(--eco-badge-review-bg);
    color: var(--eco-badge-review-text);
  }
  &.executed {
    background: var(--eco-badge-executed-bg);
    color: var(--eco-badge-executed-text);
  }
  &.cancelled,
  &.rejected,
  &.expired {
    background: var(--eco-badge-cancel-bg);
    color: var(--eco-badge-cancel-text);
  }
}

.proposal-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  font-size: 10px;
  font-weight: 600;
  color: var(--eco-meta-text);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--eco-meta-bg);
}

.proposal-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.stat-chip.accept {
  background: var(--eco-chip-accept-bg);
  color: var(--eco-chip-accept-text);
  border: 1px solid var(--eco-chip-accept-border);
}

.stat-chip.reject {
  background: var(--eco-chip-reject-bg);
  color: var(--eco-chip-reject-text);
  border: 1px solid var(--eco-chip-reject-border);
}

.stat-chip.comments {
  background: var(--eco-chip-neutral-bg);
  color: var(--eco-chip-neutral-text);
  border: 1px solid var(--eco-chip-neutral-border);
}

.proposal-actions {
  display: flex;
  justify-content: flex-end;
}

@media (min-width: 1024px) {
  .grants-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}
</style>
