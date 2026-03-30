/**
 * MiniApp Context Types & Injection Keys
 *
 * Shared types used by defineMiniApp() and MiniAppRoot to communicate
 * via provide/inject. Extracted into a standalone module to avoid
 * circular dependencies between the factory and the root component.
 */

import type { InjectionKey, Ref } from "vue";
import type { MiniAppManifest } from "./miniapp-manifest";
import type { StatusType } from "../composables/useStatusMessage";
import type { PlatformServices } from "../services";
export type { PlatformServices } from "../services";
import type { OSServices } from "../services/os/types";

// ============================================================================
// Platform Services
// ============================================================================

/** Context passed to the miniapp's setup function */
export interface MiniAppContext {
  /** Platform services (chain, balance, transfer, oracle, AA, events, cache, notify, clipboard, fmt) */
  services: PlatformServices;
  /** OS system service proxies (storage, payment, game, badge, etc.) */
  os: OSServices;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Reactive state that the platform reads for stats/sidebar display */
  state: Record<string, Ref<unknown>>;
  /** Set a status message (toast) */
  setStatus: (msg: string, type: StatusType) => void;
  /** Clear the current status message */
  clearStatus: () => void;
  /** Register an action handler for operation panel buttons */
  registerAction: (
    key: string,
    handler: (...args: unknown[]) => Promise<void>,
  ) => void;
}

/** Result returned from the miniapp's setup function */
export interface MiniAppSetupResult {
  /** Reactive state bindings for stats/sidebar display */
  state?: Record<string, Ref<unknown>>;
  /** Data loading function called on mount */
  loadData?: () => Promise<void>;
  /** Cleanup function called on unmount */
  cleanup?: () => void;
}

// ============================================================================
// Injection Keys
// ============================================================================

/** Provides the full MiniAppContext to child components */
export const MINIAPP_CONTEXT_KEY: InjectionKey<MiniAppContext> =
  Symbol("miniapp-context");

/** Provides the manifest for reading in child components */
export const MINIAPP_MANIFEST_KEY: InjectionKey<MiniAppManifest> =
  Symbol("miniapp-manifest");

/** Provides the action handler registry */
export const MINIAPP_ACTIONS_KEY: InjectionKey<
  Map<string, (...args: unknown[]) => Promise<void>>
> = Symbol("miniapp-actions");

/** Provides the reactive state store */
export const MINIAPP_STATE_KEY: InjectionKey<Record<string, Ref<unknown>>> =
  Symbol("miniapp-state");
