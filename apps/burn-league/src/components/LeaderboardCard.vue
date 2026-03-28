<template>
  <NeoCard variant="erobo" class="leaderboard-card">
    <div class="leaderboard-header">
      <AppIcon name="bar-chart" :size="16" aria-hidden="true" />
      <span>{{ t("leaderboard") }}</span>
    </div>
    <div class="leaderboard-list" :aria-label="t('ariaLeaderboard')">
      <div
        v-for="entry in entries"
        :key="entry.address"
        :class="['leader-item', entry.isUser && 'highlight']"
      >
        <div class="leader-rank-container">
          <AppIcon
            v-if="getMedalIcon(entry.rank)"
            :name="getMedalIcon(entry.rank)"
            :size="16"
            aria-hidden="true"
          />
          <span class="leader-rank">#{{ entry.rank }}</span>
        </div>
        <span class="leader-addr">{{ entry.address }}</span>
        <div class="leader-burned-container">
          <span class="leader-burned">{{ formatNum(entry.burned) }}</span>
          <span class="leader-burned-suffix">{{ t("gasSuffix") }}</span>
        </div>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { AppIcon, NeoCard } from "@shared/components";
import { formatNum, getMedalIcon } from "../composables/useBurnLeague";
import type { LeaderEntry } from "../composables/useBurnLeague";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  entries: LeaderEntry[];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.leaderboard-card {
  width: 100%;
  max-width: 400px;
}

.leaderboard-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  margin-bottom: 12px;
}

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
