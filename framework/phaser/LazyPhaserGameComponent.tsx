/**
 * Lightweight React host that defers the Phaser runtime and the app scene
 * until the game surface is actually mounted.
 *
 * Miniapp shells can render their title, mode and recovery chrome immediately
 * instead of making mobile users download ~400 kB gzip of Phaser before the
 * first useful paint. The normal PhaserGameComponent still owns the bridge,
 * sizing, audio and runtime error handling after the deferred modules arrive.
 */
import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import type Phaser from "phaser";
import type { PhaserGameConfig, PhaserGameProps } from "./types";

export type PhaserSceneLoader = () => Promise<Phaser.Types.Scenes.SceneType>;

export interface LazyPhaserGameProps
  extends Omit<PhaserGameProps, "config"> {
  /** Game config without the scene, which is supplied by loadScene. */
  config: Omit<PhaserGameConfig, "scene">;
  /** Dynamic import that resolves to the game's root Scene class. */
  loadScene: PhaserSceneLoader;
}

type LoadedRuntime = {
  Component: ComponentType<PhaserGameProps>;
  Scene: Phaser.Types.Scenes.SceneType;
};

export function LazyPhaserGameComponent({
  config,
  loadScene,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  errorLabel = "Game failed to load",
  retryLabel = "Retry",
  ...runtimeProps
}: LazyPhaserGameProps) {
  const [runtime, setRuntime] = useState<LoadedRuntime | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setRuntime(null);
    setLoadError("");

    void Promise.all([
      import("./PhaserGameComponent").then((module) => module.PhaserGameComponent),
      loadScene(),
    ])
      .then(([Component, Scene]) => {
        if (active) setRuntime({ Component, Scene });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error && error.message ? error.message : errorLabel,
        );
      });

    return () => {
      active = false;
    };
  }, [attempt, errorLabel, loadScene]);

  if (runtime) {
    const RuntimeComponent = runtime.Component;
    return (
      <RuntimeComponent
        {...runtimeProps}
        config={{ ...config, scene: [runtime.Scene] }}
        className={className}
        ariaLabel={ariaLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        retryLabel={retryLabel}
      />
    );
  }

  return (
    <div
      className={["phaser-game-host", className].filter(Boolean).join(" ")}
      role="application"
      aria-label={ariaLabel}
      aria-busy={!loadError}
      data-runtime-loading={!loadError ? "true" : undefined}
      data-runtime-error={loadError ? "true" : undefined}
      style={fallbackHostStyle(config)}
    >
      <div role={loadError ? "alert" : "status"} aria-live="polite" style={FALLBACK_PANEL_STYLE}>
        {loadError ? (
          <>
            <strong>{errorLabel}</strong>
            <span style={FALLBACK_DETAIL_STYLE}>{loadError}</span>
            <button
              type="button"
              style={RETRY_BUTTON_STYLE}
              onClick={() => setAttempt((current) => current + 1)}
            >
              {retryLabel}
            </button>
          </>
        ) : (
          <span>{loadingLabel}</span>
        )}
      </div>
    </div>
  );
}

export default LazyPhaserGameComponent;

function fallbackHostStyle(
  config: Omit<PhaserGameConfig, "scene">,
): CSSProperties {
  const width = positiveDimension(config.width, 400);
  const height = positiveDimension(config.height, 560);
  return {
    display: "block",
    position: "relative",
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: "100%",
    minHeight: `${height}px`,
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
}

function positiveDimension(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

const FALLBACK_PANEL_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 10,
  padding: 24,
  textAlign: "center",
  color: "#19313a",
  font: "600 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(225,245,238,0.72))",
};

const FALLBACK_DETAIL_STYLE: CSSProperties = {
  maxWidth: 280,
  color: "rgba(25, 49, 58, 0.72)",
  fontWeight: 500,
};

const RETRY_BUTTON_STYLE: CSSProperties = {
  border: "1px solid rgba(22, 199, 132, 0.36)",
  borderRadius: 999,
  background: "#16c784",
  color: "#ffffff",
  cursor: "pointer",
  font: "700 13px/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  minHeight: 36,
  padding: "0 18px",
  boxShadow: "0 10px 24px rgba(22, 199, 132, 0.18)",
};
