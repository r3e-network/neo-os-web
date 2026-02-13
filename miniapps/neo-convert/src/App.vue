<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
useAppInit();
</script>

<style lang="scss">
@use "@shared/styles/variables.scss" as *;

page {
  background: var(--bg-primary);
  height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
}
</style>

