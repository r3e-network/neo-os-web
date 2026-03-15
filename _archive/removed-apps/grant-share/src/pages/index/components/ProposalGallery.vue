<template>
  <div class="proposal-gallery">
    <div v-if="loading" class="empty-state">
      <span class="empty-text">{{ t("loading") }}</span>
    </div>

    <div v-else-if="fetchError" class="empty-state">
      <span class="empty-text">{{ t("loadFailed") }}</span>
    </div>

    <div v-else-if="grants.length === 0" class="empty-state">
      <span class="empty-text">{{ t("noActiveGrants") }}</span>
    </div>

    <div v-else class="grants-list">
      <NeoCard
        v-for="grant in grants"
        :key="grant.id"
        variant="erobo-neo"
        class="grant-card-neo clickable"
        hoverable
        @click="$emit('select', grant)"
      >
        <div class="grant-card-header">
          <div class="grant-info">
            <span class="grant-title-glass">{{ grant.title }}</span>
            <span v-if="grant.proposer" class="grant-creator-glass">{{ t("by") }} {{ grant.proposer }}</span>
          </div>
          <div :class="['grant-badge-glass', grant.state]">
            <span class="badge-text">{{ getStatusLabel(grant.state) }}</span>
          </div>
        </div>

        <div class="proposal-meta">
          <span v-if="grant.onchainId !== null" class="meta-item">#{{ grant.onchainId }}</span>
          <span v-if="grant.createdAt" class="meta-item">{{ formatDate(grant.createdAt) }}</span>
        </div>

        <div class="proposal-stats">
          <div class="stat-chip accept">{{ t("votesFor") }} {{ formatCount(grant.votesAccept) }}</div>
          <div class="stat-chip reject">{{ t("votesAgainst") }} {{ formatCount(grant.votesReject) }}</div>
          <div class="stat-chip comments">{{ t("comments") }} {{ formatCount(grant.comments) }}</div>
        </div>

        <div class="proposal-actions">
          <div @click.stop>
            <NeoButton
              size="sm"
              variant="secondary"
              :disabled="!grant.discussionUrl"
              @click="$emit('copyLink', grant.discussionUrl)"
            >
              {{ grant.discussionUrl ? t("copyDiscussion") : t("noDiscussion") }}
            </NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import type { Grant } from "@/types";

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
