<template>
  <view class="timer-hero-slot">
    <view class="timer-display">
      <slot name="timer" />
    </view>
    <view class="timer-action">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * TimerHeroSlot - Layout frame for timer/countdown miniapps
 *
 * Provides a large countdown display area + primary action button zone.
 * Used by daily-checkin, doomsday-clock, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.timer-hero-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 16px;
  gap: 24px;
}

.timer-display {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timer-action {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
