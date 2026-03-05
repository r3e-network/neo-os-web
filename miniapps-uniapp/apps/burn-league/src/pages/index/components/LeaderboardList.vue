<template>
  <NeoCard variant="erobo" class="leaderboard-card">
    <ItemList
      :items="leaderboard as unknown as Record<string, unknown>[]"
      :scrollable="true"
      :max-height="400"
      :aria-label="t('ariaLeaderboard')"
    >
      <template #item="{ item, index }">
        <view
          :class="[
            'leader-item',
            (item as unknown as LeaderEntry).isUser && 'highlight',
            `rank-${(item as unknown as LeaderEntry).rank}`,
          ]"
        >
          <view class="leader-rank-container">
            <text class="leader-medal">{{ getMedalIcon((item as unknown as LeaderEntry).rank) }}</text>
            <text class="leader-rank">#{{ (item as unknown as LeaderEntry).rank }}</text>
          </view>
          <text class="leader-addr">{{ (item as unknown as LeaderEntry).address }}</text>
          <view class="leader-burned-container">
            <text class="leader-burned">{{ formatNum((item as unknown as LeaderEntry).burned) }}</text>
            <text class="leader-burned-suffix">GAS</text>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";

export interface LeaderEntry {
  rank: number;
  address: string;
  burned: number;
  isUser: boolean;
}

defineProps<{
  leaderboard: LeaderEntry[];
}>();

const { t } = createUseI18n(messages)();

const formatNum = (n: number) => formatNumber(n, 2);

const getMedalIcon = (rank: number): string => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.leader-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: all 0.2s ease;

  &.highlight {
    background: rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);
    box-shadow: 0 4px 12px rgba(0, 229, 153, 0.1);
  }
}

.leader-rank-container {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 50px;
}

.leader-medal {
  font-size: 16px;
}

.leader-rank {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: $font-mono;
}

.leader-addr {
  @include text-truncate;
  font-size: 11px;
  font-family: $font-mono;
  color: var(--text-primary, rgba(255, 255, 255, 0.8));
  flex: 1;
  padding: 0 12px;
}

.leader-burned-container {
  display: flex;
  align-items: baseline;
  text-align: right;
  min-width: 80px;
  justify-content: flex-end;
}

.leader-burned {
  font-size: 14px;
  font-weight: 700;
  font-family: $font-mono;
  color: var(--text-primary);
}

.leader-burned-suffix {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-left: 2px;
}
</style>
