<template>
  <NeoCard variant="erobo" class="leaderboard-card">
    <view class="leaderboard-list">
      <view
        v-for="(entry, i) in leaderboard"
        :key="i"
        :class="['leader-item', entry.isUser && 'highlight', `rank-${entry.rank}`]"
      >
        <view class="leader-rank-container">
          <text class="leader-medal">{{ getMedalIcon(entry.rank) }}</text>
          <text class="leader-rank">#{{ entry.rank }}</text>
        </view>
        <text class="leader-addr">{{ entry.address }}</text>
        <view class="leader-burned-container">
          <text class="leader-burned">{{ formatNum(entry.burned) }}</text>
          <text class="leader-burned-suffix">GAS</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

export interface LeaderEntry {
  rank: number;
  address: string;
  burned: number;
  isUser: boolean;
}

defineProps<{
  leaderboard: LeaderEntry[];
}>();

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const getMedalIcon = (rank: number): string => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

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
  font-size: 11px;
  font-family: $font-mono;
  color: var(--text-primary, rgba(255, 255, 255, 0.8));
  flex: 1;
  padding: 0 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
