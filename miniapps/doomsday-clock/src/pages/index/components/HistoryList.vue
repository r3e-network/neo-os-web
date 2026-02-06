<template>
  <NeoCard variant="erobo">
    <view v-if="history.length === 0" class="empty-state">
      <text>{{ t("noHistory") }}</text>
    </view>
    <view class="history-list">
      <view v-for="event in history" :key="event.id" class="history-item-glass">
        <view class="history-header">
          <text class="history-title-glass">{{ event.title }}</text>
          <text class="history-date-glass">{{ event.date }}</text>
        </view>
        <text class="history-desc-glass">{{ event.details }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

export interface HistoryEvent {
  id: number;
  title: string;
  details: string;
  date: string;
}

defineProps<{
  history: HistoryEvent[];
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

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
