<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { initTheme, listenForThemeChanges } from "../../../shared/utils/theme";

let cleanupTheme: (() => void) | undefined;

onLaunch(() => {});
onShow(() => {});
onHide(() => {});

onMounted(() => {
  initTheme();
  cleanupTheme = listenForThemeChanges();
});

onUnmounted(() => {
  cleanupTheme?.();
});
</script>

<style lang="scss">
@use "@shared/styles/theme.scss";
@use "@shared/styles/tokens.scss";
/* Global styles */
</style>
