import { onMounted, onUnmounted } from "vue";
import { initTheme, listenForThemeChanges } from "../utils/theme";

/**
 * Initializes app-level concerns: theme detection, theme change listener.
 * Call once in App.vue's `<script setup>` to replace manual theme boilerplate.
 */
export function useAppInit() {
  let cleanup: (() => void) | undefined;
  onMounted(() => {
    initTheme();
    cleanup = listenForThemeChanges();
  });
  onUnmounted(() => {
    cleanup?.();
  });
}
