<template>
  <NeoCard class="history-card" variant="erobo">
    <view v-for="action in actionHistory" :key="action.id" class="history-item">
      <view class="history-icon" :class="action.type">{{ getActionIcon(action.type) }}</view>
      <view class="history-content">
        <text class="history-action">{{ action.action }}</text>
        <text class="history-time">{{ action.time }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

export interface ActionHistoryItem {
  id: string;
  action: string;
  time: string;
  type: "create" | "claim" | "processed";
}

defineProps<{
  actionHistory: ActionHistoryItem[];
  t: (key: string) => string;
}>();

const getActionIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    create: "➕",
    claim: "📤",
    processed: "✅",
  };
  return iconMap[type] || "📝";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.history-item {
  display: flex;
  align-items: center;
  gap: $space-4;
  padding: $space-4;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: transparent;
  color: var(--text-primary);
  &:last-child { border-bottom: none; }
}
.history-icon {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.05);
}
.history-action {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-primary);
}
.history-time {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 600;
  display: block;
}
</style>
