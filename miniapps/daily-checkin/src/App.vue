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

page {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  height: 100%;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

// ============================================================================
// MOBILE-FIRST RESPONSIVE BREAKPOINTS
// ============================================================================

// Extra small devices (phones, less than 576px)
@media (max-width: 575.98px) {
  .app-container {
    padding: 8px;
    font-size: 14px;
  }
  .hide-xs {
    display: none !important;
  }
}

// Small devices (landscape phones, 576px and up)
@media (min-width: 576px) and (max-width: 767.98px) {
  .app-container {
    padding: 12px;
    font-size: 15px;
  }
  .hide-sm {
    display: none !important;
  }
}

// Medium devices (tablets, 768px and up)
@media (min-width: 768px) and (max-width: 991.98px) {
  .app-container {
    padding: 16px;
    font-size: 16px;
  }
  .hide-md {
    display: none !important;
  }
}

// Large devices (desktops, 992px and up)
@media (min-width: 992px) and (max-width: 1199.98px) {
  .app-container {
    padding: 20px;
    max-width: 960px;
    margin: 0 auto;
    font-size: 16px;
  }
  .hide-lg {
    display: none !important;
  }
}

// Extra large devices (large desktops, 1200px and up)
@media (min-width: 1200px) and (max-width: 1399.98px) {
  .app-container {
    padding: 24px;
    max-width: 1140px;
    margin: 0 auto;
    font-size: 16px;
  }
  .hide-xl {
    display: none !important;
  }
}

// Extra extra large devices (larger desktops, 1400px and up)
@media (min-width: 1400px) {
  .app-container {
    padding: 32px;
    max-width: 1320px;
    margin: 0 auto;
    font-size: 16px;
  }
  .hide-xxl {
    display: none !important;
  }
}

// ============================================================================
// ORIENTATION-SPECIFIC STYLES
// ============================================================================

@media (orientation: portrait) {
  .app-container.is-portrait {
    min-height: 100vh;
    min-height: 100dvh; // Dynamic viewport height for mobile browsers
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .app-container.is-landscape {
    min-height: 100vh;
  }
  .landscape-hide {
    display: none !important;
  }
}

// ============================================================================
// HIGH-DPI / RETINA DISPLAYS
// ============================================================================

@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .app-container.is-retina {
    // Sharper text rendering on high-DPI screens
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

// ============================================================================
// REDUCED MOTION PREFERENCE (Accessibility)
// ============================================================================

@media (prefers-reduced-motion: reduce) {
  .app-container * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// ============================================================================
// DARK MODE SUPPORT
// ============================================================================

@media (prefers-color-scheme: dark) {
  .app-container {
    color-scheme: dark;
  }
}
</style>
