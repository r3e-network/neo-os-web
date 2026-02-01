<template>
  <view class="top-navbar">
    <view class="nav-left">
      <view v-if="showBack" class="nav-btn" @click="$emit('back')">
        <AppIcon name="arrow-left" :size="20" />
      </view>
    </view>
    <view class="nav-center">
      <text class="nav-title">{{ title }}</text>
    </view>
    <view class="nav-right">
      <slot name="right" />
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  title: string;
  showBack?: boolean;
}>();

defineEmits<{
  (e: "back"): void;
}>();
</script>

<style lang="scss">
@use "@shared/styles/tokens.scss" as *;

.top-navbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-card, rgba(12, 13, 22, 0.8));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color, rgba(159, 157, 243, 0.18));
  flex-shrink: 0;
  box-shadow: 0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.1));
  z-index: 10;
}

.nav-left,
.nav-right {
  width: 60px;
  display: flex;
  align-items: center;
}

.nav-right {
  justify-content: flex-end;
}

.nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid var(--border-color, rgba(159, 157, 243, 0.18));
  transition: all 0.2s ease;
  cursor: pointer;

  &:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.2);
  }
}

.nav-center {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 16px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--text-primary, #ffffff);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
