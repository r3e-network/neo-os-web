<template>
  <div class="app-root">
    <IndexPage />
  </div>
</template>

<script setup lang="ts">
import IndexPage from "./pages/index/index.vue";
</script>

<style lang="scss">
@use "@shared/styles/index.scss";

:root {
  --bridge-bg: #09111b;
  --bridge-bg-elevated: rgba(12, 23, 36, 0.92);
  --bridge-text: #eef6ff;
  --bridge-text-muted: rgba(238, 246, 255, 0.64);
  --bridge-accent: #4fd1ff;
  --bridge-accent-strong: #21a8ff;
  --bridge-border: rgba(79, 209, 255, 0.16);
  --bridge-panel: rgba(255, 255, 255, 0.035);
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(79, 209, 255, 0.14), transparent 30%),
    linear-gradient(180deg, #09111b 0%, #060b12 100%);
  color: var(--bridge-text);
  font-family: "Space Grotesk", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-root {
  min-height: 100vh;
}
</style>
