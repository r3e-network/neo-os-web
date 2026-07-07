/**
 * PhaserGameComponent — React component that boots and hosts a Phaser 3 game.
 *
 * - Mounts a Phaser.Game inside a <div> container
 * - Injects the GameBridge so scenes can communicate with React
 * - Pushes state updates from the React/framework shell into the game
 * - Tears down the Phaser instance cleanly on unmount
 *
 * Usage in a game's PlayArea.tsx:
 *
 * ```tsx
 * import { PhaserGameComponent } from "@framework/phaser";
 * import { DiceScene } from "./scenes/DiceScene";
 *
 * export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
 *   const bridgeState = { ... }; // plain object from observables
 *   return (
 *     <PhaserGameComponent
 *       config={{ scene: [DiceScene], width: 400, height: 560 }}
 *       state={bridgeState}
 *       dispatch={dispatch}
 *     />
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useId, useState } from "react";
import * as Phaser from "phaser";
import { GameBridge } from "./GameBridge";
import type { PhaserGameProps } from "./types";

export function PhaserGameComponent({
  config,
  state,
  dispatch,
  width = "100%",
  height = 560,
  autoMobileSize = true,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  errorLabel = "Game action failed",
  retryLabel = "Retry",
  continueLabel = "Continue",
  onReady,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const bridgeRef    = useRef<GameBridge>(new GameBridge());
  const onReadyRef   = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const [error, setError] = useState<{
    message: string;
    mode: "dismiss" | "retry";
  } | null>(null);
  const [autoMobileHeight, setAutoMobileHeight] = useState<number | null>(null);
  // Unique game ID for bridge registry — stable across re-renders
  const gameId       = useId();

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Boot Phaser once on mount, and again only after an explicit retry.
  useEffect(() => {
    if (!containerRef.current) return;

    const bridge = bridgeRef.current;
    setReady(false);
    setError(null);

    // Wire dispatch from React → bridge → scene
    bridge.setDispatch(dispatch);

    const unsubscribeReady = bridge.on("ready", () => {
      setReady(true);
      onReadyRef.current?.();
    });
    const unsubscribeError = bridge.on("error", (event) => {
      setError({ message: event.message || errorLabel, mode: "dismiss" });
    });

    // Inject bridge so BaseScene can pick it up synchronously in create()
    window.__phaserBridge = bridge;

    const { scene, scale, ...restConfig } = config;
    const sceneConfig = Array.isArray(scene) ? [...scene] : scene;
    const mergedConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      ...restConfig,
      parent: containerRef.current,
      scene: sceneConfig as Phaser.Types.Core.GameConfig["scene"],
      backgroundColor: "transparent",
      transparent: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width:  config.width  ?? 400,
        height: config.height ?? 560,
        ...scale,
      },
      audio: { disableWebAudio: false },
    };

    try {
      gameRef.current = new Phaser.Game(mergedConfig);
    } catch (err) {
      setError({
        message: err instanceof Error && err.message ? err.message : errorLabel,
        mode: "retry",
      });
    }

    return () => {
      unsubscribeReady();
      unsubscribeError();
      bridge.destroy();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      // Clean up global bridge reference if it's ours
      if (window.__phaserBridge === bridge) {
        delete window.__phaserBridge;
      }
    };
  // Keep dispatch hot-swapped in the separate effect below so a parent render
  // does not tear down an active canvas mid-game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootKey, gameId]);

  // Keep dispatch in the bridge in sync with latest closure
  useEffect(() => {
    bridgeRef.current.setDispatch(dispatch);
  }, [dispatch]);

  // Push state updates into the running scene whenever state changes
  useEffect(() => {
    if (!state) return;
    bridgeRef.current.sendState(state);
  }, [state]);

  useEffect(() => {
    if (!autoMobileSize) {
      setAutoMobileHeight(null);
      return;
    }

    const host = containerRef.current;
    if (!host) return;

    let frame = 0;
    const updateSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        if (viewportWidth > 640) {
          setAutoMobileHeight(null);
          return;
        }

        const hostRect = host.getBoundingClientRect();
        const parentRect = host.parentElement?.getBoundingClientRect();
        const hostWidth = hostRect.width || parentRect?.width || window.innerWidth;
        const designWidth = numericDimension(config.width, 400);
        const designHeight = numericDimension(config.height, 560);
        const aspectHeight = hostWidth * (designHeight / designWidth);
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportTop = viewport?.offsetTop ?? 0;
        const hostTop = Math.max(0, hostRect.top - viewportTop);
        const bottomReserve = viewportHeight < 620 ? 8 : 12;
        const availableHeight = Math.max(320, viewportHeight - hostTop - bottomReserve);
        const nextHeight = Math.round(
          Math.max(320, Math.min(aspectHeight, availableHeight)),
        );

        setAutoMobileHeight((current) =>
          current === nextHeight ? current : nextHeight,
        );
      });
    };

    updateSize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    resizeObserver?.observe(host);
    if (host.parentElement) resizeObserver?.observe(host.parentElement);
    window.addEventListener("resize", updateSize);
    window.visualViewport?.addEventListener("resize", updateSize);
    window.visualViewport?.addEventListener("scroll", updateSize);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateSize);
      window.visualViewport?.removeEventListener("resize", updateSize);
      window.visualViewport?.removeEventListener("scroll", updateSize);
    };
  }, [autoMobileSize, config.height, config.width]);

  useEffect(() => {
    if (autoMobileHeight === null) return;
    const frame = requestAnimationFrame(() => {
      gameRef.current?.scale.refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoMobileHeight]);

  const resolvedHeight = autoMobileHeight ?? height;

  return (
    <div
      ref={containerRef}
      className={["phaser-game-host", className].filter(Boolean).join(" ")}
      role="application"
      aria-label={ariaLabel}
      aria-busy={!ready && !error}
      data-auto-mobile-size={autoMobileHeight !== null ? "true" : undefined}
      data-ready={ready ? "true" : "false"}
      data-error={error ? "true" : "false"}
      style={{
        display: "block",
        position: "relative",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof resolvedHeight === "number" ? `${resolvedHeight}px` : resolvedHeight,
        outline: "none",
        overflow: "hidden",
        // Prevent default touch scroll while the game handles pointer events
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {!ready && !error && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(12, 33, 46, 0.72)",
            font: "600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(225,245,238,0.54))",
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
            position: "absolute",
            inset: 0,
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            color: "#19313a",
            font: "500 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: 0,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(231,247,241,0.82))",
            pointerEvents: "auto",
          }}
        >
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{errorLabel}</div>
            <div style={{ color: "rgba(25, 49, 58, 0.72)" }}>{error.message}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (error.mode === "retry") setBootKey((key) => key + 1);
              else setError(null);
            }}
            style={{
              border: "1px solid rgba(22, 199, 132, 0.36)",
              borderRadius: 999,
              background: "#16c784",
              color: "#ffffff",
              cursor: "pointer",
              font: "700 13px/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              letterSpacing: 0,
              minHeight: 36,
              padding: "0 18px",
              boxShadow: "0 10px 24px rgba(22, 199, 132, 0.18)",
            }}
          >
            {error.mode === "retry" ? retryLabel : continueLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default PhaserGameComponent;

function numericDimension(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return fallback;
}
