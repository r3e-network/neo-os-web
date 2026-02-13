<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
useAppInit();
</script>

<style lang="scss">
@import "@shared/styles/tokens.scss";
page {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
.app-container {
  width: 100%;
  height: 100vh;
}
</style>

