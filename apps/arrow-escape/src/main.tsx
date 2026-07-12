import { createObservable, defineMiniApp } from "@shared/react";
import PhaserPlayArea from "./PhaserPlayArea";
import { messages } from "./locale/messages";
import { manifest } from "./manifest";
import {
  MAX_STRIKES,
  ROUND_DURATION_MS,
  applyArrowMove,
  createLocalSeed,
  createRun,
  generateLevel,
  pauseRun,
  remainingFor,
  restoreRun,
  resumeRun,
  settleRunClock,
  type ArrowRunSnapshot,
  type MoveResult,
} from "./logic/arrow-engine";

const appId = "miniapp-arrow-escape";

interface MoveEvent {
  nonce: number;
  arrowId: number;
  outcome: MoveResult["outcome"];
  blockers: number[];
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    // This release is intentionally guest-only. Force the framework guard on
    // even in standalone development so no chain/oracle/reward write lane can
    // accidentally become reachable through the default legacy mode.
    app.mode.set("guest");

    const now = Date.now();
    const seedSequence = app.state.persisted("seedSequence", 0);
    const persistedRun = app.state.persisted<ArrowRunSnapshot | null>("guestRun", null);
    const persistedBest = app.state.persisted("bestScore", 0);
    const initialRun: ArrowRunSnapshot = {
      ...createRun(createLocalSeed(now, seedSequence.get()), now),
      status: "paused",
      resumedAt: 0,
    };

    const run = createObservable<ArrowRunSnapshot>(initialRun);
    const level = createObservable(generateLevel(initialRun.seed));
    const remainingMs = createObservable(ROUND_DURATION_MS);
    const remainingCount = createObservable(level.get().arrows.length);
    const bestScore = createObservable(Math.max(0, Number(persistedBest.get()) || 0));
    const zoom = createObservable(1);
    const moveEvent = createObservable<MoveEvent | null>(null);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const restoredNotice = createObservable("");
    const mode = createObservable<"guest">("guest");
    const gameFiAvailable = createObservable(false);
    let moveNonce = 0;
    let ticker = 0;
    let visibilityBound = false;

    const publishRun = (next: ArrowRunSnapshot, persist = true) => {
      run.set(next);
      remainingMs.set(remainingFor(next));
      remainingCount.set(Math.max(0, level.get().arrows.length - next.removed.length));
      if (persist) persistedRun.set(next);
    };

    const publishMove = (arrowId: number, result: MoveResult) => {
      moveNonce += 1;
      moveEvent.set({
        nonce: moveNonce,
        arrowId,
        outcome: result.outcome,
        blockers: result.blockers,
      });
    };

    const startFreshRun = (seed: string, statusKey = "statusReady") => {
      const nextLevel = generateLevel(seed);
      const nextRun = createRun(nextLevel.seed);
      level.set(nextLevel);
      zoom.set(1);
      moveEvent.set(null);
      restoredNotice.set("");
      lastStatus.set(ctx.t(statusKey));
      publishRun(nextRun);
    };

    const submitGuestScore = async (score: number) => {
      const nextBest = Math.max(bestScore.get(), score);
      bestScore.set(nextBest);
      persistedBest.set(nextBest);
      try {
        await app.mode.guestLeaderboard.submit(score);
      } catch {
        // Local completion remains valid when the optional OS leaderboard is
        // unavailable. No fake online success state is surfaced.
      }
    };

    app.actions.register("tapArrow", async (value: unknown) => {
      const arrowId = Number(value);
      if (!Number.isSafeInteger(arrowId) || arrowId <= 0) return;
      const result = applyArrowMove(level.get(), run.get(), arrowId);
      publishRun(result.run);
      publishMove(arrowId, result);
      if (result.outcome === "blocked") {
        lastStatus.set(ctx.t("statusBlocked"));
      } else if (result.outcome === "lost") {
        lastStatus.set(ctx.t("statusLost"));
      } else if (result.outcome === "won") {
        lastStatus.set(ctx.t("statusWon"));
        await submitGuestScore(result.run.score);
      } else if (result.outcome === "escaped") {
        lastStatus.set(ctx.t("statusEscaped"));
      }
    });

    app.actions.register("enterGame", async () => {
      const current = run.get();
      if (current.status === "paused" && current.resumedAt === 0 && current.elapsedMs === 0) {
        const started = resumeRun(current);
        lastStatus.set(ctx.t("statusReady"));
        publishRun(started);
      }
    });

    app.actions.register("togglePause", async () => {
      const current = run.get();
      if (current.status === "playing") {
        const paused = pauseRun(current);
        lastStatus.set(ctx.t("statusPaused"));
        publishRun(paused);
      } else if (current.status === "paused") {
        const resumed = resumeRun(current);
        lastStatus.set(ctx.t("statusResumed"));
        publishRun(resumed);
      }
    });

    app.actions.register("restartGame", async () => {
      startFreshRun(run.get().seed, "statusRestarted");
    });

    app.actions.register("newGame", async () => {
      const nextSequence = Math.max(0, Number(seedSequence.get()) || 0) + 1;
      seedSequence.set(nextSequence);
      startFreshRun(createLocalSeed(Date.now(), nextSequence), "statusNewGarden");
    });

    app.actions.register("setZoom", async (value: unknown) => {
      const requested = Number(value);
      if (!Number.isFinite(requested)) return;
      zoom.set(Math.max(0.85, Math.min(1.55, Math.round(requested * 20) / 20)));
    });

    const tick = () => {
      const current = run.get();
      if (current.status !== "playing") return;
      const remaining = remainingFor(current);
      remainingMs.set(remaining);
      if (remaining > 0) return;
      const expired = settleRunClock(current);
      if (expired.status !== "lost") return;
      publishRun(expired);
      publishMove(0, { run: expired, outcome: "lost", blockers: [] });
      lastStatus.set(ctx.t("statusTimeUp"));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const current = run.get();
      if (current.status !== "playing") return;
      publishRun(pauseRun(current));
      lastStatus.set(ctx.t("statusBackgroundPaused"));
    };

    return {
      state: {
        run,
        level,
        remainingMs,
        remainingCount,
        bestScore,
        zoom,
        moveEvent,
        lastStatus,
        restoredNotice,
        mode,
        gameFiAvailable,
      },
      loadData: async () => {
        const restored = restoreRun(persistedRun.get());
        if (restored) {
          level.set(generateLevel(restored.seed));
          publishRun(restored);
          if (restored.removed.length > 0 && restored.status !== "won") {
            restoredNotice.set(ctx.t("restoreNotice"));
            lastStatus.set(ctx.t("statusRestored"));
          }
        } else {
          publishRun(initialRun);
          persistedRun.set(initialRun);
        }
        if (ticker) window.clearInterval(ticker);
        ticker = window.setInterval(tick, 250);
        if (!visibilityBound) {
          document.addEventListener("visibilitychange", onVisibilityChange);
          visibilityBound = true;
        }
      },
      cleanup: () => {
        if (ticker) window.clearInterval(ticker);
        if (visibilityBound) {
          document.removeEventListener("visibilitychange", onVisibilityChange);
          visibilityBound = false;
        }
        const current = run.get();
        if (current.status === "playing") persistedRun.set(pauseRun(current));
      },
    };
  },
});

export { MAX_STRIKES };
