<template>
  <div
    class="stats-display"
    :class="[
      `stats-display--${layout}`,
      `stats-display--cols-${columns}`,
      compact ? 'stats-display--compact' : '',
      loading ? 'stats-display--loading' : '',
    ]"
    role="list"
    :aria-label="ariaLabel || t('statistics')"
  >
    <!-- Loading state -->
    <template v-if="loading">
      <div
        v-for="n in loadingCount"
        :key="`skeleton-${n}`"
        class="stats-display__item stats-display__item--skeleton"
        role="listitem"
        :aria-label="t('loading')"
      >
        <div class="stats-display__skeleton-value" />
        <div class="stats-display__skeleton-label" />
      </div>
    </template>

    <!-- Data state -->
    <template v-else>
      <div
        v-for="item in items"
        :key="item.label"
        class="stats-display__item"
        :class="item.variant ? `stats-display__item--${item.variant}` : ''"
        role="listitem"
        :aria-label="`${item.label}: ${item.value}`"
      >
        <span v-if="item.icon && layout === 'grid'" class="stats-display__icon" aria-hidden="true">{{
          item.icon
        }}</span>
        <div class="stats-display__value-row">
          <span class="stats-display__value" aria-hidden="true">{{ item.value }}</span>
          <span
            v-if="item.trend"
            class="stats-display__trend"
            :class="`stats-display__trend--${item.trend}`"
            aria-hidden="true"
          />
        </div>
        <span class="stats-display__label" aria-hidden="true">{{ item.label }}</span>
      </div>
    </template>
  </div>
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

import { useI18n } from "@shared/composables/useI18n";

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

const { t } = useI18n();
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.stats-display {
  &--grid {
    display: grid;
    gap: $spacing-3;
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
      border-radius: $spacing-3;
      padding: $spacing-3;
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
      padding: $spacing-3 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      &:last-child {
        border-bottom: none;
      }
    }

    // Variant colors
    &--success .stats-display__value {
      --stat-color: var(--accent-success, #10b981);
      color: var(--stat-color);
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.2);
    }
    &--danger .stats-display__value {
      --stat-color: var(--accent-error, #ef4444);
      color: var(--stat-color);
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
    }
    &--warning .stats-display__value {
      --stat-color: var(--accent-warning, #f59e0b);
      color: var(--stat-color);
      text-shadow: 0 0 10px rgba(253, 224, 71, 0.2);
    }
    &--accent .stats-display__value {
      --stat-color: var(--accent-success, #10b981);
      color: var(--stat-color);
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
    }
    &--erobo .stats-display__value {
      --stat-color: #9f9df3;
      color: var(--stat-color);
      text-shadow: 0 0 15px rgba(159, 157, 243, 0.4);
    }
    &--erobo-neo .stats-display__value {
      --stat-color: var(--accent-success, #10b981);
      color: var(--stat-color);
      text-shadow: 0 0 15px rgba(0, 229, 153, 0.4);
    }
    &--erobo-bitcoin .stats-display__value {
      --stat-color: #ffde59;
      color: var(--stat-color);
      text-shadow: 0 0 15px rgba(255, 222, 89, 0.4);
    }
  }

  &__icon {
    display: block;
    font-size: $font-size-3xl;
    margin-bottom: $spacing-1;
  }

  &__value-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: $spacing-1;

    .stats-display--rows & {
      justify-content: flex-end;
    }
  }

  &__value {
    font-size: $font-size-xl;
    font-weight: 800;
    color: var(--text-primary, #ffffff);
    font-family: $font-family;

    .stats-display--rows & {
      font-size: $font-size-sm;
      font-weight: 700;
      font-family: $font-mono;
    }
  }

  &__trend {
    font-size: $font-size-xs;
    font-weight: 700;
    display: inline-block;
    width: 10px;
    height: 10px;

    &--up::before {
      content: "\25B2";
      --trend-color: var(--accent-success, #10b981);
      color: var(--trend-color);
    }
    &--down::before {
      content: "\25BC";
      --trend-color: var(--accent-error, #ef4444);
      color: var(--trend-color);
    }
    &--neutral::before {
      content: "\2014";
      color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    }
  }

  &__label {
    display: block;
    font-size: $font-size-xs;
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
    padding: $spacing-2;
  }

  &--compact &__value {
    font-size: $font-size-sm;
  }

  &--compact &__label {
    font-size: $font-size-xs;
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
