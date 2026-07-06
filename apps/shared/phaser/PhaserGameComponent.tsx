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
 * import { PhaserGameComponent } from "@shared/phaser/PhaserGameComponent";
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

import { useEffect, useRef, useId } from "react";
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
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const bridgeRef    = useRef<GameBridge>(new GameBridge());
  // Unique game ID for bridge registry — stable across re-renders
  const gameId       = useId();

  // Boot Phaser once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const bridge = bridgeRef.current;

    // Wire dispatch from React → bridge → scene
    bridge.setDispatch(dispatch);

    // Inject bridge so BaseScene can pick it up synchronously in create()
    window.__phaserBridge = bridge;

    const mergedConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "transparent",
      transparent: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width:  config.width  ?? 400,
        height: config.height ?? 560,
      },
      audio: { disableWebAudio: false },
      ...config,
    };

    gameRef.current = new Phaser.Game(mergedConfig);

    return () => {
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
      style={{
        display: "block",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        outline: "none",
        // Prevent default touch scroll while the game handles pointer events
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    />
  );
}

export default PhaserGameComponent;
