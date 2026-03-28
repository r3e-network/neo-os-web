<template>
  <FlamingoLauncherPage product-key="analytics" />
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Flamingo Analytics
 *
 * Delegates all UI to the shared FlamingoLauncherPage component.
 */
import type { Ref } from "vue";
import { FlamingoLauncherPage } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();
</script>
