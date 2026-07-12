import { createObservable, defineMiniApp } from "@shared/react";

import PhaserPlayArea from "./PhaserPlayArea";
import { messages } from "./locale/messages";
import { FruitFunnelEngine, findSafeFruitHint } from "./logic/fruit-engine";
import type { FruitMoveResult, FruitSnapshot } from "./logic/fruit-engine";
import { clearFruitRun, persistFruitRun, restoreFruitEngine } from "./logic/storage";
import { manifest } from "./manifest";

const APP_ID = "miniapp-fruit-funnel";
const STORAGE_CHECKPOINT_MS = 5_000;

function laneArg(args: unknown[]): number | null {
  const value = args[0] && typeof args[0] === "object"
    ? (args[0] as { lane?: unknown }).lane
    : args[0];
  const lane = Number(value);
  return Number.isInteger(lane) ? lane : null;
}

defineMiniApp({
  appId: APP_ID,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    // This migration is deliberately local-only. Keep wallet, settlement,
    // oracle, reward and chain surfaces closed until a real contract path is
    // deployed and verified end to end.
    app.mode.set("guest");
    const storage = app.storage.local;
    let engine = restoreFruitEngine(storage) ?? FruitFunnelEngine.fresh();
    const game = createObservable<FruitSnapshot>(engine.snapshot());
    const hintLanes = createObservable<number[]>([]);
    const hintMessageKey = createObservable<string | null>(null);
    const storageHealthy = createObservable(true);
    let lastPersistAt = 0;

    const publish = (
      announce = true,
      shouldPersist = true,
      prepared?: FruitSnapshot,
    ): FruitSnapshot => {
      const snapshot = prepared ?? engine.snapshot();
      game.set(snapshot);
      if (shouldPersist) {
        storageHealthy.set(persistFruitRun(storage, snapshot));
        lastPersistAt = snapshot.savedAt;
      }
      if (announce) {
        const tone = snapshot.phase === "lost" || snapshot.phase === "timeout" ? "error" : "info";
        ctx.setStatus(ctx.t(snapshot.messageKey), tone);
      }
      return snapshot;
    };

    const apply = (action: () => FruitMoveResult): FruitMoveResult => {
      hintLanes.set([]);
      hintMessageKey.set(null);
      const result = action();
      publish(true);
      return result;
    };

    app.actions.register("tapLane", (...args: unknown[]) => {
      const lane = laneArg(args);
      if (lane === null) return undefined;
      return apply(() => engine.tapLane(lane));
    });

    app.actions.register("undoMove", () => apply(() => engine.undo()));
    app.actions.register("togglePause", () => apply(() => engine.togglePause()));
    app.actions.register("tickClock", () => {
      const now = Date.now();
      if (!engine.tick(now)) return;
      const snapshot = engine.snapshot(now);
      const checkpointDue = now - lastPersistAt >= STORAGE_CHECKPOINT_MS
        || snapshot.phase !== "playing";
      publish(false, checkpointDue, snapshot);
    });
    app.actions.register("requestHint", () => {
      const snapshot = engine.snapshot();
      const hint = findSafeFruitHint(snapshot);
      hintLanes.set(hint);
      const messageKey = hint.length > 0
        ? "statusHintReady"
        : snapshot.history.length > 0
          ? "statusHintUndo"
          : "statusHintRestart";
      hintMessageKey.set(messageKey);
      ctx.setStatus(ctx.t(messageKey), "info");
      return hint;
    });
    app.actions.register("restartGame", () => {
      clearFruitRun(storage);
      engine = FruitFunnelEngine.fresh(undefined, game.get().level + 1);
      hintLanes.set([]);
      hintMessageKey.set(null);
      return publish(true);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (engine.pauseForVisibility()) publish(false);
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);

    return {
      state: { game, hintLanes, hintMessageKey, storageHealthy },
      loadData: async () => {
        engine = restoreFruitEngine(storage) ?? FruitFunnelEngine.fresh();
        hintLanes.set([]);
        hintMessageKey.set(null);
        const snapshot = publish(false);
        ctx.setStatus(ctx.t(snapshot.messageKey), "info");
      },
      cleanup: () => {
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
        publish(false);
      },
    };
  },
});
