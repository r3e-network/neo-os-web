<template>
  <view class="theme-graveyard">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <GraveyardHero :total-destroyed="totalDestroyed" :gas-reclaimed="gasReclaimed" :t="t" />

          <HistoryTab :history="history" :forgetting-id="forgettingId" :t="t" @forget="forgetMemory" />
        </ErrorBoundary>
      </template>

      <template #operation>
        <DestructionChamber
          v-model:assetHash="assetHash"
          v-model:memoryType="memoryType"
          :memory-type-options="memoryTypeOptions"
          :is-destroying="isDestroying"
          :show-warning-shake="showWarningShake"
          :t="t"
          @initiate="initiateDestroy"
        />

        <ConfirmDestroyModal
          :show="showConfirm"
          :asset-hash="assetHash"
          :t="t"
          @cancel="showConfirm = false"
          @confirm="executeDestroy"
        />
      </template>

    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import GraveyardHero from "./components/GraveyardHero.vue";
import DestructionChamber from "./components/DestructionChamber.vue";
import ConfirmDestroyModal from "./components/ConfirmDestroyModal.vue";
import HistoryTab from "./components/HistoryTab.vue";
import { useGraveyardActions } from "@/composables/useGraveyardActions";

const { t } = useI18n();

const {
  totalDestroyed,
  gasReclaimed,
  assetHash,
  memoryType,
  status,
  history,
  showConfirm,
  isDestroying,
  showWarningShake,
  forgettingId,
  memoryTypeOptions,
  initiateDestroy,
  executeDestroy,
  loadStats,
  loadHistory,
  forgetMemory,
  cleanupTimers,
} = useGraveyardActions();

const { handleBoundaryError } = useHandleBoundaryError("graveyard");

const resetAndReload = async () => {
  await loadStats();
  await loadHistory();
};

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "destroy", icon: "🗑️", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("main");

const appState = computed(() => ({
  totalDestroyed: totalDestroyed.value,
  gasReclaimed: gasReclaimed.value,
}));

const sidebarItems = computed(() => [
  { label: t("totalDestroyed"), value: totalDestroyed.value },
  { label: t("gasReclaimed"), value: `${gasReclaimed.value} GAS` },
  { label: t("history"), value: history.value.length },
]);

onUnmounted(() => {
  cleanupTimers();
});

onMounted(async () => {
  await loadStats();
  await loadHistory();
});

watch(activeTab, async (tab) => {
  if (tab === "history") {
    await loadHistory();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./graveyard-theme.scss";

:global(page) {
  background: var(--grave-bg);
  font-family: var(--grave-font);
}
</style>
