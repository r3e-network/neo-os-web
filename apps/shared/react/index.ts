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
