<template>
  <view class="stats-tab" :aria-label="ariaLabel || 'Statistics'">
    <!-- Grid section (top cards) -->
    <view v-if="gridItems.length > 0" class="stats-tab__grid">
      <StatsDisplay :items="gridItems" layout="grid" :columns="gridColumns" :compact="compact" :loading="loading" />
    </view>

    <!-- Rows section (detail list) -->
    <view v-if="rowItems.length > 0" class="stats-tab__rows">
      <view class="stats-tab__card">
        <text v-if="rowsTitle" class="stats-tab__rows-title">{{ rowsTitle }}</text>
        <StatsDisplay :items="rowItems" layout="rows" :loading="loading" />
      </view>
    </view>

    <!-- Extra content slot -->
    <view v-if="$slots.default" class="stats-tab__extra">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * StatsTab — Shared tab content for statistics display.
 *
 * Combines a grid of highlight stats (top) with a detailed rows list (bottom).
 * Replaces the custom StatsTab components found in burn-league, lottery, etc.
 *
 * @example
 * ```vue
 * <StatsTab
 *   :grid-items="[
 *     { label: 'Total', value: '1,234', icon: '🔥', variant: 'danger' },
 *     { label: 'Rank', value: '#5', icon: '👑', variant: 'erobo-neo' },
 *   ]"
 *   :row-items="[
 *     { label: 'Games Played', value: 42 },
 *     { label: 'You Burned', value: '12.50 GAS' },
 *   ]"
 *   rows-title="Your Stats"
 * />
 * ```
 */

import StatsDisplay from "./StatsDisplay.vue";
import type { StatsDisplayItem } from "./StatsDisplay.vue";

withDefaults(
  defineProps<{
    /** Items displayed in the top grid section */
    gridItems?: StatsDisplayItem[];
    /** Items displayed in the bottom rows section */
    rowItems?: StatsDisplayItem[];
    /** Number of grid columns */
    gridColumns?: 2 | 3 | 4;
    /** Title for the rows section */
    rowsTitle?: string;
    /** Compact mode */
    compact?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Accessibility label */
    ariaLabel?: string;
  }>(),
  {
    gridItems: () => [],
    rowItems: () => [],
    gridColumns: 2,
    rowsTitle: undefined,
    compact: false,
    loading: false,
    ariaLabel: undefined,
  }
);
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.stats-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__grid {
    margin-bottom: $spacing-2;
  }

  &__card {
    background: var(--bg-card, rgba(255, 255, 255, 0.02));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    border-radius: var(--card-radius, 20px);
    padding: $spacing-4;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  &__rows-title {
    display: block;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-primary, rgba(255, 255, 255, 0.9));
    padding-bottom: $spacing-3;
    margin-bottom: $spacing-2;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  }

  &__extra {
    margin-top: $spacing-2;
  }
}
</style>
