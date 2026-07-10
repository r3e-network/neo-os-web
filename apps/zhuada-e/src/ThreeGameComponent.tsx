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

import { useEffect, useRef, useState } from "react";
import { GameBridge } from "@framework/phaser/GameBridge";
import type { DispatchFn, GameState } from "@framework/phaser/types";

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
  /** Tear down renderer + listeners. */
  unmount(): void;
}

const MOBILE_VIEWPORT_WIDTH = 760;
const COARSE_POINTER_VIEWPORT_WIDTH = 1024;
const MIN_MOBILE_GAME_WIDTH = 280;
const MIN_MOBILE_GAME_HEIGHT = 360;

export function ThreeGameComponent({
  scene,
  state,
  dispatch,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  errorLabel = "Game action failed",
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
  const fallbackSizeRef = useRef({ width: 400, height: 580 });
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
    mountedOkRef.current = false;
    try {
      scene.mount(mount, bridge);
      mountedOkRef.current = true;
    } catch (err) {
      setError({
        message: err instanceof Error && err.message ? err.message : errorLabel,
        mode: "retry",
      });
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

    return () => {
      sceneResizeObserver?.disconnect();
      unsubReady();
      unsubError();
      scene.unmount();
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
    bridgeRef.current.sendState(state);
    scene.setState?.(state);
  }, [state, scene]);

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
      const bottomReserve = viewportHeight < 620 ? 0 : 6;
      const availableViewportHeight = Math.max(MIN_MOBILE_GAME_HEIGHT, viewportHeight - hostTop - bottomReserve);
      const ratio = fallbackSizeRef.current.height / fallbackSizeRef.current.width;
      const aspectHeight = Math.max(MIN_MOBILE_GAME_HEIGHT, availableWidth * ratio);
      const availableHeight = Math.min(availableViewportHeight, aspectHeight);
      setAutoSize({ width: availableWidth, height: Math.round(availableHeight) });
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
  }, []);

  const resolvedW = autoSize?.width ?? fallbackSizeRef.current.width;
  const resolvedH = autoSize?.height ?? fallbackSizeRef.current.height;

  return (
    <div
      ref={containerRef}
      className={["three-game-host", className].filter(Boolean).join(" ")}
      role="application"
      aria-label={ariaLabel}
      aria-busy={!ready && !error}
      style={{
        display: "block",
        position: "relative",
        width: autoSize ? `${resolvedW}px` : "100%",
        height: `${resolvedH}px`,
        minHeight: `${fallbackSizeRef.current.height}px`,
        outline: "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={mountRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "auto" }}
      />
      {!ready && !error && (
        <div
          aria-hidden="true"
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
          role="status"
          aria-live="polite"
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
              color: "#fff", cursor: "pointer", font: "700 13px/1 system-ui", minHeight: 36,
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
