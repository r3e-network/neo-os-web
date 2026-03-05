<template>
  <NeoCard variant="erobo">
    <ItemList
      :items="history as unknown as Record<string, unknown>[]"
      item-key="id"
      :empty-text="t('noHistory')"
      :aria-label="t('ariaHistory')"
    >
      <template #item="{ item }">
        <view class="history-header">
          <text class="history-title-glass">{{ (item as unknown as HistoryEvent).title }}</text>
          <text class="history-date-glass">{{ (item as unknown as HistoryEvent).date }}</text>
        </view>
        <text class="history-desc-glass">{{ (item as unknown as HistoryEvent).details }}</text>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";

export interface HistoryEvent {
  id: string | number;
  title: string;
  details: string;
  date: string;
}

defineProps<{
  history: HistoryEvent[];
  t: (key: string, ...args: unknown[]) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.empty-state {
  text-align: center;
  padding: $spacing-6;
  opacity: 0.6;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  font-size: 14px;
  color: var(--text-primary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}
.history-item-glass {
  padding: $spacing-4;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-bottom: $spacing-2;
  transition: all 0.2s ease;

  &:active {
    background: rgba(255, 255, 255, 0.1);
  }
}
.history-title-glass {
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 4px;
  display: inline-block;
  color: var(--text-primary);
}
.history-date-glass {
  font-size: 10px;
  opacity: 0.6;
  font-weight: $font-weight-medium;
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
}
.history-desc-glass {
  font-size: 12px;
  font-family: $font-mono;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  display: block;
}
</style>
