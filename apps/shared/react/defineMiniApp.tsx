/**
 * defineMiniApp — React equivalent of the Vue defineMiniApp
 *
 * Simplified entry point for React-based miniapp initialization.
 * Creates a React root, wraps the PlayArea component inside MiniAppRoot,
 * and mounts to the specified DOM element.
 *
 * @example
 * ```tsx
 * import { defineMiniApp, createObservable } from "@shared/react";
 * import PlayArea from "./components/PlayArea";
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
 *   setup: async ({ services, registerAction }) => {
 *     const streak = createObservable(0);
 *     registerAction("checkin", async () => { ... });
 *     return {
 *       state: { currentStreak: streak },
 *       loadData: async () => { streak.set(await services.invoke(...)) },
 *     };
 *   },
 * });
 * ```
 */

import React from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { ComponentType } from "react";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import { MiniAppRoot } from "./MiniAppRoot";
import type {
  MiniAppSetupContext,
  MiniAppSetupResult,
  PlayAreaProps,
} from "./MiniAppRoot";

// Re-export shared types so consumers can import from one place
export type {
  MiniAppSetupContext,
  MiniAppSetupResult,
  PlayAreaProps,
} from "./MiniAppRoot";
export type { Observable, ObservableState, MiniAppContextValue } from "./context";
export { createObservable, createDerived, refToObservable, refsToObservables } from "./context";
export { manifestToTemplateConfig } from "../utils/manifestToTemplateConfig";

// ============================================================================
// Definition Type
// ============================================================================

/** The definition object passed to defineMiniApp() */
export interface MiniAppDefinition {
  /** Unique app identifier (e.g. "miniapp-daily-checkin") */
  appId: string;

  /** The play area component — the ONLY custom UI the miniapp provides */
  playArea: ComponentType<PlayAreaProps>;

  /** Declarative manifest driving all platform-rendered sections */
  manifest: MiniAppManifest;

  /** Optional i18n messages keyed by locale (e.g. { en: {...}, zh: {...} }) */
  messages?: Record<string, Record<string, string>>;

  /** Optional setup hook called after services are initialized */
  setup?: (
    ctx: MiniAppSetupContext,
  ) => MiniAppSetupResult | Promise<MiniAppSetupResult>;

  /** Optional mount target selector — defaults to "#app" */
  mountTo?: string;
}

/**
 * Create and mount a complete miniapp from a single definition object.
 *
 * This is the React equivalent of the Vue defineMiniApp(). It creates a
 * React root, renders MiniAppRoot (which provides contexts and manages
 * lifecycle), and places the miniapp's custom PlayArea component inside.
 *
 * @param definition - The miniapp definition
 * @returns The React root instance (call root.unmount() to tear down)
 */
export function defineMiniApp(definition: MiniAppDefinition): Root {
  const {
    appId,
    playArea,
    manifest,
    messages = {},
    setup: setupFn,
    mountTo = "#app",
  } = definition;

  const container = document.querySelector(mountTo);
  if (!container) {
    console.error(`[defineMiniApp] Mount target "${mountTo}" not found`);
    // Create a no-op root to maintain return type contract
    const fallback = document.createElement("div");
    return createRoot(fallback);
  }

  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <MiniAppRoot
        appId={appId}
        playArea={playArea}
        manifest={manifest}
        messages={messages}
        setupFn={setupFn}
      />
    </React.StrictMode>,
  );

  return root;
}
