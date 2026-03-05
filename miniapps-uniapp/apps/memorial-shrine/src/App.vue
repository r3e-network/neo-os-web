<script setup lang="ts">
import { useAppInit } from "@shared/composables/useAppInit";
useAppInit();
</script>

<style lang="scss">
@use "@shared/styles/variables.scss" as *;

page {
  background: var(--memorial-bg-gradient);
  height: 100%;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
</style>

