<template>
  <view class="tab-content scrollable">
    <NeoCard :title="t('globalStats')" variant="erobo-bitcoin">
      <view class="global-stats">
        <view class="stat-item-glass">
          <text class="stat-icon">👥</text>
          <text class="stat-value">{{ globalStats.totalUsers }}</text>
          <text class="stat-label">{{ t("totalUsers") }}</text>
        </view>
        <view class="stat-item-glass">
          <text class="stat-icon">✅</text>
          <text class="stat-value">{{ globalStats.totalCheckins }}</text>
          <text class="stat-label">{{ t("totalCheckins") }}</text>
        </view>
        <view class="stat-item-glass">
          <text class="stat-icon">💰</text>
          <text class="stat-value">{{ formatGas(globalStats.totalRewarded) }}</text>
          <text class="stat-label">{{ t("totalRewarded") }}</text>
        </view>
      </view>
    </NeoCard>

    <MiniAppTabStats :title="t('yourStats')" variant="erobo" :stats="userStats" />

    <NeoCard :title="t('recentCheckins')" variant="erobo">
      <view v-if="checkinHistory.length === 0" class="empty-state">
        <text>{{ t("noCheckins") }}</text>
      </view>
      <view v-else class="history-list">
        <view v-for="(item, idx) in checkinHistory" :key="idx" class="history-item">
          <view class="history-icon">🔥</view>
          <view class="history-info">
            <text class="history-day">{{ t("day") }} {{ item.streak }}</text>
            <text class="history-time">{{ item.time }}</text>
          </view>
          <text v-if="item.reward > 0" class="history-reward">+{{ formatGas(item.reward) }} GAS</text>
        </view>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { MiniAppTabStats, NeoCard, type StatItem } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  globalStats: { totalUsers: number; totalCheckins: number; totalRewarded: number };
  userStats: Array<StatItem>;
  checkinHistory: Array<{ streak: number; time: string; reward: number }>;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.global-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

.stat-item-glass {
  text-align: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
.stat-icon { font-size: 24px; display: block; margin-bottom: 4px; }
.stat-value {
  display: block;
  font-family: $font-mono;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.stat-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}

.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
}
.history-icon { font-size: 20px; }
.history-info { flex: 1; }
.history-day { display: block; font-weight: 600; font-size: 13px; color: var(--text-primary); }
.history-time { display: block; font-size: 11px; color: var(--text-secondary, rgba(255, 255, 255, 0.5)); }
.history-reward {
  font-family: $font-mono;
  font-weight: 700;
  font-size: 12px;
  color: var(--sunrise-reward);
}
</style>
