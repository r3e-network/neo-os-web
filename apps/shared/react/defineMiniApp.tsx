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
 *   setup: async ({ services, framework }) => {
 *     const streak = createObservable(0);
 *     framework.actions.register("checkin", async () => { ... });
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
import type { MiniAppManifest, MiniAppPlatformBindings } from "../types/miniapp-manifest";
import type { TranslationMap } from "../utils/i18n";
import type { MiniAppFrameworkOptions } from "../../../framework";
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
export { createObservable, createDerived, createReadCell, refToObservable, refsToObservables } from "./context";
export type { ReadCell } from "./context";
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

  /** Optional i18n messages keyed by translation id */
  messages?: TranslationMap;

  /** Optional setup hook called after services are initialized */
  setup?: (
    ctx: MiniAppSetupContext,
  ) => MiniAppSetupResult | Promise<MiniAppSetupResult>;

  /** Optional mount target selector — defaults to "#app" */
  mountTo?: string;

  /**
   * Override for the framework `app.storage.local` key prefix (default
   * `neo:<appId>:`). Migration lane: apps whose legacy localStorage keys
   * lived in a different namespace pass their legacy prefix so existing
   * user data is not orphaned.
   */
  storagePrefix?: string;

  /**
   * app.oracle extension config (framework S13). Apps that read the Morpheus
   * DataFeed inject the network-specific deployed contract + RPC endpoint
   * here; absent ⇒ `app.oracle.dataFeed` reads throw a typed capability error.
   */
  oracle?: MiniAppFrameworkOptions["oracle"];

  /**
   * app.credits config (platform Credits v2). Hosts that expose the credits
   * ledger inject the credits-ledger endpoint URL + the network's deployed
   * MiniAppCredits contract hash here; absent ⇒ `app.credits.available` is
   * false and every app.credits method throws a typed capability error, so
   * credit UI degrades away cleanly in dev/standalone.
   */
  credits?: MiniAppFrameworkOptions["credits"];

  /**
   * app.registry config (Platform Contract Library v2 phase 2). Hosts on a
   * network with a deployed PlatformRegistry inject its contract hash here;
   * absent ⇒ `app.registry.available` is false and every app.registry chain call
   * throws a typed capability error, so registry-aware UI degrades away
   * cleanly on hosts without the directory.
   */
  registry?: MiniAppFrameworkOptions["registry"];

  /**
   * app.platformGame config (Platform Contract Library v2 phase 2). Hosts on
   * a network with a deployed PlatformGame (RewardGame engine) inject its
   * contract hash here; absent ⇒ `app.platformGame.available` is false and
   * every app.platformGame method throws a typed capability error, so
   * engine-aware UI degrades away cleanly on hosts without the engine.
   */
  platformGame?: MiniAppFrameworkOptions["platformGame"];
  platformSocial?: MiniAppFrameworkOptions["platformSocial"];
  platformAnchor?: MiniAppFrameworkOptions["platformAnchor"];
  platformDeFi?: MiniAppFrameworkOptions["platformDeFi"];
  platformVesting?: MiniAppFrameworkOptions["platformVesting"];
  platformEscrow?: MiniAppFrameworkOptions["platformEscrow"];
  platformFactory?: MiniAppFrameworkOptions["platformFactory"];
}

function configuredPlatformHash(
  manifest: MiniAppManifest,
  key: Exclude<keyof MiniAppPlatformBindings, "factory">,
): string {
  return String(manifest.platformBindings?.[key] ?? "").trim();
}

function legacySharedHash(manifest: MiniAppManifest, moduleIds: string[]): string {
  const binding = manifest.contract;
  const moduleId = String(binding?.moduleId ?? "").trim().toLowerCase();
  if (binding?.mode !== "shared" || !moduleIds.includes(moduleId)) return "";
  return String(binding.engine ?? "").trim();
}

export function platformRegistryConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["registry"] | undefined {
  const registryHash = configuredPlatformHash(manifest, "registry") ||
    legacySharedHash(manifest, ["platformregistry", "platform-registry"]);
  return registryHash ? { registryHash } : undefined;
}

export function platformGameConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformGame"] | undefined {
  const gameHash = configuredPlatformHash(manifest, "game") ||
    legacySharedHash(manifest, ["platform-game"]);
  return gameHash ? { gameHash } : undefined;
}

export function platformSocialConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformSocial"] | undefined {
  const socialHash = configuredPlatformHash(manifest, "social") ||
    legacySharedHash(manifest, ["platform-social"]);
  return socialHash ? { socialHash } : undefined;
}

export function platformAnchorConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformAnchor"] | undefined {
  const anchorHash = configuredPlatformHash(manifest, "anchor") ||
    legacySharedHash(manifest, ["platformanchor", "platform-anchor"]);
  return anchorHash ? { anchorHash } : undefined;
}

export function platformDeFiConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformDeFi"] | undefined {
  const defiHash = configuredPlatformHash(manifest, "defi") ||
    legacySharedHash(manifest, ["platformdefi", "platform-defi"]);
  return defiHash ? { defiHash } : undefined;
}

export function platformVestingConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformVesting"] | undefined {
  const vestingHash = configuredPlatformHash(manifest, "vesting") ||
    legacySharedHash(manifest, ["platformvesting", "platform-vesting"]);
  return vestingHash ? { vestingHash } : undefined;
}

export function platformEscrowConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformEscrow"] | undefined {
  const escrowHash = configuredPlatformHash(manifest, "escrow") ||
    legacySharedHash(manifest, ["platformescrow", "platform-escrow"]);
  return escrowHash ? { escrowHash } : undefined;
}

export function platformFactoryConfigFromManifest(
  manifest: MiniAppManifest,
): MiniAppFrameworkOptions["platformFactory"] | undefined {
  const hashes = Object.fromEntries(
    Object.entries(manifest.platformBindings?.factory ?? {})
      .map(([network, hash]) => [network, String(hash ?? "").trim()])
      .filter(([, hash]) => Boolean(hash)),
  ) as NonNullable<MiniAppFrameworkOptions["platformFactory"]>["hashes"];
  return Object.keys(hashes).length > 0 ? { hashes } : undefined;
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
    storagePrefix,
    oracle,
    credits,
    registry,
    platformGame,
    platformSocial,
    platformAnchor,
    platformDeFi,
    platformVesting,
    platformEscrow,
    platformFactory,
  } = definition;
  const resolvedRegistry = registry ?? platformRegistryConfigFromManifest(manifest);
  const resolvedPlatformGame = platformGame ?? platformGameConfigFromManifest(manifest);
  const resolvedPlatformSocial = platformSocial ?? platformSocialConfigFromManifest(manifest);
  const resolvedPlatformAnchor = platformAnchor ?? platformAnchorConfigFromManifest(manifest);
  const resolvedPlatformDeFi = platformDeFi ?? platformDeFiConfigFromManifest(manifest);
  const resolvedPlatformVesting = platformVesting ?? platformVestingConfigFromManifest(manifest);
  const resolvedPlatformEscrow = platformEscrow ?? platformEscrowConfigFromManifest(manifest);
  const resolvedPlatformFactory = platformFactory ?? platformFactoryConfigFromManifest(manifest);

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
        storagePrefix={storagePrefix}
        oracle={oracle}
        credits={credits}
        registry={resolvedRegistry}
        platformGame={resolvedPlatformGame}
        platformSocial={resolvedPlatformSocial}
        platformAnchor={resolvedPlatformAnchor}
        platformDeFi={resolvedPlatformDeFi}
        platformVesting={resolvedPlatformVesting}
        platformEscrow={resolvedPlatformEscrow}
        platformFactory={resolvedPlatformFactory}
      />
    </React.StrictMode>,
  );

  return root;
}
