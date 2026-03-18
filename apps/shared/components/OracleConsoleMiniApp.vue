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

      <NeoCard variant="erobo" :title="resultTitle" class="px-1">
        <slot name="result" />
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="operationTitle" class="px-1">
        <slot name="operation" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoCard, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";

defineProps<{
  pageName: string;
  templateConfig: object;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: unknown;
  sidebarItems: unknown;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  onRetry?: () => void;
  heroIcon: string;
  heroStats: HeroStatsStripItem[];
  overviewStats: StatsDisplayItem[];
  resultTitle: string;
  operationTitle: string;
}>();
</script>
