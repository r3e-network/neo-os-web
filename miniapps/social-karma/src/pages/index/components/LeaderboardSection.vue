<template>
  <view class="leaderboard-section">
    <view class="content-card">
      <view class="card-header">
        <text class="card-title">{{ t("topContributors") }}</text>
        <view class="refresh-btn" @click="emitRefresh">
          <text>🔄</text>
        </view>
      </view>
      
      <view v-if="leaderboard.length === 0" class="empty-state">
        <text class="empty-icon">🏆</text>
        <text class="empty-text">{{ t("noActivity") }}</text>
        <text class="empty-subtext">{{ t("beFirst") }}</text>
      </view>
      
      <view v-else class="leaderboard-list">
        <view 
          v-for="(entry, index) in leaderboard" 
          :key="entry.address" 
          class="leaderboard-item"
          :class="{ 'is-me': entry.address === userAddress }"
        >
          <view class="rank-badge" :class="{ 'top-3': index < 3 }">
            <text>{{ index + 1 }}</text>
          </view>
          <view class="user-info">
            <text class="user-address">{{ shortenAddress(entry.address) }}</text>
            <text v-if="entry.address === userAddress" class="user-tag">{{ t("you") }}</text>
          </view>
          <view class="karma-badge">
            <text class="karma-amount">{{ entry.karma }}</text>
            <text class="karma-label-small">Karma</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";

export interface LeaderboardEntry {
  address: string;
  karma: number;
}

const props = defineProps<{
  leaderboard: LeaderboardEntry[];
  userAddress: string | null;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
}>();

const { t } = useI18n();

const emitRefresh = () => emit("refresh");

const shortenAddress = (addr: string): string => {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
};
</script>

<style lang="scss" scoped>
.leaderboard-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background: var(--karma-card-bg);
  border: 1px solid var(--karma-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--karma-text);
}

.refresh-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  &.is-me {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
}

.rank-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: var(--karma-text-secondary);
  
  &.top-3 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: white;
  }
}

.user-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-address {
  font-size: 14px;
  color: var(--karma-text);
  font-family: monospace;
}

.user-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--karma-primary);
  color: white;
  border-radius: 99px;
  font-weight: 600;
}

.karma-badge {
  text-align: right;
}

.karma-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--karma-success);
  display: block;
}

.karma-label-small {
  font-size: 10px;
  color: var(--karma-text-muted);
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .empty-text {
    font-size: 16px;
    color: var(--karma-text);
    font-weight: 600;
    display: block;
    margin-bottom: 8px;
  }
  
  .empty-subtext {
    font-size: 14px;
    color: var(--karma-text-secondary);
  }
}
</style>
