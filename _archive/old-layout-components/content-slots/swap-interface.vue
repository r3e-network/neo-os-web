<template>
  <div class="swap-interface-slot">
    <div class="swap-container">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SwapInterfaceSlot - Layout frame for swap-type miniapps
 *
 * Provides a centered token-pair swap layout with from/to sections.
 * Used by neo-swap, neo-convert, flashloan, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.swap-interface-slot {
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 16px;
}

.swap-container {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
