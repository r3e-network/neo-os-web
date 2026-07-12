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
 *
 * `config.width`/`config.height` are the scene's logical coordinate system.
 * The displayed host size is framework-owned and fits the available mobile
 * viewport while preserving the configured game aspect ratio.
 */

import { useEffect, useRef, useId, useState, type CSSProperties } from "react";
import * as Phaser from "phaser";
import { Volume2, VolumeX } from "lucide-react";
import { GameBridge } from "./GameBridge";
import {
  SCENE_AUDIO_MUTE_EVENT,
  SCENE_AUDIO_MUTE_STORAGE_KEY,
  isSceneAudioMuted,
  setSceneAudioMuted,
} from "./SceneAudio";
import type { PhaserGameProps } from "./types";

type AutoMobileSize = {
  width: number;
  height: number;
};

const MOBILE_VIEWPORT_WIDTH = 760;
const COARSE_POINTER_VIEWPORT_WIDTH = 1024;
const MIN_MOBILE_GAME_WIDTH = 280;
const MIN_MOBILE_GAME_HEIGHT = 360;

export function PhaserGameComponent({
  config,
  state,
  dispatch,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  errorLabel = "Game action failed",
  retryLabel = "Retry",
  continueLabel = "Continue",
  enableSoundLabel = "Enable game sound",
  muteSoundLabel = "Mute game sound",
  preserveLogicalSize = false,
  onReady,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef     = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const bridgeRef    = useRef<GameBridge>(new GameBridge());
  const onReadyRef   = useRef(onReady);
  const autoSizeAppliedRef = useRef(false);
  const autoMobileSizeRef = useRef<AutoMobileSize | null>(null);
  const fallbackSizeRef = useRef({ width: 400, height: 560 });
  const sizeRefreshFrameRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const [error, setError] = useState<{
    message: string;
    mode: "dismiss" | "retry";
  } | null>(null);
  const [autoMobileSizePx, setAutoMobileSizePx] = useState<AutoMobileSize | null>(null);
  const [audioMuted, setAudioMuted] = useState(() => isSceneAudioMuted());
  // Unique game ID for bridge registry — stable across re-renders
  const gameId       = useId();
  const fallbackWidth = numericDimension(config.width, 400);
  const fallbackHeight = numericDimension(config.height, 560);
  const resolvedWidth = autoMobileSizePx?.width ?? fallbackWidth;
  const resolvedHeight = autoMobileSizePx?.height ?? fallbackHeight;
  const AudioIcon = audioMuted ? VolumeX : Volume2;

  autoMobileSizeRef.current = autoMobileSizePx;
  fallbackSizeRef.current = { width: fallbackWidth, height: fallbackHeight };

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const syncAudioMuted = () => setAudioMuted(isSceneAudioMuted());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SCENE_AUDIO_MUTE_STORAGE_KEY) syncAudioMuted();
    };

    window.addEventListener(SCENE_AUDIO_MUTE_EVENT, syncAudioMuted);
    window.addEventListener("storage", onStorage);
    syncAudioMuted();

    return () => {
      window.removeEventListener(SCENE_AUDIO_MUTE_EVENT, syncAudioMuted);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Boot Phaser once on mount, and again only after an explicit retry.
  useEffect(() => {
    if (!containerRef.current || !mountRef.current) return;

    const bridge = bridgeRef.current;
    const mount = mountRef.current;
    setReady(false);
    setError(null);
    mount.replaceChildren();

    // Wire dispatch from React → bridge → scene
    bridge.setDispatch(dispatch);

    const unsubscribeReady = bridge.on("ready", () => {
      setReady(true);
      scheduleGameSizeRefresh();
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
      parent: mount,
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
      cancelAnimationFrame(sizeRefreshFrameRef.current);
      unsubscribeReady();
      unsubscribeError();
      bridge.destroy();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      mount.replaceChildren();
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
    const host = containerRef.current;
    if (!host) return;

    let frame = 0;
    const updateSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const isCoarsePointer =
          window.matchMedia?.("(pointer: coarse)").matches ?? false;
        const isCompactViewport = viewportWidth <= MOBILE_VIEWPORT_WIDTH;
        const isCoarsePointerMobile =
          isCoarsePointer && viewportWidth <= COARSE_POINTER_VIEWPORT_WIDTH;
        const isMobileViewport =
          isCompactViewport || isCoarsePointerMobile;

        if (preserveLogicalSize || !isMobileViewport) {
          setAutoMobileSizePx(null);
          return;
        }

        const hostRect = host.getBoundingClientRect();
        const parentRect = host.parentElement?.getBoundingClientRect();
        const hostWidth = parentRect?.width || hostRect.width || window.innerWidth;
        const availableWidth = Math.round(
          Math.max(MIN_MOBILE_GAME_WIDTH, Math.min(hostWidth, viewportWidth)),
        );
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportTop = viewport?.offsetTop ?? 0;
        const hostTop = Math.max(0, hostRect.top - viewportTop);
        const computedStyle = window.getComputedStyle(host);
        const configuredBottomReserve = Number.parseFloat(
          computedStyle.getPropertyValue("--phaser-mobile-bottom-reserve"),
        );
        const bottomReserve =
          Number.isFinite(configuredBottomReserve) && configuredBottomReserve >= 0
            ? configuredBottomReserve
            : viewportHeight < 620
              ? 0
              : 6;
        const availableViewportHeight = Math.max(
          MIN_MOBILE_GAME_HEIGHT,
          viewportHeight - hostTop - bottomReserve,
        );
        const mobileHeightRatio = Number.parseFloat(
          computedStyle.getPropertyValue("--phaser-mobile-height-ratio"),
        );
        const heightRatio =
          Number.isFinite(mobileHeightRatio) && mobileHeightRatio > 0
            ? mobileHeightRatio
            : fallbackHeight / fallbackWidth;
        const aspectHeight = Math.max(
          MIN_MOBILE_GAME_HEIGHT,
          availableWidth * heightRatio,
        );
        const availableHeight = Math.min(availableViewportHeight, aspectHeight);
        const nextSize = {
          width:  availableWidth,
          height: Math.round(availableHeight),
        };

        setAutoMobileSizePx((current) =>
          current &&
          current.width === nextSize.width &&
          current.height === nextSize.height
            ? current
            : nextSize,
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
  }, [fallbackHeight, fallbackWidth, preserveLogicalSize]);

  useEffect(() => {
    scheduleGameSizeRefresh();
    return () => cancelAnimationFrame(sizeRefreshFrameRef.current);
  }, [autoMobileSizePx, fallbackHeight, fallbackWidth]);

  return (
    <div
      ref={containerRef}
      className={["phaser-game-host", className].filter(Boolean).join(" ")}
      role="application"
      aria-label={ariaLabel}
      aria-busy={!ready && !error}
      data-auto-mobile-size={autoMobileSizePx !== null ? "true" : undefined}
      data-ready={ready ? "true" : "false"}
      data-error={error ? "true" : "false"}
      style={{
        display: "block",
        position: "relative",
        width: typeof resolvedWidth === "number" ? `${resolvedWidth}px` : resolvedWidth,
        height: typeof resolvedHeight === "number" ? `${resolvedHeight}px` : resolvedHeight,
        maxWidth: autoMobileSizePx ? undefined : "100%",
        minHeight: autoMobileSizePx ? undefined : `${fallbackHeight}px`,
        outline: "none",
        overflow: "hidden",
        // Prevent default touch scroll while the game handles pointer events
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={mountRef}
        className="phaser-game-mount"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      />
      <button
        type="button"
        aria-label={audioMuted ? enableSoundLabel : muteSoundLabel}
        aria-pressed={!audioMuted}
        title={audioMuted ? enableSoundLabel : muteSoundLabel}
        data-phaser-audio-muted={audioMuted ? "true" : "false"}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const nextMuted = !audioMuted;
          setAudioMuted(nextMuted);
          setSceneAudioMuted(nextMuted);
        }}
        style={AUDIO_TOGGLE_BUTTON_STYLE}
      >
        <AudioIcon aria-hidden="true" size={18} strokeWidth={2.2} />
      </button>
      {!ready && !error && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
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
            zIndex: 1,
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

  function scheduleGameSizeRefresh(): void {
    cancelAnimationFrame(sizeRefreshFrameRef.current);
    sizeRefreshFrameRef.current = requestAnimationFrame(() => {
      const mobileSize = autoMobileSizeRef.current;
      const fallbackSize = fallbackSizeRef.current;

      if (mobileSize) {
        autoSizeAppliedRef.current = true;
        gameRef.current?.scale.setGameSize(mobileSize.width, mobileSize.height);
      } else if (autoSizeAppliedRef.current) {
        autoSizeAppliedRef.current = false;
        gameRef.current?.scale.setGameSize(fallbackSize.width, fallbackSize.height);
      }
      gameRef.current?.scale.refresh();
    });
  }
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

const AUDIO_TOGGLE_BUTTON_STYLE: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 2,
  width: 34,
  height: 34,
  display: "inline-grid",
  placeItems: "center",
  border: "1px solid rgba(132, 105, 54, 0.2)",
  borderRadius: 999,
  background: "rgba(255, 253, 248, 0.88)",
  color: "#183a34",
  boxShadow: "0 8px 18px rgba(31, 41, 55, 0.12)",
  cursor: "pointer",
  padding: 0,
  pointerEvents: "auto",
  touchAction: "manipulation",
};
