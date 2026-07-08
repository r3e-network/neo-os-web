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
import type { StatusMessage, StatusType } from "../composables/useStatusMessage";
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
  runSingleFlight,
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
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GameHomePage } from "../components-react/GameHomePage";
import { createMiniAppFramework } from "../../../framework";
import type { FrameworkLaunchContext, MiniAppFramework } from "../../../framework";
import type { TranslationMap } from "../utils/i18n";
import {
  readMiniAppLaunchContext,
  type MiniAppLaunchContext,
} from "../utils/launch-params";

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
  launchContext: MiniAppLaunchContext;
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
  setupFn?: (
    ctx: MiniAppSetupContext,
  ) => MiniAppSetupResult | Promise<MiniAppSetupResult>;
  /**
   * Override for the framework `app.storage.local` key prefix (default
   * `neo:<appId>:`) — for apps whose legacy localStorage keys lived in a
   * different namespace, so migrating to app.storage.local does not orphan
   * existing user data.
   */
  storagePrefix?: string;
}

/** Context passed to the miniapp's setup function (React version) */
export interface MiniAppSetupContext {
  services: PlatformServices;
  os: PlatformServices["os"];
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  setStatus: (msg: string, type: StatusType) => void;
  clearStatus: () => void;
  launchContext: MiniAppLaunchContext;
  framework: MiniAppFramework;
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
  storagePrefix,
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
  const launchContext = useMemo(() => readMiniAppLaunchContext(appId), [appId]);
  const frameworkLaunchContext = useMemo<FrameworkLaunchContext>(
    () => ({
      ...launchContext,
      appId: launchContext.appId ?? appId,
    }),
    [appId, launchContext],
  );

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
  // Per-key set of actions currently executing. Shared by both dispatch entry
  // points (handleAction + dispatch) so the same operation cannot run twice
  // concurrently — a double click or a click racing a programmatic dispatch
  // collapses to a single in-flight run.
  const actionsInFlightRef = useRef(new Set<string>());
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

  const frameworkRef = useRef<MiniAppFramework | null>(null);
  if (frameworkRef.current === null) {
    frameworkRef.current = createMiniAppFramework({
      services,
      os: services.os,
      t: tFn,
      state: appStateRef.current,
      setStatus: setStatusWithFireworks,
      clearStatus,
      launchContext: frameworkLaunchContext,
      registerAction,
    }, { appId, storagePrefix });
  }
  const framework = frameworkRef.current;

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
      framework,
      registerAction,
    };
  }

  // Keep mutable fields up to date
  ctxRef.current.setStatus = setStatusWithFireworks;
  ctxRef.current.clearStatus = clearStatus;
  ctxRef.current.framework = framework;

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
            launchContext,
            framework,
            registerAction,
          };

          const result = await setupFn(setupCtx);

          if (result?.state) {
            for (const [key, value] of Object.entries(result.state)) {
              appStateRef.current[key] = value;
            }
            stateSubscriptionsRef.current.forEach((unsubscribe) =>
              unsubscribe(),
            );
            stateSubscriptionsRef.current = Object.values(
              appStateRef.current,
            ).map((observable) =>
              observable.subscribe(() =>
                setStateVersion((version) => version + 1),
              ),
            );
            setStateVersion((version) => version + 1);
          }

          loadDataFnRef.current = result?.loadData;
          if (loadDataFnRef.current) {
            services.lifecycle.onDataLoad(executeLoadData);
          }

          if (result?.cleanup) {
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
      await runSingleFlight(actionsInFlightRef.current, methodKey, async () => {
        try {
          await handler(formData);
        } catch (err) {
          console.error(`[${appId}] action "${methodKey}" error:`, err);
          setStatus(
            err instanceof Error ? err.message : "Action failed",
            "error",
          );
        }
      });
    },
    [appId, manifest.operations, setStatus],
  );

  // --------------------------------------------------------------------------
  // Dispatch
  // --------------------------------------------------------------------------

  const dispatch = useCallback(
    async (name: string, ...args: unknown[]): Promise<void> => {
      const handler = actionHandlersRef.current.get(name);
      if (!handler) return;
      // Single-flight by action name: a same-key dispatch that arrives while
      // one is still running is dropped (resolves with undefined) so a
      // double-submit cannot fire the handler twice. Shares the in-flight set
      // with handleAction so the button path and a programmatic dispatch of the
      // same op also cannot overlap.
      return runSingleFlight(actionsInFlightRef.current, name, async () => {
        try {
          // Preserve the public Promise<void> type while still returning handler
          // payloads at runtime for components that need success/failure semantics.
          return (await handler(...args)) as void;
        } catch (err) {
          // Kernel-level error convention (mirrors handleAction): every failed
          // dispatch surfaces as a status toast so apps that never wrap their
          // handlers are safe by default. The error then rethrows so PlayAreas
          // keep their existing catch blocks and post-success steps (form
          // resets, modal closes) stay gated on a resolved dispatch.
          console.error(`[${appId}] action "${name}" error:`, err);
          setStatus(
            err instanceof Error ? err.message : "Action failed",
            "error",
          );
          throw err;
        }
      }) as Promise<void>;
    },
    [appId, setStatus],
  );

  // --------------------------------------------------------------------------
  // Template Config & Sidebar (derived from manifest)
  // --------------------------------------------------------------------------

  const templateConfig = useMemo(
    () => manifestToTemplateConfig(manifest),
    [manifest],
  );

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
  const standaloneDappMode = isStandaloneDappLaunch(launchContext);
  const shouldShowGameHomePage = manifest.shell === "game";
  const oneGateDirectPlay = launchContext.source.trim().toLowerCase() === "onegate";

  const handleBoundaryError = useCallback(
    (error: Error) => {
      console.error(`[${appId}] boundary error:`, error);
    },
    [appId],
  );

  const fallbackMessage = tFn("errorFallback");
  // Wrap the app's PlayArea in a real React error boundary so a render-time
  // throw degrades to a retryable fallback instead of white-screening the whole
  // shell. This single wrapper covers both the standalone and shell render
  // paths below (MiniAppPage's own try/catch around `children` cannot catch
  // render errors). getDerivedStateFromError handles the actual catch.
  const playArea = (
    <ErrorBoundary
      t={tFn as (key: string) => string}
      fallback={fallbackMessage}
      onError={handleBoundaryError}
      onRetry={reloadData}
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
        launchContext={launchContext}
      />
    </ErrorBoundary>
  );
  const gameSurface = shouldShowGameHomePage ? (
    <GameHomePageWrapper
      manifest={manifest}
      appState={appStateRef.current}
      t={tFn}
      stateVersion={stateVersion}
      skipLaunchPage={oneGateDirectPlay}
    >
      {playArea}
    </GameHomePageWrapper>
  ) : (
    playArea
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <MiniAppContext.Provider value={ctxRef.current}>
      <MiniAppManifestContext.Provider value={manifest}>
        <MiniAppActionsContext.Provider value={actionHandlersRef.current}>
          <MiniAppStateContext.Provider value={appStateRef.current}>
            {standaloneDappMode ? (
              <StandaloneDappSurface
                status={status}
                fireworksActive={fireworksActive}
              >
                {gameSurface}
              </StandaloneDappSurface>
            ) : (
              <StandardAppShell>
                <MiniAppPage
                  name={appId}
                  config={templateConfig}
                  state={
                    appStateRef.current as unknown as Record<string, unknown>
                  }
                  t={tFn as (key: string) => string}
                  statusMessage={status}
                  fireworksActive={fireworksActive}
                  sidebarItems={sidebarItems}
                  sidebarTitle={sidebarTitle}
                  fallbackMessage={fallbackMessage}
                  onBoundaryError={handleBoundaryError}
                  onBoundaryRetry={reloadData}
                  focusMode
                  renderOperation={
                    hasOperations
                      ? () => (
                          <MiniAppOperationPanel
                            operations={manifest.operations ?? []}
                            t={tFn}
                            state={appStateRef.current}
                            onAction={handleAction}
                            launchContext={launchContext}
                          />
                        )
                      : undefined
                  }
                >
                  {gameSurface}
                </MiniAppPage>
              </StandardAppShell>
            )}
          </MiniAppStateContext.Provider>
        </MiniAppActionsContext.Provider>
      </MiniAppManifestContext.Provider>
    </MiniAppContext.Provider>
  );
}

function StandaloneDappSurface({
  status,
  fireworksActive,
  children,
}: {
  status: StatusMessage | null;
  fireworksActive: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) {
      return undefined;
    }

    let animationFrame = 0;
    const postHeight = () => {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const contentHeight = Array.from(root.children).reduce((max, child) => {
        if (!(child instanceof HTMLElement) || child.tagName === "STYLE") {
          return max;
        }
        const rect = child.getBoundingClientRect();
        return Math.max(max, rect.bottom - rootRect.top);
      }, 0);
      const height = Math.ceil(contentHeight || rootRect.height);
      if (!Number.isFinite(height) || height <= 0) return;
      window.parent.postMessage(
        {
          type: "neo-miniapp:resize",
          height,
        },
        "*",
      );
    };
    const schedulePostHeight = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        postHeight();
      });
    };

    schedulePostHeight();
    const root = rootRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && root
        ? new ResizeObserver(schedulePostHeight)
        : null;
    if (root && resizeObserver) {
      resizeObserver.observe(root);
    }
    window.addEventListener("load", schedulePostHeight);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("load", schedulePostHeight);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`standalone-dapp-root${fireworksActive ? " standalone-dapp-root--celebrating" : ""}`}
      data-testid="standalone-dapp-root"
      style={{
        minHeight: "100vh",
        background: "var(--sd-canvas, #FAF9F7)",
        color: "var(--sd-ink, #1A1A19)",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {/* Neo v4 Design Language reset — cascades inside every embedded dApp iframe.
          Uses warm canvas (#FAF9F7) instead of pure white. See docs/DESIGN_LANGUAGE.md.
          Per-dApp SCSS still wins via specificity when needed. */}
      <style>{`
        /* ── v4 Design Tokens ─────────────────────────── */
        .standalone-dapp-root {
          --sd-canvas: #FAF9F7;
          --sd-canvas-alt: #F4F2EF;
          --sd-surface: #FFFFFF;
          --sd-surface-hover: #F1EFEC;
          --sd-border: #E8E6E1;
          --sd-border-strong: #D4D0C9;
          --sd-ink: #1A1A19;
          --sd-ink-secondary: #5C5A56;
          --sd-ink-tertiary: #8B8984;
          --sd-brand: #16C784;
          --sd-brand-hover: #0EA371;
          --sd-brand-light: #E8F8F1;
          --sd-success: #22C55E;
          --sd-warning: #F59E0B;
          --sd-error: #EF4444;
          --sd-radius-sm: 8px;
          --sd-radius-md: 12px;
          --sd-radius-lg: 16px;
          --sd-radius-full: 9999px;
          --sd-shadow-card: 0 1px 3px rgba(0,0,0,0.04);
          --sd-shadow-card-hover: 0 4px 12px rgba(0,0,0,0.06);
          --sd-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          --sd-dur-fast: 150ms;
          line-height: 1.55;
        }
        .standalone-dapp-root,
        .standalone-dapp-root body {
          background: var(--sd-canvas) !important;
          color: var(--sd-ink) !important;
        }
        .standalone-dapp-root .play-area,
        .standalone-dapp-root [class*="-play-area"],
        .standalone-dapp-root main,
        .standalone-dapp-root .checkin-stat-item,
        .standalone-dapp-root .NeoCard,
        .standalone-dapp-root .neo-card {
          background-color: var(--sd-surface) !important;
          color: var(--sd-ink);
        }
        /* Neutralize common dark surface patterns inside dApps. */
        .standalone-dapp-root [class*="-bg-slate"],
        .standalone-dapp-root [class*="-bg-zinc"],
        .standalone-dapp-root [class*="-bg-gray-9"],
        .standalone-dapp-root [class*="-bg-gray-8"],
        .standalone-dapp-root [class*="-bg-gray-7"],
        .standalone-dapp-root [style*="background: #0"],
        .standalone-dapp-root [style*="background: #1"],
        .standalone-dapp-root [style*="background-color: #0"],
        .standalone-dapp-root [style*="background-color: #1"] {
          color: inherit;
        }
        /* Light cards for any element using common card class names. */
        .standalone-dapp-root [class*="card-"]:not([class*="dark"]):not([class*="brand"]) {
          background: var(--sd-surface) !important;
          border: 1px solid var(--sd-border);
          border-radius: var(--sd-radius-md);
          box-shadow: var(--sd-shadow-card);
          color: var(--sd-ink);
        }
        /* Headings. */
        .standalone-dapp-root h1,
        .standalone-dapp-root h2,
        .standalone-dapp-root h3,
        .standalone-dapp-root h4,
        .standalone-dapp-root h5 {
          color: var(--sd-ink);
        }
        /* Body text default. */
        .standalone-dapp-root p,
        .standalone-dapp-root span:not([class*="badge"]):not([class*="pill"]):not([class*="chip"]),
        .standalone-dapp-root li,
        .standalone-dapp-root td,
        .standalone-dapp-root th {
          color: inherit;
        }
        /* ── Status Toast v4 ──────────────────────────── */
        .standalone-dapp-root .status-toast {
          position: fixed;
          top: auto;
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: max-content;
          max-width: min(calc(100vw - 32px), 520px);
          padding: 11px 14px;
          border-radius: 12px;
          background: var(--sd-surface) !important;
          color: var(--sd-ink) !important;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.4;
          text-align: left;
          white-space: normal;
          opacity: 1 !important;
          pointer-events: none;
          border: 1px solid var(--sd-border-strong);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
          animation: standalone-toast-enter 200ms var(--sd-ease-out) both !important;
        }
        .standalone-dapp-root .status-toast > span:last-child {
          color: inherit !important;
        }
        .standalone-dapp-root .status-toast .toast-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--sd-brand);
        }
        .standalone-dapp-root .status-toast.success {
          background: var(--sd-brand-light) !important;
          color: #065f46 !important;
          border-color: #bbf7d0;
        }
        .standalone-dapp-root .status-toast.warning {
          background: #fffbeb !important;
          color: #92400e !important;
          border-color: #fde68a;
        }
        .standalone-dapp-root .status-toast.info {
          background: #eff6ff !important;
          color: #1e40af !important;
          border-color: #bfdbfe;
        }
        .standalone-dapp-root .status-toast.error,
        .standalone-dapp-root .status-toast.danger {
          background: #fef2f2 !important;
          color: #991b1b !important;
          border-color: #fecaca;
        }
        .standalone-dapp-root .status-toast.error .toast-dot,
        .standalone-dapp-root .status-toast.danger .toast-dot {
          background: var(--sd-error);
        }
        @keyframes standalone-toast-enter {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(8px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        /* Scrollbar — warm style. */
        .standalone-dapp-root ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .standalone-dapp-root ::-webkit-scrollbar-thumb {
          background: var(--sd-border-strong);
          border-radius: 999px;
        }
        .standalone-dapp-root ::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      {status && (
        <div
          className={`status-toast ${status.type}`}
          role={status.type === "error" || status.type === "danger" ? "alert" : "status"}
        >
          <span className="toast-dot" />
          <span>{status.msg}</span>
        </div>
      )}
      {children}
    </div>
  );
}

const MINIAPP_PLATFORM_SOURCES = new Set([
  "platform",
  "miniapp",
  "miniapp-platform",
  "neomini",
  "yiwu",
  "yiwu-miniapp",
]);

function isStandaloneDappLaunch(launchContext: MiniAppLaunchContext): boolean {
  const source = launchContext.source.trim().toLowerCase();
  return !MINIAPP_PLATFORM_SOURCES.has(source);
}

function compactGameLaunchCopy(value: string, maxLength = 138): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const firstSentence = clean.match(/^.+?[.!?](\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 24 && firstSentence.length <= maxLength) {
    return firstSentence;
  }
  const truncated = clean.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const boundary = lastSpace > 72 ? lastSpace : maxLength;
  return `${clean.slice(0, boundary).trim()}...`;
}

// ============================================================================
// GameHomePageWrapper — auto-renders a focused launch page for game miniapps
// ============================================================================

/**
 * Wraps a game miniapp's PlayArea with a landing page when the game is idle.
 * The landing page is built from `gamePage` when provided, otherwise from
 * the manifest's name, description, and docs.
 * That keeps all shell="game" apps from falling back to a form-first screen.
 */
function GameHomePageWrapper({
  manifest,
  appState,
  t,
  stateVersion,
  skipLaunchPage = false,
  children,
}: {
  manifest: MiniAppManifest;
  appState: Record<string, Observable>;
  t: (key: string, params?: Record<string, string | number>) => string;
  stateVersion: number;
  skipLaunchPage?: boolean;
  children: React.ReactNode;
}) {
  const gamePage = manifest.gamePage;
  const [showGame, setShowGame] = useState(false);
  const _sv = stateVersion; // re-render when observables change

  // ── Auto-switch to game when gameStatus leaves idle ──
  const gameStatusObs = appState["gameStatus"];
  const gameStatus =
    typeof gameStatusObs?.get === "function"
      ? (gameStatusObs.get() as string | undefined)
      : undefined;

  useEffect(() => {
    if (!gameStatusObs || typeof gameStatusObs.subscribe !== "function") return;
    const unsub = gameStatusObs.subscribe(() => {
      const s = gameStatusObs.get() as string | undefined;
      if (s && s !== "idle") setShowGame(true);
    });
    return unsub;
  }, [gameStatusObs]);

  const translate = useCallback(
    (key: string | undefined, fallback = "") => {
      if (!key) return fallback;
      const value = t(key);
      return value && value !== key ? value : fallback;
    },
    [t],
  );

  // In OneGate the native wallet already owns the container and app listing.
  // Open directly into the dApp so users see the game itself, not host chrome.
  if (skipLaunchPage || showGame || (gameStatus && gameStatus !== "idle")) {
    return <>{children}</>;
  }

  const rulesDoc = manifest.docs?.find(
    (d) => d.type === "steps" || d.titleKey.toLowerCase().includes("rules") || d.titleKey.toLowerCase().includes("rule"),
  );
  const rulesPreview = rulesDoc
    ? { title: translate(rulesDoc.titleKey), content: translate(rulesDoc.contentKey) }
    : undefined;

  const heroTitle = gamePage
    ? translate(gamePage.heroTitleKey, manifest.name)
    : manifest.name;
  const heroDesc = compactGameLaunchCopy(
    gamePage
      ? translate(gamePage.heroDescKey, manifest.description ?? "")
      : manifest.description ?? "Play the game, connect your wallet, and submit verified results when the run is complete.",
  );
  const primaryLabel = gamePage
    ? translate(gamePage.primaryLabelKey, translate("startAction", "Start game"))
    : translate("startAction", "Start game");
  const features =
    gamePage?.features?.map((feature) => ({
      icon: feature.icon,
      title: translate(feature.titleKey),
      desc: compactGameLaunchCopy(translate(feature.descKey), 180),
      large: feature.large,
      gradient: feature.gradient,
    })) ?? [];
  const ctaTitle = gamePage?.ctaTitleKey
    ? translate(gamePage.ctaTitleKey)
    : "";
  const ctaDesc = gamePage?.ctaDescKey
    ? compactGameLaunchCopy(translate(gamePage.ctaDescKey), 160)
    : "";
  const ctaLabel = gamePage?.ctaLabelKey
    ? translate(gamePage.ctaLabelKey, primaryLabel)
    : gamePage
      ? primaryLabel
      : undefined;
  const heroTitleAccent = gamePage?.heroTitleAccent
    ? translate(gamePage.heroTitleAccent, gamePage.heroTitleAccent)
    : undefined;

  return (
    <GameHomePage
      appLogoUrl="./logo.webp"
      appBannerUrl="./banner.webp"
      appIcon={gamePage?.appIcon}
      appName={manifest.name}
      categoryColor={gamePage?.categoryColor ?? manifest.theme?.accentColor ?? "#10B981"}
      heroBadge={gamePage ? translate(gamePage.heroBadgeKey, translate("playTab", "Game")) : translate("playTab", "Game")}
      heroTitle={heroTitle}
      heroTitleAccent={heroTitleAccent}
      heroDesc={heroDesc}
      primaryLabel={primaryLabel}
      ghostLabel={
        gamePage?.ghostLabelKey
          ? translate(gamePage.ghostLabelKey, translate("rulesTitle", "How to play"))
          : rulesPreview
            ? translate("rulesTitle", "How to play")
            : undefined
      }
      onPrimaryClick={() => setShowGame(true)}
      onGhostClick={() => setShowGame(true)}
      stats={[]}
      featuresEyebrow={
        gamePage?.featuresEyebrowKey
          ? translate(gamePage.featuresEyebrowKey)
          : undefined
      }
      featuresTitle={
        gamePage?.featuresTitleKey
          ? translate(gamePage.featuresTitleKey)
          : undefined
      }
      features={features}
      lbEyebrow={
        gamePage?.lbEyebrowKey ? translate(gamePage.lbEyebrowKey) : undefined
      }
      lbTitle={
        gamePage?.lbTitleKey ? translate(gamePage.lbTitleKey) : translate("ranksTab", "Leaderboard")
      }
      leaderboard={[]}
      ctaTitle={ctaTitle}
      ctaDesc={ctaDesc}
      ctaLabel={ctaLabel}
      trustBadges={
        gamePage?.trustBadgeKeys?.map((key) => translate(key)).filter(Boolean) ??
        ["Neo N3", "Wallet signed", "Verified result"]
      }
      rulesPreview={rulesPreview}
    />
  );
}
