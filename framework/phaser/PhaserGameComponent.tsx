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
import Phaser from "phaser";
import { GameBridge } from "./GameBridge";
import type { PhaserGameProps } from "./types";

export function PhaserGameComponent({
  config,
  state,
  dispatch,
  width = "100%",
  height = 560,
  className,
  ariaLabel = "Interactive game",
  loadingLabel = "Loading game",
  onReady,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const bridgeRef    = useRef<GameBridge>(new GameBridge());
  const onReadyRef   = useRef(onReady);
  const [ready, setReady] = useState(false);
  // Unique game ID for bridge registry — stable across re-renders
  const gameId       = useId();

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Boot Phaser once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const bridge = bridgeRef.current;
    setReady(false);

    // Wire dispatch from React → bridge → scene
    bridge.setDispatch(dispatch);

    const unsubscribeReady = bridge.on("ready", () => {
      setReady(true);
      onReadyRef.current?.();
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

    gameRef.current = new Phaser.Game(mergedConfig);

    return () => {
      unsubscribeReady();
      bridge.destroy();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      // Clean up global bridge reference if it's ours
      if (window.__phaserBridge === bridge) {
        delete window.__phaserBridge;
      }
    };
  // Only run once — config and gameId are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Keep dispatch in the bridge in sync with latest closure
  useEffect(() => {
    bridgeRef.current.setDispatch(dispatch);
  }, [dispatch]);

  // Push state updates into the running scene whenever state changes
  useEffect(() => {
    if (!state) return;
    bridgeRef.current.sendState(state);
  }, [state]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label={ariaLabel}
      aria-busy={!ready}
      data-ready={ready ? "true" : "false"}
      style={{
        display: "block",
        position: "relative",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        outline: "none",
        overflow: "hidden",
        // Prevent default touch scroll while the game handles pointer events
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {!ready && (
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
    </div>
  );
}

export default PhaserGameComponent;
