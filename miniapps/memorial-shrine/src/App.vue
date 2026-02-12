<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";

let cleanupTheme: (() => void) | undefined;

onMounted(() => {
  initTheme();
  cleanupTheme = listenForThemeChanges();
});

onUnmounted(() => {
  cleanupTheme?.();
});
</script>

<style lang="scss">
@use "@shared/styles/variables.scss" as *;

page {
  background: var(--memorial-bg-gradient);
  height: 100%;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
</style>
