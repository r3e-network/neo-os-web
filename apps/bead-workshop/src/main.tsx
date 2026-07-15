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

    // A round only exists once the player is actually standing on the play
    // surface. Building one during setup() would run the studio clock — and
    // checkpoint it to storage — while the launch page is still up, so the
    // first real entry would restore that untouched in-flight round through
    // the crash-recovery lane and open on "Workshop paused / Recovered
    // safely" before the player had made a single move. No entry, no round.
    let engine: BeadEngine | null = null;
    let entered = false;
    let timer: number | null = null;
    const game = createObservable<BeadSnapshot | null>(null);
    const storageHealthy = createObservable(true);
    let lastPersistAt = 0;

    const publish = (
      announce = true,
      shouldPersist = true,
      prepared?: BeadSnapshot,
    ): BeadSnapshot | null => {
      if (!engine) return null;
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

    const tick = () => {
      if (!engine) return;
      const now = Date.now();
      if (!engine.tick(now)) return;
      const snapshot = engine.snapshot(now);
      const checkpointDue =
        now - lastPersistAt >= 5_000 || snapshot.phase !== "playing";
      publish(false, checkpointDue, snapshot);
    };

    const startClock = () => {
      if (timer !== null || typeof window === "undefined") return;
      timer = window.setInterval(tick, CLOCK_STEP_MS);
    };

    /**
     * Deal the round. Idempotent, so whichever of loadData()/`enterPlay`
     * lands first after the hand-off wins and the other is a no-op — there is
     * no window where two rounds race for the same storage slot.
     *
     * A snapshot found in storage here is a genuinely interrupted round (the
     * player entered, played, and the tab went away), so BeadEngine.restore's
     * playing→paused recovery is the honest answer and the resume modal is
     * earned.
     */
    const ensureRound = (): BeadSnapshot | null => {
      if (!entered || engine) return game.get();
      engine = restoreEngine(storage) ?? BeadEngine.fresh();
      startClock();
      return publish(true);
    };

    const apply = (action: (live: BeadEngine) => EngineResult): EngineResult => {
      const live = engine;
      if (!live) return { ok: false, action: "blocked", messageKey: "statusReady" };
      const result = action(live);
      publish(true);
      return result;
    };

    app.actions.register("enterPlay", () => {
      entered = true;
      ensureRound();
      return undefined;
    });

    app.actions.register("tapBoard", (...args: unknown[]) => {
      const position = positionArgs(args);
      if (!position) return undefined;
      return apply((live) => live.tapBoard(position.row, position.col));
    });

    app.actions.register("tapHolding", (...args: unknown[]) => {
      const value =
        args[0] && typeof args[0] === "object"
          ? (args[0] as { index?: unknown }).index
          : args[0];
      const index = Number(value);
      if (!Number.isInteger(index)) return undefined;
      return apply((live) => live.tapHolding(index));
    });

    app.actions.register("moveSelectionToHolding", () =>
      apply((live) => live.moveSelectionToHolding()),
    );

    app.actions.register("togglePause", () =>
      apply((live) => live.togglePause()),
    );

    app.actions.register("undoMove", () => apply((live) => live.undo()));

    app.actions.register("restartGame", () => {
      clearPersistedEngine(storage);
      engine = BeadEngine.fresh(undefined, (game.get()?.level ?? 0) + 1);
      startClock();
      return publish(true);
    });

    const onVisibilityChange = () => {
      if (!engine) return;
      if (document.visibilityState !== "hidden") return;
      if (engine.pauseForVisibility()) publish(false);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return {
      state: { game, storageHealthy },
      loadData: async () => {
        const snapshot = ensureRound();
        // Pre-entry there is no round to describe — the launch page's status
        // chip stays on the inviting "pick a patch to begin" zero-state.
        ctx.setStatus(ctx.t(snapshot?.messageKey ?? "statusReady"), "info");
      },
      cleanup: () => {
        if (timer !== null && typeof window !== "undefined") {
          window.clearInterval(timer);
          timer = null;
        }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
        publish(false);
      },
    };
  },
});
