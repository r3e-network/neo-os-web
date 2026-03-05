<template>
  <view class="dashboard-slot">
    <view v-if="$slots.hero" class="dashboard-hero">
      <slot name="hero" />
    </view>
    <view class="dashboard-panels">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * DashboardSlot - Layout frame for dashboard-type miniapps
 *
 * Provides a hero stats row + stacked panel grid layout.
 * Used by neoburger, trustanchor, wallet-health, neo-treasury, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.dashboard-slot {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 16px;
  padding: 16px;
}

.dashboard-hero {
  width: 100%;
}

.dashboard-panels {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
</style>
