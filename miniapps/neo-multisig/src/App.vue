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
@use "@shared/styles/tokens.scss" as *;

page {
  background: var(--bg-primary);
  height: 100%;
  font-family: $font-family;
}
</style>
