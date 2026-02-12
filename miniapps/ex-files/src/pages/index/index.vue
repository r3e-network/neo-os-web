<template>
  <view class="theme-ex-files">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="app-container">
          <StatusMessage :status="status" />

          <!-- Memory Archive -->
          <MemoryArchive :sorted-records="sortedRecords" :t="t" @view="viewRecord" />
        </view>
      </template>

      <template #operation>
        <view class="app-container">
          <QueryRecordForm
            v-model:queryInput="queryInput"
            :query-result="queryResult"
            :is-loading="isLoading"
            :t="t"
            @query="queryRecord"
          />
        </view>
      </template>

      <template #tab-upload>
        <view class="app-container">
          <UploadForm
            v-model:recordContent="recordContent"
            v-model:recordRating="recordRating"
            v-model:recordCategory="recordCategory"
            :is-loading="isLoading"
            :can-create="canCreate"
            :t="t"
            @create="createRecord"
          />
        </view>
      </template>

      <template #tab-stats>
        <view class="app-container">
          <NeoCard variant="erobo">
            <NeoStats :stats="statsData" />
          </NeoCard>
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoStats, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";

import StatusMessage from "./components/StatusMessage.vue";
import QueryRecordForm from "./components/QueryRecordForm.vue";
import MemoryArchive from "./components/MemoryArchive.vue";
import UploadForm from "./components/UploadForm.vue";
import { useExFiles } from "./composables/useExFiles";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "files", labelKey: "tabFiles", icon: "📁", default: true },
    { key: "upload", labelKey: "tabUpload", icon: "📤" },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const {
  activeTab,
  recordContent,
  recordRating,
  recordCategory,
  queryInput,
  queryResult,
  isLoading,
  status,
  appState,
  sidebarItems,
  sortedRecords,
  statsData,
  canCreate,
  viewRecord,
  createRecord,
  queryRecord,
  init,
} = useExFiles(t);

onMounted(init);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./ex-files-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Special+Elite&display=swap");

:global(page) {
  background: var(--bg-primary);
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--noir-bg);
  background-image:
    linear-gradient(var(--noir-grid), var(--noir-grid)),
    radial-gradient(circle at 1px 1px, var(--noir-ink-line) 1px, transparent 0);
  background-size:
    auto,
    4px 4px;
  min-height: 100vh;
  font-family: "Special Elite", "Courier Prime", monospace;
}

/* Noir Component Overrides */
:global(.theme-ex-files) :deep(.neo-card) {
  background: var(--noir-paper) !important;
  border: 1px solid var(--noir-border) !important;
  border-radius: 2px !important;
  box-shadow:
    4px 4px 8px var(--noir-shadow),
    inset 0 0 40px var(--noir-card-glow) !important;
  color: var(--noir-text) !important;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--noir-ink-line);
  }
}

:global(.theme-ex-files) :deep(.neo-button) {
  border-radius: 2px !important;
  font-family: "Special Elite", monospace !important;
  text-transform: uppercase;
  font-weight: 700 !important;
  letter-spacing: 0.1em;
  box-shadow: var(--noir-button-shadow) !important;

  &.variant-primary {
    background: var(--noir-button-primary-bg) !important;
    color: var(--noir-button-primary-text) !important;
    border: 1px solid var(--noir-button-primary-border) !important;

    &:active {
      transform: translate(1px, 1px);
      box-shadow: var(--noir-button-shadow-press) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 2px solid var(--noir-button-secondary-border) !important;
    color: var(--noir-button-secondary-text) !important;
  }
}

:global(.theme-ex-files) :deep(.neo-input) {
  background: var(--noir-input-bg) !important;
  border: 1px solid var(--noir-input-border) !important;
  border-radius: 0 !important;
  font-family: "Special Elite", monospace !important;
  color: var(--noir-input-text) !important;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}


.noir-warning-title {
  color: var(--noir-accent);
}

.noir-warning-desc {
  color: var(--noir-text);
}

// Desktop sidebar
</style>
