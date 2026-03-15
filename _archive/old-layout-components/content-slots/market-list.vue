<template>
  <div class="market-list-slot">
    <div v-if="$slots.filters" class="list-filters">
      <slot name="filters" />
    </div>
    <div class="list-container">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * MarketListSlot - Layout frame for list-type miniapps
 *
 * Provides a scrollable list container with an optional filter/search bar.
 * Used by prediction-market, candidate-vote, hall-of-fame, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.market-list-slot {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;
  padding: 16px;
}

.list-filters {
  position: sticky;
  top: 0;
  z-index: 10;
  padding-bottom: 8px;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
