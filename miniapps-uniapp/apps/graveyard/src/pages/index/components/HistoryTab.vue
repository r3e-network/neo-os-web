<template>
  <view class="tab-content scrollable">
    <view class="history-header">
      <text class="history-label">{{ t("recentDestructions") }}</text>
      <text class="history-count">{{ history.length }}</text>
    </view>

    <view v-if="history.length === 0" class="empty-state">
      <text class="empty-icon">🕊️</text>
      <text class="empty-text">{{ t("noDestructions") }}</text>
    </view>

    <view v-else class="history-list">
      <NeoCard
        v-for="(item, index) in history"
        :key="item.id"
        variant="erobo-neo"
        class="history-card"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <view class="history-item-content">
          <view class="history-icon-container">
            <text class="history-icon">{{ getDestructionIcon(index) }}</text>
          </view>

          <view class="history-info">
            <text class="history-hash">{{ item.hash.slice(0, 10) }}...{{ item.hash.slice(-6) }}</text>
            <text class="history-time">{{ item.time }}</text>
          </view>

          <view :class="['history-badge', { forgotten: item.forgotten }]">
            <text class="badge-text">{{ item.forgotten ? t("forgotten") : t("destroyed") }}</text>
          </view>
          <NeoButton
            v-if="!item.forgotten"
            size="sm"
            variant="secondary"
            class="forget-btn"
            :loading="forgettingId === item.id"
            @click.stop="$emit('forget', item)"
          >
            {{ t("forgetAction") }}
          </NeoButton>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton, NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { HistoryItem } from "@/types";

defineProps<{
  history: HistoryItem[];
  forgettingId: string | null;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["forget"]);

const getDestructionIcon = (index: number) => {
  const icons = ["💀", "⚰️", "🪦", "☠️", "🔥"];
  return icons[index % icons.length];
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.tab-content {
  padding: $spacing-4;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.history-header {
  @include section-header;
  margin-bottom: $spacing-2;
  padding: 0 $spacing-1;
}

.history-label {
  @include stat-label;
  font-size: 12px;
}

.history-count {
  font-size: 12px;
  font-weight: 800;
  background: var(--grave-panel-strong);
  color: var(--text-primary);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--grave-panel-border);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  margin-bottom: 0;
  padding: 12px;
  animation: slide-in 0.4s ease-out backwards;
}

.history-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-icon-container {
  width: 40px;
  height: 40px;
  background: var(--grave-panel);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--grave-panel-border);
}

.history-icon {
  font-size: 20px;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-hash {
  font-family: $font-mono;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
}

.history-time {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
}

.history-badge {
  background: var(--grave-danger-soft-weak);
  border: 1px solid var(--grave-danger-border);
  padding: 4px 8px;
  border-radius: 4px;
}

.history-badge.forgotten {
  background: var(--grave-panel-strong);
  border-color: var(--grave-panel-border);
}

.badge-text {
  color: var(--grave-danger-text);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-badge.forgotten .badge-text {
  color: var(--text-secondary);
}

.forget-btn {
  min-width: 72px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.empty-state {
  @include empty-state;
  padding: 40px 20px;
  background: var(--grave-panel-soft);
  border-radius: 12px;
  border: 1px dashed var(--grave-panel-border);
}

.empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 12px;
  filter: grayscale(1) opacity(0.5);
}

.empty-text {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
