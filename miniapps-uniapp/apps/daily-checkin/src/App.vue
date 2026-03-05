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
@use "@shared/styles/app-shell";
@include app-shell.app-shell;
</style>

