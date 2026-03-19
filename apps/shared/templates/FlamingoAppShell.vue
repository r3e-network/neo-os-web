<template>
  <div class="app-root">
    <slot />
  </div>
</template>

<style lang="scss">
@use "@shared/styles/index.scss";

body {
  min-height: 100vh;
  background: #0b0d12;
  color: #fff;
}

.app-root {
  min-height: 100vh;
}
</style>
