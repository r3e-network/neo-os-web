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
  gap: 24px;
  box-sizing: border-box;
  transition: padding 0.2s ease, gap 0.2s ease;
}

.two-column-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  min-width: 0;
}

.two-column-operation {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  border-radius: 24px;
  padding: 24px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
}

@media (min-width: 900px) {
  .two-column-slot {
    flex-direction: row;
    align-items: flex-start;
    padding: 32px;
    gap: 32px;

    &.single-column {
      flex-direction: column;
    }
  }

  .two-column-info {
    flex: 1;
    min-width: 0;
    gap: 32px;

    .single-column & {
      max-width: 900px;
      margin: 0 auto;
    }
  }

  .two-column-operation {
    flex: 0 0 400px;
    position: sticky;
    top: 24px;
    width: 400px;
    max-width: 400px;
    border-radius: 24px;
    padding: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .two-column-slot,
  .two-column-operation {
    transition: none;
  }
}
</style>
