<template>
  <FlamingoLauncherPage product-key="actionCenter" />
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Flamingo Action Center
 *
 * Delegates all UI to the shared FlamingoLauncherPage component.
 * The defineMiniApp pattern renders this inside MiniAppRoot,
 * which provides the standard shell chrome.
 */
import type { Ref } from "vue";
import { FlamingoLauncherPage } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();
</script>
