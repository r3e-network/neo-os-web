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

// MiniApp framework SDK compatibility re-export. New app code should normally
// consume the runtime-injected `ctx.framework` or import framework types from
// the root `@framework` package directly. The error classes below are
// identity-stable framework exports (plan §2): re-exporting the SAME class
// objects keeps `instanceof` checks true no matter which package an app
// imports them from.
export {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
  FrameworkPrepaidActionError,
  FrameworkSealError,
  PLATFORM_INVOKE_PERMISSIONS,
  revertKeyOf,
} from "../../../framework";
export type {
  MiniAppFramework,
  FrameworkAaSurface,
  FrameworkBadgeSurface,
  FrameworkBusSurface,
  FrameworkClipboardSurface,
  FrameworkDepositSettlement,
  FrameworkEventsSurface,
  FrameworkLifecycleSurface,
  FrameworkNotifyPolicy,
  FrameworkOracleExtensions,
  FrameworkPlatformInvokePermission,
  FrameworkPermissionsSurface,
  FrameworkPollOptions,
  FrameworkResourcesSurface,
  FrameworkRemoteStorageSurface,
  FrameworkShareOutcome,
  FrameworkShareSurface,
  FrameworkSuccessParams,
  FrameworkWalletBalanceHandle,
  FrameworkWalletSurface,
} from "../../../framework";

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
export { useNowMs } from "./hooks/useNowMs";
export type { UseNowMsOptions } from "./hooks/useNowMs";

// Re-export manifest types for convenience
export type {
  MiniAppManifest,
  MiniAppPlatformBindings,
} from "../types/miniapp-manifest";
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
