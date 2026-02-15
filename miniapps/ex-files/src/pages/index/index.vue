<template>
  <MiniAppPage
    name="ex-files"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="init"
  >
    <template #content>
      <!-- Memory Archive -->
      <MemoryArchive :sorted-records="sortedRecords" :t="t" @view="viewRecord" />
    </template>

    <template #operation>
      <QueryRecordForm
        v-model:queryInput="queryInput"
        :query-result="queryResult"
        :is-loading="isLoading"
        :t="t"
        @query="queryRecord"
      />
    </template>

    <template #tab-upload>
      <UploadForm
        v-model:recordContent="recordContent"
        v-model:recordRating="recordRating"
        v-model:recordCategory="recordCategory"
        :is-loading="isLoading"
        :can-create="canCreate"
        :t="t"
        @create="createRecord"
      />
    </template>

    <template #tab-stats>
      <StatsTab :grid-items="statsData" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";

import MemoryArchive from "./components/MemoryArchive.vue";
import { useExFiles } from "./composables/useExFiles";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "ex-files",
  messages,
  template: {
    tabs: [
      { key: "files", labelKey: "tabFiles", icon: "📁", default: true },
      { key: "upload", labelKey: "tabUpload", icon: "📤" },
      { key: "stats", labelKey: "tabStats", icon: "📊" },
    ],
  },
});

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

:global(page) {
  background: var(--bg-primary);
}

.noir-warning-title {
  color: var(--noir-accent);
}

.noir-warning-desc {
  color: var(--noir-text);
}
</style>
