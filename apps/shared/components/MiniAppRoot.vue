<template>
  <StandardAppShell>
    <MiniAppPage
      :name="appId"
      :config="templateConfig"
      :state="appState"
      :t="tFn"
      :status-message="status"
      :fireworks-active="fireworksActive"
      :sidebar-items="sidebarItems"
      :sidebar-title="sidebarTitle"
      :fallback-message="fallbackMessage"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="reloadData"
    >
      <template #content>
        <component :is="playArea" v-bind="playAreaProps" />
      </template>

      <template v-if="hasOperations" #operation>
        <MiniAppOperationPanel
          :operations="manifest.operations ?? []"
          :t="tFn"
          :state="appState"
          :on-action="handleAction"
        />
      </template>

      <!-- Forward additional tab slots from the manifest -->
      <template
        v-for="tab in additionalTabs"
        :key="tab.key"
        #[`tab-${tab.key}`]
      >
        <slot :name="`tab-${tab.key}`" />
      </template>
    </MiniAppPage>
  </StandardAppShell>
</template>

<script setup lang="ts">
/**
 * MiniAppRoot — Internal root component created by defineMiniApp()
 *
 * This component bridges the new simplified API with the existing
 * MiniAppPage + StandardAppShell infrastructure. It is NOT intended
 * to be used directly — use defineMiniApp() instead.
 *
 * Responsibilities:
 * - Renders StandardAppShell for global chrome (styles, CSS resets)
 * - Renders MiniAppPage with config derived from the manifest
 * - Places the miniapp's playArea component in the #content slot
 * - Renders the operation panel from manifest.operations in #operation
 * - Wires reactive state to sidebar/stats display
 * - Wires registered action handlers to operation panel buttons
 * - Manages fireworks, status messages, and error boundary
 */

import { ref, reactive, computed, provide, watch, onMounted, onUnmounted } from "vue";
import type { Component, Ref } from "vue";
import type { MiniAppManifest, SidebarItemDefinition } from "@shared/types/miniapp-manifest";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import type {
  MiniAppContext,
  MiniAppSetupResult,
  PlatformServices,
} from "@shared/types/miniapp-context";
import {
  MINIAPP_CONTEXT_KEY,
  MINIAPP_MANIFEST_KEY,
  MINIAPP_ACTIONS_KEY,
  MINIAPP_STATE_KEY,
} from "@shared/types/miniapp-context";
import { manifestToTemplateConfig } from "@shared/utils/manifestToTemplateConfig";
import { createUseI18n } from "@shared/composables/useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { StatusType } from "@shared/composables/useStatusMessage";
import { createSidebarItems } from "@shared/utils/createSidebarItems";
import StandardAppShell from "@shared/templates/StandardAppShell.vue";
import MiniAppPage from "./MiniAppPage.vue";
import MiniAppOperationPanel from "./MiniAppOperationPanel.vue";

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  /** Unique miniapp identifier */
  appId: string;
  /** The play area component — custom UI provided by the miniapp */
  playArea: Component;
  /** Declarative manifest driving platform-rendered sections */
  manifest: MiniAppManifest;
  /** i18n messages keyed by locale */
  messages: Record<string, Record<string, string>>;
  /** Platform services instance */
  services: PlatformServices;
  /** Optional setup function from the miniapp definition */
  setupFn?: (ctx: MiniAppContext) => MiniAppSetupResult | Promise<MiniAppSetupResult>;
}>();

// ============================================================================
// i18n
// ============================================================================

const { t } = createUseI18n(props.messages)();
const tFn = t as (key: string, params?: Record<string, string | number>) => string;

// ============================================================================
// Template Config
// ============================================================================

const templateConfig: MiniAppTemplateConfig = manifestToTemplateConfig(props.manifest);

// ============================================================================
// Status & Fireworks
// ============================================================================

const { status, setStatus, clearStatus } = useStatusMessage();
const fireworksActive = ref(false);
let fireworksTimer: ReturnType<typeof setTimeout> | null = null;

const triggerFireworks = () => {
  if (fireworksTimer !== null) clearTimeout(fireworksTimer);
  fireworksActive.value = true;
  fireworksTimer = setTimeout(() => {
    fireworksActive.value = false;
    fireworksTimer = null;
  }, 3500);
};

// ============================================================================
// Reactive State & Actions
// ============================================================================

const appState: Record<string, Ref<unknown>> = reactive({});
const actionHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();

const loadError = ref<Error | null>(null);

const registerAction = (key: string, handler: (...args: unknown[]) => Promise<void>) => {
  actionHandlers.set(key, handler);
};

// ============================================================================
// Format Helpers
// ============================================================================

type FormatFn = (value: unknown) => string;

const FORMAT_MAP: Record<string, FormatFn> = {
  number: (v) => {
    const n = Number(v);
    return isNaN(n) ? String(v ?? "") : n.toLocaleString();
  },
  currency: (v) => {
    const n = Number(v);
    return isNaN(n)
      ? String(v ?? "")
      : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  gas: (v) => {
    const n = Number(v);
    return isNaN(n) ? String(v ?? "") : `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} GAS`;
  },
  percent: (v) => {
    const n = Number(v);
    return isNaN(n) ? String(v ?? "") : `${n.toFixed(1)}%`;
  },
  duration: (v) => {
    const totalSeconds = Number(v);
    if (isNaN(totalSeconds) || totalSeconds < 0) return String(v ?? "");
    if (totalSeconds === 0) return "0s";
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);
    return parts.join(" ");
  },
  text: (v) => String(v ?? ""),
};

function getFormatter(format?: string): FormatFn {
  return FORMAT_MAP[format ?? "text"] ?? FORMAT_MAP.text;
}

// ============================================================================
// Sidebar
// ============================================================================

const sidebarDefs = props.manifest.sidebar?.items ?? [];
const sidebarItems = createSidebarItems(
  tFn as (key: string) => string,
  sidebarDefs.map((item: SidebarItemDefinition) => ({
    labelKey: item.labelKey,
    value: () => {
      const stateRef = appState[item.valueKey];
      if (!stateRef) return null;
      return getFormatter(item.format)(stateRef.value);
    },
  })),
);
const sidebarTitle = tFn(props.manifest.sidebar?.titleKey ?? "overview");

// ============================================================================
// Error Boundary
// ============================================================================

const handleBoundaryError = (error: Error) => {
  console.error(`[${props.appId}] boundary error:`, error);
};
const fallbackMessage = tFn("errorFallback");

// ============================================================================
// Context & Provide
// ============================================================================

const ctx: MiniAppContext = {
  services: props.services,
  t: tFn,
  state: appState,
  setStatus: (msg: string, type: StatusType) => {
    setStatus(msg, type);
    if (type === "success" && props.manifest.features?.fireworks) {
      triggerFireworks();
    }
  },
  clearStatus,
  registerAction,
};

provide(MINIAPP_CONTEXT_KEY, ctx);
provide(MINIAPP_MANIFEST_KEY, props.manifest);
provide(MINIAPP_ACTIONS_KEY, actionHandlers);
provide(MINIAPP_STATE_KEY, appState);

// ============================================================================
// Setup Hook Execution
// ============================================================================

let loadDataFn: (() => Promise<void>) | undefined;
let cleanupFn: (() => void) | undefined;

const setupPromise = (async () => {
  if (!props.setupFn) return;
  try {
    const result = await props.setupFn(ctx);
    if (result?.state) {
      for (const [key, value] of Object.entries(result.state)) {
        appState[key] = value;
      }
    }
    loadDataFn = result?.loadData;
    cleanupFn = result?.cleanup;
  } catch (err) {
    console.error(`[${props.appId}] setup error:`, err);
    setStatus(
      err instanceof Error ? err.message : "Setup failed",
      "error",
    );
  }
})();

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  await setupPromise;
  if (loadDataFn) {
    try {
      loadError.value = null;
      await loadDataFn();
    } catch (err) {
      console.error(`[${props.appId}] loadData error:`, err);
      loadError.value = err instanceof Error ? err : new Error("Failed to load data");
      setStatus(
        loadError.value.message,
        "error",
      );
    }
  }

  // Watch for wallet address changes and reload data automatically.
  // The chain service exposes `address` as a Ref<string | null>.
  const chainService = props.services.chain as { address?: Ref<string | null> } | undefined;
  if (chainService?.address && loadDataFn) {
    const addressRef = chainService.address;
    watch(addressRef, () => {
      reloadData();
    });
  }
});

onUnmounted(() => {
  if (fireworksTimer !== null) clearTimeout(fireworksTimer);
  cleanupFn?.();
});

// ============================================================================
// Action Handling
// ============================================================================

const handleAction = async (operationKey: string, formData: Record<string, unknown>) => {
  const op = props.manifest.operations?.find((o) => o.key === operationKey);
  const methodKey = op?.actionMethod ?? operationKey;
  const handler = actionHandlers.get(methodKey);
  if (!handler) {
    console.warn(`[${props.appId}] No action handler registered for "${methodKey}"`);
    return;
  }
  try {
    await handler(formData);
  } catch (err) {
    console.error(`[${props.appId}] action "${methodKey}" error:`, err);
    setStatus(
      err instanceof Error ? err.message : "Action failed",
      "error",
    );
  }
};

const reloadData = async () => {
  if (loadDataFn) {
    try {
      loadError.value = null;
      clearStatus();
      await loadDataFn();
    } catch (err) {
      console.error(`[${props.appId}] reload error:`, err);
      loadError.value = err instanceof Error ? err : new Error("Failed to load data");
      setStatus(
        loadError.value.message,
        "error",
      );
    }
  }
};

// ============================================================================
// Computed Props
// ============================================================================

const hasOperations = computed(() => (props.manifest.operations?.length ?? 0) > 0);
const additionalTabs = computed(() => (props.manifest.tabs ?? []).filter((tab) => !tab.default));

/** Props passed down to the play area component */
const playAreaProps = computed(() => ({
  t: tFn,
  state: appState,
  services: props.services,
  status: status.value,
  setStatus: ctx.setStatus,
  clearStatus,
  loadError: loadError.value,
  retryLoad: reloadData,
}));
</script>
