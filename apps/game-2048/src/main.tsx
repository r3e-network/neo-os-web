import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
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
import {
  createLocalStorageRewardGameStorage,
  eventHashMatches as addrEq,
  expireRewardGame,
  finalizeRewardGame,
  mapField,
  normalizedHash as normHash,
  openRewardGameSession,
  recordRewardGameOp,
  refreshRewardGameBalances,
  startRewardGame,
  withdrawRewardCredit,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";

const appId = "miniapp-game-2048";
// Operator-whitelisted engine pin (sha-256 of the reviewed 2048 engine wrapper).
const ENGINE_HASH = "2fd50277231865f3da3535d27ebd74ef14662ee7fb2a5e037badd43c968814bb";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-game-2048:ops:";

type TeeOp = { type: "move"; dir: number } | { type: "undo" };

const rewardGameConfig: RewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id: rule.difficulty,
    key: rule.key,
    entryFixed8: rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs: rule.limitMs,
    minSolveMs: rule.minSolveMs,
    target: rule.targetTile,
  })),
};

const opStorage = createLocalStorageRewardGameStorage<TeeOp>(OPS_STORAGE_PREFIX);

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

/** Read the enclave step view's spawn field into a typed spawn, or null. */
function parseSpawn(view: Record<string, unknown>): TeeSpawn | null {
  const raw = view.spawn as { pos?: unknown; exp?: unknown } | undefined;
  if (!raw || !Number.isInteger(Number(raw.pos)) || !Number.isInteger(Number(raw.exp))) {
    return null;
  }
  return { pos: Number(raw.pos), exp: Number(raw.exp) };
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface SolveRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const runBoard = createObservable<number[]>([]);
    const runMoveCount = createObservable(0);
    const runMaxExp = createObservable(0);
    const isMoving = createObservable(false);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const lastStatus = createObservable(ctx.t("statusReady"));

    // Enclave session context + live run for the active game. Both rebuild
    // deterministically; the run folds the persisted move/spawn history.
    let session: RewardGameSession | null = null;
    let run: LiveRun | null = null;

    const publishRun = (): void => {
      runBoard.set(run ? [...run.board] : []);
      runMoveCount.set(run ? run.moves.length : 0);
      runMaxExp.set(run ? run.maxExp : 0);
    };

    const playerScriptHash = (): string => {
      const player = ctx.services.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const refreshBalances = async (): Promise<void> => {
      try {
        const balances = await refreshRewardGameBalances(
          rewardGameConfig,
          ctx.services.chain,
          playerScriptHash(),
        );
        poolFree.set(balances.poolFreeGas);
        credit.set(balances.creditGas);
      } catch {
        /* keep the previous values — reads are best-effort */
      }
    };

    const refreshStats = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const stats = await app.chain.readRaw("statsOf", [
          app.chain.arg.hash160(playerHash),
        ]);
        mySolves.set(asNumber(mapField(stats, "solved")));
        myTotalWon.set(fromFixed8(parseBigInt(mapField(stats, "totalWon"))));
      } catch {
        /* stats stay stale */
      }
    };

    /**
     * Rebuild the global ranking from Solved events. The event's totalWon slot
     * carries the player's CUMULATIVE winnings at solve time, so taking the
     * MAX per player is order-independent (robust to indexer sort direction).
     */
    const loadLeaderboard = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      try {
        const events = await app.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves: (prior?.solves ?? 0) + 1,
            raw: eventStateValue(ev, 1),
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              elapsedMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
            });
          }
        }
        const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
          .map(([address, entry]) => ({
            address,
            totalWon: entry.totalWon,
            solves: entry.solves,
            isUser: playerHash ? addrEq(entry.raw, playerHash) : false,
          }))
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the run stays playable without rankings */
      }
    };

    const applyGameSnapshot = (game: unknown): void => {
      const status = statusOf(asNumber(mapField(game, "status")));
      gameStatus.set(status);
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave generates the spawn stream (never revealed ahead of play) and
     * returns the initial board + commitment. No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        session = await openRewardGameSession(rewardGameConfig, ctx.services.chain, gameId, difficulty);
        const board = (session.view.board ?? []) as number[];
        run = restoreRun(gameId, Array.isArray(board) && board.length === 16 ? board : []);
        publishRun();
        commitment.set(session.commitment);
        const game = await app.chain.readRaw("getGame", [
          app.chain.arg.integer(gameId),
        ]);
        dealtAt.set(asNumber(mapField(game, "dealtAt")));
        deadline.set(asNumber(mapField(game, "deadline")));
        gameStatus.set("dealt");
        undosUsed.set(0);
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to an active game after a reload: same identity, same stream. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await openRewardGameSession(rewardGameConfig, ctx.services.chain, gameId, difficulty);
        if (commitment.get() && restored.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        const board = (restored.view.board ?? []) as number[];
        run = restoreRun(gameId, Array.isArray(board) && board.length === 16 ? board : []);
        publishRun();
        commitment.set(restored.commitment);
      } catch {
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp): Promise<{ ok: boolean; spawn: TeeSpawn | null; board: number[] }> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const { step } = await recordRewardGameOp(session, opStorage, op);
      const board = (step.view.board ?? []) as number[];
      return {
        ok: step.view.ok !== false,
        spawn: parseSpawn(step.view),
        board: Array.isArray(board) ? board : [],
      };
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(
          rewardGameConfig,
          ctx.services.chain,
          difficulty,
          opStorage,
        );
        const gameId = started.gameId;
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
        run = null;
        publishRun();
        gameStatus.set("committed");
        lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const message =
          error instanceof Error && "code" in error && error.code === "POOL_LOW"
            ? ctx.t("statusPoolLow")
            : error instanceof Error
              ? error.message
              : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isStarting.set(false);
      }
    });

    ctx.framework.actions.register("retryDeal", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await openSession(gameId, gameDifficulty.get());
    });

    // One committed move: local slide for instant UX, spawn from the enclave.
    ctx.framework.actions.register("playMove", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { dir?: unknown };
      const dir = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      if (!run || !session || gameStatus.get() !== "dealt" || isMoving.get()) return;
      if (run.moves.length >= MAX_MOVES) return;
      if (!applyMove([...run.board], dir)) return; // no-op move — nothing to commit
      isMoving.set(true);
      try {
        const result = await sendOp({ type: "move", dir });
        if (!result.ok || !result.spawn) return;
        const next = applyStep(run, dir, result.spawn);
        if (!next) {
          // Local fold and enclave disagree — resync from the enclave's board.
          if (result.board.length === 16 && run) {
            run = buildRun(result.board, [], []) ?? run;
            publishRun();
          }
          return;
        }
        run = next;
        persistRun(activeGameId.get(), run);
        publishRun();
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
      } finally {
        isMoving.set(false);
      }
    });

    // Paid undo: recorded in the enclave session (no transaction). The penalty
    // lands at settlement — the kernel replays the undo count into the payout.
    ctx.framework.actions.register("useUndo", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      if (!run || run.moves.length === 0) return;
      isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        run = trimLastMove(run);
        persistRun(gameId, run);
        publishRun();
        const undos = undosUsed.get() + 1;
        undosUsed.set(undos);
        lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(lastStatus.get(), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isUndoing.set(false);
      }
    });

    ctx.framework.actions.register("submitRun", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(
          rewardGameConfig,
          ctx.services.chain,
          session,
          opStorage,
        );
        const settled = finalized.settlement;
        lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(settled.elapsedMs);
        gameStatus.set(settled.status === "unknown" ? "solved" : settled.status);
        activeGameId.set("0");
        forgetRun(gameId);
        session = null;
        run = null;
        publishRun();
        if (settled.payoutGas > 0) {
          lastStatus.set(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }));
          ctx.setStatus(lastStatus.get(), "success");
        } else {
          lastStatus.set(ctx.t("statusExpired"));
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return finalized.tx;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    ctx.framework.actions.register("expireGame", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      try {
        await expireRewardGame(rewardGameConfig, ctx.services.chain, gameId, opStorage);
        gameStatus.set("expired");
        activeGameId.set("0");
        forgetRun(gameId);
        session = null;
        run = null;
        publishRun();
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.services.notify.guard(async () => {
        await withdrawRewardCredit(
          rewardGameConfig,
          ctx.services.chain,
          app.amount.gasToFixed8(credit.get()),
        );
        await refreshBalances();
      }, "creditWithdrawn");
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        commitment,
        dealtAt,
        deadline,
        undosUsed,
        runBoard,
        runMoveCount,
        runMaxExp,
        isMoving,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        lastStatus,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [
                  app.chain.arg.hash160(playerHash),
                ]),
              ) ?? "0",
            );
            if (active !== "0") {
              activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [
                app.chain.arg.integer(active),
              ]);
              applyGameSnapshot(game);
              if (gameStatus.get() === "dealt") {
                await resumeSession(active, gameDifficulty.get());
              } else if (gameStatus.get() === "committed") {
                void openSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
    };
  },
});

export { gasDisplay };
