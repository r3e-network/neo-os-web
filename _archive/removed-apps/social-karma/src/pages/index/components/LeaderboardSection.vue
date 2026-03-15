<template>
  <div class="leaderboard-section">
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">{{ t("topContributors") }}</span>
        <div
          class="refresh-btn"
          role="button"
          tabindex="0"
          :aria-label="t('refresh') || 'Refresh leaderboard'"
          @click="emitRefresh"
        >
          <span aria-hidden="true">🔄</span>
        </div>
      </div>

      <div v-if="leaderboard.length === 0" class="empty-state">
        <span class="empty-icon">🏆</span>
        <span class="empty-text">{{ t("noActivity") }}</span>
        <span class="empty-subtext">{{ t("beFirst") }}</span>
      </div>

      <div v-else class="leaderboard-list">
        <div
          v-for="(entry, index) in leaderboard"
          :key="entry.address"
          class="leaderboard-item"
          :class="{ 'is-me': entry.address === userAddress }"
        >
          <div class="rank-badge" :class="{ 'top-3': index < 3 }">
            <span>{{ index + 1 }}</span>
          </div>
          <div class="user-info">
            <span class="user-address">{{ formatAddress(entry.address) }}</span>
            <span v-if="entry.address === userAddress" class="user-tag">{{ t("you") }}</span>
          </div>
          <div class="karma-badge">
            <span class="karma-amount">{{ entry.karma }}</span>
            <span class="karma-label-small">{{ t("sidebarKarma") }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatAddress } from "@shared/utils/format";

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

const { t } = createUseI18n(messages)();

const emitRefresh = () => emit("refresh");
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;
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
    background: var(--karma-rank-gradient);
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
