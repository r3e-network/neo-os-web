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
  --bg-primary: #0d0d0d;
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.5);
  --accent: #00e599;
  --border-color: rgba(255, 255, 255, 0.08);
  --bg-card: rgba(255, 255, 255, 0.03);
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.app-root {
  min-height: 100vh;
}
</style>
