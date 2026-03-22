<template>
  <NeoCard variant="erobo" class="leaderboard-card">
    <!--
      ItemList expects Record<string, unknown>[] but we have LeaderEntry[].
      The double-cast is needed because ItemList is not generically typed.
      The inner cast 'as unknown' is necessary to go from LeaderEntry[] to unknown first.
    -->
    <ItemList
      :items="(leaderboard as unknown) as Record<string, unknown>[]"
      :scrollable="true"
      :max-height="400"
      :aria-label="t('ariaLeaderboard')"
    >
      <template #item="{ item, index }">
        <div
          :class="[
            'leader-item',
            (item as unknown as LeaderEntry).isUser && 'highlight',
            `rank-${(item as unknown as LeaderEntry).rank}`,
          ]"
        >
          <div class="leader-rank-container">
            <AppIcon :name="getMedalIcon((item as unknown as LeaderEntry).rank)" :size="16" :aria-label="getMedalAriaLabel((item as unknown as LeaderEntry).rank)" />
            <span class="leader-rank">#{{ (item as unknown as LeaderEntry).rank }}</span>
          </div>
          <span class="leader-addr">{{ (item as unknown as LeaderEntry).address }}</span>
          <div class="leader-burned-container">
            <span class="leader-burned">{{ formatNum((item as unknown as LeaderEntry).burned) }}</span>
            <span class="leader-burned-suffix">{{ t("gasSuffix") }}</span>
          </div>
        </div>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList, AppIcon } from "@shared/components";
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
  if (rank === 1) return "medal_gold";
  if (rank === 2) return "medal_silver";
  if (rank === 3) return "medal_bronze";
  return "";
};

const getMedalAriaLabel = (rank: number): string => {
  if (rank === 1) return t("rankGold");
  if (rank === 2) return t("rankSilver");
  if (rank === 3) return t("rankBronze");
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
    background: color-mix(in srgb, var(--burn-green) 10%, transparent);
    border-color: color-mix(in srgb, var(--burn-green) 30%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--burn-green) 10%, transparent);
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
