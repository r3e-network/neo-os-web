<template>
  <NeoCard variant="erobo" class="info-section" :aria-label="title" role="region">
    <template v-if="title" #header>
      <view class="info-section__header">
        <text class="info-section__title">{{ title }}</text>
        <text v-if="description" class="info-section__desc">{{ description }}</text>
      </view>
    </template>

    <view class="info-section__body">
      <slot />
    </view>

    <view v-if="$slots.stats" class="info-section__stats">
      <slot name="stats" />
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

/**
 * InfoSection - Reusable left-panel info display for two-column layouts
 *
 * Provides a consistent card-based information display with title,
 * description, main content area, and optional stats grid.
 *
 * @example
 * ```vue
 * <InfoSection title="Pool Details" description="Current liquidity pool status">
 *   <PoolChart :data="chartData" />
 *   <template #stats>
 *     <StatRow label="TVL" value="$1.2M" />
 *   </template>
 * </InfoSection>
 * ```
 */
withDefaults(
  defineProps<{
    /** Section title */
    title?: string;
    /** Optional description below title */
    description?: string;
  }>(),
  {
    title: "",
    description: "",
  }
);
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.info-section {
  &__header {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: var(--text-primary, #f8fafc);
    line-height: $line-height-tight;
    font-family: $font-family;
  }

  &__desc {
    font-size: $font-size-sm;
    color: var(--text-secondary, rgba(248, 250, 252, 0.6));
    line-height: $line-height-normal;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
  }

  &__stats {
    margin-top: $spacing-4;
    padding-top: $spacing-4;
    border-top: $border-width-sm solid var(--border-color, rgba(255, 255, 255, 0.06));
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }
}
</style>
