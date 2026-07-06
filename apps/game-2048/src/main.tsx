/**
 * 2048 Rush — tile-cascade puzzle (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: tile-run management, move/undo recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, MAX_MOVES, statusOf, gasDisplay } from "./logic/game-rules";
import { applyMove } from "./logic/engine-2048";
import {
  applyStep,
  buildRun,
  forgetRun,
  persistRun,
  restoreRun,
  trimLastMove,
} from "./logic/run-store";
import type { LiveRun, TeeSpawn } from "./logic/run-store";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-game-2048";
const ENGINE_HASH = "2fd50277231865f3da3535d27ebd74ef14662ee7fb2a5e037badd43c968814bb";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-game-2048:ops:";

type TeeOp = { type: "move"; dir: number } | { type: "undo" };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    key:          rule.key,
    entryFixed8:  rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
    target:       rule.targetTile,
  })),
};

// 2048 Solved event: gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 4, solvedPayout: 5, totalWon: 6,
};

function parseSpawn(view: Record<string, unknown>): TeeSpawn | null {
  const raw = view.spawn as { pos?: unknown; exp?: unknown } | undefined;
  if (!raw || !Number.isInteger(Number(raw.pos)) || !Number.isInteger(Number(raw.exp))) return null;
  return { pos: Number(raw.pos), exp: Number(raw.exp) };
}

export type { LeaderEntry, SolveRow };

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // ── 2048-specific observables ─────────────────────────────────────────────
    const runBoard     = createObservable<number[]>([]);
    const runMoveCount = createObservable(0);
    const runMaxExp    = createObservable(0);
    const isMoving     = createObservable(false);

    let session: RewardGameSession | null = null;
    let run: LiveRun | null = null;

    // Run log persists via framework's namespaced local KV.
    const runStorage = app.storage.local;

    const publishRun = (): void => {
      runBoard.set(run ? [...run.board] : []);
      runMoveCount.set(run ? run.moves.length : 0);
      runMaxExp.set(run ? run.maxExp : 0);
    };

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const loadLeaderboard = async () => {
      const { ranked, mine } = await app.game.leaderboard.load<SolveRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      obs.myRank.set(ranked.find((e) => e.isUser)?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        const board = (session.view.board ?? []) as number[];
        run = restoreRun(runStorage, gameId, Array.isArray(board) && board.length === 16 ? board : []);
        publishRun();
        obs.commitment.set(session.commitment);
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        const board = (restored.view.board ?? []) as number[];
        run = restoreRun(runStorage, gameId, Array.isArray(board) && board.length === 16 ? board : []);
        publishRun();
        obs.commitment.set(restored.commitment);
      } catch {
        obs.lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp): Promise<{ ok: boolean; spawn: TeeSpawn | null; board: number[] }> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const { step } = await rewardGame.recordOp(session, op);
      const board    = (step.view.board ?? []) as number[];
      return { ok: step.view.ok !== false, spawn: parseSpawn(step.view), board: Array.isArray(board) ? board : [] };
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const form       = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        run = null;
        publishRun();
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const msg = error instanceof Error && "code" in error && error.code === "POOL_LOW"
          ? ctx.t("statusPoolLow")
          : error instanceof Error
            ? error.message
            : ctx.t("statusFailed");
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("playMove", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { dir?: unknown };
      const dir  = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      if (!run || !session || obs.gameStatus.get() !== "dealt" || isMoving.get()) return;
      if (run.moves.length >= MAX_MOVES) return;
      if (!applyMove([...run.board], dir)) return; // no-op move
      isMoving.set(true);
      try {
        const result = await sendOp({ type: "move", dir });
        if (!result.ok || !result.spawn) return;
        const next = applyStep(run, dir, result.spawn);
        if (!next) {
          if (result.board.length === 16 && run) {
            run = buildRun(result.board, [], []) ?? run;
            publishRun();
          }
          return;
        }
        run = next;
        persistRun(runStorage, obs.activeGameId.get(), run);
        publishRun();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        isMoving.set(false);
      }
    });

    app.actions.register("useUndo", async () => {
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isUndoing.get() || obs.gameStatus.get() !== "dealt") return;
      if (!run || run.moves.length === 0) return;
      obs.isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        run = trimLastMove(run);
        persistRun(runStorage, gameId, run);
        publishRun();
        const undos = obs.undosUsed.get() + 1;
        obs.undosUsed.set(undos);
        obs.lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(obs.lastStatus.get(), "info");
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        throw error;
      } finally {
        obs.isUndoing.set(false);
      }
    });

    app.actions.register("submitRun", async () => {
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.status === "unknown" ? "solved" : settled.status as "solved" | "expired");
        obs.activeGameId.set("0");
        forgetRun(runStorage, gameId);
        session = null;
        run = null;
        publishRun();
        if (settled.payoutGas > 0) {
          obs.lastStatus.set(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }));
          ctx.setStatus(obs.lastStatus.get(), "success");
        } else {
          obs.lastStatus.set(ctx.t("statusExpired"));
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return finalized.tx;
      } catch (error) {
        const msg = error instanceof Error ? error.message : ctx.t("statusFailed");
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("expireGame", async () => {
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      try {
        await rewardGame.expire(gameId);
        obs.gameStatus.set("expired");
        obs.activeGameId.set("0");
        forgetRun(runStorage, gameId);
        session = null;
        run = null;
        publishRun();
        obs.lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        throw error;
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        await rewardGame.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: { ...obs, runBoard, runMoveCount, runMaxExp, isMoving },
      loadData: async () => {
        await refreshBalances();
        const playerHash = app.game.player.scriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [app.chain.arg.hash160(playerHash)]),
              ) ?? "0",
            );
            if (active !== "0") {
              obs.activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(active)]);
              app.game.session.applySnapshot(obs, game, statusOf);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };
