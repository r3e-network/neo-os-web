<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
useAppInit();
</script>

<style lang="scss">
// If these files are missing, the build will fail. 
// Assuming they existed in the source app I copied from.
// If not, I should define basic styles here.
// I will comment them out and provide direct styles to be safe, 
// OR check if they exist.
/* @use "@shared/styles/variables.scss" as *; */
/* @use "@shared/styles/tokens.scss" as *; */

:root {
  --bg-primary: var(--piggy-bg-primary, #ffffff);
  --text-primary: var(--piggy-text-primary, #1a1a1a);
}

[data-theme="dark"] {
  --bg-primary: var(--piggy-bg-primary, #0f172a);
  --text-primary: var(--piggy-text-primary, #f8fafc);
}

page {
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
}
</style>

