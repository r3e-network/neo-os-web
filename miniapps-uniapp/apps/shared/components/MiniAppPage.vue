<template>
  <view :class="`theme-${name}`">
    <MiniAppShell
      :config="config"
      :state="state"
      :t="t"
      :status-message="statusMessage"
      :fireworks-active="fireworksActive"
      :sidebar-title="sidebarTitle"
      :sidebar-items="sidebarItems"
      :fallback-message="fallbackMessage"
      :on-boundary-error="onBoundaryError"
      :on-boundary-retry="onBoundaryRetry"
      @tab-change="$emit('tab-change', $event)"
    >
      <template v-for="(_, slotName) in $slots" #[slotName]>
        <slot :name="slotName" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import MiniAppShell from "./MiniAppShell.vue";

defineProps<{
  /** Miniapp name used to generate theme-{name} class */
  name: string;
  /** Template configuration */
  config: MiniAppTemplateConfig;
  /** Reactive app state */
  state: Record<string, unknown>;
  /** i18n translation function */
  t: (key: string) => string;
  /** Status message */
  statusMessage?: { msg: string; type: "success" | "error" } | null;
  /** Whether fireworks animation is active */
  fireworksActive?: boolean;
  /** Sidebar title */
  sidebarTitle?: string;
  /** Sidebar items */
  sidebarItems?: Array<{ label: string; value: string | number | boolean | null | undefined }>;
  /** Fallback message for ErrorBoundary */
  fallbackMessage?: string;
  /** Error boundary handler */
  onBoundaryError?: (error: Error) => void;
  /** Error boundary retry handler */
  onBoundaryRetry?: () => void;
}>();

defineEmits<{
  (e: "tab-change", tabKey: string): void;
}>();
</script>
