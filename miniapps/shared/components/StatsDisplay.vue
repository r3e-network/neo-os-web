<template>
  <view
    class="stats-display"
    :class="[
      `stats-display--${layout}`,
      `stats-display--cols-${columns}`,
      compact ? 'stats-display--compact' : '',
      loading ? 'stats-display--loading' : '',
    ]"
    role="list"
    :aria-label="ariaLabel || 'Statistics'"
  >
    <!-- Loading state -->
    <template v-if="loading">
      <view
        v-for="n in loadingCount"
        :key="`skeleton-${n}`"
        class="stats-display__item stats-display__item--skeleton"
        role="listitem"
        aria-label="Loading"
      >
        <view class="stats-display__skeleton-value" />
        <view class="stats-display__skeleton-label" />
      </view>
    </template>

    <!-- Data state -->
    <template v-else>
      <view
        v-for="item in items"
        :key="item.label"
        class="stats-display__item"
        :class="item.variant ? `stats-display__item--${item.variant}` : ''"
        role="listitem"
        :aria-label="`${item.label}: ${item.value}`"
      >
        <text v-if="item.icon && layout === 'grid'" class="stats-display__icon" aria-hidden="true">{{
          item.icon
        }}</text>
        <view class="stats-display__value-row">
          <text class="stats-display__value" aria-hidden="true">{{ item.value }}</text>
          <text
            v-if="item.trend"
            class="stats-display__trend"
            :class="`stats-display__trend--${item.trend}`"
            aria-hidden="true"
            >{{ item.trend === "up" ? "\u25B2" : item.trend === "down" ? "\u25BC" : "\u2014" }}</text
          >
        </view>
        <text class="stats-display__label" aria-hidden="true">{{ item.label }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
export interface StatsDisplayItem {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "success" | "danger" | "warning" | "accent" | "erobo" | "erobo-neo" | "erobo-bitcoin";
  /** Optional trend indicator */
  trend?: "up" | "down" | "neutral";
}

export type StatsDisplayLayout = "grid" | "rows";

const props = withDefaults(
  defineProps<{
    items: StatsDisplayItem[];
    layout?: StatsDisplayLayout;
    /** Number of columns when layout is 'grid' */
    columns?: 2 | 3 | 4;
    /** Compact mode with reduced padding and font sizes */
    compact?: boolean;
    /** Show skeleton loading state */
    loading?: boolean;
    /** Accessibility label for screen readers */
    ariaLabel?: string;
  }>(),
  {
    layout: "grid",
    columns: 2,
    compact: false,
    loading: false,
    ariaLabel: undefined,
  }
);

/** Number of skeleton items to show while loading */
const loadingCount = props.columns;
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.stats-display {
  &--grid {
    display: grid;
    gap: 12px;
  }

  &--cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  &--cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  &--cols-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  &--rows {
    display: flex;
    flex-direction: column;
  }

  &__item {
    .stats-display--grid & {
      background: var(--bg-card, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      backdrop-filter: blur(10px);
      transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

      &:hover {
        transform: translateY(-2px);
        background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
        border-color: rgba(159, 157, 243, 0.3);
      }
    }

    .stats-display--rows & {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      &:last-child {
        border-bottom: none;
      }
    }

    // Variant colors
    &--success .stats-display__value {
      color: #00e599;
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.2);
    }
    &--danger .stats-display__value {
      color: #ef4444;
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
    }
    &--warning .stats-display__value {
      color: #fde047;
      text-shadow: 0 0 10px rgba(253, 224, 71, 0.2);
    }
    &--accent .stats-display__value {
      color: #00e599;
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
    }
    &--erobo .stats-display__value {
      color: #9f9df3;
      text-shadow: 0 0 15px rgba(159, 157, 243, 0.4);
    }
    &--erobo-neo .stats-display__value {
      color: #00e599;
      text-shadow: 0 0 15px rgba(0, 229, 153, 0.4);
    }
    &--erobo-bitcoin .stats-display__value {
      color: #ffde59;
      text-shadow: 0 0 15px rgba(255, 222, 89, 0.4);
    }
  }

  &__icon {
    display: block;
    font-size: 24px;
    margin-bottom: 4px;
  }

  &__value-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;

    .stats-display--rows & {
      justify-content: flex-end;
    }
  }

  &__value {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary, #ffffff);
    font-family: $font-family;

    .stats-display--rows & {
      font-size: 14px;
      font-weight: 700;
      font-family: $font-mono;
    }
  }

  &__trend {
    font-size: 10px;
    font-weight: 700;

    &--up {
      color: #00e599;
    }
    &--down {
      color: #ef4444;
    }
    &--neutral {
      color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    }
  }

  &__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;

    .stats-display--rows & {
      font-weight: 700;
      letter-spacing: 0.1em;
      order: -1;
    }
  }

  // Compact mode
  &--compact &__item {
    padding: 8px;
  }

  &--compact &__value {
    font-size: 14px;
  }

  &--compact &__label {
    font-size: 10px;
  }

  &--compact &__icon {
    font-size: 18px;
    margin-bottom: 2px;
  }

  // Loading skeleton
  &__item--skeleton {
    .stats-display--grid & {
      min-height: 60px;
    }
  }

  &__skeleton-value {
    width: 60%;
    height: 18px;
    margin: 0 auto 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    animation: statsDisplayPulse 1.5s ease-in-out infinite;
  }

  &__skeleton-label {
    width: 80%;
    height: 11px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    animation: statsDisplayPulse 1.5s ease-in-out infinite 0.2s;
  }
}

@keyframes statsDisplayPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stats-display__item {
    transition: none;

    &:hover {
      transform: none;
    }
  }

  .stats-display__skeleton-value,
  .stats-display__skeleton-label {
    animation: none;
  }
}
</style>
