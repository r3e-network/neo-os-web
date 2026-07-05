/**
 * React MiniApp Runtime — barrel export
 *
 * Provides the complete React equivalent of the Vue miniapp runtime.
 * Import everything from this single entry point.
 *
 * @example
 * ```tsx
 * import {
 *   defineMiniApp,
 *   createObservable,
 *   useStateBindings,
 *   useI18n,
 * } from "@shared/react";
 * ```
 */

// Core entry point
export { defineMiniApp } from "./defineMiniApp";
export type { MiniAppDefinition } from "./defineMiniApp";

// MiniApp framework SDK — the business layer surfaced to apps as `ctx.framework`.
// Re-exported here so app composables can type against it via the same
// `@shared/react` entry point they already use (no per-app path alias needed).
export { createMiniAppFramework } from "../../../framework";
export type { MiniAppFramework } from "../../../framework";

// Root component (internal, but exported for testing/advanced use)
export { MiniAppRoot } from "./MiniAppRoot";
export type {
  MiniAppSetupContext,
  MiniAppSetupResult,
  PlayAreaProps,
} from "./MiniAppRoot";

// Contexts
export {
  MiniAppContext,
  MiniAppManifestContext,
  MiniAppActionsContext,
  MiniAppStateContext,
  createObservable,
  refToObservable,
  refsToObservables,
} from "./context";
export type {
  MiniAppContextValue,
  Observable,
  ObservableState,
} from "./context";

// Hooks
export { createUseI18n, useI18n } from "./hooks/useI18n";
export { useT } from "./hooks/useT";
export type { TFunction } from "./hooks/useT";
export { useStatusMessage } from "./hooks/useStatusMessage";
export type { StatusType, StatusMessage } from "./hooks/useStatusMessage";
export { useStateBindings, useObservable } from "./hooks/useStateBindings";

// Re-export manifest types for convenience
export type { MiniAppManifest } from "../types/miniapp-manifest";
export { manifestToTemplateConfig } from "../utils/manifestToTemplateConfig";
export {
  getLaunchParam,
  parseMiniAppLaunchContext,
  readMiniAppLaunchContext,
} from "../utils/launch-params";
export type {
  MiniAppLaunchContext,
  MiniAppLaunchNetwork,
} from "../utils/launch-params";
