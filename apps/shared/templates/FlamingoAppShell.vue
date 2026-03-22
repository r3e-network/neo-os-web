<template>
  <div class="app-root">
    <slot />
  </div>
</template>

<style lang="scss">
@use "@shared/styles/index.scss";

body {
  min-height: 100vh;
  background: var(--bg-primary, #0b0d12);
  color: var(--text-primary, #fff);
}

.app-root {
  min-height: 100vh;
}
</style>
