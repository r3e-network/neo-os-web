/**
 * ThreeGameComponent — React component that hosts a Three.js WebGL game.
 *
 * This is the Three.js analogue of `PhaserGameComponent`. It reuses the SAME
 * framework GameBridge (which is engine-agnostic despite the file name) so the
 * React/framework shell talks to a Three.js scene through the identical
 * contract used by Phaser games:
 *
 *   - On mount we inject `window.__phaserBridge = bridge`.
 *   - `bridge.setDispatch(dispatch)` wires React actions → scene.
 *   - Whenever the React `state` snapshot changes we call `bridge.sendState`.
 *   - The scene reads state via `bridge.getState()` / `bridge.on("state")`
 *     and emits actions via `bridge.dispatch(...)`.
 *
 * The Three scene is supplied by the caller (e.g. `ZhuaDaScene`); this
 * component owns only the canvas host, the render lifecycle, mobile sizing,
 * and bridge plumbing. The scene drives its own requestAnimationFrame loop.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GameBridge } from "@framework/phaser/GameBridge";
import type { DispatchFn, GameState } from "@framework/phaser/types";
import { themeItem, themeOf } from "./logic/themes";
import { publicAssetUrl } from "./logic/public-asset-url";
import { ThemeItemChip } from "./ThemeItemChip";

export interface ThreeGameProps {
  /** A ready-to-use Three.js scene controller (owns renderer + loop). */
  scene: ThreeSceneController;
  /** Current app state pushed into the running scene whenever it changes. */
  state?: GameState;
  /** Dispatch function forwarded to the scene. */
  dispatch: DispatchFn;
  /** Optional extra CSS class for the container div. */
  className?: string;
  /** Accessible name for the canvas host. */
  ariaLabel?: string;
  /** Text shown while the scene boots. */
  loadingLabel?: string;
  /** Text shown when boot or a bridge action fails. */
  errorLabel?: string;
  /** Recovery copy shown when the browser loses the WebGL context. */
  contextLostLabel?: string;
  retryLabel?: string;
  continueLabel?: string;
  /** Called when the scene reports that it is ready. */
  onReady?: () => void;
}

/** Implemented by the Three.js scene (e.g. ZhuaDaScene). */
export interface ThreeSceneController {
  /** Attach to a host DOM element and start the render loop. */
  mount(host: HTMLElement, bridge: GameBridge): void;
  /** Push a fresh state snapshot from React. */
  setState?(state: GameState): void;
  /** Host size changed — update renderer size + camera aspect. */
  resize?(width: number, height: number): void;
  /** Keyboard equivalent of tapping the highest currently available item. */
  activatePrimary?(): void;
  /** Stop physics/render work after an unrecoverable GPU interruption. */
  pause?(): void;
  /** Resume physics/render work after leaving a compatibility fallback. */
  resume?(): void;
  /** Tear down renderer + listeners. */
  unmount(): void;
}

const MOBILE_VIEWPORT_WIDTH = 760;
const COARSE_POINTER_VIEWPORT_WIDTH = 1024;
const MIN_MOBILE_GAME_WIDTH = 280;
const MIN_MOBILE_GAME_HEIGHT = 280;
const MOBILE_FOOTER_SAFETY_PX = 8;
const ANDROID_CANVAS_SAMPLE_DELAY_MS = 1600;

interface FallbackItem {
  id: number;
  kind: number;
}

function isAndroidChromeRuntime(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /\bAndroid\b/i.test(ua) && /\b(?:Chrome|Chromium)\//i.test(ua);
}

function forcesAndroidSimulatorFallback(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("simQa") === "1" && params.get("androidFallback") === "1";
}

function canvasLooksBlank(canvas: HTMLCanvasElement): boolean {
  // Only the scene's direct post-render framebuffer probe is a trustworthy
  // positive signal. Android Emulator can expose fully populated WebGL pixels
  // to drawImage while Chrome's compositor still presents a transparent
  // surface; accepting that offscreen copy left the player staring at an
  // empty table forever. Healthy Android renderers mark the canvas from
  // ZhuaDaScene immediately after a visible submitted frame.
  return canvas.dataset.gooseSoftwareRenderer === "true"
    || canvas.dataset.gooseFrameReady !== "true";
}

function fallbackItemStyle(
  item: FallbackItem,
  index: number,
  total: number,
  themeId: string,
): CSSProperties {
  const ring = index / Math.max(1, total);
  const angle = (item.id * 137.508 + item.kind * 23 + index * 11) * (Math.PI / 180);
  const radius = 8 + (item.id * 17 + item.kind * 9 + index * 5) % 33;
  const x = 50 + Math.cos(angle) * radius;
  const y = 51 + Math.sin(angle) * radius * 0.82 + (ring - 0.5) * 8;
  const rotate = ((item.id * 29 + item.kind * 17) % 70) - 35;
  const sizeBand = themeItem(themeId, item.kind).sizeBand;
  const sizeScale = sizeBand === "large" ? 1.2 : sizeBand === "small" ? 0.76 : 0.98;
  const scale = (0.86 + ((item.id + item.kind + index) % 5) * 0.025) * sizeScale;
  return {
    left: `${Math.max(12, Math.min(88, x))}%`,
    top: `${Math.max(15, Math.min(84, y))}%`,
    transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
    zIndex: 20 + index,
  };
}

function AndroidCanvasFallback({
  state,
  dispatch,
}: {
  state?: GameState;
  dispatch: DispatchFn;
}) {
  const themeId = String(state?.themeId ?? "fresh-market");
  const safeThemeId = themeOf(themeId).id;
  const shakeNonce = Number(state?.shakeNonce ?? 0) || 0;
  const rawItems = Array.isArray(state?.items) ? state.items : [];
  const items = rawItems
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => !!item)
    .map((item) => ({ id: Number(item.id), kind: Number(item.kind) }))
    .filter((item) => Number.isInteger(item.id) && Number.isInteger(item.kind))
    .slice(0, 54);

  return (
    <div className="goose-android-fallback" data-testid="android-canvas-fallback">
      <img
        className="goose-android-fallback__basket"
        src={publicAssetUrl(`./art/container-${safeThemeId}.webp`)}
        alt=""
        draggable={false}
      />
      <div
        key={`fallback-pile-${shakeNonce}`}
        className="goose-android-fallback__pile"
        data-shaking={shakeNonce > 0 ? "true" : undefined}
        aria-label="Android fallback item pile"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="goose-android-fallback__item"
            style={fallbackItemStyle(item, index, items.length, themeId)}
            aria-label={`Pick item ${item.kind + 1}`}
            onClick={() => { void dispatch("extract", { itemId: item.id }); }}
          >
            <ThemeItemChip themeId={safeThemeId} kind={item.kind} />
          </button>
        ))}
      </div>
    </div>
  );
}

function measuredStageFooterHeight(host: HTMLElement): number | null {
  const stage = host.closest(".goose-stage-shell");
  if (!stage) return null;
  const selectors = [
    ".goose-level-progress",
    ".goose-tray-row",
    ".goose-powerbar",
  ];
  let measured = 0;
  for (const selector of selectors) {
    const node = stage.querySelector(selector);
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    measured += rect.height;
  }
  return measured > 0 ? measured + MOBILE_FOOTER_SAFETY_PX : null;
}

export function ThreeGameComponent({
  scene,
  state,
  dispatch,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  errorLabel = "Game action failed",
  contextLostLabel = "Graphics were interrupted. Retry to restore the game.",
  retryLabel = "Retry",
  continueLabel = "Continue",
  onReady,
}: ThreeGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<GameBridge>(new GameBridge());
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ message: string; mode: "dismiss" | "retry" } | null>(null);
  const [autoSize, setAutoSize] = useState<{ width: number; height: number } | null>(null);
  const [androidCanvasFallback, setAndroidCanvasFallback] = useState(false);
  const fallbackSizeRef = useRef({ width: 400, height: 520 });
  // True only after scene.mount() succeeded — state pushes into a
  // half-initialized scene (e.g. WebGL unavailable) would crash it.
  const mountedOkRef = useRef(false);

  // Keep latest onReady without re-running the boot effect.
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Boot once on mount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const bridge = bridgeRef.current;
    setReady(false);
    setError(null);
    mount.replaceChildren();

    bridge.setDispatch(dispatch);

    const unsubReady = bridge.on("ready", () => {
      setReady(true);
      onReadyRef.current?.();
    });
    const unsubError = bridge.on("error", (ev) => {
      setError({ message: ev.message || errorLabel, mode: "dismiss" });
    });

    // Inject bridge so the Three scene picks it up synchronously on mount.
    window.__phaserBridge = bridge;

    // Hand control to the scene. It owns the WebGLRenderer + rAF loop.
    //
    // The explicit Android simulator fallback is a development-only QA lane
    // for emulator images whose Chromium GPU process is unstable. Mounting a
    // WebGLRenderer behind that DOM fallback can still crash/restart the GPU
    // process and take the visible compatibility board down with it. In that
    // one opt-in lane, keep the real game rules/dispatch/state flow but do not
    // create a WebGL context at all.
    const skipSceneBoot = forcesAndroidSimulatorFallback() && isAndroidChromeRuntime();
    mountedOkRef.current = false;
    if (skipSceneBoot) {
      setReady(true);
      onReadyRef.current?.();
    } else {
      try {
        scene.mount(mount, bridge);
        mountedOkRef.current = true;
      } catch (err) {
        setError({
          message: err instanceof Error && err.message ? err.message : errorLabel,
          mode: "retry",
        });
      }
    }

    // Keep renderer size + camera aspect in sync with the host box (mobile
    // auto-size changes, orientation flips, window resizes).
    let sceneResizeObserver: ResizeObserver | null = null;
    if (mountedOkRef.current && scene.resize && typeof ResizeObserver !== "undefined") {
      let lastW = mount.clientWidth;
      let lastH = mount.clientHeight;
      sceneResizeObserver = new ResizeObserver(() => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w <= 0 || h <= 0 || (w === lastW && h === lastH)) return;
        lastW = w;
        lastH = h;
        scene.resize?.(w, h);
      });
      sceneResizeObserver.observe(mount);
    }

    // Mobile browsers may reclaim the GPU context after memory pressure or a
    // long background pause. Prevent a permanent blank canvas and surface an
    // explicit recovery action instead of leaving the player trapped.
    const rendererCanvas = mountedOkRef.current ? mount.querySelector("canvas") : null;
    const onContextLost = (event: Event): void => {
      event.preventDefault();
      mountedOkRef.current = false;
      scene.pause?.();
      setReady(false);
      setError({ message: contextLostLabel, mode: "retry" });
      if (
        import.meta.env.VITE_DEVICE_QA === "1"
        && new URLSearchParams(window.location.search).get("deviceQa") === "1"
      ) {
        window.dispatchEvent(new CustomEvent("zhuada-e:device-qa-context-loss", {
          detail: { at: Date.now() },
        }));
      }
    };
    rendererCanvas?.addEventListener("webglcontextlost", onContextLost);

    return () => {
      sceneResizeObserver?.disconnect();
      rendererCanvas?.removeEventListener("webglcontextlost", onContextLost);
      unsubReady();
      unsubError();
      if (!skipSceneBoot) scene.unmount();
      bridge.destroy();
      mount.replaceChildren();
      if (window.__phaserBridge === bridge) {
        delete window.__phaserBridge;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Keep dispatch hot in the bridge across re-renders.
  useEffect(() => {
    bridgeRef.current.setDispatch(dispatch);
  }, [dispatch]);

  // Push state updates into the running scene. Short-circuit when mount
  // failed (e.g. no WebGL): pushing into a half-initialized scene crashes it,
  // replacing the graceful error UI with the global boundary.
  useEffect(() => {
    if (!state || !mountedOkRef.current) return;
    // The scene subscribes to the bridge's state event. Calling setState too
    // would reconcile every snapshot twice and duplicate flights/disposals.
    bridgeRef.current.sendState(state);
  }, [state, scene]);

  // When a modal start / retry / next-level action hands control back to the
  // board, put keyboard focus on the board as soon as it is ready. This also
  // covers the first lazy mount after starting from the lobby.
  useEffect(() => {
    if (!ready || error || state?.gameStatus !== "dealt") return;
    const frame = window.requestAnimationFrame(() => {
      containerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [error, ready, state?.gameStatus]);

  useEffect(() => {
    if (!ready || error || state?.gameStatus !== "dealt" || !isAndroidChromeRuntime()) {
      setAndroidCanvasFallback(false);
      return;
    }
    // Some Android Emulator GPU backends can crash/restart Chromium's GPU
    // process while the normal Android UI remains healthy. This explicit,
    // development-only QA switch keeps that known host-driver limitation from
    // blocking interaction verification; production never reads or ships it.
    if (forcesAndroidSimulatorFallback()) {
      setAndroidCanvasFallback(true);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      const canvas = mountRef.current?.querySelector("canvas");
      if (!cancelled && canvas && canvasLooksBlank(canvas)) {
        setAndroidCanvasFallback(true);
      }
    }, ANDROID_CANVAS_SAMPLE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  // This is intentionally an initial-deal health check, not a per-pick
  // screenshot test. Android's compositor may return a transient transparent
  // readback while a perfectly healthy WebGL canvas is animating. Re-running
  // the heuristic for every `items` update can therefore replace the live 3D
  // board with the emergency DOM fallback in the middle of rapid play.
  // Context loss after boot is handled separately by `webglcontextlost`.
  }, [error, ready, state?.gameStatus]);

  // The DOM fallback is intentionally an emergency compatibility surface, not
  // a second renderer. Stop the hidden Three/Cannon loop while it is visible
  // so a blank Android GPU path cannot keep consuming battery or compounding a
  // compositor failure. Resume with a fresh clock delta if the board recovers.
  useEffect(() => {
    if (!mountedOkRef.current) return;
    if (androidCanvasFallback) {
      scene.pause?.();
    } else {
      scene.resume?.();
    }
  }, [androidCanvasFallback, scene]);

  // Mobile responsive sizing — match the Phaser component's behavior.
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const updateSize = () => {
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const isMobile = viewportWidth <= MOBILE_VIEWPORT_WIDTH ||
        (isCoarsePointer && viewportWidth <= COARSE_POINTER_VIEWPORT_WIDTH);

      if (!isMobile) {
        setAutoSize(null);
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const parentRect = host.parentElement?.getBoundingClientRect();
      const hostWidth = parentRect?.width || hostRect.width || window.innerWidth;
      const availableWidth = Math.round(Math.max(MIN_MOBILE_GAME_WIDTH, Math.min(hostWidth, viewportWidth)));
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const hostTop = Math.max(0, hostRect.top - viewportTop);
      // The HUD overlays the scene and the tray/tool deck is one compact
      // footer. Size the physical surface from the remaining viewport instead
      // of capping it to the desktop fallback aspect ratio; otherwise tall
      // phones end with a large, visually disconnected blank strip.
      // Keep a few pixels of safety for sub-pixel footer rounding so the
      // browser never introduces a vertical scrollbar that steals canvas
      // width on narrow phones.
      const bottomReserve = measuredStageFooterHeight(host) ?? (viewportHeight < 620 ? 134 : 136);
      const availableViewportHeight = Math.max(MIN_MOBILE_GAME_HEIGHT, viewportHeight - hostTop - bottomReserve);
      setAutoSize({ width: availableWidth, height: Math.round(availableViewportHeight) });
    };

    updateSize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    ro?.observe(host);
    if (host.parentElement) ro?.observe(host.parentElement);
    window.addEventListener("resize", updateSize);
    window.visualViewport?.addEventListener("resize", updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateSize);
      window.visualViewport?.removeEventListener("resize", updateSize);
    };
  }, [state?.gameStatus]);

  const resolvedW = autoSize?.width ?? fallbackSizeRef.current.width;
  const resolvedH = autoSize?.height ?? fallbackSizeRef.current.height;

  return (
    <div
      ref={containerRef}
      className={["three-game-host", className].filter(Boolean).join(" ")}
      role="application"
      tabIndex={error ? -1 : 0}
      aria-keyshortcuts="Enter Space"
      aria-label={ariaLabel}
      aria-busy={!ready && !error}
      aria-disabled={!ready || !!error || undefined}
      data-ready={ready ? "true" : "false"}
      style={{
        display: "block",
        position: "relative",
        width: autoSize ? `${resolvedW}px` : "100%",
        height: `${resolvedH}px`,
        minHeight: autoSize ? `${MIN_MOBILE_GAME_HEIGHT}px` : `${fallbackSizeRef.current.height}px`,
        outline: "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onKeyDown={(event) => {
        // The error action lives inside this container. Let native child
        // controls handle their own keyboard events instead of bubbling a
        // Space press into an unintended in-game pick.
        if (event.target !== event.currentTarget || !ready || error) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        scene.activatePrimary?.();
      }}
    >
      <div
        ref={mountRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "auto" }}
      />
      {androidCanvasFallback && !error && (
        <AndroidCanvasFallback state={state} dispatch={dispatch} />
      )}
      {!ready && !error && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute", inset: 0, zIndex: 1, display: "grid", placeItems: "center",
            color: "rgba(12, 33, 46, 0.72)",
            font: "600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            pointerEvents: "none",
            background: "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(225,245,238,0.54))",
          }}
        >
          {loadingLabel}
        </div>
      )}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          style={{
            position: "absolute", inset: 0, zIndex: 1, display: "grid", alignContent: "center",
            justifyItems: "center", gap: 12, padding: 24, textAlign: "center", color: "#19313a",
            font: "500 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(231,247,241,0.82))",
            pointerEvents: "auto",
          }}
        >
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{errorLabel}</div>
            <div style={{ color: "rgba(25, 49, 58, 0.72)" }}>{error.message}</div>
          </div>
          <button
            type="button"
            onClick={() => (error.mode === "retry" ? window.location.reload() : setError(null))}
            style={{
              border: "1px solid rgba(22, 199, 132, 0.36)", borderRadius: 999, background: "#16c784",
              color: "#fff", cursor: "pointer", font: "700 13px/1 system-ui", minHeight: 44,
              padding: "0 18px", boxShadow: "0 10px 24px rgba(22, 199, 132, 0.18)",
            }}
          >
            {error.mode === "retry" ? retryLabel : continueLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default ThreeGameComponent;
