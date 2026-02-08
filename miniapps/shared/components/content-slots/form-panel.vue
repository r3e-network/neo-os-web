<template>
  <view class="form-panel-slot">
    <view class="form-card">
      <slot />
    </view>
    <view v-if="$slots.footer" class="form-footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * FormPanelSlot - Layout frame for form-type miniapps
 *
 * Provides a centered card with form layout and optional submit footer.
 * Used by red-envelope, neo-sign-anything, time-capsule, etc.
 */
defineEmits<{
  (e: "ready"): void;
}>();
</script>

<style lang="scss" scoped>
.form-panel-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 16px;
  gap: 16px;
}

.form-card {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-footer {
  width: 100%;
  max-width: 560px;
  padding-top: 8px;
}
</style>
