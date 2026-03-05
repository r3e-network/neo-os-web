<template>
  <view class="activity-section">
    <view class="section-header">
      <text class="section-title">{{ title }}</text>
      <view v-if="count > 0" class="activity-count">
        <text class="count-text">{{ count }}</text>
      </view>
    </view>

    <view v-if="count === 0" class="empty-state">
      <text class="empty-icon">📋</text>
      <text class="empty-title">{{ emptyTitle }}</text>
      <text class="empty-desc">{{ emptyDescription }}</text>
    </view>

    <view v-else class="history-list">
      <view
        v-for="item in items"
        :key="item.id"
        class="history-card"
        role="button"
        :aria-label="shorten(item.scriptHash) + ' — ' + statusLabel(item.status)"
        tabindex="0"
        @click="$emit('select', item.id)"
        @keydown.enter="$emit('select', item.id)"
      >
        <view class="history-icon">
          <text class="icon-text">{{ getStatusIcon(item.status) }}</text>
        </view>
        <view class="history-content">
          <text class="history-hash">{{ shorten(item.scriptHash) }}</text>
          <text class="history-time">{{ formatDate(item.createdAt) }}</text>
        </view>
        <view :class="['status-badge', item.status]">
          <text class="status-text">{{ statusLabel(item.status) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { HistoryItem } from "../composables/useMultisigHistory";

interface Props {
  items: HistoryItem[];
  count: number;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  getStatusIcon: (status: string) => string;
  statusLabel: (status: string) => string;
  shorten: (str: string) => string;
  formatDate: (ts: string) => string;
}

defineProps<Props>();

defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.activity-section {
  position: relative;
  z-index: 10;
  margin-bottom: 24px;
}

.section-header {
  @include section-header;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--multi-text);
}

.activity-count {
  background: var(--multi-accent-soft);
  border-radius: 12px;
  padding: 4px 12px;
}

.count-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--multi-accent);
}

.empty-state {
  @include empty-state;
  padding: 48px 24px;
  background: var(--multi-card-soft);
  border: 1px dashed var(--multi-divider);
  border-radius: 16px;
}

.empty-icon {
  display: block;
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--multi-text);
  margin-bottom: 8px;
}

.empty-desc {
  display: block;
  font-size: 13px;
  color: var(--multi-text-dim);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--multi-card-soft);
  border: 1px solid var(--multi-border-soft);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    background: var(--multi-accent-soft);
    border-color: var(--multi-accent-border);
  }
}

.history-icon {
  width: 40px;
  height: 40px;
  background: var(--multi-icon-bg-soft);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-text {
  font-size: 18px;
}

.history-content {
  flex: 1;
}

.history-hash {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--multi-text);
  font-family: "JetBrains Mono", monospace;
  margin-bottom: 4px;
}

.history-time {
  display: block;
  font-size: 11px;
  color: var(--multi-text-dim);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 8px;

  &.pending {
    background: var(--multi-warning-soft);
  }
  &.ready {
    background: var(--multi-info-soft);
  }
  &.broadcasted {
    background: var(--multi-accent-soft);
  }
  &.cancelled {
    background: var(--multi-error-soft);
  }
  &.expired {
    background: var(--multi-expired-soft);
  }
}

.status-text {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  .pending & {
    color: var(--multi-warning);
  }
  .ready & {
    color: var(--multi-info);
  }
  .broadcasted & {
    color: var(--multi-accent);
  }
  .cancelled & {
    color: var(--multi-error);
  }
  .expired & {
    color: var(--multi-text-dim);
  }
}
</style>
