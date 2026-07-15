import { createObservable, defineMiniApp } from "@shared/react";

import PhaserPlayArea from "./PhaserPlayArea";
import { messages } from "./locale/messages";
import { SuikaEngine } from "./logic/suika-engine";
import type { SuikaSnapshot } from "./logic/suika-engine";
import {
  clearSuikaRun,
  persistSuikaRun,
  restoreSuikaEngine,
} from "./logic/storage";
import { manifest } from "./manifest";

const APP_ID = "miniapp-fruit-funnel";
const STORAGE_CHECKPOINT_MS = 5_000;
const AIM_STEP = 20;
const AIM_MIN = 34;
const AIM_MAX = 356;

function numArg(args: unknown[], index: number): number | null {
  const value = args[index];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

defineMiniApp({
  appId: APP_ID,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    // Local-only: keep wallet/settlement/oracle surfaces closed until a real
    // contract path is deployed and verified end to end.
    app.mode.set("guest");
    const storage = app.storage.local;

    // A run only exists once the player is actually standing on the play
    // surface. Building one during setup() would checkpoint an untouched
    // in-flight run to storage while the launch page was still up, so the
    // first real entry would restore it through SuikaEngine.restore's
    // crash-recovery lane (playing→paused) and open on the "Paused" modal
    // before a single fruit had been dropped. No entry, no run.
    let engine: SuikaEngine | null = null;
    let entered = false;
    const game = createObservable<SuikaSnapshot | null>(null);
    const aimX = createObservable<number>((390) / 2);
    const storageHealthy = createObservable(true);
    let lastPersistAt = 0;

    const publish = (
      announce = true,
      shouldPersist = true,
      prepared?: SuikaSnapshot,
    ): SuikaSnapshot | null => {
      if (!engine) return null;
      const snapshot = prepared ?? engine.snapshot();
      game.set(snapshot);
      if (shouldPersist && snapshot.phase !== "gameover") {
        storageHealthy.set(persistSuikaRun(storage, snapshot));
        lastPersistAt = snapshot.savedAt;
      }
      if (announce) {
        const tone = snapshot.phase === "gameover" ? "error" : "info";
        ctx.setStatus(ctx.t(snapshot.messageKey), tone);
      }
      return snapshot;
    };

    /**
     * Deal the run. Idempotent, so whichever of loadData()/`enterPlay` lands
     * first after the launcher hand-off wins and the other is a no-op.
     *
     * A snapshot found in storage here is a genuinely interrupted run (the
     * player entered, dropped fruit, and the tab went away), so the restore
     * path's playing→paused recovery is honest and the resume modal is earned.
     */
    const ensureRun = (): SuikaSnapshot | null => {
      if (!entered || engine) return game.get();
      engine = restoreSuikaEngine(storage)
        ?? SuikaEngine.fresh(undefined, readBest(storage));
      aimX.set(390 / 2);
      return publish(true);
    };

    const apply = (action: (live: SuikaEngine) => SuikaSnapshot): SuikaSnapshot | null => {
      const live = engine;
      if (!live) return null;
      const snapshot = action(live);
      publish(true);
      return snapshot;
    };

    app.actions.register("enterPlay", () => {
      entered = true;
      ensureRun();
      return undefined;
    });

    app.actions.register("dropCurrent", (...args: unknown[]) => {
      if (engine?.snapshot().phase !== "playing") return undefined;
      const x = numArg(args, 0);
      const y = numArg(args, 1);
      if (x === null || y === null) return undefined;
      return apply((live) => {
        const level = live.snapshot().currentLevel;
        return live.dropFruit(level, x, y).snapshot;
      });
    });

    app.actions.register("mergeFruits", (...args: unknown[]) => {
      const idA = args[0];
      const idB = args[1];
      const newLevel = numArg(args, 2);
      const x = numArg(args, 3);
      const y = numArg(args, 4);
      if (
        typeof idA !== "string" || typeof idB !== "string"
        || newLevel === null || x === null || y === null
      ) return undefined;
      return apply((live) => live.mergeFruits(idA, idB, newLevel, x, y).snapshot);
    });

    app.actions.register("setGameOver", () => apply((live) => live.setGameOver()));

    app.actions.register("syncBoard", (...args: unknown[]) => {
      if (!engine) return undefined;
      const positions = Array.isArray(args[0])
        ? (args[0] as Array<{ id: string; x: number; y: number }>)
          .filter((entry) => entry && typeof entry.id === "string"
            && Number.isFinite(entry.x) && Number.isFinite(entry.y))
        : [];
      if (positions.length === 0) return undefined;
      engine.syncBoard(positions);
      const now = Date.now();
      const checkpointDue = now - lastPersistAt >= STORAGE_CHECKPOINT_MS;
      const snapshot = engine.snapshot(now);
      game.set(snapshot);
      if (checkpointDue) {
        storageHealthy.set(persistSuikaRun(storage, snapshot));
        lastPersistAt = snapshot.savedAt;
      }
      return undefined;
    });

    app.actions.register("setAim", (...args: unknown[]) => {
      const x = numArg(args, 0);
      if (x === null) return undefined;
      aimX.set(Math.max(AIM_MIN, Math.min(AIM_MAX, x)));
      if (engine) game.set(engine.snapshot());
      return undefined;
    });

    app.actions.register("nudgeAim", (...args: unknown[]) => {
      const dir = numArg(args, 0);
      if (dir === null) return undefined;
      aimX.set(Math.max(AIM_MIN, Math.min(AIM_MAX, aimX.get() + dir * AIM_STEP)));
      if (engine) game.set(engine.snapshot());
      return undefined;
    });

    app.actions.register("togglePause", () => apply((live) => live.togglePause()));

    app.actions.register("restartGame", () => {
      clearSuikaRun(storage);
      const currentBest = engine?.getBest() ?? readBest(storage);
      engine = SuikaEngine.fresh(undefined, currentBest);
      aimX.set(390 / 2);
      return publish(true);
    });

    const onVisibilityChange = () => {
      if (!engine) return;
      if (document.visibilityState !== "hidden") return;
      if (engine.snapshot().phase === "playing") {
        engine.togglePause();
        publish(false);
      }
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);

    return {
      state: { game, aimX, storageHealthy },
      loadData: async () => {
        const snapshot = ensureRun();
        // Pre-entry there is no run to describe — the launch page's status
        // chip stays on the inviting "drop fruit to begin" zero-state.
        ctx.setStatus(ctx.t(snapshot?.messageKey ?? "statusReady"), "info");
      },
      cleanup: () => {
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
        publish(false);
      },
    };
  },
});

function readBest(storage: { get<T>(key: string, fallback?: T | null): T | null }): number {
  const raw = storage.get<number>("suika:best", 0);
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
}
