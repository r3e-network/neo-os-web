/**
 * createMiniApp — Unified factory for miniapp page initialization
 *
 * Eliminates the repeated boilerplate found in every miniapp's index.vue:
 *   - i18n setup (createUseI18n)
 *   - Template config (createTemplateConfig)
 *   - Sidebar items (createSidebarItems)
 *   - Error boundary handler (useHandleBoundaryError)
 *   - Status message (useStatusMessage)
 *
 * Each miniapp provides a declarative config; the factory returns
 * all the reactive refs and helpers the template needs.
 *
 * @example
 * ```ts
 * const {
 *   t, templateConfig, sidebarItems, sidebarTitle,
 *   status, setStatus, clearStatus,
 *   handleBoundaryError, fallbackMessage,
 * } = createMiniApp({
 *   name: "burn-league",
 *   messages,
 *   template: {
 *     tabs: [{ key: "game", labelKey: "game", icon: "🎮", default: true }],
 *     fireworks: true,
 *   },
 *   sidebarItems: [
 *     { labelKey: "totalBurned", value: () => totalBurned.value },
 *   ],
 * });
 * ```
 */

import type { MiniAppFactoryConfig } from "@shared/types/miniapp-config";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import type { ComputedRef } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { useStatusMessage, type StatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "./createTemplateConfig";
import { createSidebarItems } from "./createSidebarItems";

type SidebarValue = string | number | boolean | null | undefined;

export interface MiniAppFactoryResult {
  /** i18n translation function */
  t: (key: string, args?: Record<string, string | number>) => string;
  /** Resolved template config for MiniAppShell / MiniAppTemplate */
  templateConfig: MiniAppTemplateConfig;
  /** Reactive sidebar items array */
  sidebarItems: ComputedRef<Array<{ label: string; value: SidebarValue }>>;
  /** Translated sidebar title */
  sidebarTitle: string;
  /** Translated fallback message for ErrorBoundary */
  fallbackMessage: string;
  /** Reactive status message ref */
  status: ReturnType<typeof useStatusMessage>["status"];
  /** Set a status message with type */
  setStatus: (msg: string, type: StatusMessage["type"]) => void;
  /** Clear the current status message */
  clearStatus: () => void;
  /** Error boundary handler scoped to this miniapp */
  handleBoundaryError: (error: Error) => void;
}

export function createMiniApp(config: MiniAppFactoryConfig): MiniAppFactoryResult {
  // --- i18n ---
  const { t } = createUseI18n(config.messages as Record<string, Record<string, string>>)();

  // --- Template config ---
  const { tabs, contentType, fireworks, chainWarning, stats, twoColumn, docs, ...docOptions } = config.template;
  const templateConfig = createTemplateConfig({
    tabs,
    contentType,
    fireworks,
    chainWarning,
    stats,
    twoColumn,
    docs,
    ...docOptions,
  });

  // --- Sidebar ---
  const sidebarItems = createSidebarItems(t as (key: string) => string, config.sidebarItems ?? []);
  const sidebarTitleKey = config.sidebarTitleKey ?? "overview";
  const sidebarTitle = (t as (key: string) => string)(sidebarTitleKey);

  // --- Status message ---
  const { status, setStatus, clearStatus } = useStatusMessage(config.statusTimeoutMs);

  // --- Error boundary ---
  const { handleBoundaryError } = useHandleBoundaryError(config.name);
  const fallbackMessageKey = config.fallbackMessageKey ?? "errorFallback";
  const fallbackMessage = (t as (key: string) => string)(fallbackMessageKey);

  return {
    t: t as (key: string, args?: Record<string, string | number>) => string,
    templateConfig,
    sidebarItems,
    sidebarTitle,
    fallbackMessage,
    status,
    setStatus,
    clearStatus,
    handleBoundaryError,
  };
}
