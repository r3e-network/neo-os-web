<template>
  <view class="app-container" :class="containerClasses">
    <router-view />
  </view>
</template>

<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
import { useResponsive } from "@shared/composables/useResponsive";
useAppInit();
const { containerClasses } = useResponsive();
</script>

<style lang="scss">
@import "@shared/styles/tokens.scss";

page {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.app-container {
  width: 100%;
  height: 100vh;
}
</style>

