<template>
  <view class="app-container" :class="containerClasses">
    <router-view />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { onMounted } from "vue";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { useResponsive } from "@shared/composables/useResponsive";

const { containerClasses } = useResponsive();

onLaunch(() => {});

onShow(() => {});

onHide(() => {});

onMounted(() => {
  initTheme();
  listenForThemeChanges();
});
</script>

<style lang="scss">
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/app-responsive" as resp;

page {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  height: 100%;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

@include resp.app-responsive-a;
@include resp.app-orientation-a;
@include resp.app-reduced-motion;
@include resp.app-retina;
</style>
