<template>
  <AppLayout
    :class="layoutClass"
    :tabs="navTabs"
    :active-tab="activeTab"
    @tab-change="handleTabChange"
  >
    <!-- Chain Warning Slot (default position) -->
    <template v-if="!hideChainWarning">
      <slot name="chain-warning">
        <ChainWarning
          :title="chainWarningTitle"
          :message="chainWarningMessage"
          :button-text="chainWarningButtonText"
          @switch="emit('chain-switch')"
          @switch-complete="emit('chain-switch-complete')"
          @switch-error="emit('chain-switch-error', $event)"
        />
      </slot>
    </template>

    <!-- Main Content Slot -->
    <slot :active-tab="activeTab" />
  </AppLayout>
</template>

<script setup lang="ts">
/**
 * MiniAppLayout Component
 *
 * A standardized layout component for miniapps that encapsulates common patterns:
 * - Chain warning display
 * - Tab navigation
 * - Documentation tab
 * - Consistent structure
 *
 * @example
 * ```ts
 * // Usage: <MiniAppLayout theme-class="theme-myapp" :tabs="navTabs" />
 * const navTabs = [
 *   { id: "game", icon: "game", label: "Game" },
 *   { id: "stats", icon: "chart", label: "Stats" }
 * ];
 * ```
 */

import { ref, computed, type PropType } from "vue";
import AppLayout from "./AppLayout.vue";
import { type NavTab } from "./NavBar.vue";
import ChainWarning from "./ChainWarning.vue";

interface Props {
  /** CSS class for theme styling (e.g., "theme-lottery") */
  themeClass?: string;
  /** Navigation tabs configuration */
  tabs?: NavTab[];
  /** Initially active tab */
  initialTab?: string;
  /** Hide the chain warning component */
  hideChainWarning?: boolean;
  /** Chain warning title text */
  chainWarningTitle?: string;
  /** Chain warning message text */
  chainWarningMessage?: string;
  /** Chain warning button text */
  chainWarningButtonText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  themeClass: "",
  tabs: () => [],
  initialTab: "",
  hideChainWarning: false,
  chainWarningTitle: "Wrong Network",
  chainWarningMessage: "Switch to Neo N3 Mainnet to continue.",
  chainWarningButtonText: "Switch Network",
});

const emit = defineEmits<{
  (e: "tab-change", tabId: string): void;
  (e: "chain-switch"): void;
  (e: "chain-switch-complete"): void;
  (e: "chain-switch-error", error: Error): void;
}>();

const activeTab = ref(props.initialTab || props.tabs[0]?.id || "");

const layoutClass = computed(() => props.themeClass);

const navTabs = computed(() => props.tabs);

const handleTabChange = (tabId: string) => {
  activeTab.value = tabId;
  emit("tab-change", tabId);
};

defineExpose({
  /**
   * Programmatically change the active tab
   */
  setActiveTab: (tabId: string) => {
    activeTab.value = tabId;
  },
  /**
   * Get the current active tab
   */
  getActiveTab: () => activeTab.value,
});
</script>

<style lang="scss" scoped>
// Inherit all styles from AppLayout
</style>
