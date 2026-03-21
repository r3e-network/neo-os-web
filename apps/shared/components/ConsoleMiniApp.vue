<template>
  <MiniAppPage
    :name="pageName"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="onRetry"
  >
    <template #content>
      <HeroSection variant="erobo" :icon="heroIcon" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStats" compact />
        </template>
      </HeroSection>

      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

      <NeoCard v-if="wrapResultCard" variant="erobo" :title="resultTitle" class="px-1">
        <slot name="result" />
      </NeoCard>
      <slot v-else name="result" />
    </template>

    <template #operation>
      <NeoCard v-if="wrapOperationCard" variant="erobo" :title="operationTitle" class="px-1">
        <slot name="operation" />
      </NeoCard>
      <slot v-else name="operation" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoCard, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import type { StatusMessage } from "@shared/composables/useStatusMessage";

withDefaults(defineProps<{
  pageName: string;
  templateConfig: MiniAppTemplateConfig;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: StatusMessage | null;
  sidebarItems: Array<{ label: string; value: string | number | boolean | null | undefined }>;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  onRetry?: () => void;
  heroIcon: string;
  heroStats: HeroStatsStripItem[];
  overviewStats: StatsDisplayItem[];
  resultTitle: string;
  operationTitle: string;
  wrapResultCard?: boolean;
  wrapOperationCard?: boolean;
}>(), {
  wrapResultCard: true,
  wrapOperationCard: true,
});
</script>
