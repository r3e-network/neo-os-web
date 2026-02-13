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
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import GraveyardHero from "./components/GraveyardHero.vue";
import DestructionChamber from "./components/DestructionChamber.vue";
import ConfirmDestroyModal from "./components/ConfirmDestroyModal.vue";
import HistoryTab from "./components/HistoryTab.vue";
import { useGraveyardActions } from "@/composables/useGraveyardActions";

const { t } = createUseI18n(messages)();

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

const templateConfig = createTemplateConfig({
  tabs: [{ key: "main", labelKey: "destroy", icon: "🗑️", default: true }],
  fireworks: true,
  docFeatureCount: 3,
});

const activeTab = ref("main");

const appState = computed(() => ({
  totalDestroyed: totalDestroyed.value,
  gasReclaimed: gasReclaimed.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "totalDestroyed", value: () => totalDestroyed.value },
  { labelKey: "gasReclaimed", value: () => `${gasReclaimed.value} GAS` },
  { labelKey: "history", value: () => history.value.length },
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
@use "@shared/styles/page-common" as *;
@import "./graveyard-theme.scss";

@include page-background(
  var(--grave-bg),
  (
    font-family: var(--grave-font),
  )
);
</style>
