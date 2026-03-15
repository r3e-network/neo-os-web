<template>
  <MiniAppTemplate
    :config="config"
    :state="state"
    :t="t"
    :status-message="statusMessage"
    :fireworks-active="fireworksActive"
    :sidebar-title="sidebarTitle"
    :sidebar-items="sidebarItems"
    @tab-change="handleTabChange"
  >
    <template #content>
      <ErrorBoundary :fallback="fallbackMessage" :on-error="onBoundaryError" @retry="handleBoundaryRetry">
        <slot name="content" />
      </ErrorBoundary>
    </template>

    <template v-if="hasSlot('operation')" #operation>
      <slot name="operation" />
    </template>

    <template v-if="hasSlot('tab-stats')" #tab-stats>
      <slot name="tab-stats" />
    </template>

    <template v-if="hasSlot('tab-docs')" #tab-docs>
      <slot name="tab-docs" />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { useSlots } from "vue";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import MiniAppTemplate from "./MiniAppTemplate.vue";
import ErrorBoundary from "./ErrorBoundary.vue";

const props = defineProps<{
  config: MiniAppTemplateConfig;
  state: Record<string, unknown>;
  t: (key: string) => string;
  statusMessage?: { msg: string; type: "success" | "error" } | null;
  fireworksActive?: boolean;
  sidebarTitle?: string;
  sidebarItems?: Array<{ label: string; value: string | number | boolean | null | undefined }>;
  fallbackMessage?: string;
  onBoundaryError?: (error: Error) => void;
  onBoundaryRetry?: () => void;
}>();

const emit = defineEmits<{
  (e: "tab-change", tabKey: string): void;
}>();

const slots = useSlots();

const hasSlot = (name: string): boolean => Boolean(slots[name]);

const handleTabChange = (tabKey: string) => {
  emit("tab-change", tabKey);
};

const handleBoundaryRetry = () => {
  props.onBoundaryRetry?.();
};
</script>
