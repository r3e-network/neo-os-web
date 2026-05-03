/**
 * MiniAppRoot — React equivalent of MiniAppRoot.vue
 *
 * Internal root component created by defineMiniApp(). Bridges the simplified
 * API with the platform's rendering infrastructure.
 *
 * Responsibilities:
 * - Creates PlatformServices and wires i18n
 * - Runs the miniapp's setup function and merges returned state
 * - Provides context values to child components via React Context
 * - Renders the PlayArea component with standard props
 * - Manages action handlers, status messages, and fireworks
 * - Handles lifecycle (mount, data loading, cleanup)
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import type { ComponentType } from "react";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import type { StatusType } from "../composables/useStatusMessage";
import { PlatformServices, EventBus, NOTIFICATION_EVENT } from "../services";
import type { Notification } from "../services";
import { createUseI18n } from "./hooks/useI18n";
import { useStatusMessage } from "./hooks/useStatusMessage";
import {
  MiniAppContext,
  MiniAppManifestContext,
  MiniAppActionsContext,
  MiniAppStateContext,
  createObservable,
} from "./context";
import type {
  MiniAppContextValue,
  ObservableState,
  Observable,
} from "./context";
import { manifestToTemplateConfig } from "../utils/manifestToTemplateConfig";
import { StandardAppShell } from "../templates/StandardAppShell";
import { MiniAppPage } from "../components/MiniAppPage";
import { MiniAppOperationPanel } from "../components/MiniAppOperationPanel";
import type { TranslationMap } from "../utils/i18n";

// ============================================================================
// Props
// ============================================================================

/** Props for the PlayArea component provided by the miniapp */
export interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  services: PlatformServices;
  status: { msg: string; type: StatusType } | null;
  setStatus: (msg: string, type: StatusType) => void;
  clearStatus: () => void;
  loadError: Error | null;
  retryLoad: () => Promise<void>;
}

interface MiniAppRootProps {
  /** Unique miniapp identifier */
  appId: string;
  /** The play area component — custom UI provided by the miniapp */
  playArea: ComponentType<PlayAreaProps>;
  /** Declarative manifest driving platform-rendered sections */
  manifest: MiniAppManifest;
  /** i18n messages keyed by locale */
  messages: TranslationMap;
  /** Optional setup function from the miniapp definition */
  setupFn?: (ctx: MiniAppSetupContext) => MiniAppSetupResult | Promise<MiniAppSetupResult>;
}

/** Context passed to the miniapp's setup function (React version) */
export interface MiniAppSetupContext {
  services: PlatformServices;
  os: PlatformServices["os"];
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  setStatus: (msg: string, type: StatusType) => void;
  clearStatus: () => void;
  registerAction: (
    key: string,
    handler: (...args: unknown[]) => Promise<unknown>,
  ) => void;
}

/** Result returned from the miniapp's setup function */
export interface MiniAppSetupResult {
  /** Observable state bindings */
  state?: Record<string, Observable>;
  /** Data loading function called on mount */
  loadData?: () => Promise<void>;
  /** Cleanup function called on unmount */
  cleanup?: () => void;
}

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
    return isNaN(n)
      ? String(v ?? "")
      : `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} GAS`;
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
  return FORMAT_MAP[format ?? "text"] ?? FORMAT_MAP.text!;
}

// ============================================================================
// Component
// ============================================================================

export function MiniAppRoot({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setupFn,
}: MiniAppRootProps) {
  // --------------------------------------------------------------------------
  // i18n
  // --------------------------------------------------------------------------

  const { t } = createUseI18n(messages)();
  const tFn = t as (
    key: string,
    params?: Record<string, string | number>,
  ) => string;

  // --------------------------------------------------------------------------
  // Services (created once)
  // --------------------------------------------------------------------------

  const servicesRef = useRef<PlatformServices | null>(null);
  if (servicesRef.current === null) {
    servicesRef.current = PlatformServices.create(appId, { t: tFn });
  }
  const services = servicesRef.current;

  // --------------------------------------------------------------------------
  // Status & Fireworks
  // --------------------------------------------------------------------------

  const { status, setStatus, clearStatus } = useStatusMessage();
  const [fireworksActive, setFireworksActive] = useState(false);
  const fireworksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFireworks = useCallback(() => {
    if (fireworksTimerRef.current !== null)
      clearTimeout(fireworksTimerRef.current);
    setFireworksActive(true);
    fireworksTimerRef.current = setTimeout(() => {
      setFireworksActive(false);
      fireworksTimerRef.current = null;
    }, 3500);
  }, []);

  // Wrapped setStatus that triggers fireworks on success
  const setStatusWithFireworks = useCallback(
    (msg: string, type: StatusType) => {
      setStatus(msg, type);
      if (type === "success" && manifest.features?.fireworks) {
        triggerFireworks();
      }
    },
    [setStatus, manifest.features?.fireworks, triggerFireworks],
  );

  // --------------------------------------------------------------------------
  // Reactive State & Actions (created once, stable references)
  // --------------------------------------------------------------------------

  const appStateRef = useRef<ObservableState>({});
  const actionHandlersRef = useRef(
    new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  );
  const loadErrorRef = useRef(createObservable<Error | null>(null));
  const stateSubscriptionsRef = useRef<Array<() => void>>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [stateVersion, setStateVersion] = useState(0);

  // Sync loadError observable to React state
  useEffect(() => {
    return loadErrorRef.current.subscribe(() => {
      setLoadError(loadErrorRef.current.get());
    });
  }, []);

  const registerAction = useCallback(
    (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      actionHandlersRef.current.set(key, handler);
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Context
  // --------------------------------------------------------------------------

  const ctxRef = useRef<MiniAppContextValue | null>(null);
  if (ctxRef.current === null) {
    ctxRef.current = {
      services,
      os: services.os,
      t: tFn,
      state: appStateRef.current,
      setStatus: setStatusWithFireworks,
      clearStatus,
      registerAction,
    };
  }

  // Keep mutable fields up to date
  ctxRef.current.setStatus = setStatusWithFireworks;
  ctxRef.current.clearStatus = clearStatus;

  // --------------------------------------------------------------------------
  // Setup Hook Execution & Lifecycle
  // --------------------------------------------------------------------------

  const loadDataFnRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const setupRanRef = useRef(false);

  const executeLoadData = useCallback(async () => {
    if (!loadDataFnRef.current) return;
    try {
      loadErrorRef.current.set(null);
      await loadDataFnRef.current();
    } catch (err) {
      console.error(`[${appId}] loadData error:`, err);
      const error =
        err instanceof Error ? err : new Error("Failed to load data");
      loadErrorRef.current.set(error);
      setStatus(error.message, "error");
    }
  }, [appId, setStatus]);

  const reloadData = useCallback(async () => {
    if (!loadDataFnRef.current) return;
    loadErrorRef.current.set(null);
    clearStatus();
    await services.lifecycle.reloadData();
  }, [clearStatus, services]);

  useEffect(() => {
    if (setupRanRef.current) return;
    setupRanRef.current = true;

    let cleanupFn: (() => void) | undefined;

    const runSetup = async () => {
      // Subscribe to platform events
      const stopNotificationEvents = services.events.on(
        NOTIFICATION_EVENT,
        (payload) => {
          const notification = payload as Notification | null;
          if (!notification?.message) return;
          setStatus(notification.message, notification.type);
        },
      );

      const stopPlatformErrors = services.events.on(
        EventBus.ERROR,
        (payload) => {
          const errorPayload = payload as { error?: unknown } | null;
          const error = errorPayload?.error;
          if (error instanceof Error) {
            setStatus(error.message, "error");
            return;
          }
          if (typeof error === "string" && error.length > 0) {
            setStatus(error, "error");
          }
        },
      );

      services.lifecycle.registerCleanup(stopNotificationEvents);
      services.lifecycle.registerCleanup(stopPlatformErrors);

      // Run the miniapp's setup function
      if (setupFn) {
        try {
          const setupCtx: MiniAppSetupContext = {
            services,
            os: services.os,
            t: tFn,
            state: appStateRef.current,
            setStatus: setStatusWithFireworks,
            clearStatus,
            registerAction,
          };

          const result = await setupFn(setupCtx);

          if (result?.state) {
            for (const [key, value] of Object.entries(result.state)) {
              appStateRef.current[key] = value;
            }
            stateSubscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
            stateSubscriptionsRef.current = Object.values(appStateRef.current).map((observable) =>
              observable.subscribe(() => setStateVersion((version) => version + 1)),
            );
            setStateVersion((version) => version + 1);
          }

          loadDataFnRef.current = result?.loadData;
          if (loadDataFnRef.current) {
            services.lifecycle.onDataLoad(executeLoadData);
          }

          if (result?.cleanup) {
            cleanupFn = result.cleanup;
            services.lifecycle.registerCleanup(result.cleanup);
          }
        } catch (err) {
          console.error(`[${appId}] setup error:`, err);
          setStatus(
            err instanceof Error ? err.message : "Setup failed",
            "error",
          );
        }
      }

      // Mount the lifecycle
      await services.lifecycle.mount();
    };

    void runSetup();

    return () => {
      if (fireworksTimerRef.current !== null) {
        clearTimeout(fireworksTimerRef.current);
      }
      stateSubscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      stateSubscriptionsRef.current = [];
      services.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // Action Handling
  // --------------------------------------------------------------------------

  const handleAction = useCallback(
    async (operationKey: string, formData: Record<string, unknown>) => {
      const op = manifest.operations?.find((o) => o.key === operationKey);
      const methodKey = op?.actionMethod ?? operationKey;
      const handler = actionHandlersRef.current.get(methodKey);
      if (!handler) {
        console.warn(
          `[${appId}] No action handler registered for "${methodKey}"`,
        );
        return;
      }
      try {
        await handler(formData);
      } catch (err) {
        console.error(`[${appId}] action "${methodKey}" error:`, err);
        setStatus(
          err instanceof Error ? err.message : "Action failed",
          "error",
        );
      }
    },
    [appId, manifest.operations, setStatus],
  );

  // --------------------------------------------------------------------------
  // Dispatch
  // --------------------------------------------------------------------------

  const dispatch = useCallback(
    async (name: string, ...args: unknown[]) => {
      const handler = actionHandlersRef.current.get(name);
      if (handler) await handler(...args);
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Template Config & Sidebar (derived from manifest)
  // --------------------------------------------------------------------------

  const templateConfig = useMemo(() => manifestToTemplateConfig(manifest), [manifest]);

  const sidebarDefs = manifest.sidebar?.items ?? [];
  const sidebarItems = useMemo(() => {
    return sidebarDefs.map((item) => ({
      label: tFn(item.labelKey),
      value: (() => {
        const obs = appStateRef.current[item.valueKey];
        if (!obs) return null;
        const raw = obs.get();
        return getFormatter(item.format)(raw);
      })() as string | number | boolean | null | undefined,
    }));
    // Re-derive when status changes (proxy for state updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarDefs, tFn, status, stateVersion]);

  const sidebarTitle = tFn(manifest.sidebar?.titleKey ?? "overview");
  const hasOperations = (manifest.operations?.length ?? 0) > 0;

  const handleBoundaryError = useCallback(
    (error: Error) => {
      console.error(`[${appId}] boundary error:`, error);
    },
    [appId],
  );

  const fallbackMessage = tFn("errorFallback");

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <MiniAppContext.Provider value={ctxRef.current}>
      <MiniAppManifestContext.Provider value={manifest}>
        <MiniAppActionsContext.Provider value={actionHandlersRef.current}>
          <MiniAppStateContext.Provider value={appStateRef.current}>
            <StandardAppShell>
              <MiniAppPage
                name={appId}
                config={templateConfig}
                state={appStateRef.current as unknown as Record<string, unknown>}
                t={tFn as (key: string) => string}
                statusMessage={status}
                fireworksActive={fireworksActive}
                sidebarItems={sidebarItems}
                sidebarTitle={sidebarTitle}
                fallbackMessage={fallbackMessage}
                onBoundaryError={handleBoundaryError}
                onBoundaryRetry={reloadData}
                renderOperation={
                  hasOperations
                    ? () => (
                        <MiniAppOperationPanel
                          operations={manifest.operations ?? []}
                          t={tFn}
                          state={appStateRef.current}
                          onAction={handleAction}
                        />
                      )
                    : undefined
                }
              >
                <PlayArea
                  t={tFn}
                  state={appStateRef.current}
                  dispatch={dispatch}
                  services={services}
                  status={status}
                  setStatus={setStatusWithFireworks}
                  clearStatus={clearStatus}
                  loadError={loadError}
                  retryLoad={reloadData}
                />
              </MiniAppPage>
            </StandardAppShell>
          </MiniAppStateContext.Provider>
        </MiniAppActionsContext.Provider>
      </MiniAppManifestContext.Provider>
    </MiniAppContext.Provider>
  );
}
