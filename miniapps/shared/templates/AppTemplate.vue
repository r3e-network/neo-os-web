<template>
  <view class="app-container" :class="containerClasses">
    <slot>
      <router-view />
    </slot>
  </view>
</template>

<script setup lang="ts">
/**
 * AppTemplate — Standardized App.vue component for all miniapps
 *
 * Replaces the duplicated App.vue boilerplate across 52 miniapps.
 * Handles theme initialization, responsive class injection, and
 * provides a consistent app shell structure.
 *
 * Usage (in a miniapp's App.vue):
 * ```vue
 * <template>
 *   <AppTemplate />
 * </template>
 *
 * <script setup lang="ts">
 * import AppTemplate from "@shared/templates/AppTemplate.vue";
 * </script>
 *
 * <style lang="scss">
 * @use "@shared/styles/app-shell";
 * @include app-shell.app-shell;
 * </style>
 * ```
 *
 * For miniapps that need custom page-level styles without the
 * responsive container, use the `useResponsive` prop:
 * ```vue
 * <AppTemplate :use-responsive="false" />
 * ```
 */

import { computed } from "vue";
import { useAppInit } from "@shared/composables/useAppInit";
import { useResponsive } from "@shared/composables/useResponsive";

const props = withDefaults(
  defineProps<{
    /** Enable responsive container classes (default: true) */
    useResponsiveClasses?: boolean;
  }>(),
  {
    useResponsiveClasses: true,
  }
);

// Theme initialization — runs for every miniapp
useAppInit();

// Responsive classes — conditionally enabled
const responsive = useResponsive();

const containerClasses = computed(() => {
  if (!props.useResponsiveClasses) return {};
  return responsive.containerClasses.value;
});
</script>

<style lang="scss">
@use "@shared/styles/app-shell";
@include app-shell.app-shell;
</style>
