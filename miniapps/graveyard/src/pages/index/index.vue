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
        <StatusMessage :status="status" />

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

      <template #tab-stats>
        <GraveyardHero :total-destroyed="totalDestroyed" :gas-reclaimed="gasReclaimed" :t="t" />
      </template>

      <template #tab-history>
        <HistoryTab :history="history" :forgetting-id="forgettingId" :t="t" @forget="forgetMemory" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import GraveyardHero from "./components/GraveyardHero.vue";
import DestructionChamber from "./components/DestructionChamber.vue";
import ConfirmDestroyModal from "./components/ConfirmDestroyModal.vue";
import HistoryTab from "./components/HistoryTab.vue";
import StatusMessage from "./components/StatusMessage.vue";
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

const templateConfig: MiniAppTemplateConfig = {
  contentType: "market-list",
  tabs: [
    { key: "destroy", labelKey: "destroy", icon: "🗑️", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
    { key: "history", labelKey: "history", icon: "📜" },
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

const activeTab = ref("destroy");

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

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--grave-bg);
  min-height: 100vh;
  position: relative;

  /* Matrix/Grid background */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--grave-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grave-grid) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    z-index: 0;
  }
}


/* Digital Afterlife Component Overrides */
:deep(.neo-card) {
  background: var(--grave-card-bg);
  border: 1px solid var(--grave-card-border);
  border-left: 4px solid var(--grave-card-accent-border);
  border-radius: 0;
  box-shadow: var(--grave-card-shadow);
  color: var(--grave-text);
  font-family: var(--grave-font);
  position: relative;
  z-index: 1;

  &.variant-danger {
    background: var(--grave-card-danger-bg);
    border-color: var(--grave-danger);
    color: var(--grave-danger);
    text-shadow: 0 0 5px var(--grave-danger-glow);
  }
}

:deep(.neo-button) {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: var(--grave-font);
  font-weight: 700;
  border-radius: 0;
  transition: all 0.1s steps(2);

  &.variant-primary {
    background: var(--grave-accent);
    color: var(--grave-bg);
    border: none;
    box-shadow: var(--grave-button-shadow);

    &:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--grave-card-shadow);
    }

    &:active {
      transform: translate(0, 0);
      box-shadow: 0 0 0;
    }
  }

  &.variant-secondary {
    background: transparent;
    border: 1px solid var(--grave-accent);
    color: var(--grave-accent);

    &:hover {
      background: var(--grave-accent-soft);
    }
  }

  &.variant-danger {
    background: var(--grave-danger);
    color: var(--grave-bg);
    box-shadow: var(--grave-button-danger-shadow);
  }
}

:deep(input),
:deep(.neo-input) {
  background: var(--grave-bg);
  border: 1px solid var(--grave-input-border);
  color: var(--grave-accent);
  font-family: var(--grave-font);
  border-radius: 0;
  caret-color: var(--grave-accent);

  &:focus {
    border-color: var(--grave-accent);
    box-shadow: 0 0 10px var(--grave-accent-glow);
  }
}

</style>
