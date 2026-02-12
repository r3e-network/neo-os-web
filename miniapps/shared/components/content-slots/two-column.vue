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
 * TwoColumnSlot - Layout frame for info + operation miniapps
 *
 * Left panel: information, details, lists, status displays
 * Right panel: sticky operation box with forms and actions
 * Responsive: stacks vertically on mobile, side-by-side on desktop
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
  gap: 20px;
}

.two-column-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.two-column-operation {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

@media (min-width: 768px) {
  .two-column-slot {
    flex-direction: row;
    align-items: flex-start;

    &.single-column {
      flex-direction: column;
    }
  }

  .two-column-info {
    flex: 3;
    min-width: 0;

    .single-column & {
      flex: 1;
      max-width: 800px;
    }
  }

  .two-column-operation {
    flex: 2;
    position: sticky;
    top: 20px;
    min-width: 280px;
    max-width: 400px;
  }
}
</style>
