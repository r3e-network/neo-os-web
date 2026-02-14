<template>
  <view class="theme-ex-files">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
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
        <MiniAppTabStats variant="erobo" :stats="statsData" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell, MiniAppTabStats } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";

import QueryRecordForm from "./components/QueryRecordForm.vue";
import MemoryArchive from "./components/MemoryArchive.vue";
import UploadForm from "./components/UploadForm.vue";
import { useExFiles } from "./composables/useExFiles";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "files", labelKey: "tabFiles", icon: "📁", default: true },
    { key: "upload", labelKey: "tabUpload", icon: "📤" },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
  ],
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

const { handleBoundaryError } = useHandleBoundaryError("ex-files");
const resetAndReload = async () => {
  await init();
};

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
