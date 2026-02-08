<template>
  <view class="game-board-slot">
    <view class="game-arena">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * GameBoardSlot - Layout frame for game-type miniapps
 *
 * Provides a centered arena container with aspect-ratio preservation
 * and an animation-friendly zone. Used by coin-flip, lottery, tarot, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.game-board-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  padding: 16px;
}

.game-arena {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
</style>
