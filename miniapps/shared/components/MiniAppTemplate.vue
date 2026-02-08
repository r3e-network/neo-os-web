<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="navTabs" :active-tab="activeTab" @tab-change="handleTabChange">
    <!-- Pass through desktop sidebar slot -->
    <template #desktop-sidebar>
      <slot name="desktop-sidebar" />
    </template>

    <!-- Chain Warning -->
    <ChainWarning
      v-if="showChainWarning"
      :title="t('wrongChain')"
      :message="t('wrongChainMessage')"
      :button-text="t('switchToNeo')"
    />

    <!-- Status Message -->
    <NeoCard
      v-if="showStatus && statusMessage"
      :variant="statusMessage.type === 'error' ? 'danger' : 'erobo-neo'"
      class="template-status mb-4"
    >
      <text class="text-center font-bold">{{ statusMessage.msg }}</text>
    </NeoCard>

    <!-- Default / Content Tab -->
    <view v-if="activeTab === defaultTabKey" class="tab-content">
      <component :is="contentSlotComponent">
        <slot name="content" />
      </component>
    </view>

    <!-- Dynamic tab slots -->
    <template v-for="tab in nonDefaultTabs" :key="tab.key">
      <view v-if="activeTab === tab.key" class="tab-content scrollable">
        <!-- Auto-generated stats tab -->
        <template v-if="tab.key === 'stats' && hasStats && !hasSlot(`tab-stats`)">
          <NeoCard variant="erobo">
            <NeoStats :stats="computedStats" />
          </NeoCard>
        </template>

        <!-- Auto-generated docs tab -->
        <template v-else-if="tab.key === 'docs' && hasDocs && !hasSlot(`tab-docs`)">
          <NeoDoc
            :title="t(docsConfig.titleKey)"
            :subtitle="docsConfig.subtitleKey ? t(docsConfig.subtitleKey) : undefined"
            :steps="computedDocSteps"
            :features="computedDocFeatures"
          />
        </template>

        <!-- Custom tab slot (app-provided) -->
        <slot v-else :name="`tab-${tab.key}`" />
      </view>
    </template>

    <!-- Fireworks -->
    <Fireworks v-if="showFireworks" :active="fireworksActive" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from "vue";
import type { MiniAppTemplateConfig, StatConfig } from "@shared/types/template-config";
import { ResponsiveLayout, NeoCard, NeoStats, NeoDoc, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useChainValidation } from "@shared/composables/useChainValidation";

import {
  GameBoardSlot,
  MarketListSlot,
  FormPanelSlot,
  DashboardSlot,
  SwapInterfaceSlot,
  TimerHeroSlot,
} from "./content-slots";

/**
 * MiniAppTemplate - Universal composable template for miniapps
 *
 * Replaces per-app boilerplate with a config-driven layout.
 * Each miniapp's index.vue becomes ~30-60 lines: config + slot content.
 *
 * @example
 * ```vue
 * <MiniAppTemplate :config="templateConfig" :state="appState" :t="t">
 *   <template #content>
 *     <MyGameComponent />
 *   </template>
 * </MiniAppTemplate>
 * ```
 */
const props = defineProps<{
  /** Template configuration declaring structure */
  config: MiniAppTemplateConfig;
  /** Reactive app state — stat valueKeys are read from this */
  state: Record<string, unknown>;
  /** i18n translation function */
  t: (key: string) => string;
  /** Status message to display (optional) */
  statusMessage?: { msg: string; type: "success" | "error" } | null;
  /** Whether fireworks animation is active */
  fireworksActive?: boolean;
}>();

const emit = defineEmits<{
  (e: "tab-change", tabKey: string): void;
}>();

const slots = useSlots();

// --- Chain validation ---
const { showWarning } = useChainValidation();
const showChainWarning = computed(() => {
  return props.config.features?.chainWarning !== false && showWarning.value;
});

// --- Tab management ---
const defaultTabKey = computed(() => {
  const defaultTab = props.config.tabs.find((t) => t.default);
  return defaultTab?.key ?? props.config.tabs[0]?.key ?? "";
});

const activeTab = ref(defaultTabKey.value);

const navTabs = computed<NavTab[]>(() =>
  props.config.tabs.map((tab) => ({
    id: tab.key,
    label: props.t(tab.labelKey),
    icon: tab.icon ?? "",
  }))
);

const nonDefaultTabs = computed(() => props.config.tabs.filter((tab) => tab.key !== defaultTabKey.value));

const handleTabChange = (tabKey: string) => {
  activeTab.value = tabKey;
  emit("tab-change", tabKey);
};

// --- Content slot resolution ---
const contentSlotMap: Record<string, unknown> = {
  "game-board": GameBoardSlot,
  "market-list": MarketListSlot,
  "form-panel": FormPanelSlot,
  dashboard: DashboardSlot,
  "swap-interface": SwapInterfaceSlot,
  "timer-hero": TimerHeroSlot,
  custom: "view",
};

const contentSlotComponent = computed(() => {
  return contentSlotMap[props.config.contentType] ?? "view";
});

// --- Stats computation ---
const hasStats = computed(() => (props.config.stats?.length ?? 0) > 0);

const formatStatValue = (stat: StatConfig, raw: unknown): string | number => {
  const value = raw ?? 0;
  switch (stat.format) {
    case "currency":
      return `${Number(value).toFixed(2)} GAS`;
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "duration":
      return String(value);
    case "number":
    default:
      return typeof value === "number" ? value : Number(value) || 0;
  }
};

const computedStats = computed(() =>
  (props.config.stats ?? []).map((stat) => ({
    label: props.t(stat.labelKey),
    value: formatStatValue(stat, props.state[stat.valueKey]),
    variant: stat.variant ?? "default",
  }))
);

// --- Docs computation ---
const docsConfig = computed(() => props.config.features?.docs);
const hasDocs = computed(() => !!docsConfig.value);

const computedDocSteps = computed(() => (docsConfig.value?.stepKeys ?? []).map((key) => props.t(key)));

const computedDocFeatures = computed(() =>
  (docsConfig.value?.featureKeys ?? []).map((f) => ({
    name: props.t(f.nameKey),
    desc: props.t(f.descKey),
  }))
);

// --- Feature flags ---
const showFireworks = computed(() => props.config.features?.fireworks !== false);
const showStatus = computed(() => props.config.features?.statusMessages !== false);

// --- Slot detection ---
const hasSlot = (name: string): boolean => !!slots[name];
</script>

<style lang="scss" scoped>
.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.template-status {
  margin: 0 20px;
}
</style>
