/**
 * defineMiniApp — Simplified entry point for miniapp initialization
 *
 * Replaces the 4-layer pattern:
 *   App.vue -> StandardAppShell -> IndexPage -> createMiniApp() -> usePage() -> useDomainContract()
 *
 * With a single call:
 *   main.ts -> defineMiniApp({ appId, playArea, manifest, messages })
 *
 * The function creates a Vue app, wraps the playArea component inside
 * MiniAppRoot (which uses StandardAppShell + MiniAppPage), wires i18n,
 * reactive state, sidebar, operation panel actions, and mounts to #app.
 *
 * Existing miniapps using createMiniApp() continue to work unchanged.
 *
 * @example
 * ```ts
 * import { defineMiniApp } from "@shared/utils/defineMiniApp";
 * import PlayArea from "./PlayArea";
 *
 * defineMiniApp({
 *   appId: "miniapp-daily-checkin",
 *   playArea: PlayArea,
 *   manifest: {
 *     name: "Daily Check-in",
 *     category: "game",
 *     tabs: [
 *       { key: "checkin", labelKey: "checkin", icon: "check-circle", default: true },
 *       { key: "stats", labelKey: "stats", icon: "bar-chart" },
 *     ],
 *     features: { fireworks: true, walletRequired: true },
 *   },
 *   messages: { en: { checkin: "Check In", stats: "Stats" } },
 *   setup: async ({ services, state, registerAction }) => {
 *     const streak = ref(0);
 *     registerAction("checkin", async () => { ... });
 *     return {
 *       state: { currentStreak: streak },
 *       loadData: async () => { streak.value = await services.invoke(...) },
 *     };
 *   },
 * });
 * ```
 */

import { createApp, h } from "vue";
import type { Component, App as VueApp } from "vue";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import type {
  MiniAppContext,
  MiniAppSetupResult,
  PlatformServices,
} from "../types/miniapp-context";
import MiniAppRoot from "../react/MiniAppRoot";

// Re-export shared types and injection keys so consumers can import from one place
export type {
  PlatformServices,
  MiniAppContext,
  MiniAppSetupResult,
} from "../types/miniapp-context";
export {
  MINIAPP_CONTEXT_KEY,
  MINIAPP_MANIFEST_KEY,
  MINIAPP_ACTIONS_KEY,
  MINIAPP_STATE_KEY,
} from "../types/miniapp-context";
export { manifestToTemplateConfig } from "./manifestToTemplateConfig";

// ============================================================================
// Definition Type
// ============================================================================

/** The definition object passed to defineMiniApp() */
export interface MiniAppDefinition {
  /** Unique app identifier (e.g. "miniapp-daily-checkin") */
  appId: string;

  /** The play area component — the ONLY custom UI the miniapp provides */
  playArea: Component;

  /** Declarative manifest driving all platform-rendered sections */
  manifest: MiniAppManifest;

  /** Optional i18n messages keyed by locale (e.g. { en: {...}, zh: {...} }) */
  messages?: Record<string, Record<string, string>>;

  /** Optional setup hook called after services are initialized */
  setup?: (
    ctx: MiniAppContext,
  ) => MiniAppSetupResult | Promise<MiniAppSetupResult>;

  /** Optional mount target selector — defaults to "#app" */
  mountTo?: string;
}

/**
 * Create and mount a complete miniapp from a single definition object.
 *
 * This is the new simplified entry point that replaces the 4-layer
 * initialization pattern. It creates a Vue app, renders MiniAppRoot
 * (which wraps StandardAppShell + MiniAppPage), and places the miniapp's
 * custom playArea component in the content slot.
 *
 * @param definition - The miniapp definition
 * @returns The mounted Vue app instance
 */
export function defineMiniApp(definition: MiniAppDefinition): VueApp {
  const {
    appId,
    playArea,
    manifest,
    messages = {},
    setup: setupFn,
    mountTo = "#app",
  } = definition;

  // Create the root component that renders MiniAppRoot with all props
  const RootApp = {
    name: `MiniApp_${appId}`,
    render() {
      return h(MiniAppRoot, {
        appId,
        playArea,
        manifest,
        messages: messages as Record<string, Record<string, string>>,
        setupFn,
      });
    },
  };

  // Create and mount the Vue app
  const app = createApp(RootApp);

  const container = document.querySelector(mountTo);
  if (container) {
    app.mount(container);
  } else {
    console.error(`[defineMiniApp] Mount target "${mountTo}" not found`);
  }

  return app;
}
