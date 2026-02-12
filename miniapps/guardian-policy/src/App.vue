<template>
  <view class="app-container" :class="{ 'is-desktop': isDesktop, 'is-mobile': isMobile, 'is-tablet': isTablet }">
    <router-view />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { onMounted } from "vue";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";
import { useResponsive } from "@shared/composables/useResponsive";

const { isMobile, isTablet, isDesktop } = useResponsive();

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

page {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  height: 100%;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

/* Mobile-first responsive design */
@media screen and (max-width: 480px) {
  .app-container {
    padding: 8px;
  }
  .app-container.is-mobile .hide-mobile {
    display: none !important;
  }
}

@media screen and (min-width: 481px) and (max-width: 768px) {
  .app-container {
    padding: 12px;
  }
}

@media screen and (min-width: 769px) and (max-width: 1023px) {
  .app-container {
    padding: 20px;
  }
  .app-container.is-tablet .hide-tablet {
    display: none !important;
  }
}

@media screen and (min-width: 1024px) {
  .app-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .app-container.is-desktop .hide-desktop {
    display: none !important;
  }
}

/* Orientation-specific adjustments */
@media screen and (orientation: portrait) {
  .app-container {
    min-height: 100vh;
  }
}

@media screen and (orientation: landscape) and (max-height: 600px) {
  .app-container {
    min-height: 100vh;
  }
}
</style>
