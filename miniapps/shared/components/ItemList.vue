<template>
  <view class="item-list" role="list" :aria-label="ariaLabel || 'List'">
    <!-- Loading state -->
    <view v-if="loading" class="item-list__loading" role="status" aria-label="Loading">
      <view class="item-list__spinner" aria-hidden="true" />
      <text v-if="loadingText" class="item-list__loading-text">{{ loadingText }}</text>
    </view>

    <!-- Empty state -->
    <view v-else-if="!items || items.length === 0" class="item-list__empty" role="status">
      <slot name="empty">
        <text class="item-list__empty-text">{{ emptyText }}</text>
      </slot>
    </view>

    <!-- Items -->
    <template v-else>
      <view
        class="item-list__content"
        :class="{ 'item-list__content--scrollable': scrollable }"
        :style="maxHeight ? { maxHeight: `${maxHeight}px` } : undefined"
      >
        <view
          v-for="(item, index) in displayedItems"
          :key="itemKey ? item[itemKey] : index"
          class="item-list__item"
          role="listitem"
        >
          <slot name="item" :item="item" :index="index" />
        </view>
      </view>

      <!-- Load more -->
      <view
        v-if="hasMore"
        class="item-list__load-more"
        role="button"
        tabindex="0"
        @click="$emit('load-more')"
        @keydown.enter="$emit('load-more')"
      >
        <text>{{ loadMoreText }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    items: Array<Record<string, unknown>>;
    loading?: boolean;
    loadingText?: string;
    emptyText?: string;
    /** Key field on item objects for :key binding */
    itemKey?: string;
    scrollable?: boolean;
    /** Max height in px (enables overflow scroll automatically) */
    maxHeight?: number;
    /** Number of items to display (for client-side pagination). 0 = show all. */
    limit?: number;
    /** Whether more items can be loaded (shows load-more button) */
    hasMore?: boolean;
    /** Label for the load-more button */
    loadMoreText?: string;
    /** Accessibility label for screen readers */
    ariaLabel?: string;
  }>(),
  {
    loading: false,
    loadingText: undefined,
    emptyText: "No items found",
    itemKey: undefined,
    scrollable: false,
    maxHeight: undefined,
    limit: 0,
    hasMore: false,
    loadMoreText: "Load more",
    ariaLabel: undefined,
  }
);

defineEmits<{
  (e: "load-more"): void;
}>();

const displayedItems = computed(() => {
  if (props.limit > 0) {
    return props.items.slice(0, props.limit);
  }
  return props.items;
});
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.item-list {
  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $spacing-8;
    gap: $spacing-3;
  }

  &__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-top-color: var(--text-primary, #ffffff);
    border-radius: 50%;
    animation: itemListSpin 0.8s linear infinite;
  }

  &__loading-text {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  &__empty {
    text-align: center;
    padding: $spacing-6;
  }

  &__empty-text {
    font-size: $font-size-md;
    font-weight: $font-weight-medium;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;

    &--scrollable {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  }

  &__item {
    background: var(--bg-card, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    border-radius: 12px;
    padding: $spacing-3;
    transition: background 0.2s ease;

    &:hover {
      background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
    }
  }

  &__load-more {
    text-align: center;
    padding: $spacing-3;
    margin-top: $spacing-2;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    border-radius: 8px;
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary, #ffffff);
    }
  }
}

@keyframes itemListSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .item-list {
    &__spinner {
      animation: none;
    }

    &__item {
      transition: none;
    }
  }
}
</style>
