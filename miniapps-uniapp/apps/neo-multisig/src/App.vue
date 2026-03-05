<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
useAppInit();
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

