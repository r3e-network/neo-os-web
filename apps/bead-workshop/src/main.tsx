import { createObservable, defineMiniApp } from "@shared/react";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { BeadEngine } from "./logic/BeadEngine";
import {
  clearPersistedEngine,
  persistEngine,
  restoreEngine,
} from "./logic/storage";
import type { BeadSnapshot, EngineResult } from "./logic/types";

const APP_ID = "miniapp-bead-workshop";
const CLOCK_STEP_MS = 1_000;

function positionArgs(args: unknown[]): { row: number; col: number } | null {
  const first = args[0];
  if (first && typeof first === "object") {
    const value = first as { row?: unknown; col?: unknown };
    const row = Number(value.row);
    const col = Number(value.col);
    return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
  }
  const row = Number(args[0]);
  const col = Number(args[1]);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

defineMiniApp({
  appId: APP_ID,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    // This migration ships as a complete local game. Keep every wallet,
    // reward, oracle, and settlement lane closed until a real GameFi path is
    // deployed and verified end to end.
    app.mode.set("guest");
    const storage = app.storage.local;
    let engine = restoreEngine(storage) ?? BeadEngine.fresh();
    const game = createObservable<BeadSnapshot>(engine.snapshot());
    const storageHealthy = createObservable(true);
    let lastPersistAt = 0;

    const publish = (
      announce = true,
      shouldPersist = true,
      prepared?: BeadSnapshot,
    ): BeadSnapshot => {
      const snapshot = prepared ?? engine.snapshot();
      game.set(snapshot);
      if (shouldPersist) {
        const saved = persistEngine(storage, snapshot);
        storageHealthy.set(saved);
        lastPersistAt = snapshot.savedAt;
      }
      if (announce) {
        ctx.setStatus(
          ctx.t(snapshot.messageKey),
          snapshot.phase === "stuck" || snapshot.phase === "timeout"
            ? "error"
            : "info",
        );
      }
      return snapshot;
    };

    const apply = (action: () => EngineResult): EngineResult => {
      const result = action();
      publish(true);
      return result;
    };

    app.actions.register("tapBoard", (...args: unknown[]) => {
      const position = positionArgs(args);
      if (!position) return undefined;
      return apply(() => engine.tapBoard(position.row, position.col));
    });

    app.actions.register("tapHolding", (...args: unknown[]) => {
      const value =
        args[0] && typeof args[0] === "object"
          ? (args[0] as { index?: unknown }).index
          : args[0];
      const index = Number(value);
      if (!Number.isInteger(index)) return undefined;
      return apply(() => engine.tapHolding(index));
    });

    app.actions.register("moveSelectionToHolding", () =>
      apply(() => engine.moveSelectionToHolding()),
    );

    app.actions.register("togglePause", () =>
      apply(() => engine.togglePause()),
    );

    app.actions.register("undoMove", () => apply(() => engine.undo()));

    app.actions.register("restartGame", () => {
      clearPersistedEngine(storage);
      engine = BeadEngine.fresh(undefined, game.get().level + 1);
      return publish(true);
    });

    const tick = () => {
      const now = Date.now();
      if (!engine.tick(now)) return;
      const snapshot = engine.snapshot(now);
      const checkpointDue =
        now - lastPersistAt >= 5_000 || snapshot.phase !== "playing";
      publish(false, checkpointDue, snapshot);
    };
    const timer =
      typeof window === "undefined"
        ? null
        : window.setInterval(tick, CLOCK_STEP_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (engine.pauseForVisibility()) publish(false);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return {
      state: { game, storageHealthy },
      loadData: async () => {
        engine = restoreEngine(storage) ?? BeadEngine.fresh();
        const snapshot = publish(false);
        ctx.setStatus(ctx.t(snapshot.messageKey), "info");
      },
      cleanup: () => {
        if (timer !== null) window.clearInterval(timer);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
        publish(false);
      },
    };
  },
});
