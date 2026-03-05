<template>
  <view :class="['two-column-slot', { 'single-column': !hasOperation }]">
    <view class="two-column-info">
      <slot />
    </view>
    <view v-if="hasOperation" class="two-column-operation">
      <slot name="operation" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { useSlots, computed } from "vue";

/**
 * TwoColumnSlot - Consistent info + operation layout for all miniapps
 *
 * Left panel (flex: 1): main content area — information, details, lists, status displays
 * Right panel (fixed ~340px, sticky, floating): compact operation box with forms and actions
 * Responsive: stacks vertically on mobile, side-by-side on desktop (≥768px)
 * Gracefully degrades to single column when operation slot is empty.
 */
const slots = useSlots();
const hasOperation = computed(() => !!slots.operation);

defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.two-column-slot {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 16px;
  gap: 16px;
  box-sizing: border-box;
  transition: padding 0.2s ease, gap 0.2s ease;
}

.two-column-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.two-column-operation {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  border-radius: 16px;
  padding: 16px;
  box-sizing: border-box;
  transition: padding 0.2s ease, background 0.2s ease;
}

@media (min-width: 768px) {
  .two-column-slot {
    flex-direction: row;
    align-items: flex-start;
    padding: 24px;
    gap: 24px;

    &.single-column {
      flex-direction: column;
    }
  }

  .two-column-info {
    flex: 1;
    min-width: 0;
    gap: 20px;

    .single-column & {
      max-width: 900px;
    }
  }

  .two-column-operation {
    flex: 0 0 340px;
    position: sticky;
    top: 24px;
    width: 340px;
    max-width: 340px;
    gap: 20px;
    padding: 20px;
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  }
}

@media (prefers-reduced-motion: reduce) {
  .two-column-slot,
  .two-column-operation {
    transition: none;
  }
}
</style>
